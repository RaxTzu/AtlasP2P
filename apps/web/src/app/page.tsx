'use client';

import dynamic from 'next/dynamic';
import { Suspense, useState, useEffect, useMemo } from 'react';
import { Globe, Map, List, Filter, BarChart3, Plus, Minus, Layers } from 'lucide-react';
import { StatsPanel } from '@/components/stats/StatsPanel';
import { GrowthMetrics } from '@/components/stats/GrowthMetrics';
import { FilterPanel } from '@/components/filters/FilterPanel';
import { DraggablePanel } from '@/components/ui/DraggablePanel';
import { NodeDetailModal } from '@/components/nodes/NodeDetailModal';
import { NodeListSidebar } from '@/components/nodes/NodeListSidebar';
import { getChainConfig, getThemeConfig, getTileStyles, getDefaultTileStyle, getMapConfig } from '@/config';
import { useNodes } from '@/hooks/useNodes';
import type { NodeWithProfile } from '@atlasp2p/types';
import * as LucideIcons from 'lucide-react';

// Icon mapping for tile style switcher (config-driven)
function iconNameToComponent(iconName: string): any {
  const pascalCase = iconName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
  return (LucideIcons as any)[pascalCase];
}

// Dynamic import for MapLibre map (handles both 2D and 3D) - lazy loaded for better performance
const MapLibreMap = dynamic(() => import('@/components/map/MapLibreMap'), {
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
        <p className="text-sm text-muted-foreground">Loading map...</p>
      </div>
    </div>
  ),
  ssr: false,
});

