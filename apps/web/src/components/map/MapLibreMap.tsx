'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useTheme } from 'next-themes';
import Map, { Marker, NavigationControl, MapRef, Popup } from 'react-map-gl/maplibre';
import type { ViewStateChangeEvent } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
// @ts-ignore - supercluster doesn't have types but works fine
import Supercluster from 'supercluster';
import { Sun, Map as MapIcon, Moon } from 'lucide-react';
import { useNodes } from '@/hooks/useNodes';
import { getTileStyles, getDefaultTileStyle, getMapConfig, getThemeConfig } from '@/config';
import { getTierColor, getTierIcon } from '@/lib/theme-colors';
import type { NodeWithProfile, TileStyleConfig, NodeTier } from '@atlasp2p/types';
import { renderToStaticMarkup } from 'react-dom/server';
import * as LucideIcons from 'lucide-react';
import ClusterMarker from './ClusterMarker';
import NodeHoverPreview from './NodeHoverPreview';

// Icon mapping for theme switcher (config-driven)
const THEME_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  sun: Sun,
  map: MapIcon,
  moon: Moon,
};

// Convert kebab-case to PascalCase for icon lookup
function iconNameToComponent(iconName: string): any {
  const pascalCase = iconName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
  return (LucideIcons as any)[pascalCase];
}

interface MapLibreMapProps {
  viewMode: 'map' | 'globe';
  onNodeClick?: (node: NodeWithProfile) => void;
}

interface ClusterFeature {
  type: 'Feature';
  id: number;
  properties: {
    cluster: true;
    cluster_id: number;
    point_count: number;
    point_count_abbreviated: string;
  };
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
}

interface PointFeature {
  type: 'Feature';
  properties: {
    node: NodeWithProfile;
    cluster: false;
  };
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
}

type MapFeature = ClusterFeature | PointFeature;

// Spiderfy configuration
const SPIDER_LEG_LENGTH = 120; // Distance from center (increased for more nodes)
const SPIDER_ANGLE_STEP = 30; // Degrees between nodes
const MAX_SPIDERFY_NODES = 50; // Maximum nodes to spiderfy before zooming instead
const MAX_FULL_SPIDERFY = 30; // Above this, prioritize online nodes
const LARGE_CLUSTER_THRESHOLD = 100; // Very large clusters just zoom in

interface SpiderfyState {
  nodes: NodeWithProfile[];
  center: { longitude: number; latitude: number };
  clusterId: number;
  totalCount: number; // Total nodes in cluster (including filtered)
  onlineCount: number; // Number of online nodes
  isFiltered: boolean; // Whether we're showing filtered subset
}

// Meta-cluster state for co-located nodes split into groups
interface MetaClusterState {
  groups: Array<{
    nodes: NodeWithProfile[];
    onlineCount: number;
  }>;
  center: { longitude: number; latitude: number };
  totalCount: number;
}

