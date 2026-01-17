import { createHash } from 'crypto';
import { getChainConfig, getChain } from '@atlasp2p/config';

// Lazy load secp256k1 to avoid WASM loading errors at module import time
let eccCache: any = null;
async function getEcc() {
  if (!eccCache) {
    eccCache = await import('tiny-secp256k1');
  }
  return eccCache;
}

/**
 * Verification helper functions for node ownership verification
 *
 * Supports multiple verification methods:
 * - message_sign: Cryptographic signature verification (multi-chain)
 * - user_agent: Custom user agent verification (via crawler)
 * - port_check: Port connectivity verification (via crawler)
 * - dns_txt: DNS TXT record verification
 */

export interface VerificationResult {
  valid: boolean;
  error?: string;
}

export interface NetworkConfig {
  messagePrefix: string;
  pubKeyHash: number;
  addressPrefix: string;
}

/**
 * Verification status constants
 * Used throughout the application for type safety and consistency
 */
export const VerificationStatus = {
  PENDING: 'pending' as const,
  PENDING_APPROVAL: 'pending_approval' as const,
  VERIFIED: 'verified' as const,
  FAILED: 'failed' as const,
  EXPIRED: 'expired' as const,
} as const;

export type VerificationStatusType = typeof VerificationStatus[keyof typeof VerificationStatus];

/**
 * Verification method constants
 */
export const VerificationMethod = {
  MESSAGE_SIGN: 'message_sign' as const,
  USER_AGENT: 'user_agent' as const,
  PORT_CHECK: 'port_check' as const,
  DNS_TXT: 'dns_txt' as const,
  HTTP_FILE: 'http_file' as const,
} as const;

export type VerificationMethodType = typeof VerificationMethod[keyof typeof VerificationMethod];

/**
 * Verification error codes for standardized error responses
 */
export const VerificationErrorCode = {
  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

  // Missing parameters
  MISSING_NODE_ID: 'MISSING_NODE_ID',
  MISSING_VERIFICATION_ID: 'MISSING_VERIFICATION_ID',
  PROOF_REQUIRED: 'PROOF_REQUIRED',

  // Authentication
  AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
  FORBIDDEN: 'FORBIDDEN',

  // Validation errors
  INVALID_NODE_ID: 'INVALID_NODE_ID',
  INVALID_VERIFICATION_ID: 'INVALID_VERIFICATION_ID',
  INVALID_DOMAIN_FORMAT: 'INVALID_DOMAIN_FORMAT',
  DOMAIN_BLOCKED: 'DOMAIN_BLOCKED',
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',
  INVALID_ADDRESS: 'INVALID_ADDRESS',
  INVALID_STATUS: 'INVALID_STATUS',

  // Not found
  NODE_NOT_FOUND: 'NODE_NOT_FOUND',
  VERIFICATION_NOT_FOUND: 'VERIFICATION_NOT_FOUND',

  // Status errors
  VERIFICATION_EXPIRED: 'VERIFICATION_EXPIRED',
  VERIFICATION_FAILED: 'VERIFICATION_FAILED',
  ALREADY_VERIFIED: 'ALREADY_VERIFIED',

  // Database errors
  DATABASE_ERROR: 'DATABASE_ERROR',
  DELETE_FAILED: 'DELETE_FAILED',
  CREATE_FAILED: 'CREATE_FAILED',
  UPDATE_FAILED: 'UPDATE_FAILED',

  // Turnstile
  TURNSTILE_REQUIRED: 'TURNSTILE_REQUIRED',
  TURNSTILE_FAILED: 'TURNSTILE_FAILED',
} as const;

export type VerificationErrorCodeType = typeof VerificationErrorCode[keyof typeof VerificationErrorCode];

// Fallback network configs for common chains (used when verifying other chains)
const FALLBACK_NETWORK_CONFIGS: Record<string, NetworkConfig> = {
  bitcoin: {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    pubKeyHash: 0x00,
    addressPrefix: '1',
  },
  dogecoin: {
    messagePrefix: '\x19Dogecoin Signed Message:\n',
    pubKeyHash: 0x1e,
    addressPrefix: 'D',
  },
  litecoin: {
    messagePrefix: '\x19Litecoin Signed Message:\n',
    pubKeyHash: 0x30,
    addressPrefix: 'L',
  },
};

/**
 * Get network configuration for the current chain from project config
 */
