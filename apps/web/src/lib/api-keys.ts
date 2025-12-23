/**
 * API Key Management Utilities
 *
 * Handles API key generation, validation, and management
 */

import { createAdminClient } from '@/lib/supabase/server';
import { getChainConfig } from '@atlasp2p/config';

// ===========================================
// CONSTANTS
// ===========================================

// API key prefix derived from chain ticker (e.g., "dingo_sk_" for DINGO)
function getKeyPrefix(): string {
  const ticker = getChainConfig().ticker.toLowerCase();
  return `${ticker}_sk_`;
}

// Key length (excluding prefix)
const KEY_LENGTH = 32;

// Available scopes
export const API_SCOPES = {
  'read:nodes': 'Read node information',
  'read:stats': 'Read network statistics',
  'read:leaderboard': 'Read leaderboard data',
  'read:profiles': 'Read node profiles',
} as const;

export type ApiScope = keyof typeof API_SCOPES;

// ===========================================
// TYPES
// ===========================================

export interface ApiKey {
  id: string;
  user_id: string;
  name: string;
  key_prefix: string;
  description?: string;
  scopes: ApiScope[];
  rate_limit: number;
  last_used_at?: string;
  request_count: number;
  is_active: boolean;
  expires_at?: string;
  revoked_at?: string;
  revoked_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateApiKeyResult {
  key: ApiKey;
  rawKey: string; // Only returned once on creation
}

export interface ValidateApiKeyResult {
  valid: boolean;
  keyId?: string;
  userId?: string;
  scopes?: ApiScope[];
  rateLimit?: number;
  error?: string;
}

// ===========================================
// KEY GENERATION
// ===========================================

/**
 * Generate a cryptographically secure random API key
 */
function generateRawKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const randomValues = new Uint8Array(KEY_LENGTH);
  crypto.getRandomValues(randomValues);

  let key = '';
  for (let i = 0; i < KEY_LENGTH; i++) {
    key += chars[randomValues[i] % chars.length];
  }

  return getKeyPrefix() + key;
}

/**
 * Hash an API key using SHA-256
 */
async function hashKey(rawKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(rawKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Get the display prefix from a raw key (for identification)
 */
function getKeyDisplayPrefix(rawKey: string): string {
  const prefix = getKeyPrefix();
  return rawKey.substring(0, prefix.length + 8); // "{ticker}_sk_" + first 8 chars
}

// ===========================================
// KEY MANAGEMENT
// ===========================================

/**
 * Create a new API key for a user
 */
export async function createApiKey(
  userId: string,
  name: string,
  options: {
    description?: string;
    scopes?: ApiScope[];
    rateLimit?: number;
    expiresAt?: Date;
  } = {}
): Promise<CreateApiKeyResult> {
  const adminClient = createAdminClient();

  // Generate the raw key
  const rawKey = generateRawKey();
  const keyHash = await hashKey(rawKey);
  const keyPrefix = getKeyDisplayPrefix(rawKey);

  // Create the key record
  const { data: key, error } = await adminClient
    .from('api_keys')
    .insert({
      user_id: userId,
      name,
      key_prefix: keyPrefix,
      key_hash: keyHash,
      description: options.description || null,
      scopes: options.scopes || ['read:nodes', 'read:stats', 'read:leaderboard'],
      rate_limit: options.rateLimit || 1000,
      expires_at: options.expiresAt?.toISOString() || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create API key: ${error.message}`);
  }

  return {
    key: key as ApiKey,
    rawKey, // Return raw key only once
  };
}

/**
 * List all API keys for a user (without revealing key hashes)
 */
export async function listApiKeys(userId: string): Promise<ApiKey[]> {
  const adminClient = createAdminClient();

  const { data: keys, error } = await adminClient
    .from('api_keys')
    .select('id, user_id, name, key_prefix, description, scopes, rate_limit, last_used_at, request_count, is_active, expires_at, revoked_at, revoked_reason, created_at, updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list API keys: ${error.message}`);
  }

  return keys as ApiKey[];
}

/**
 * Get a single API key by ID (for the owner)
 */
export async function getApiKey(userId: string, keyId: string): Promise<ApiKey | null> {
  const adminClient = createAdminClient();

  const { data: key, error } = await adminClient
    .from('api_keys')
    .select('id, user_id, name, key_prefix, description, scopes, rate_limit, last_used_at, request_count, is_active, expires_at, revoked_at, revoked_reason, created_at, updated_at')
    .eq('id', keyId)
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get API key: ${error.message}`);
  }

  return key as ApiKey;
}

/**
 * Update an API key
 */
export async function updateApiKey(
  userId: string,
  keyId: string,
  updates: {
    name?: string;
    description?: string;
    scopes?: ApiScope[];
    rateLimit?: number;
    isActive?: boolean;
  }
): Promise<ApiKey | null> {
  const adminClient = createAdminClient();

  const updateData: Record<string, unknown> = {};
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.scopes !== undefined) updateData.scopes = updates.scopes;
  if (updates.rateLimit !== undefined) updateData.rate_limit = updates.rateLimit;
  if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

  const { data: key, error } = await adminClient
    .from('api_keys')
    .update(updateData)
    .eq('id', keyId)
    .eq('user_id', userId)
    .select('id, user_id, name, key_prefix, description, scopes, rate_limit, last_used_at, request_count, is_active, expires_at, revoked_at, revoked_reason, created_at, updated_at')
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to update API key: ${error.message}`);
  }

  return key as ApiKey;
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(
  userId: string,
  keyId: string,
  reason?: string
): Promise<boolean> {
  const adminClient = createAdminClient();

  const { error } = await adminClient
    .from('api_keys')
    .update({
      is_active: false,
      revoked_at: new Date().toISOString(),
      revoked_reason: reason || 'Manually revoked by user',
    })
    .eq('id', keyId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to revoke API key: ${error.message}`);
  }

  return true;
}

/**
 * Delete an API key permanently
 */
export async function deleteApiKey(userId: string, keyId: string): Promise<boolean> {
  const adminClient = createAdminClient();

  const { error } = await adminClient
    .from('api_keys')
    .delete()
    .eq('id', keyId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to delete API key: ${error.message}`);
  }

  return true;
}

