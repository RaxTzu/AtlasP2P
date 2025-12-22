'use client';

import dynamic from 'next/dynamic';
import { Suspense, useState, useEffect } from 'react';
import { Globe, Map, List, Filter, BarChart3 } from 'lucide-react';
import { StatsPanel } from '@/components/stats/StatsPanel';
import { GrowthMetrics } from '@/components/stats/GrowthMetrics';
import { FilterPanel } from '@/components/filters/FilterPanel';
import { DraggablePanel } from '@/components/ui/DraggablePanel';
import { NodeDetailModal } from '@/components/nodes/NodeDetailModal';
import { NodeListSidebar } from '@/components/nodes/NodeListSidebar';
import { getChainConfig, getThemeConfig } from '@/config';
import { useNodes } from '@/hooks/useNodes';
import type { NodeWithProfile } from '@atlasp2p/types';

// Dynamic import for MapLibre map (handles both 2D and 3D)
const MapLibreMap = dynamic(() => import('@/components/map/MapLibreMap'), {
  ssr: false,
});

export default function HomePage() {
  const chainConfig = getChainConfig();
  const theme = getThemeConfig();
  const chain = chainConfig.ticker.toLowerCase();

  const [viewMode, setViewMode] = useState<'map' | 'globe'>('map');
  const [isClient, setIsClient] = useState(false);
  const [isStatsPanelMinimized, setIsStatsPanelMinimized] = useState(false); // Default: expanded on desktop, minimized on mobile

  const { nodes } = useNodes();
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
        <div className="absolute bottom-20 lg:bottom-4 right-2 sm:right-4 z-[55] flex items-center gap-1.5 sm:gap-2">

          {/* Node List Button */}
          <button
            onClick={handleOpenSidebar}
            className="bg-card/90 backdrop-blur-xl rounded-lg shadow-lg border border-border w-10 h-10 sm:w-auto sm:h-11 sm:px-3 flex items-center justify-center sm:gap-2 hover:bg-muted transition-colors"
            title="Show node list"
          >
            <List className="h-4 w-4" />
            <span className="text-sm font-medium hidden sm:inline">Nodes</span>
            <span
              className="hidden sm:inline text-xs text-white px-1.5 py-0.5 rounded-full font-semibold"
              style={{ backgroundColor: theme.primaryColor }}
            >
              {nodes.length}
            </span>
          </button>

          {/* Map/Globe Toggle */}
          <div className="bg-card/90 backdrop-blur-xl rounded-lg shadow-lg border border-border overflow-hidden h-10 sm:h-11">
            <div className="flex h-full">
              <button
                onClick={() => setViewMode('map')}
                className={`flex items-center justify-center w-10 sm:w-auto sm:px-3 sm:gap-2 text-sm font-medium transition-colors ${
                  viewMode === 'map'
                    ? 'text-white'
                    : 'bg-transparent text-muted-foreground hover:bg-muted'
                }`}
                style={viewMode === 'map' ? { backgroundColor: theme.primaryColor } : {}}
              >
                <Map className="h-4 w-4" />
                <span className="hidden sm:inline">Map</span>
              </button>
              <button
                onClick={() => setViewMode('globe')}
                className={`flex items-center justify-center w-10 sm:w-auto sm:px-3 sm:gap-2 text-sm font-medium transition-colors ${
                  viewMode === 'globe'
                    ? 'text-white'
                    : 'bg-transparent text-muted-foreground hover:bg-muted'
                }`}
                style={viewMode === 'globe' ? { backgroundColor: theme.primaryColor } : {}}
              >
                <Globe className="h-4 w-4" />
                <span className="hidden sm:inline">Globe</span>
              </button>
            </div>
          </div>
        </div>


        {/* Map View - MapLibre handles both 2D (pitch=0) and 3D (pitch=60) */}
        <div className="relative h-full w-full">
          <MapLibreMap viewMode={viewMode} onNodeClick={handleNodeClick} />
        </div>

        {/* Network Info - Bottom Center - Only on larger screens */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[35] hidden md:block pointer-events-none">
          <div className="bg-card/85 backdrop-blur-xl rounded-lg px-4 py-2 shadow-lg border border-border">
            <p className="text-sm text-muted-foreground whitespace-nowrap">
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
        nodes={nodes}
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