function getConfiguredNetworkConfig(): NetworkConfig {
  const chainConfig = getChainConfig();

  // Build the message prefix with proper length byte
  // The format is: \x{length}{Chain} Signed Message:\n
  const rawPrefix = chainConfig.messagePrefix || `${chainConfig.name} Signed Message:\n`;

  // If the config already has the length prefix (starts with \x), use as-is
  // Otherwise, prepend the length byte
  let messagePrefix: string;
  if (rawPrefix.startsWith('\\x') || rawPrefix.charCodeAt(0) < 32) {
    messagePrefix = rawPrefix;
  } else {
    // Add length prefix (Bitcoin-style message signing)
    const prefixLength = rawPrefix.length;
    messagePrefix = String.fromCharCode(prefixLength) + rawPrefix;
  }

  return {
    messagePrefix,
    pubKeyHash: chainConfig.pubKeyHash ? parseInt(chainConfig.pubKeyHash, 16) : 0x00,
    addressPrefix: chainConfig.addressPrefix || '1',
  };
}

/**
 * Get network configuration from chain name or custom config
 * Uses project config for current chain, fallback configs for other chains
 */
export function getNetworkConfig(chain?: string, customConfig?: Partial<NetworkConfig>): NetworkConfig {
  const currentChain = getChain().toLowerCase();

  // If no chain specified or matches current chain, use configured values
  if (!chain || chain.toLowerCase() === currentChain) {
    const configuredConfig = getConfiguredNetworkConfig();

    // Apply any custom overrides
    if (customConfig) {
      return {
        messagePrefix: customConfig.messagePrefix || configuredConfig.messagePrefix,
        pubKeyHash: customConfig.pubKeyHash ?? configuredConfig.pubKeyHash,
        addressPrefix: customConfig.addressPrefix || configuredConfig.addressPrefix,
      };
    }

    return configuredConfig;
  }

  // For other chains, use fallback configs
  const baseConfig = FALLBACK_NETWORK_CONFIGS[chain.toLowerCase()];

  if (!baseConfig && !customConfig) {
    // Default to Bitcoin-like config
    return FALLBACK_NETWORK_CONFIGS.bitcoin;
  }

  return {
    messagePrefix: customConfig?.messagePrefix || baseConfig?.messagePrefix || '\x18Bitcoin Signed Message:\n',
    pubKeyHash: customConfig?.pubKeyHash ?? baseConfig?.pubKeyHash ?? 0x00,
    addressPrefix: customConfig?.addressPrefix || baseConfig?.addressPrefix || '1',
  };
}

/**
 * Create magic hash for message signing (Bitcoin-style)
 */
function magicHash(message: string, messagePrefix: string): Buffer {
  const prefixBuffer = Buffer.from(messagePrefix, 'utf8');
  const messageBuffer = Buffer.from(message, 'utf8');

  // Varint encode the message length
  const messageLengthBuffer = encodeVarInt(messageBuffer.length);

  const buffer = Buffer.concat([
    prefixBuffer,
    messageLengthBuffer,
    messageBuffer,
  ]);

  // Double SHA256
  return createHash('sha256').update(
    createHash('sha256').update(buffer).digest()
  ).digest();
}

/**
 * Encode a number as a Bitcoin-style varint
 */
function encodeVarInt(n: number): Buffer {
  if (n < 0xfd) {
    return Buffer.from([n]);
  } else if (n <= 0xffff) {
    const buf = Buffer.alloc(3);
    buf[0] = 0xfd;
    buf.writeUInt16LE(n, 1);
    return buf;
  } else if (n <= 0xffffffff) {
    const buf = Buffer.alloc(5);
    buf[0] = 0xfe;
    buf.writeUInt32LE(n, 1);
    return buf;
  } else {
    throw new Error('Value too large for varint');
  }
}

/**
 * Decode a Bitcoin-style signature
 * Recovery ID type must be 0, 1, 2, or 3 for tiny-secp256k1
 */
function decodeSignature(signature: Buffer): { recovery: 0 | 1 | 2 | 3; signature: Buffer } {
  if (signature.length !== 65) {
    throw new Error('Invalid signature length');
  }

  const flagByte = signature[0] - 27;
  if (flagByte > 15 || flagByte < 0) {
    throw new Error('Invalid signature parameter');
  }

  const recovery = (flagByte & 3) as 0 | 1 | 2 | 3;

  return {
    recovery,
    signature: signature.slice(1),
  };
}

/**
 * Hash160 (RIPEMD160(SHA256(data)))
 */
function hash160(data: Buffer): Buffer {
  const sha256 = createHash('sha256').update(data).digest();
  return createHash('ripemd160').update(sha256).digest();
}

/**
 * Base58Check encode
 */
function base58CheckEncode(version: number, payload: Buffer): string {
  const versionBuffer = Buffer.from([version]);
  const data = Buffer.concat([versionBuffer, payload]);
  const checksum = createHash('sha256').update(
    createHash('sha256').update(data).digest()
  ).digest().slice(0, 4);

  return base58Encode(Buffer.concat([data, checksum]));
}

/**
 * Base58 encode
 */
