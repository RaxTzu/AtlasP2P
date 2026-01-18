import { z } from 'zod';

/**
 * Validation schemas for API endpoints
 */

// Nodes API query parameters
export const nodesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(100),
  tier: z.enum(['diamond', 'gold', 'silver', 'bronze', 'standard']).optional(),
  country: z.string().length(2).optional(), // ISO 3166-1 alpha-2
  version: z.string().optional(),
  verified: z.enum(['true', 'false']).optional(),
  online: z.enum(['true', 'false']).optional(),
  sort: z.enum(['last_seen', 'first_seen', 'pix_score', 'tier', 'uptime_percentage']).default('last_seen'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type NodesQuery = z.infer<typeof nodesQuerySchema>;

// Leaderboard API query parameters
export const leaderboardQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export type LeaderboardQuery = z.infer<typeof leaderboardQuerySchema>;

// Verification API body schemas
export const verifyInitiateSchema = z.object({
  nodeId: z.string().uuid('Invalid node ID format'),
  method: z.enum(['message_sign', 'user_agent', 'port_check', 'dns_txt', 'http_file']),
  turnstileToken: z.string().optional(), // Optional: required only if Turnstile is enabled
});

export type VerifyInitiate = z.infer<typeof verifyInitiateSchema>;

export const verifyCompleteSchema = z.object({
  verificationId: z.string().uuid('Invalid verification ID format'),
  proof: z.string().optional(),
  turnstileToken: z.string().optional(), // Optional: required only if Turnstile is enabled
});

export type VerifyComplete = z.infer<typeof verifyCompleteSchema>;

/**
 * Helper function to validate and parse query parameters
 */
export function validateQuery<T extends z.ZodType>(
  schema: T,
  params: URLSearchParams
): { success: true; data: z.infer<T> } | { success: false; error: string } {
  try {
    // Convert URLSearchParams to object
    const paramsObject: Record<string, string> = {};
    params.forEach((value, key) => {
      paramsObject[key] = value;
    });

    const result = schema.safeParse(paramsObject);

    if (!result.success) {
      const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return { success: false, error: `Validation failed: ${errors}` };
    }

    return { success: true, data: result.data };
  } catch (error) {
    return { success: false, error: 'Invalid query parameters' };
  }
}