/**
 * Rotate an API key (revoke old, create new with same settings)
 */
export async function rotateApiKey(
  userId: string,
  keyId: string
): Promise<CreateApiKeyResult> {
  const adminClient = createAdminClient();

  // Get existing key details
  const { data: existingKey, error: fetchError } = await adminClient
    .from('api_keys')
    .select('*')
    .eq('id', keyId)
    .eq('user_id', userId)
    .single();

  if (fetchError || !existingKey) {
    throw new Error('API key not found');
  }

  // Revoke the old key
  await revokeApiKey(userId, keyId, 'Rotated to new key');

  // Create new key with same settings
  const newKey = await createApiKey(userId, existingKey.name, {
    description: existingKey.description,
    scopes: existingKey.scopes,
    rateLimit: existingKey.rate_limit,
  });

  return newKey;
}

// ===========================================
// KEY VALIDATION
// ===========================================

/**
 * Validate an API key and return its details
 */
export async function validateApiKey(
  rawKey: string,
  endpoint?: string,
  method?: string,
  ipAddress?: string
): Promise<ValidateApiKeyResult> {
  // Quick validation
  const prefix = getKeyPrefix();
  if (!rawKey || !rawKey.startsWith(prefix)) {
    return { valid: false, error: 'Invalid API key format' };
  }

  try {
    const keyHash = await hashKey(rawKey);
    const adminClient = createAdminClient();

    // Use the database function for validation
    const { data, error } = await adminClient.rpc('validate_api_key', {
      p_key_hash: keyHash,
      p_endpoint: endpoint || null,
      p_method: method || null,
      p_ip_address: ipAddress || null,
    });

    if (error) {
      console.error('[API Keys] Validation error:', error);
      return { valid: false, error: 'Validation failed' };
    }

    const result = data?.[0];
    if (!result || !result.is_valid) {
      return { valid: false, error: 'Invalid or expired API key' };
    }

    return {
      valid: true,
      keyId: result.key_id,
      userId: result.user_id,
      scopes: result.scopes,
      rateLimit: result.rate_limit,
    };
  } catch (error) {
    console.error('[API Keys] Validation exception:', error);
    return { valid: false, error: 'Validation failed' };
  }
}

/**
 * Check if a scope is allowed for a validated key
 */
export function hasScope(validatedScopes: ApiScope[], requiredScope: ApiScope): boolean {
  return validatedScopes.includes(requiredScope);
}

// ===========================================
// MIDDLEWARE HELPER
// ===========================================

/**
 * Extract API key from request headers
 */
export function extractApiKey(headers: Headers): string | null {
  const prefix = getKeyPrefix();

  // Check Authorization header first (Bearer token)
  const authHeader = headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    if (token.startsWith(prefix)) {
      return token;
    }
  }

  // Check X-API-Key header
  const apiKeyHeader = headers.get('X-API-Key');
  if (apiKeyHeader?.startsWith(prefix)) {
    return apiKeyHeader;
  }

  return null;
}