export default function MapLibreMap({ viewMode, onNodeClick }: MapLibreMapProps) {
  const { nodes, isLoading, error } = useNodes();
  const mapRef = useRef<MapRef>(null);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<NodeWithProfile | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ longitude: number; latitude: number } | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Spiderfy state - when cluster is expanded into individual nodes
  const [spiderfyState, setSpiderfyState] = useState<SpiderfyState | null>(null);

  // Meta-cluster state - when co-located nodes are split into groups
  const [metaClusterState, setMetaClusterState] = useState<MetaClusterState | null>(null);

  // Spider node hover - stores pixel offset for tooltip positioning
  const [spiderHover, setSpiderHover] = useState<{ node: NodeWithProfile; x: number; y: number } | null>(null);

  // Get tile styles and map config from project configuration
  const tileStyles = getTileStyles();
  const defaultTileStyle = getDefaultTileStyle();
  const mapConfig = getMapConfig();
  const theme = getThemeConfig();

  const [tileStyle, setTileStyle] = useState(defaultTileStyle);
  const [isClient, setIsClient] = useState(false);

  // View state for map
  const [viewState, setViewState] = useState({
    longitude: mapConfig.defaultCenter[1],
    latitude: mapConfig.defaultCenter[0],
    zoom: mapConfig.defaultZoom,
    pitch: 0,
    bearing: 0,
    transitionDuration: 1000,
  });

  // Track mounted state
  useEffect(() => {
    setMounted(true);
  }, []);

  // Load tileStyle from localStorage on client mount
  useEffect(() => {
    setIsClient(true);
    const saved = localStorage.getItem(`atlasp2p-${viewMode}-tile-style`);
    const isValid = saved && tileStyles.some(style => style.id === saved);
    if (isValid && saved) {
      setTileStyle(saved);
    }
  }, [tileStyles, viewMode]);

  // Persist tileStyle to localStorage
  useEffect(() => {
    if (isClient) {
      localStorage.setItem(`atlasp2p-${viewMode}-tile-style`, tileStyle);
    }
  }, [tileStyle, isClient, viewMode]);

  // Reset pitch and bearing when switching to globe to prevent tilt
  useEffect(() => {
    if (viewMode === 'globe') {
      setViewState(prev => ({
        ...prev,
        pitch: 0,
        bearing: 0,
      }));
    }
  }, [viewMode]);


  // Filter nodes with valid coordinates (memoized for performance)
  const validNodes = useMemo(
    () =>
      nodes.filter(
        (node) =>
          node.latitude !== null &&
          node.longitude !== null &&
          !isNaN(node.latitude) &&
          !isNaN(node.longitude)
      ),
    [nodes]
  );

  // Create supercluster instance
  const cluster = useMemo(() => {
    const supercluster = new Supercluster<{ node: NodeWithProfile }>({
      radius: mapConfig.clusterRadius,
      maxZoom: mapConfig.clusterMaxZoom,
      minZoom: mapConfig.minZoom,
    });

    const points = validNodes.map(node => ({
      type: 'Feature' as const,
      properties: { node, cluster: false as const },
      geometry: {
        type: 'Point' as const,
        coordinates: [node.longitude!, node.latitude!] as [number, number],
      },
    }));

    supercluster.load(points);
    return supercluster;
  }, [validNodes, mapConfig.clusterRadius, mapConfig.clusterMaxZoom, mapConfig.minZoom]);

  // Get clusters and markers for current viewport
  const { clusters: clusterFeatures, markers: nodeMarkers } = useMemo(() => {
    const bounds: [number, number, number, number] = [-180, -85, 180, 85];
    const zoom = Math.floor(viewState.zoom);
    const clustersData = cluster.getClusters(bounds, zoom) as MapFeature[];

    const clusterMarkers: ClusterFeature[] = [];
    const nodeMarkers: PointFeature[] = [];

    clustersData.forEach(feature => {
      if (feature.properties.cluster) {
        clusterMarkers.push(feature as ClusterFeature);
      } else {
        nodeMarkers.push(feature as PointFeature);
      }
    });

    return { clusters: clusterMarkers, markers: nodeMarkers };
  }, [cluster, viewState.zoom]);

  // Find current tile configuration
  const currentTileConfig = tileStyles.find((style) => style.id === tileStyle) || tileStyles[0];

  // Apply map filter (independent of UI theme)
  // The navbar theme toggle should ONLY affect UI components, NOT the map
  // NOTE: Only apply CSS filters to RASTER tiles. Vector tiles have colors in the style JSON!
  useEffect(() => {
    if (!mounted) return;

    // Check if using vector tiles (styleUrl means vector, no filter needed)
    const isVectorTiles = !!(currentTileConfig as any).styleUrl;
    const filter = isVectorTiles ? '' : (currentTileConfig.filter || '');

    // Wait for canvas to exist and apply filter
    const applyFilter = () => {
      const canvases = document.querySelectorAll('.maplibregl-canvas');
      console.log(`[FILTER CHECK] Vector tiles: ${isVectorTiles}, Filter: "${filter}"`);

      if (canvases.length === 0) {
        // Canvas doesn't exist yet, retry in 100ms
        setTimeout(applyFilter, 100);
        return;
      }

      canvases.forEach((canvas) => {
        if (canvas instanceof HTMLElement) {
          canvas.style.filter = filter;
          canvas.style.transition = 'filter 0.3s ease-in-out';
          console.log(`[FILTER ${filter ? 'APPLIED' : 'CLEARED'}] ${currentTileConfig.name}`);
        }
      });
    };

    applyFilter();
  }, [mounted, tileStyle, currentTileConfig.filter, currentTileConfig.name]);

  // IMPORTANT: Map tiles should NOT change based on UI theme
  // Only the CSS filter changes (see filter/filterDark below)
  // The tile URL is determined ONLY by the selected map style
  const tileUrl = currentTileConfig.url;

  // Create MapLibre style object
  const mapStyle = useMemo(() => {
    // Check if this tile config has a custom styleUrl (for vector tiles with custom colors)
    const customStyleUrl = (currentTileConfig as any).styleUrl;
    if (customStyleUrl) {
      return customStyleUrl; // Return the style URL directly
    }

    // Ensure we have a tile URL for raster styles
    if (!tileUrl) {
      console.error('No tile URL provided for raster style');
      return null;
    }

    // Fallback: Create raster tile style
    const useRetina = viewMode === 'map'; // Only use retina on 2D map
    const maxZoomLevel = viewMode === 'globe' ? 8 : (currentTileConfig.maxZoom || 20);
    const tileSizeValue = viewMode === 'globe' ? 512 : 256;

    const processedUrl = tileUrl
      .replace('{s}', currentTileConfig.subdomains?.[0] || 'a')
      .replace('{r}', useRetina ? '@2x' : '');

    return {
      version: 8 as const,
      sources: {
        'raster-tiles': {
          type: 'raster' as const,
          tiles: [processedUrl],
          tileSize: tileSizeValue,
          attribution: currentTileConfig.attribution,
          maxzoom: maxZoomLevel,
        },
      },
      layers: [
        {
          id: 'simple-tiles',
          type: 'raster' as const,
          source: 'raster-tiles',
          minzoom: 0,
          maxzoom: 22,
        },
      ],
    };
  }, [tileUrl, currentTileConfig, viewMode]);

  // Handle cluster click - zoom in or spiderfy
  const handleClusterClick = useCallback((clusterId: number, longitude: number, latitude: number, clusterNodes: NodeWithProfile[]) => {
    const expansionZoom = cluster.getClusterExpansionZoom(clusterId);
    const totalCount = clusterNodes.length;

    console.log('[CLUSTER CLICK]', {
      clusterId,
      totalCount,
      expansionZoom,
      currentZoom: viewState.zoom,
      coordinates: { longitude, latitude }
    });

    // Count online nodes
    const onlineNodes = clusterNodes.filter(node => node.status === 'up');
    const onlineCount = onlineNodes.length;

    // Check if ALL nodes are at the EXACT same coordinates (truly co-located)
    const firstNode = clusterNodes[0];
    const firstLat = firstNode.latitude;
    const firstLng = firstNode.longitude;
    const isColocated = firstLat !== null && firstLng !== null &&
      clusterNodes.every(node =>
        node.latitude !== null && node.longitude !== null &&
        Math.abs(node.latitude - firstLat) < 0.0001 &&
        Math.abs(node.longitude - firstLng) < 0.0001
      );

    console.log('[CLUSTER] Co-location check', {
      isColocated,
      totalCount,
      firstNodeCoords: { lat: firstNode.latitude, lng: firstNode.longitude },
      expansionZoom,
      currentZoom: viewState.zoom
    });

    // ===========================================
    // CASE 1: CO-LOCATED NODES (same coordinates)
    // Can't zoom to separate them, handle in-place
    // ===========================================
    if (isColocated) {
      console.log('[CLUSTER] Co-located nodes - same coordinates');

      // Small co-located cluster (≤30): Show all in spider view
      if (totalCount <= MAX_FULL_SPIDERFY) {
        console.log('[CLUSTER] → Spiderfying all', totalCount, 'nodes');
        setMetaClusterState(null);
        setSpiderfyState({
          nodes: clusterNodes,
          center: { longitude, latitude },
          clusterId,
          totalCount,
          onlineCount,
          isFiltered: false,
        });
        return;
      }

      // Large co-located cluster (>30): Split into groups (meta-clusters)
      console.log('[CLUSTER] → Creating meta-clusters (groups of', MAX_FULL_SPIDERFY, ')');
      const groups: Array<{ nodes: NodeWithProfile[]; onlineCount: number }> = [];

      for (let i = 0; i < clusterNodes.length; i += MAX_FULL_SPIDERFY) {
        const groupNodes = clusterNodes.slice(i, i + MAX_FULL_SPIDERFY);
        const groupOnline = groupNodes.filter(n => n.status === 'up').length;
        groups.push({ nodes: groupNodes, onlineCount: groupOnline });
      }

      setMetaClusterState({
        groups,
        center: { longitude, latitude },
        totalCount,
      });
      setSpiderfyState(null);
      return;
    }

    // ===========================================
    // CASE 2: NEARBY NODES (different coordinates)
    // Can zoom to separate them naturally
    // ===========================================
    console.log('[CLUSTER] Nearby nodes - different coordinates');

    // Very large clusters (100+): Zoom to break down
    if (totalCount >= LARGE_CLUSTER_THRESHOLD) {
      console.log('[CLUSTER] → Zooming in to break apart', totalCount, 'nodes');
      setMetaClusterState(null);
      setSpiderfyState(null);
      setViewState(prev => ({
        ...prev,
        longitude,
        latitude,
        zoom: Math.min(expansionZoom + 1, mapConfig.maxZoom),
        transitionDuration: 500,
      }));
      return;
    }

    // Large clusters (51-99): Show online subset or zoom
    if (totalCount > MAX_SPIDERFY_NODES) {
      const hasUsefulOnlineSubset = onlineCount > 0 && onlineCount <= 30 && onlineCount < totalCount * 0.5;

      if (hasUsefulOnlineSubset) {
        console.log('[CLUSTER] → Spiderfying', onlineCount, 'online /', totalCount, 'total');
        setMetaClusterState(null);
        setSpiderfyState({
          nodes: onlineNodes,
          center: { longitude, latitude },
          clusterId,
          totalCount,
          onlineCount,
          isFiltered: true,
        });
        return;
      } else {
        console.log('[CLUSTER] → Zooming in to break apart');
        setMetaClusterState(null);
        setSpiderfyState(null);
        setViewState(prev => ({
          ...prev,
          longitude,
          latitude,
          zoom: Math.min(expansionZoom + 1, mapConfig.maxZoom),
          transitionDuration: 500,
        }));
        return;
      }
    }

    // Medium clusters (31-50): Filter to online if mixed
    if (totalCount > MAX_FULL_SPIDERFY) {
      if (onlineCount > 0 && onlineCount < totalCount) {
        console.log('[CLUSTER] → Spiderfying', onlineCount, 'online /', totalCount, 'total');
        setMetaClusterState(null);
        setSpiderfyState({
          nodes: onlineNodes,
          center: { longitude, latitude },
          clusterId,
          totalCount,
          onlineCount,
          isFiltered: true,
        });
        return;
      }
    }

    // Small clusters (1-30): Show all
    console.log('[CLUSTER] → Spiderfying all', totalCount, 'nodes');
    setMetaClusterState(null);
    setSpiderfyState({
      nodes: clusterNodes,
      center: { longitude, latitude },
      clusterId,
      totalCount,
      onlineCount,
      isFiltered: false,
    });
  }, [cluster, mapConfig.maxZoom]);

  // Close spiderfy and meta-clusters when clicking on map background
  const handleMapClick = useCallback(() => {
    if (spiderfyState || metaClusterState) {
      setSpiderHover(null);
      setSpiderfyState(null);
      setMetaClusterState(null);
    }
  }, [spiderfyState, metaClusterState]);

  // Calculate spider radius based on node count
  const getSpiderRadius = useCallback((count: number) => {
    const baseRadius = 60;
    const radiusGrowth = count <= 10 ? count * 6 : count <= 20 ? 60 + (count - 10) * 3 : 90 + (count - 20) * 3;
    return Math.min(baseRadius + radiusGrowth, 200); // Cap at 200px
  }, []);

  // Calculate spider positions for nodes in a circle (pixel offsets)
  // Returns positions sorted by y-coordinate so top nodes render LAST (on top)
  const getSpiderPositions = useCallback((nodes: NodeWithProfile[]) => {
    const count = nodes.length;
    const positions: Array<{ node: NodeWithProfile; x: number; y: number }> = [];

    // Calculate positions in a circle
    const angleStep = (2 * Math.PI) / count;
    const radius = getSpiderRadius(count);

    nodes.forEach((node, index) => {
      const angle = index * angleStep - Math.PI / 2; // Start from top
      positions.push({
        node,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      });
    });

    // Sort by y descending - bottom nodes first, top nodes last (rendered on top)
    return positions.sort((a, b) => b.y - a.y);
  }, [getSpiderRadius]);

  // Render node marker icon
  // Shows custom avatar if available, otherwise default marker
  // Adds tier badge overlay for non-standard tiers
  const renderNodeIcon = useCallback((node: NodeWithProfile, zIndex?: number, customSize?: number) => {
    const tierIconName = getTierIcon(node.tier);
    const color = getTierColor(node.tier, node.status);
    const size = customSize || 56; // Use custom size if provided, otherwise default
    const badgeSize = Math.max(18, size * 0.39); // Scale badge proportionally

    // Determine the image source - custom avatar or default marker
    const imageSrc = node.avatarUrl || '/logos/marker-icon.svg';
    const isCustomAvatar = !!node.avatarUrl;

    // Get tier badge icon for non-standard tiers
    const IconComponent = node.tier !== 'standard' ? iconNameToComponent(tierIconName) : null;

    return (
      <div
        style={{
          position: 'relative',
          width: size,
          height: size,
          cursor: 'pointer',
          transition: 'transform 0.2s',
          zIndex: zIndex ?? 'auto',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.15)';
          e.currentTarget.style.zIndex = '1000';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.zIndex = zIndex?.toString() ?? 'auto';
        }}
      >
        {/* Main marker image - avatar or default */}
        <div
          style={{
            width: size,
            height: size,
            borderRadius: isCustomAvatar ? '50%' : '0',
            overflow: isCustomAvatar ? 'hidden' : 'visible',
            // Only apply shadow to avatars, not default markers
            boxShadow: isCustomAvatar ? '0 3px 8px rgba(0,0,0,0.4)' : 'none',
            filter: node.status === 'down' ? 'grayscale(1) opacity(0.5)' : 'none',
          }}
        >
          <img
            src={imageSrc}
            alt={node.displayName || 'Network Node'}
            style={{
              width: '100%',
              height: '100%',
              objectFit: isCustomAvatar ? 'cover' : 'contain',
              // Default marker: add drop shadow directly to image
              filter: isCustomAvatar ? 'none' : 'drop-shadow(0 3px 4px rgba(0,0,0,0.4))',
            }}
          />
        </div>

        {/* Tier badge overlay for non-standard tiers */}
        {IconComponent && node.tier !== 'standard' && (
          <div
            style={{
              position: 'absolute',
              bottom: -2,
              right: -2,
              width: badgeSize,
              height: badgeSize,
              borderRadius: '50%',
              backgroundColor: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
            }}
          >
            <IconComponent
              size={badgeSize * 0.65}
              color={color}
              strokeWidth={2.5}
              fill={node.tier === 'diamond' ? color : 'none'}
            />
          </div>
        )}
      </div>
    );
  }, []);

  // Get nodes within a cluster
  const getClusterNodes = useCallback((clusterId: number): NodeWithProfile[] => {
    const leaves = cluster.getLeaves(clusterId, Infinity);
    return leaves.map((leaf: any) => leaf.properties.node);
  }, [cluster]);

  // Handle hover with delay
  const handleNodeHover = useCallback((node: NodeWithProfile, longitude: number, latitude: number) => {
    // Clear any existing timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }

    // Set new timeout to show preview after 300ms
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredNode(node);
      setHoverPosition({ longitude, latitude });
    }, 300);
  }, []);

  const handleNodeHoverEnd = useCallback(() => {
    // Clear timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }

    setHoveredNode(null);
    setHoverPosition(null);
  }, []);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="h-full w-full relative">
      {/* Map Style Switcher - Bottom Left (Desktop only - hidden when bottom sheet is visible) */}
      <div className="hidden lg:block absolute bottom-20 left-4 z-[1000] bg-card/85 backdrop-blur-xl rounded-lg shadow-lg p-3 border border-border focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2">
        <div
          className="text-sm font-semibold text-muted-foreground px-0 py-2 mb-2"
          id="map-style-label"
        >
          Map Style
        </div>
        <div
          className="flex flex-col gap-2"
          role="group"
          aria-labelledby="map-style-label"
        >
          {tileStyles.map((style) => {
            const IconComponent = style.icon ? THEME_ICONS[style.icon] : null;
            return (
              <button
                key={style.id}
                type="button"
                onClick={() => setTileStyle(style.id)}
                aria-label={`Map Style: ${style.name}`}
                aria-current={tileStyle === style.id ? 'true' : undefined}
                title={style.description || `Switch to ${style.name} view`}
                className={`px-4 py-2.5 text-sm font-medium rounded-md transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary focus-visible:ring-2 focus-visible:ring-offset-2 flex items-center gap-2 ${
                  tileStyle === style.id
                    ? 'bg-primary text-white shadow-md font-semibold'
                    : 'bg-transparent text-foreground/80 hover:bg-muted'
                }`}
              >
                {IconComponent && <IconComponent className="h-4 w-4" />}
                <span>{style.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <Map
        ref={mapRef}
        {...viewState}
        onMove={(evt: ViewStateChangeEvent) => {
          // Clear spiderfy and meta-clusters when map moves/zooms (clusters change)
          if (spiderfyState || metaClusterState) {
            setSpiderHover(null);
            setSpiderfyState(null);
            setMetaClusterState(null);
          }
          setViewState({ ...evt.viewState, transitionDuration: 1000 });
        }}
        onClick={handleMapClick}
        style={{ width: '100%', height: '100%' }}
        mapStyle={mapStyle}
        projection={viewMode === 'globe' ? 'globe' : 'mercator'}
        minZoom={mapConfig.minZoom}
        maxZoom={mapConfig.maxZoom}
        attributionControl={false}
        renderWorldCopies={viewMode === 'map'}
        dragRotate={false}
        pitchWithRotate={false}
        touchPitch={false}
      >
        <NavigationControl position="bottom-left" showCompass={false} />

        {/* Cluster Markers */}
        {clusterFeatures.map((clusterFeature) => {
          const clusterNodes = getClusterNodes(clusterFeature.properties.cluster_id);
          const isDimmed = !!(spiderfyState || metaClusterState); // Dim when spider/meta-cluster active
          return (
            <Marker
              key={`cluster-${clusterFeature.id}`}
              longitude={clusterFeature.geometry.coordinates[0]}
              latitude={clusterFeature.geometry.coordinates[1]}
              anchor="center"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                handleClusterClick(
                  clusterFeature.properties.cluster_id,
                  clusterFeature.geometry.coordinates[0],
                  clusterFeature.geometry.coordinates[1],
                  clusterNodes
                );
              }}
            >
              <div style={{ opacity: isDimmed ? 0.2 : 1, transition: 'opacity 0.3s ease' }}>
                <ClusterMarker
                  count={clusterFeature.properties.point_count}
                  nodes={clusterNodes}
                />
              </div>
            </Marker>
          );
        })}

        {/* Node Markers - sorted by latitude so southern nodes render on top */}
        {[...nodeMarkers]
          .sort((a, b) => b.geometry.coordinates[1] - a.geometry.coordinates[1])
          .map((marker, index) => {
          const node = marker.properties.node;
          const isDimmed = !!(spiderfyState || metaClusterState); // Dim when spider/meta-cluster active
          return (
            <Marker
              key={node.id}
              longitude={marker.geometry.coordinates[0]}
              latitude={marker.geometry.coordinates[1]}
              anchor="center"
              style={{ zIndex: index }}
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                handleNodeHoverEnd(); // Clear hover preview on click
                onNodeClick?.(node);
              }}
            >
              <div
                onMouseEnter={() => handleNodeHover(node, marker.geometry.coordinates[0], marker.geometry.coordinates[1])}
                onMouseLeave={handleNodeHoverEnd}
                style={{ opacity: isDimmed ? 0.2 : 1, transition: 'opacity 0.3s ease' }}
              >
                {renderNodeIcon(node, index)}
              </div>
            </Marker>
          );
        })}

        {/* Spiderfy - expanded cluster nodes in a circle */}
        {spiderfyState && (() => {
          console.log('[RENDER] Rendering spiderfy', { nodes: spiderfyState.nodes.length, center: spiderfyState.center });

          // Calculate marker size for spider nodes
          const nodeCount = spiderfyState.nodes.length;
          const markerSize = nodeCount <= 15 ? 56 : nodeCount <= 25 ? 48 : 42;

          return (
          <Marker
            longitude={spiderfyState.center.longitude}
            latitude={spiderfyState.center.latitude}
            anchor="center"
            style={{ zIndex: 1000 }}
          >
            {/* Container for all spider elements */}
            <div style={{ position: 'relative', width: 0, height: 0 }}>
              {/* Spider leg lines (SVG) */}
              <svg
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  overflow: 'visible',
                  pointerEvents: 'none',
                  zIndex: 1,
                }}
                width="1"
                height="1"
              >
                {getSpiderPositions(spiderfyState.nodes).map(({ node, x, y }) => (
                  <line
                    key={`leg-${node.id}`}
                    x1="0"
                    y1="0"
                    x2={x}
                    y2={y}
                    stroke={theme.primaryColor}
                    strokeWidth="2"
                    strokeOpacity="0.4"
                  />
                ))}
              </svg>

              {/* Close button - centered perfectly on cluster center */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setSpiderHover(null);
                  setSpiderfyState(null);
                }}
                style={{
                  position: 'absolute',
                  top: -20,
                  left: -20,
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  backgroundColor: theme.primaryColor,
                  opacity: 0.9,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                  zIndex: 2,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'opacity 0.2s',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = '1'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = '0.9'; }}
                title="Click to collapse"
              >
                <span style={{ color: 'white', fontSize: '18px', fontWeight: 'bold' }}>×</span>
              </div>

              {/* Spider nodes - absolutely positioned */}
              {getSpiderPositions(spiderfyState.nodes).map(({ node, x, y }, index) => {
                // Scale marker size based on cluster size
                // 1-15 nodes: 56px, 16-25 nodes: 48px, 26+ nodes: 42px
                const nodeCount = spiderfyState.nodes.length;
                const markerSize = nodeCount <= 15 ? 56 : nodeCount <= 25 ? 48 : 42;
                const halfSize = markerSize / 2;

                return (
                  <div
                    key={`spider-${node.id}`}
                    style={{
                      position: 'absolute',
                      top: y - halfSize,
                      left: x - halfSize,
                      zIndex: 10 + index,
                      cursor: 'pointer',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSpiderHover(null);
                      setSpiderfyState(null);
                      onNodeClick?.(node);
                    }}
                    onMouseEnter={() => setSpiderHover({ node, x, y })}
                    onMouseLeave={() => setSpiderHover(null)}
                  >
                    {renderNodeIcon(node, 10 + index, markerSize)}
                  </div>
                );
              })}

              {/* Spider node tooltip - positioned at the hovered node */}
              {spiderHover && (() => {
                const nodeCount = spiderfyState.nodes.length;
                const markerSize = nodeCount <= 15 ? 56 : nodeCount <= 25 ? 48 : 42;
                const halfSize = markerSize / 2;

                return (
                  <div
                    style={{
                      position: 'absolute',
                      top: spiderHover.y - halfSize - 10, // Above the node
                      left: spiderHover.x,
                      transform: 'translate(-50%, -100%)',
                      zIndex: 1000,
                      pointerEvents: 'none',
                    }}
                  >
                    <NodeHoverPreview node={spiderHover.node} />
                  </div>
                );
              })()}
            </div>
          </Marker>
          );
        })()}

        {/* Meta-clusters - co-located nodes split into groups arranged in a circle */}
        {metaClusterState && (() => {
          console.log('[RENDER] Rendering meta-clusters', { groups: metaClusterState.groups.length });

          const groupCount = metaClusterState.groups.length;
          // Dynamic radius based on group count: 2-3 groups = 80px, 4-5 groups = 100px, 6+ = 120px
          const metaRadius = groupCount <= 3 ? 80 : groupCount <= 5 ? 100 : 120;
          const angleStep = (2 * Math.PI) / groupCount;

          return (
            <Marker
              longitude={metaClusterState.center.longitude}
              latitude={metaClusterState.center.latitude}
              anchor="center"
              style={{ zIndex: 999 }}
            >
              <div style={{ position: 'relative', width: 0, height: 0 }}>
                {/* Center close button */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setMetaClusterState(null);
                  }}
                  style={{
                    position: 'absolute',
                    top: -20,
                    left: -20,
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    backgroundColor: theme.primaryColor,
                    opacity: 0.9,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                    zIndex: 2,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'opacity 0.2s',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = '1'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = '0.9'; }}
                  title="Click to collapse"
                >
                  <span style={{ color: 'white', fontSize: '18px', fontWeight: 'bold' }}>×</span>
                </div>

                {/* Group clusters arranged in circle */}
                {metaClusterState.groups.map((group, index) => {
                  const angle = index * angleStep - Math.PI / 2; // Start from top
                  const x = Math.cos(angle) * metaRadius;
                  const y = Math.sin(angle) * metaRadius;

                  return (
                    <div
                      key={`meta-group-${index}`}
                      style={{
                        position: 'absolute',
                        top: y,
                        left: x,
                        transform: 'translate(-50%, -50%)',
                        zIndex: 10 + index,
                        cursor: 'pointer',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        // Clear meta-clusters and show spider for this group
                        console.log('[META-CLUSTER] Clicked group', index, 'with', group.nodes.length, 'nodes');
                        setMetaClusterState(null);
                        setSpiderfyState({
                          nodes: group.nodes,
                          center: metaClusterState.center,
                          clusterId: -1, // Virtual cluster
                          totalCount: group.nodes.length,
                          onlineCount: group.onlineCount,
                          isFiltered: false,
                        });
                      }}
                    >
                      <ClusterMarker
                        count={group.nodes.length}
                        nodes={group.nodes}
                      />
                    </div>
                  );
                })}
              </div>
            </Marker>
          );
        })()}

        {/* Hover Preview Popup */}
        {hoveredNode && hoverPosition && (
          <Popup
            longitude={hoverPosition.longitude}
            latitude={hoverPosition.latitude}
            anchor="bottom"
            offset={24}
            closeButton={false}
            closeOnClick={false}
            className="node-hover-popup"
            maxWidth="320px"
          >
            <NodeHoverPreview node={hoveredNode} />
          </Popup>
        )}
      </Map>

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-background/50 backdrop-blur-sm" role="status" aria-live="polite" aria-label="Loading map data">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-2" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">Loading nodes...</p>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-background/50 backdrop-blur-sm" role="alert" aria-live="assertive">
          <div className="text-center text-error">
            <p className="text-sm">Failed to load nodes</p>
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
