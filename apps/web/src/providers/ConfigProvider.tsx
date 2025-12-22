'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { initializeConfig } from '@atlasp2p/config';
import type { ProjectConfig } from '@atlasp2p/types';

const ConfigContext = createContext<ProjectConfig | null>(null);

export function ConfigProvider({
  children,
  config,
}: {
  children: ReactNode;
  config: ProjectConfig;
}) {
  // Initialize the config system immediately (works during SSR)
  initializeConfig(config);

  return <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>;
}

export function useConfig() {
  const config = useContext(ConfigContext);
  if (!config) {
    throw new Error('useConfig must be used within ConfigProvider');
  }
  return config;
}
