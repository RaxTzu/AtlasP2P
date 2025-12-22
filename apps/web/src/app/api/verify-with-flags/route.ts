// ===========================================
// EXAMPLE: API ROUTE WITH FEATURE FLAGS
// ===========================================
// This demonstrates how to use feature flags in API routes

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import {
  requireAuthentication,
  requireVerification,
  requireTurnstile,
  isVerificationMethodEnabled,
  getEnabledVerificationMethods,
  getVerificationConfig,
} from '@/lib/feature-flags.server';
import { getChain } from '@atlasp2p/config';

/**
 * Initiate node verification
 * EXAMPLE: Shows feature flag enforcement at multiple levels
 */
export async function POST(request: NextRequest) {
  // ===========================================
  // STEP 1: Check if core features are enabled
  // ===========================================

  // Check if authentication is enabled
  const authError = requireAuthentication();
  if (authError) return authError;

  // Check if verification is enabled
  const verificationError = requireVerification();
  if (verificationError) return verificationError;

  // ===========================================
  // STEP 2: Authenticate the user
  // ===========================================

  const supabase = await createClient();
  const { data: { user }, error: authUserError } = await supabase.auth.getUser();

  if (authUserError || !user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  // ===========================================
  // STEP 3: Parse and validate request
  // ===========================================

  const body = await request.json();
  const { nodeId, method, turnstileToken } = body;

  // Validate required fields
  if (!nodeId || !method) {
    return NextResponse.json(
      { error: 'nodeId and method are required' },
      { status: 400 }
    );
  }

  // Check if the requested verification method is enabled
  if (!isVerificationMethodEnabled(method)) {
    const enabledMethods = getEnabledVerificationMethods();
    return NextResponse.json(
      {
        error: 'Verification method not enabled',
        message: `The ${method} verification method is not enabled. Available methods: ${enabledMethods.join(', ')}`,
        enabledMethods,
      },
      { status: 400 }
    );
  }

  // ===========================================
  // STEP 4: Check Turnstile protection (if enabled)
  // ===========================================

  const turnstileError = await requireTurnstile('verification', turnstileToken);
  if (turnstileError) return turnstileError;

  // ===========================================
  // STEP 5: Get verification configuration
  // ===========================================

  const verificationConfig = getVerificationConfig();

  // Check if payment verification is required
  if (verificationConfig.requirePayment) {
    // TODO: Implement payment verification logic
    return NextResponse.json(
      {
        error: 'Payment required',
        message: `Please send ${verificationConfig.paymentAmount} ${verificationConfig.paymentCurrency} to verify node ownership`,
        paymentDetails: {
          amount: verificationConfig.paymentAmount,
          currency: verificationConfig.paymentCurrency,
        },
      },
      { status: 402 } // Payment Required
    );
  }

  // ===========================================
  // STEP 6: Check if node exists
  // ===========================================

  const { data: node, error: nodeError } = await supabase
    .from('nodes')
    .select('id, ip, port')
    .eq('id', nodeId)
    .single();

  if (nodeError || !node) {
    return NextResponse.json(
      { error: 'Node not found' },
      { status: 404 }
    );
  }

  // ===========================================
  // STEP 7: Check if there's already a pending verification
  // ===========================================

  const { data: existing } = await supabase
    .from('verifications')
    .select('id')
    .eq('node_id', nodeId)
    .eq('status', 'pending')
    .single();

  if (existing) {
    return NextResponse.json(
      { error: 'A verification is already pending for this node' },
      { status: 409 }
    );
  }

  // ===========================================
  // STEP 8: Generate challenge based on method
  // ===========================================

  const challenge = generateChallenge(method);
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + verificationConfig.challengeExpiryHours);

  // ===========================================
  // STEP 9: Create verification record
  // ===========================================

  const { data: verification, error: createError } = await supabase
    .from('verifications')
    .insert({
      node_id: nodeId,
      user_id: user.id,
      method,
      challenge,
      status: 'pending',
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (createError) {
    return NextResponse.json(
      { error: 'Failed to create verification', details: createError.message },
      { status: 500 }
    );
  }

  // ===========================================
  // STEP 10: Return instructions
  // ===========================================

  const instructions = getVerificationInstructions(method, challenge, node);

  return NextResponse.json({
    verification: {
      id: verification.id,
      method,
      challenge,
      expiresAt: expiresAt.toISOString(),
      autoApprove: verificationConfig.autoApprove,
    },
    instructions,
    config: {
      requiresAdminApproval: !verificationConfig.autoApprove,
      expiryHours: verificationConfig.challengeExpiryHours,
    },
  });
}

function generateChallenge(method: string): string {
  const nonce = randomBytes(16).toString('hex');

  switch (method) {
    case 'message_sign':
      return `node-verify:${nonce}`;
    case 'user_agent':
      return `NodeVerify:${nonce.substring(0, 8)}`;
    case 'port_challenge':
      return nonce;
    case 'dns_txt':
      return `node-verify=${nonce}`;
    default:
      return nonce;
  }
}

function getVerificationInstructions(
  method: string,
  challenge: string,
  node: { ip: string; port: number }
): string {
  // Get chain name from environment for instructions
  const chain = getChain();
  const cliName = `${chain}-cli`;
  const confName = `${chain}.conf`;

  switch (method) {
    case 'message_sign':
      return `Sign the following message with your node's wallet:\n\n${challenge}\n\nUse: ${cliName} signmessage "<address>" "${challenge}"`;
    case 'user_agent':
      return `Add the following to your ${confName} and restart your node:\n\nuseragent=${challenge}\n\nYour node at ${node.ip}:${node.port} will be checked within 24 hours.`;
    case 'port_challenge':
      return `Ensure your node at ${node.ip}:${node.port} is accessible. We will verify connectivity and respond to our challenge.`;
    case 'dns_txt':
      return `Add the following DNS TXT record to the domain pointing to your node's IP:\n\n${challenge}\n\nThe record should be on the domain that resolves to ${node.ip}`;
    default:
      return 'Unknown verification method';
  }
}