export default function HomePage() {
  const chainConfig = getChainConfig();
  const theme = getThemeConfig();
  const chain = chainConfig.ticker.toLowerCase();
  const mapConfig = getMapConfig();
  const tileStyles = getTileStyles();

  const [viewMode, setViewMode] = useState<'map' | 'globe'>('map');
  const [isClient, setIsClient] = useState(false);
  const [isStatsPanelMinimized, setIsStatsPanelMinimized] = useState(false); // Default: expanded on desktop, minimized on mobile
  const [mapZoom, setMapZoom] = useState(mapConfig.defaultZoom);
  const [tileStyle, setTileStyle] = useState(getDefaultTileStyle());
  const [isStyleDropdownOpen, setIsStyleDropdownOpen] = useState(false);

  const { nodes, isLoading: nodesLoading } = useNodes();

  // Memoize nodes array to prevent unnecessary re-renders
  const memoizedNodes = useMemo(() => nodes, [nodes]);
  const [selectedNode, setSelectedNode] = useState<NodeWithProfile | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Load viewMode from localStorage on client mount
  useEffect(() => {
    setIsClient(true);
    const saved = localStorage.getItem('atlasp2p-view-mode');
    if (saved === 'globe' || saved === 'map') {
      setViewMode(saved);
    }
    // Default: minimize stats panel on mobile
    const isMobile = window.innerWidth < 768;
    setIsStatsPanelMinimized(isMobile);
  }, []);

  // Persist viewMode to localStorage
  useEffect(() => {
    if (isClient) {
      localStorage.setItem('atlasp2p-view-mode', viewMode);
    }
  }, [viewMode, isClient]);

  // Close style dropdown when clicking outside
  useEffect(() => {
    if (!isStyleDropdownOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-style-dropdown]')) {
        setIsStyleDropdownOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isStyleDropdownOpen]);

  const handleNodeClick = (node: NodeWithProfile) => {
    setSelectedNode(node);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedNode(null);
  };

  const handleOpenSidebar = () => {
    setIsSidebarOpen(true);
  };

  const handleCloseSidebar = () => {
    setIsSidebarOpen(false);
  };

  const handleZoomIn = () => {
    setMapZoom(prev => Math.min(prev + 1, mapConfig.maxZoom));
  };

  const handleZoomOut = () => {
    setMapZoom(prev => Math.max(prev - 1, mapConfig.minZoom));
  };

  const handleTileStyleChange = (styleId: string) => {
    setTileStyle(styleId);
    setIsStyleDropdownOpen(false);
  };

  return (
    <div className="fixed inset-0 top-16 flex flex-col overflow-hidden">
      {/* Map Container - Full height */}
      <div className="relative flex-1 w-full overflow-hidden">
        {/* Mobile Bottom Sheet - Tabbed Stats/Filters */}
        <div className={`lg:hidden absolute z-[60] transition-all duration-300 bottom-0 left-0 right-0 ${
          isStatsPanelMinimized
            ? 'max-h-12' // Minimized - just show tab bar
            : 'max-h-[55vh]' // Expanded
        } overflow-hidden`}>
          {/* Tab bar with drag handle */}
          <div className="bg-card/95 backdrop-blur-xl border-t border-border/50">
            {/* Drag handle */}
            <button
              onClick={() => setIsStatsPanelMinimized(!isStatsPanelMinimized)}
              className="w-full py-2 flex justify-center"
              aria-label={isStatsPanelMinimized ? "Expand panel" : "Minimize panel"}
            >
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </button>

            {/* Tab buttons */}
            <div className="flex px-2 pb-2 gap-1">
              <button
                onClick={() => {
                  setIsFilterOpen(false);
                  setIsStatsPanelMinimized(false);
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-colors ${
                  !isFilterOpen
                    ? 'text-white'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
                style={!isFilterOpen ? { backgroundColor: theme.primaryColor } : {}}
              >
                <BarChart3 className="h-3.5 w-3.5" />
                Stats
              </button>
              <button
                onClick={() => {
                  setIsFilterOpen(true);
                  setIsStatsPanelMinimized(false);
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-colors ${
                  isFilterOpen
                    ? 'text-white'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
                style={isFilterOpen ? { backgroundColor: theme.primaryColor } : {}}
              >
                <Filter className="h-3.5 w-3.5" />
                Filters
              </button>
            </div>
          </div>

          {/* Panel content */}
          <div className={`bg-card/95 backdrop-blur-xl overflow-y-auto scrollbar-none max-h-[calc(55vh-5rem)] ${
            isStatsPanelMinimized ? 'hidden' : 'block'
          }`}>
            {!isFilterOpen ? (
              /* Stats Content */
              <div className="p-3 space-y-3">
                <Suspense fallback={<div className="h-32 bg-muted rounded-lg animate-pulse" />}>
                  <StatsPanel />
                </Suspense>
                <Suspense fallback={<div className="h-32 bg-muted rounded-lg animate-pulse" />}>
                  <GrowthMetrics />
                </Suspense>
              </div>
            ) : (
              /* Filter Content */
              <div className="p-3">
                <Suspense fallback={<div className="h-32 bg-muted rounded-lg animate-pulse" />}>
                  <FilterPanel />
                </Suspense>
              </div>
            )}
          </div>
        </div>

        {/* Desktop Stats Panel - Top Left */}
        <div className="hidden lg:block absolute z-[60] top-4 left-4 w-80 max-h-[calc(100vh-7rem)] overflow-hidden">
          <div className="space-y-4 overflow-y-auto scrollbar-none max-h-[calc(100vh-9rem)]">
            <Suspense fallback={<div className="h-32 bg-card rounded-lg animate-pulse" />}>
              <StatsPanel />
            </Suspense>
            <Suspense fallback={<div className="h-32 bg-card rounded-lg animate-pulse" />}>
              <GrowthMetrics />
            </Suspense>
          </div>
        </div>

        {/* Filter Panel - Draggable on desktop, snaps to edges */}
        <div className="hidden lg:block">
          <DraggablePanel storageKey="filter-panel-position" defaultPosition="top-right" width="w-72">
            <Suspense fallback={<div className="h-64 bg-card rounded-lg animate-pulse" />}>
              <FilterPanel />
            </Suspense>
          </DraggablePanel>
        </div>

        {/* View Toggle & Actions - Bottom Right, above the mobile/tablet stats bar */}
        {/* MOBILE: 48px buttons, 20px icons, 12px gaps | DESKTOP: 40px buttons, 18px icons, 8px gaps */}
        <div className="absolute bottom-20 lg:bottom-4 right-3 lg:right-4 z-[55] flex items-center gap-3 lg:gap-2">

          {/* Map Style Dropdown - MOBILE: 48x48px | DESKTOP: 40x40px */}
          <div className="relative" data-style-dropdown>
            <button
              onClick={() => setIsStyleDropdownOpen(!isStyleDropdownOpen)}
              className="bg-card/90 backdrop-blur-xl rounded-xl lg:rounded-lg shadow-lg border border-border
                         w-12 h-12 lg:w-10 lg:h-10
                         flex items-center justify-center
                         hover:bg-muted active:bg-muted/80 transition-colors"
              title="Change map style"
            >
              <Layers className="h-5 w-5 lg:h-[18px] lg:w-[18px]" strokeWidth={2.5} />
            </button>

            {/* Style Dropdown Menu */}
            {isStyleDropdownOpen && (
              <div className="absolute bottom-full right-0 mb-2 w-56 bg-card/95 backdrop-blur-xl rounded-xl shadow-2xl border border-border overflow-hidden z-[70]">
                <div className="p-2 space-y-1">
                  {tileStyles.map((style) => {
                    const StyleIcon = iconNameToComponent(style.icon);
                    const isActive = tileStyle === style.id;
                    return (
                      <button
                        key={style.id}
                        onClick={() => handleTileStyleChange(style.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-200 ${
                          isActive
                            ? 'text-white'
                            : 'hover:bg-muted text-foreground'
                        }`}
                        style={isActive ? { backgroundColor: theme.primaryColor } : {}}
                      >
                        {StyleIcon && <StyleIcon className="h-4 w-4 flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{style.name}</p>
                          <p className={`text-xs truncate ${isActive ? 'text-white/80' : 'text-muted-foreground'}`}>
                            {style.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Zoom Controls - MOBILE: 48px tall | DESKTOP: 40px tall */}
          <div className="bg-card/90 backdrop-blur-xl rounded-xl lg:rounded-lg shadow-lg border border-border overflow-hidden
                          h-12 lg:h-10">
            <div className="flex h-full">
              <button
                onClick={handleZoomIn}
                disabled={mapZoom >= mapConfig.maxZoom}
                className="flex items-center justify-center
                           w-12 lg:w-10
                           hover:bg-muted active:bg-muted/80 transition-colors
                           disabled:opacity-40 disabled:cursor-not-allowed"
                title="Zoom in"
              >
                <Plus className="h-5 w-5 lg:h-[18px] lg:w-[18px]" strokeWidth={2.5} />
              </button>
              <div className="w-px bg-border" />
              <button
                onClick={handleZoomOut}
                disabled={mapZoom <= mapConfig.minZoom}
                className="flex items-center justify-center
                           w-12 lg:w-10
                           hover:bg-muted active:bg-muted/80 transition-colors
                           disabled:opacity-40 disabled:cursor-not-allowed"
                title="Zoom out"
              >
                <Minus className="h-5 w-5 lg:h-[18px] lg:w-[18px]" strokeWidth={2.5} />
              </button>
            </div>
          </div>

          {/* Node List Button - MOBILE: 48x48px | DESKTOP: auto height 40px */}
          <button
            onClick={handleOpenSidebar}
            className="bg-card/90 backdrop-blur-xl rounded-xl lg:rounded-lg shadow-lg border border-border
                       w-12 h-12 lg:w-auto lg:h-10 lg:px-3
                       flex items-center justify-center lg:gap-2
                       hover:bg-muted active:bg-muted/80 transition-colors"
            title="Show node list"
          >
            <List className="h-5 w-5 lg:h-[18px] lg:w-[18px]" strokeWidth={2.5} />
            <span className="text-sm font-medium hidden lg:inline">Nodes</span>
            {!nodesLoading && (
              <span
                className="hidden lg:inline text-xs text-white px-1.5 py-0.5 rounded-full font-semibold"
                style={{ backgroundColor: theme.primaryColor }}
              >
                {memoizedNodes.length}
              </span>
            )}
          </button>

          {/* Map/Globe Toggle - MOBILE: 48x48px per button | DESKTOP: 40px height */}
          <div className="bg-card/90 backdrop-blur-xl rounded-xl lg:rounded-lg shadow-lg border border-border overflow-hidden
                          h-12 lg:h-10">
            <div className="flex h-full">
              <button
                onClick={() => setViewMode('map')}
                className={`flex items-center justify-center
                           w-12 lg:w-auto lg:px-3 lg:gap-2
                           text-sm font-medium transition-colors ${
                  viewMode === 'map'
                    ? 'text-white'
                    : 'bg-transparent text-muted-foreground hover:bg-muted active:bg-muted/80'
                }`}
                style={viewMode === 'map' ? { backgroundColor: theme.primaryColor } : {}}
              >
                <Map className="h-5 w-5 lg:h-[18px] lg:w-[18px]" strokeWidth={2.5} />
                <span className="hidden lg:inline">Map</span>
              </button>
              <button
                onClick={() => setViewMode('globe')}
                className={`flex items-center justify-center
                           w-12 lg:w-auto lg:px-3 lg:gap-2
                           text-sm font-medium transition-colors ${
                  viewMode === 'globe'
                    ? 'text-white'
                    : 'bg-transparent text-muted-foreground hover:bg-muted active:bg-muted/80'
                }`}
                style={viewMode === 'globe' ? { backgroundColor: theme.primaryColor } : {}}
              >
                <Globe className="h-5 w-5 lg:h-[18px] lg:w-[18px]" strokeWidth={2.5} />
                <span className="hidden lg:inline">Globe</span>
              </button>
            </div>
          </div>
        </div>


        {/* Map View - MapLibre handles both 2D (pitch=0) and 3D (pitch=60) */}
        <div className="relative h-full w-full">
          <MapLibreMap
            viewMode={viewMode}
            onNodeClick={handleNodeClick}
            mapZoom={mapZoom}
            onZoomChange={setMapZoom}
            tileStyle={tileStyle}
            isBottomSheetMinimized={isStatsPanelMinimized}
          />
        </div>

        {/* Network Info - Only on tablet/desktop, positioned on left side away from controls */}
        <div className="absolute bottom-4 left-4 z-[30] hidden md:block pointer-events-none">
          <div className="bg-card/85 backdrop-blur-xl rounded-lg px-3 py-1.5 lg:px-4 lg:py-2 shadow-lg border border-border">
            <p className="text-xs lg:text-sm text-muted-foreground whitespace-nowrap">
              {chainConfig.name} Nodes {viewMode === 'globe' ? 'Globe' : 'Map'} view | Live updates every 30s
            </p>
          </div>
        </div>
      </div>

      {/* Node Detail Modal */}
      {selectedNode && (
        <NodeDetailModal
          node={selectedNode}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
        />
      )}

      {/* Node List Sidebar */}
      <NodeListSidebar
        nodes={memoizedNodes}
        isOpen={isSidebarOpen}
        onClose={handleCloseSidebar}
        onNodeClick={(node) => {
          handleNodeClick(node);
          handleCloseSidebar();
        }}
      />
    </div>
  );
}
