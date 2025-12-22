declare module 'react-leaflet-cluster' {
  import { FC, ReactNode } from 'react';
  import L from 'leaflet';

  interface MarkerClusterGroupProps {
    children?: ReactNode;
    chunkedLoading?: boolean;
    iconCreateFunction?: (cluster: L.MarkerCluster) => L.DivIcon;
    maxClusterRadius?: number;
    disableClusteringAtZoom?: number;
    spiderfyOnMaxZoom?: boolean;
    showCoverageOnHover?: boolean;
    zoomToBoundsOnClick?: boolean;
    singleMarkerMode?: boolean;
    spiderLegPolylineOptions?: L.PolylineOptions;
    polygonOptions?: L.PolylineOptions;
    animate?: boolean;
    animateAddingMarkers?: boolean;
    removeOutsideVisibleBounds?: boolean;
  }

  const MarkerClusterGroup: FC<MarkerClusterGroupProps>;
  export default MarkerClusterGroup;
}