function base58Encode(buffer: Buffer): string {
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

  let num = BigInt('0x' + buffer.toString('hex'));
  let str = '';

  while (num > 0n) {
    const remainder = num % 58n;
    str = ALPHABET[Number(remainder)] + str;
    num = num / 58n;
  }

  // Add leading zeros
  for (const byte of buffer) {
    if (byte === 0) {
      str = '1' + str;
    } else {
      break;
    }
  }

  return str;
}

/**
 * Verify a signed message using Bitcoin-style message signing
 * Supports multiple chains via network configuration
 *
 * @param message - The original challenge message
 * @param address - The cryptocurrency address that signed the message
 * @param signature - The signature in base64 format
 * @param networkConfig - Optional network configuration for non-Bitcoin chains
 * @returns Verification result
 */
export async function verifyMessageSignature(
  message: string,
  address: string,
  signature: string,
  networkConfig?: NetworkConfig
): Promise<VerificationResult> {
  try {
    // Validate inputs
    if (!message || !address || !signature) {
      return {
        valid: false,
        error: 'Missing required parameters: message, address, or signature',
      };
    }

    // Get network config (defaults to current chain from config)
    const config = networkConfig || getNetworkConfig();

    // Validate address prefix
    if (config.addressPrefix && !address.startsWith(config.addressPrefix)) {
      return {
        valid: false,
        error: `Address should start with '${config.addressPrefix}' for this chain`,
      };
    }

    // Decode signature
    const signatureBuffer = Buffer.from(signature, 'base64');
    const { recovery, signature: sigBytes } = decodeSignature(signatureBuffer);

    // Create message hash
    const hash = magicHash(message, config.messagePrefix);

    // Lazy load secp256k1 (loads WASM at runtime, inside try-catch)
    const ecc = await getEcc();

    // Recover public key from signature
    const publicKey = ecc.recover(hash, sigBytes, recovery, true);
    if (!publicKey) {
      return {
        valid: false,
        error: 'Could not recover public key from signature',
      };
    }

    // Generate address from recovered public key
    const publicKeyHash = hash160(Buffer.from(publicKey));
    const recoveredAddress = base58CheckEncode(config.pubKeyHash, publicKeyHash);

    // Compare addresses
    const isValid = recoveredAddress === address;

    return {
      valid: isValid,
      error: isValid ? undefined : `Signature verification failed. Expected ${address}, got ${recoveredAddress}`,
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Signature verification failed',
    };
  }
}

/**
 * Verify DNS TXT record contains the challenge AND domain resolves to node IP
 *
 * Uses DNS-over-HTTPS (Google Public DNS) to check TXT records and A/AAAA records
 *
 * SECURITY: This validates BOTH domain ownership (TXT) AND node control (IP resolution)
 *
 * @param domain - The domain to check
 * @param challenge - The expected TXT record value
 * @param nodeIp - The node's IP address that domain must resolve to
 * @returns Verification result
 */
