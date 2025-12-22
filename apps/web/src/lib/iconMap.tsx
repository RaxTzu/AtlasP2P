// ===========================================
// ICON MAPPING UTILITIES
// ===========================================

import {
  Github,
  Twitter,
  MessageCircle,
  Send,
  Youtube,
  Linkedin,
  Map,
  BarChart3,
  Trophy,
  User,
  Info,
  Settings,
  FileText,
  Server,
  Activity,
  LayoutDashboard,
  type LucideIcon,
} from 'lucide-react';

// Map icon names to Lucide React components
export const socialIconMap: Record<string, LucideIcon> = {
  github: Github,
  twitter: Twitter,
  discord: MessageCircle,
  telegram: Send,
  reddit: MessageCircle, // Using MessageCircle as fallback
  youtube: Youtube,
  medium: FileText,
  linkedin: Linkedin,
};

export const navigationIconMap: Record<string, LucideIcon> = {
  map: Map,
  barchart: BarChart3,
  trophy: Trophy,
  server: Server,
  activity: Activity,
  user: User,
  info: Info,
  settings: Settings,
  docs: FileText,
  'layout-dashboard': LayoutDashboard,
};

export function getSocialIcon(iconName: string): LucideIcon {
  return socialIconMap[iconName] || MessageCircle;
}

export function getNavigationIcon(iconName: string): LucideIcon {
  return navigationIconMap[iconName] || Map;
}
