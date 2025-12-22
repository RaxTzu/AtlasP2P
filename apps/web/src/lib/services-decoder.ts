/**
 * Cryptocurrency P2P Services Decoder
 *
 * Decodes the services bitmask into human-readable service names
 * Compatible with Bitcoin, Litecoin, Dogecoin, and other Bitcoin-derived chains
 */

// Service flags as per Bitcoin protocol
export const SERVICE_FLAGS = {
  NODE_NETWORK: 1 << 0,        // 1 - This node can be asked for full blocks
  NODE_GETUTXO: 1 << 1,        // 2 - See BIP 64
  NODE_BLOOM: 1 << 2,          // 4 - See BIP 111
  NODE_WITNESS: 1 << 3,        // 8 - See BIP 144
  NODE_XTHIN: 1 << 4,          // 16 - Never formally proposed
  NODE_COMPACT_FILTERS: 1 << 6, // 64 - See BIP 157 & 158
  NODE_NETWORK_LIMITED: 1 << 10, // 1024 - See BIP 159
  NODE_P2P_V2: 1 << 11,        // 2048 - See BIP 324
} as const;

export const SERVICE_NAMES: Record<number, string> = {
  [SERVICE_FLAGS.NODE_NETWORK]: 'NODE_NETWORK',
  [SERVICE_FLAGS.NODE_GETUTXO]: 'NODE_GETUTXO',
  [SERVICE_FLAGS.NODE_BLOOM]: 'NODE_BLOOM',
  [SERVICE_FLAGS.NODE_WITNESS]: 'NODE_WITNESS',
  [SERVICE_FLAGS.NODE_XTHIN]: 'NODE_XTHIN',
  [SERVICE_FLAGS.NODE_COMPACT_FILTERS]: 'NODE_COMPACT_FILTERS',
  [SERVICE_FLAGS.NODE_NETWORK_LIMITED]: 'NODE_NETWORK_LIMITED',
  [SERVICE_FLAGS.NODE_P2P_V2]: 'NODE_P2P_V2',
};

export const SERVICE_DESCRIPTIONS: Record<number, string> = {
  [SERVICE_FLAGS.NODE_NETWORK]: 'Full node, can serve full blocks',
  [SERVICE_FLAGS.NODE_GETUTXO]: 'Supports UTXO queries (BIP 64)',
  [SERVICE_FLAGS.NODE_BLOOM]: 'Supports bloom filters (BIP 111)',
  [SERVICE_FLAGS.NODE_WITNESS]: 'Supports witness data (SegWit)',
  [SERVICE_FLAGS.NODE_XTHIN]: 'Supports Xthin blocks',
  [SERVICE_FLAGS.NODE_COMPACT_FILTERS]: 'Supports compact block filters (BIP 157/158)',
  [SERVICE_FLAGS.NODE_NETWORK_LIMITED]: 'Limited network node (BIP 159), last ~2 days of blocks',
  [SERVICE_FLAGS.NODE_P2P_V2]: 'Supports P2P v2 encrypted transport (BIP 324)',
};

/**
 * Decode services bitmask into array of service names
 */
export function decodeServices(services: number | string | null | undefined): string[] {
  if (services === null || services === undefined) {
    return [];
  }

  const servicesNum = typeof services === 'string' ? parseInt(services, 10) : services;

  if (isNaN(servicesNum) || servicesNum === 0) {
    return [];
  }

  const activeServices: string[] = [];

  for (const [flag, name] of Object.entries(SERVICE_NAMES)) {
    const flagNum = parseInt(flag, 10);
    if ((servicesNum & flagNum) === flagNum) {
      activeServices.push(name);
    }
  }

  return activeServices;
}

/**
 * Get services with descriptions
 */
export function getServicesWithDescriptions(services: number | string | null | undefined): Array<{ name: string; description: string }> {
  if (services === null || services === undefined) {
    return [];
  }

  const servicesNum = typeof services === 'string' ? parseInt(services, 10) : services;

  if (isNaN(servicesNum) || servicesNum === 0) {
    return [];
  }

  const activeServices: Array<{ name: string; description: string }> = [];

  for (const [flag, name] of Object.entries(SERVICE_NAMES)) {
    const flagNum = parseInt(flag, 10);
    if ((servicesNum & flagNum) === flagNum) {
      activeServices.push({
        name,
        description: SERVICE_DESCRIPTIONS[flagNum] || 'Unknown service',
      });
    }
  }

  return activeServices;
}

/**
 * Format services for display (comma-separated with value in parentheses)
 */
export function formatServices(services: number | string | null | undefined): string {
  if (services === null || services === undefined) {
    return 'None';
  }

  const servicesNum = typeof services === 'string' ? parseInt(services, 10) : services;

  if (isNaN(servicesNum)) {
    return 'Invalid';
  }

  if (servicesNum === 0) {
    return 'None (0)';
  }

  const serviceNames = decodeServices(servicesNum);

  if (serviceNames.length === 0) {
    return `Unknown (${servicesNum})`;
  }

  return `${serviceNames.join(', ')} (${servicesNum})`;
}