export async function verifyDnsTxt(
  domain: string,
  challenge: string,
  nodeIp: string
): Promise<VerificationResult> {
  try {
    // Validate inputs
    if (!domain || !challenge || !nodeIp) {
      return {
        valid: false,
        error: 'Missing required parameters: domain, challenge, or nodeIp',
      };
    }

    // Step 1: Check TXT record (proves domain ownership)
    const txtResponse = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=TXT`,
      {
        headers: {
          Accept: 'application/dns-json',
        },
      }
    );

    if (!txtResponse.ok) {
      return {
        valid: false,
        error: 'Failed to query DNS TXT records',
      };
    }

    const txtData = await txtResponse.json();

    // Check if we have TXT records
    if (!txtData.Answer || !Array.isArray(txtData.Answer)) {
      return {
        valid: false,
        error: 'No TXT records found for this domain',
      };
    }

    // Look for our challenge in the TXT records
    const txtFound = txtData.Answer.some((record: any) => {
      if (record.type !== 16) return false; // 16 = TXT record
      // TXT records are quoted, remove quotes
      const txtValue = record.data.replace(/"/g, '');
      return txtValue === challenge;
    });

    if (!txtFound) {
      return {
        valid: false,
        error: 'Challenge not found in DNS TXT records',
      };
    }

    // Step 2: Resolve domain to IP addresses (proves node control)
    const resolvedIps: string[] = [];

    // Query A records (IPv4)
    const ipv4Response = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=A`,
      {
        headers: {
          Accept: 'application/dns-json',
        },
      }
    );

    if (ipv4Response.ok) {
      const ipv4Data = await ipv4Response.json();
      if (ipv4Data.Answer && Array.isArray(ipv4Data.Answer)) {
        ipv4Data.Answer.forEach((record: any) => {
          if (record.type === 1) { // 1 = A record
            resolvedIps.push(record.data);
          }
        });
      }
    }

    // Query AAAA records (IPv6)
    const ipv6Response = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=AAAA`,
      {
        headers: {
          Accept: 'application/dns-json',
        },
      }
    );

    if (ipv6Response.ok) {
      const ipv6Data = await ipv6Response.json();
      if (ipv6Data.Answer && Array.isArray(ipv6Data.Answer)) {
        ipv6Data.Answer.forEach((record: any) => {
          if (record.type === 28) { // 28 = AAAA record
            resolvedIps.push(record.data);
          }
        });
      }
    }

    // Check if domain resolves to any IP
    if (resolvedIps.length === 0) {
      return {
        valid: false,
        error: `Domain ${domain} does not resolve to any IP address`,
      };
    }

    // Check if domain resolves to the node's IP
    if (!resolvedIps.includes(nodeIp)) {
      return {
        valid: false,
        error: `Domain ${domain} resolves to ${resolvedIps.join(', ')} but node IP is ${nodeIp}`,
      };
    }

    // Both checks passed!
    return {
      valid: true,
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'DNS verification failed',
    };
  }
}

/**
 * Verify HTTP file challenge
 *
 * Makes an HTTP GET request to the node's IP address to verify the challenge file.
 * This proves:
 * 1. Direct access to the node's IP and port
 * 2. File system access (ability to create files)
 * 3. Process execution rights (ability to run binaries)
 * 4. Network binding capability (can bind to port 8080)
 *
 * SECURITY: This method directly validates node control without DNS intermediaries
 *
 * @param nodeIp - The node's IP address
 * @param challenge - The expected challenge token
 * @returns Verification result
 */
export async function verifyHttpFile(
  nodeIp: string,
  challenge: string
): Promise<VerificationResult> {
  try {
    // Validate inputs
    if (!nodeIp || !challenge) {
      return {
        valid: false,
        error: 'Missing required parameters: nodeIp or challenge',
      };
    }

    // Construct the verification URL
    const url = `http://${nodeIp}:8080/.well-known/node-verify/${challenge}`;

    // Make HTTP GET request with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'AtlasP2P-Verifier/1.0',
      },
    });

    clearTimeout(timeoutId);

    // Check if response is successful
    if (!response.ok) {
      return {
        valid: false,
        error: `HTTP request failed with status ${response.status}`,
      };
    }

    // Read response body
    const content = await response.text();

    // Verify content matches expected format: "node-verify:{challenge}"
    const expectedContent = `node-verify:${challenge}`;
    if (content.trim() !== expectedContent) {
      return {
        valid: false,
        error: `Challenge content mismatch. Expected: "${expectedContent}", Got: "${content.trim()}"`,
      };
    }

    // Verification successful!
    return {
      valid: true,
    };
  } catch (error) {
    // Handle abort/timeout
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        valid: false,
        error: 'Connection timeout. Make sure the verification server is running on port 8080',
      };
    }

    // Handle network errors
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'HTTP file verification failed',
    };
  }
}

/**
 * Extract address from signature proof
 *
 * For message_sign verification, the proof format is:
 * address:signature
 *
 * @param proof - The proof string
 * @returns Extracted address and signature, or null if invalid
 */
export function parseSignatureProof(proof: string): {
  address: string;
  signature: string;
} | null {
  try {
    // Handle case where signature contains colons (unlikely but possible)
    const firstColonIndex = proof.indexOf(':');
    if (firstColonIndex === -1) {
      return null;
    }

    const address = proof.substring(0, firstColonIndex);
    const signature = proof.substring(firstColonIndex + 1);

    if (!address || !signature) {
      return null;
    }

    return { address, signature };
  } catch {
    return null;
  }
}

/**
 * Validate cryptocurrency address format
 *
 * @param address - The address to validate
 * @param expectedPrefix - Optional expected prefix
 * @returns True if valid format
 */
export function isValidAddress(address: string, expectedPrefix?: string): boolean {
  // Basic validation for common address formats
  if (!address || address.length < 26 || address.length > 35) {
    return false;
  }

  // If expected prefix is provided, check it
  if (expectedPrefix && !address.startsWith(expectedPrefix)) {
    return false;
  }

  // Check for valid starting characters (common prefixes)
  const validPrefixes = ['D', '1', '3', 'bc1', 'L', 'M', 'ltc1'];
  return validPrefixes.some((prefix) => address.startsWith(prefix));
}

/**
 * Validate verification challenge format
 *
 * @param method - The verification method
 * @param challenge - The challenge string
 * @returns True if valid format
 */
export function isValidChallenge(method: string, challenge: string): boolean {
  if (!challenge) return false;

  switch (method) {
    case 'message_sign':
      return challenge.startsWith('node-verify:');
    case 'user_agent':
      return challenge.startsWith('NodeVerify:');
    case 'dns_txt':
      return challenge.startsWith('node-verify=');
    case 'port_check':
      return challenge.length === 32; // hex string
    default:
      return false;
  }
}
