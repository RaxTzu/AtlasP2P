'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Copy, Loader2, Shield, Key, Globe, Wallet, Terminal, QrCode, RefreshCw, Trash2, Clock } from 'lucide-react';
import { getThemeConfig, getChainConfig } from '@/config';
import { TurnstileWidget } from '@/components/turnstile/TurnstileWidget';
import { useVerificationMethods, useTurnstileProtection } from '@/hooks/use-feature-flags';
import type { VerificationMethod } from '@atlasp2p/types';
import { ProgressSteps, type Step } from '@/components/ui/ProgressSteps';

// DNS polling configuration
const DNS_POLL_INTERVAL = 60 * 1000; // 60 seconds
const DNS_POLL_DURATION = 10 * 60 * 1000; // 10 minutes
const DNS_MANUAL_COOLDOWN = 5 * 60 * 1000; // 5 minutes
const DNS_STOP_PENALTY_COOLDOWN = 3 * 60 * 1000; // 3 minutes penalty for manual stop

interface VerificationModalProps {
  nodeId: string;
  nodeIp: string;
  nodePort: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface VerificationStep {
  method: VerificationMethod | null;
  challenge: string | null;
  verificationId: string | null;
  instructions: string | null;
  requiresAdminApproval?: boolean;
}

interface PendingVerification {
  id: string;
  method: VerificationMethod;
  challenge: string;
  expires_at: string;
  status: 'pending' | 'pending_approval';
}

export function VerificationModal({
  nodeId,
  nodeIp,
  nodePort,
  isOpen,
  onClose,
  onSuccess
}: VerificationModalProps) {
  const theme = getThemeConfig();
  const chainConfig = getChainConfig();
  const enabledMethods = useVerificationMethods();
  const requiresTurnstile = useTurnstileProtection('verification');

  const [step, setStep] = useState<'select' | 'pending' | 'challenge' | 'proof' | 'complete'>('select');
  const [verification, setVerification] = useState<VerificationStep>({
    method: null,
    challenge: null,
    verificationId: null,
    instructions: null,
    requiresAdminApproval: false
  });
  const [pendingVerification, setPendingVerification] = useState<PendingVerification | null>(null);
  const [proof, setProof] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingPending, setCheckingPending] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // DNS verification state
  const [dnsDomain, setDnsDomain] = useState('');
  const [dnsPolling, setDnsPolling] = useState(false);
  const [dnsCheckCount, setDnsCheckCount] = useState(0);
  const [dnsLastCheck, setDnsLastCheck] = useState<Date | null>(null);
  const [dnsMessage, setDnsMessage] = useState<string | null>(null);
  const [manualCheckCooldown, setManualCheckCooldown] = useState(0);
  const [startCooldown, setStartCooldown] = useState(0); // Cooldown for starting auto-check
  const pollStartTimeRef = useRef<number | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const cooldownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startCooldownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check for pending verification when modal opens
  useEffect(() => {
    if (isOpen) {
      checkPendingVerification();
    }
  }, [isOpen, nodeId]);

  const checkPendingVerification = async () => {
    setCheckingPending(true);
    try {
      const response = await fetch(`/api/verify?nodeId=${nodeId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.pending) {
          setPendingVerification(data.pending);
          setStep('pending');
        } else {
          setPendingVerification(null);
          setStep('select');
        }
      }
    } catch (err) {
      // No pending verification or error checking
      setPendingVerification(null);
      setStep('select');
    } finally {
      setCheckingPending(false);
    }
  };

  const handleCancelPending = async () => {
    if (!pendingVerification) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/verify?verificationId=${pendingVerification.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to cancel verification');
      }

      setPendingVerification(null);
      setStep('select');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel verification');
    } finally {
      setLoading(false);
    }
  };

  const handleResumePending = () => {
    if (!pendingVerification) return;

    setVerification({
      method: pendingVerification.method,
      challenge: pendingVerification.challenge,
      verificationId: pendingVerification.id,
      instructions: null,
      requiresAdminApproval: false
    });
    setStep('challenge');
  };

  // DNS verification check function
  const checkDnsVerification = useCallback(async (isManual = false) => {
    if (!verification.verificationId || !dnsDomain || verification.method !== 'dns_txt') {
      return false;
    }

    setDnsMessage('Checking DNS records...');

    try {
      const response = await fetch('/api/verify/dns-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verificationId: verification.verificationId,
          domain: dnsDomain
        })
      });

      const data = await response.json();
      setDnsLastCheck(new Date());
      setDnsCheckCount(prev => prev + 1);

      if (data.verified) {
        // Success!
        setDnsPolling(false);
        setDnsMessage('✓ DNS verification successful!');
        setVerification(prev => ({ ...prev, requiresAdminApproval: true }));
        setStep('complete');
        return true;
      } else {
        setDnsMessage(data.message || 'DNS record not found yet...');

        // If manual check, set cooldown
        if (isManual) {
          const cooldownEnd = Date.now() + DNS_MANUAL_COOLDOWN;
          localStorage.setItem(`dns-cooldown-${verification.verificationId}`, cooldownEnd.toString());
          startCooldownTimer(cooldownEnd);
        }
        return false;
      }
    } catch (err) {
      setDnsMessage('Error checking DNS. Will retry...');
      return false;
    }
  }, [verification.verificationId, verification.method, dnsDomain]);

  // Start manual check cooldown timer
  const startCooldownTimer = useCallback((cooldownEnd: number) => {
    if (cooldownIntervalRef.current) {
      clearInterval(cooldownIntervalRef.current);
    }

    const updateCooldown = () => {
      const remaining = Math.max(0, cooldownEnd - Date.now());
      setManualCheckCooldown(remaining);
      if (remaining === 0 && cooldownIntervalRef.current) {
        clearInterval(cooldownIntervalRef.current);
        cooldownIntervalRef.current = null;
      }
    };

    updateCooldown();
    cooldownIntervalRef.current = setInterval(updateCooldown, 1000);
  }, []);

  // Start "start auto-check" cooldown timer (penalty for stopping early)
  const startStartCooldownTimer = useCallback((cooldownEnd: number) => {
    if (startCooldownIntervalRef.current) {
      clearInterval(startCooldownIntervalRef.current);
    }

    const updateCooldown = () => {
      const remaining = Math.max(0, cooldownEnd - Date.now());
      setStartCooldown(remaining);
      if (remaining === 0 && startCooldownIntervalRef.current) {
        clearInterval(startCooldownIntervalRef.current);
        startCooldownIntervalRef.current = null;
      }
    };

    updateCooldown();
    startCooldownIntervalRef.current = setInterval(updateCooldown, 1000);
  }, []);

  // Start DNS polling
  const startDnsPolling = useCallback(() => {
    if (!dnsDomain.trim()) {
      setError('Please enter your domain name first');
      return;
    }

    // Check if there's a start cooldown
    if (startCooldown > 0) {
      setError('Please wait for cooldown before starting auto-check again');
      return;
    }

    setDnsPolling(true);
    setDnsMessage('Starting DNS verification polling...');
    pollStartTimeRef.current = Date.now();

    // Check existing manual check cooldown from localStorage
    const savedCooldown = localStorage.getItem(`dns-cooldown-${verification.verificationId}`);
    if (savedCooldown) {
      const cooldownEnd = parseInt(savedCooldown, 10);
      if (cooldownEnd > Date.now()) {
        startCooldownTimer(cooldownEnd);
      } else {
        localStorage.removeItem(`dns-cooldown-${verification.verificationId}`);
      }
    }

    // Initial check
    checkDnsVerification();

    // Start polling interval
    pollIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - (pollStartTimeRef.current || 0);

      if (elapsed >= DNS_POLL_DURATION) {
        // Stop auto-polling after 10 minutes (no penalty)
        setDnsPolling(false);
        setDnsMessage('Auto-checking completed. Use "Check Now" button to verify manually.');
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        return;
      }

      checkDnsVerification();
    }, DNS_POLL_INTERVAL);
  }, [dnsDomain, verification.verificationId, checkDnsVerification, startCooldownTimer, startCooldown]);

  // Stop DNS polling (with optional penalty for manual stop)
  const stopDnsPolling = useCallback((applyPenalty = true) => {
    setDnsPolling(false);
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    // Apply cooldown penalty when manually stopped
    if (applyPenalty && verification.verificationId) {
      const penaltyEnd = Date.now() + DNS_STOP_PENALTY_COOLDOWN;
      localStorage.setItem(`dns-start-cooldown-${verification.verificationId}`, penaltyEnd.toString());
      startStartCooldownTimer(penaltyEnd);

      // Also apply manual check cooldown
      const manualEnd = Date.now() + DNS_MANUAL_COOLDOWN;
      localStorage.setItem(`dns-cooldown-${verification.verificationId}`, manualEnd.toString());
      startCooldownTimer(manualEnd);

      setDnsMessage('Auto-check stopped. Cooldown applied before next check.');
    }
  }, [verification.verificationId, startStartCooldownTimer, startCooldownTimer]);

  // Manual DNS check with cooldown
  const handleManualDnsCheck = useCallback(async () => {
    if (manualCheckCooldown > 0) return;
    await checkDnsVerification(true);
  }, [manualCheckCooldown, checkDnsVerification]);

  // Cleanup on unmount or modal close
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (cooldownIntervalRef.current) {
        clearInterval(cooldownIntervalRef.current);
      }
      if (startCooldownIntervalRef.current) {
        clearInterval(startCooldownIntervalRef.current);
      }
    };
  }, []);

  // Load existing cooldowns from localStorage when verification changes
  useEffect(() => {
    if (verification.verificationId && verification.method === 'dns_txt') {
      // Check for existing start cooldown
      const savedStartCooldown = localStorage.getItem(`dns-start-cooldown-${verification.verificationId}`);
      if (savedStartCooldown) {
        const cooldownEnd = parseInt(savedStartCooldown, 10);
        if (cooldownEnd > Date.now()) {
          startStartCooldownTimer(cooldownEnd);
        } else {
          localStorage.removeItem(`dns-start-cooldown-${verification.verificationId}`);
        }
      }

      // Check for existing manual check cooldown
      const savedManualCooldown = localStorage.getItem(`dns-cooldown-${verification.verificationId}`);
      if (savedManualCooldown) {
        const cooldownEnd = parseInt(savedManualCooldown, 10);
        if (cooldownEnd > Date.now()) {
          startCooldownTimer(cooldownEnd);
        } else {
          localStorage.removeItem(`dns-cooldown-${verification.verificationId}`);
        }
      }
    }
  }, [verification.verificationId, verification.method, startStartCooldownTimer, startCooldownTimer]);

  // Reset DNS state when method changes
  useEffect(() => {
    if (verification.method !== 'dns_txt') {
      stopDnsPolling(false); // No penalty when switching methods
      setDnsDomain('');
      setDnsMessage(null);
      setDnsCheckCount(0);
    }
  }, [verification.method, stopDnsPolling]);

  if (!isOpen) return null;

  if (checkingPending) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
        <div className="glass-strong rounded-2xl shadow-2xl p-8">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" style={{ color: theme.primaryColor }} />
          <p className="mt-4 text-muted-foreground">Checking verification status...</p>
        </div>
      </div>
    );
  }

  // Define verification steps for progress indicator
  const verificationSteps: Step[] = [
    { id: 'select', title: 'Select Method', description: 'Choose verification method' },
    { id: 'challenge', title: 'Get Challenge', description: 'Obtain verification challenge' },
    { id: 'proof', title: 'Submit Proof', description: 'Provide verification proof' },
    { id: 'complete', title: 'Complete', description: 'Verification complete' },
  ];

  const currentStepIndex = step === 'select' || step === 'pending' ? 0 : step === 'challenge' ? 1 : step === 'proof' ? 2 : 3;

  const handleCopyChallenge = () => {
    if (verification.challenge) {
      navigator.clipboard.writeText(verification.challenge);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const handleMethodSelect = async (method: VerificationMethod) => {
    setLoading(true);
    setError(null);

    try {
      const body: any = { nodeId, method };

      // Include Turnstile token if required
      if (requiresTurnstile && turnstileToken) {
        body.turnstileToken = turnstileToken;
      }

      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        // If there's a pending verification, auto-redirect to resume instead of showing error
        if (data.error?.toLowerCase().includes('pending')) {
          await checkPendingVerification();
          return;
        }
        throw new Error(data.error || 'Failed to initiate verification');
      }

      setVerification({
        method,
        challenge: data.verification.challenge,
        verificationId: data.verification.id,
        instructions: data.instructions,
        requiresAdminApproval: data.requiresAdminApproval
      });
      setStep('challenge');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initiate verification');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitProof = async () => {
    if (!verification.verificationId) return;

    setLoading(true);
    setError(null);

    try {
      const body: any = {
        verificationId: verification.verificationId,
        proof: proof || undefined
      };

      // Include Turnstile token if required
      if (requiresTurnstile && turnstileToken) {
        body.turnstileToken = turnstileToken;
      }

      const response = await fetch('/api/verify', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Verification failed');
      }

      setStep('complete');
      if (onSuccess) {
        setTimeout(() => {
          onSuccess();
          handleClose();
        }, 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete verification');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep('select');
    setVerification({
      method: null,
      challenge: null,
      verificationId: null,
      instructions: null
    });
    setProof('');
    setError(null);
    setTurnstileToken(null);
    onClose();
  };

  const getMethodIcon = (method: VerificationMethod | string) => {
    switch (method) {
      case 'message_sign': return Key;
      case 'dns_txt': return Globe;
      case 'user_agent': return Terminal;
      case 'port_challenge': return Shield;
      default: return Shield;
    }
  };

  const getMethodName = (method: VerificationMethod | string) => {
    switch (method) {
      case 'message_sign': return 'Message Signature';
      case 'dns_txt': return 'DNS TXT Record';
      case 'user_agent': return 'User Agent';
      case 'port_challenge': return 'Port Challenge';
      default: return method;
    }
  };

  const getMethodDescription = (method: VerificationMethod | string) => {
    switch (method) {
      case 'message_sign':
        return 'Sign a message with your node wallet private key (most secure)';
      case 'dns_txt':
        return 'Verify domain ownership and node control via DNS records';
      case 'user_agent':
        return 'Set a custom user agent string in your node configuration';
      case 'port_challenge':
        return 'Temporarily bind to a specific port for verification';
      default:
        return '';
    }
  };

  const getMethodSecurityLevel = (method: VerificationMethod | string) => {
    switch (method) {
      case 'message_sign': return { level: 'High', color: 'text-green-600' };
      case 'dns_txt': return { level: 'Medium', color: 'text-yellow-600' };
      case 'user_agent': return { level: 'Medium', color: 'text-yellow-600' };
      case 'port_challenge': return { level: 'High', color: 'text-green-600' };
      default: return { level: 'Unknown', color: 'text-gray-600' };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in-scale">
      <div className="glass-strong rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-slide-in-up">
        {/* Header */}
        <div className="p-6 border-b border-border/50">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-3">
                <div
                  className="p-2 rounded-xl shadow-lg"
                  style={{ backgroundColor: `${theme.primaryColor}20` }}
                >
                  <Shield className="h-6 w-6" style={{ color: theme.primaryColor }} />
                </div>
                Verify Node Ownership
              </h2>
              <p className="text-sm text-muted-foreground mt-2 ml-14">
                Prove you control this node to unlock customization features
              </p>
            </div>
            <button
              onClick={handleClose}
              className="p-2 rounded-lg hover:bg-muted/80 transition-all duration-200 hover:rotate-90"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Progress Steps */}
          <div className="mt-6">
            <ProgressSteps
              steps={verificationSteps}
              currentStep={currentStepIndex}
              variant="dots"
            />
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-red-900 dark:text-red-100">Verification Error</p>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
                {error.toLowerCase().includes('authentication') && (
                  <a
                    href="/auth"
                    className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-lg font-medium text-sm text-white transition-all duration-200 hover:scale-105 shadow-md hover:shadow-lg"
                    style={{ backgroundColor: theme.primaryColor }}
                  >
                    Sign In to Continue
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Pending Verification */}
          {step === 'pending' && pendingVerification && (
            <div className="space-y-6">
              {pendingVerification.status === 'pending_approval' ? (
                /* Awaiting Admin Approval */
                <div className="p-5 rounded-xl border-2 border-blue-500/30 bg-blue-500/10">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-blue-500/20">
                      <Clock className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-blue-700 dark:text-blue-300">
                        Awaiting Admin Approval
                      </h3>
                      <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                        Your verification proof has been submitted and is waiting for an admin to review it.
                        You will be notified once it&apos;s approved.
                      </p>
                      <div className="mt-3 space-y-2 text-sm">
                        <p><strong>Method:</strong> {getMethodName(pendingVerification.method)}</p>
                        <p><strong>Submitted:</strong> Awaiting review</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Regular Pending - needs proof submission */
                <div className="p-5 rounded-xl border-2 border-yellow-500/30 bg-yellow-500/10">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-yellow-500/20">
                      <RefreshCw className="h-6 w-6 text-yellow-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-yellow-700 dark:text-yellow-300">
                        Pending Verification Found
                      </h3>
                      <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-1">
                        You have an existing verification in progress for this node.
                      </p>
                      <div className="mt-3 space-y-2 text-sm">
                        <p><strong>Method:</strong> {getMethodName(pendingVerification.method)}</p>
                        <p><strong>Expires:</strong> {new Date(pendingVerification.expires_at).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {pendingVerification.status === 'pending' && (
                <div className="p-4 bg-muted/50 rounded-xl">
                  <p className="text-sm font-medium mb-2">Challenge to sign:</p>
                  <code className="text-xs font-mono break-all block p-2 bg-background rounded">
                    {pendingVerification.challenge}
                  </code>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleCancelPending}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-3 border-2 border-red-500/30 text-red-600 rounded-xl hover:bg-red-500/10 transition-all duration-200 font-medium disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  {loading ? 'Cancelling...' : 'Cancel & Start Over'}
                </button>
                {pendingVerification.status === 'pending' && (
                  <button
                    onClick={handleResumePending}
                    disabled={loading}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                    style={{ backgroundColor: theme.primaryColor }}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Resume Verification
                  </button>
                )}
                {pendingVerification.status === 'pending_approval' && (
                  <button
                    onClick={handleClose}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                    style={{ backgroundColor: theme.primaryColor }}
                  >
                    Close
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Step 1: Select Method */}
          {step === 'select' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Choose a verification method to prove you own this node:
              </p>

              {/* Admin Approval Notice */}
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      Admin Approval Required
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                      After submitting your proof, an administrator will review and approve your verification.
                      You&apos;ll be notified once approved.
                    </p>
                  </div>
                </div>
              </div>

              {enabledMethods.length === 0 && (
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <p className="text-sm text-yellow-900 dark:text-yellow-100">
                    No verification methods are currently enabled. Please contact the administrator.
                  </p>
                </div>
              )}

              <div className="grid gap-3">
                {enabledMethods.map((method) => {
                  const Icon = getMethodIcon(method);
                  const security = getMethodSecurityLevel(method);

                  return (
                    <button
                      key={method}
                      onClick={() => handleMethodSelect(method)}
                      disabled={loading}
                      className="p-4 border-2 border-border rounded-xl hover:bg-muted/50 transition-all duration-200 text-left group disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:-translate-y-0.5"
                      style={{
                        borderColor: 'var(--color-border)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = theme.primaryColor;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--color-border)';
                      }}
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className="p-3 rounded-xl transition-all duration-200 group-hover:scale-110"
                          style={{
                            backgroundColor: `${theme.primaryColor}15`,
                          }}
                        >
                          <Icon className="h-6 w-6" style={{ color: theme.primaryColor }} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold">{getMethodName(method)}</h3>
                            <span className={`text-xs font-medium ${security.color}`}>
                              {security.level} Security
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {getMethodDescription(method)}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Turnstile Widget for method selection */}
              {requiresTurnstile && (
                <div className="mt-6 pt-6 border-t border-border flex justify-center">
                  <TurnstileWidget
                    onSuccess={setTurnstileToken}
                    onError={() => setError('CAPTCHA verification failed')}
                    onExpire={() => setTurnstileToken(null)}
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 2: Show Challenge */}
          {step === 'challenge' && verification.method && (
            <div className="space-y-6">
              {/* Method-specific instructions */}
              {verification.method === 'message_sign' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full text-white text-sm font-bold" style={{ backgroundColor: theme.primaryColor }}>
                      1
                    </div>
                    <h3 className="font-semibold text-lg">Sign the Challenge Message</h3>
                  </div>

                  <div className="ml-11 space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Run this command in your terminal to sign the verification message:
                    </p>

                    {/* CLI Command Box */}
                    <div className="relative group">
                      <div className="p-4 bg-zinc-900 dark:bg-zinc-950 rounded-xl border border-zinc-700 overflow-x-auto">
                        <code className="text-sm text-green-400 font-mono whitespace-nowrap">
                          {chainConfig.name.toLowerCase()}-cli signmessage {'"<your-wallet-address>"'} {`"${verification.challenge}"`}
                        </code>
                      </div>
                      <button
                        onClick={() => {
                          const cmd = `${chainConfig.name.toLowerCase()}-cli signmessage "<your-wallet-address>" "${verification.challenge}"`;
                          navigator.clipboard.writeText(cmd);
                          setCopySuccess(true);
                          setTimeout(() => setCopySuccess(false), 2000);
                        }}
                        className="absolute top-2 right-2 p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-all duration-200"
                        title="Copy command"
                      >
                        {copySuccess ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4 text-zinc-400" />
                        )}
                      </button>
                    </div>

                    {/* Challenge String */}
                    <div className="p-3 bg-muted/50 rounded-lg border border-border">
                      <p className="text-xs text-muted-foreground mb-1">Challenge string:</p>
                      <code className="text-sm font-mono break-all">{verification.challenge}</code>
                    </div>

                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                      <p className="text-sm text-amber-600 dark:text-amber-400">
                        <strong>Note:</strong> Replace <code className="px-1.5 py-0.5 bg-amber-500/20 rounded text-xs">&lt;your-wallet-address&gt;</code> with an address from your wallet
                        {chainConfig.addressPrefix && <span> (starts with <strong>{chainConfig.addressPrefix}</strong>)</span>}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {verification.method === 'dns_txt' && (
                <div className="space-y-6">
                  {/* Step 1: Configure DNS A Record */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full text-white text-sm font-bold" style={{ backgroundColor: theme.primaryColor }}>
                        1
                      </div>
                      <h3 className="font-semibold text-lg">Configure DNS A Record</h3>
                    </div>

                    <div className="ml-11 space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Your domain <strong>must resolve to the node IP address</strong>. Add an A record:
                      </p>

                      <div className="relative group">
                        <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-xl border-2 border-blue-200 dark:border-blue-800">
                          <div className="grid grid-cols-[80px_1fr] gap-2 text-sm">
                            <span className="text-muted-foreground">Type:</span>
                            <span className="font-mono font-semibold">A</span>
                            <span className="text-muted-foreground">Host:</span>
                            <span className="font-mono">@ or subdomain</span>
                            <span className="text-muted-foreground">Value:</span>
                            <span className="font-mono font-semibold">{nodeIp}</span>
                          </div>
                        </div>
                      </div>

                      <p className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span>Required: Domain verification will fail if your domain does not resolve to {nodeIp}</span>
                      </p>
                    </div>
                  </div>

                  {/* Step 2: Add TXT Record */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full text-white text-sm font-bold" style={{ backgroundColor: theme.primaryColor }}>
                        2
                      </div>
                      <h3 className="font-semibold text-lg">Add DNS TXT Record</h3>
                    </div>

                    <div className="ml-11 space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Add this TXT record to your domain&apos;s DNS settings:
                      </p>

                      <div className="relative group">
                        <div className="p-4 bg-muted/50 rounded-xl border-2 border-border">
                          <div className="grid grid-cols-[80px_1fr] gap-2 text-sm">
                            <span className="text-muted-foreground">Type:</span>
                            <span className="font-mono">TXT</span>
                            <span className="text-muted-foreground">Host:</span>
                            <span className="font-mono">@ or _atlasp2p</span>
                            <span className="text-muted-foreground">Value:</span>
                            <span className="font-mono break-all">{verification.challenge}</span>
                          </div>
                        </div>
                        <button
                          onClick={handleCopyChallenge}
                          className="absolute top-2 right-2 p-2 rounded-lg bg-muted hover:bg-muted/80 transition-all duration-200"
                          title="Copy value"
                        >
                          {copySuccess ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Removed legacy verification methods: wallet_payment and rpc_call */}

              {(verification.method === 'user_agent' || verification.method === 'port_challenge') && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full text-white text-sm font-bold" style={{ backgroundColor: theme.primaryColor }}>
                      1
                    </div>
                    <h3 className="font-semibold text-lg">Sign via RPC</h3>
                  </div>

                  <div className="ml-11 space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Run this RPC command on your node:
                    </p>

                    <div className="relative">
                      <div className="p-4 bg-zinc-900 dark:bg-zinc-950 rounded-xl border border-zinc-700 overflow-x-auto">
                        <code className="text-sm text-green-400 font-mono whitespace-nowrap">
                          {chainConfig.name.toLowerCase()}-cli signmessage {'"<address>"'} {`"${verification.challenge}"`}
                        </code>
                      </div>
                      <button
                        onClick={handleCopyChallenge}
                        className="absolute top-2 right-2 p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-all"
                        title="Copy command"
                      >
                        <Copy className="h-4 w-4 text-zinc-400" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full text-white text-sm font-bold" style={{ backgroundColor: theme.primaryColor }}>
                    {verification.method === 'dns_txt' ? '3' : '2'}
                  </div>
                  <h3 className="font-semibold text-lg">Submit Your Proof</h3>
                </div>
                <div className="ml-11 space-y-3">
                  {/* DNS Verification - Special UI with auto-polling */}
                  {verification.method === 'dns_txt' ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Domain Name</label>
                        <input
                          type="text"
                          value={dnsDomain}
                          onChange={(e) => setDnsDomain(e.target.value)}
                          placeholder="example.com"
                          disabled={dnsPolling}
                          className="w-full px-4 py-3 border-2 border-border rounded-xl bg-background focus:outline-none transition-all duration-200 hover:border-muted-foreground disabled:opacity-50"
                          onFocus={(e) => {
                            e.currentTarget.style.borderColor = theme.primaryColor;
                            e.currentTarget.style.boxShadow = `0 0 0 3px ${theme.primaryColor}20`;
                          }}
                          onBlur={(e) => {
                            e.currentTarget.style.borderColor = 'var(--color-border)';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        />
                      </div>

                      {/* DNS Status Display */}
                      {dnsMessage && (
                        <div className={`p-3 rounded-lg text-sm ${
                          dnsMessage.includes('✓')
                            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                            : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                        }`}>
                          {dnsPolling && <Loader2 className="h-4 w-4 animate-spin inline mr-2" />}
                          {dnsMessage}
                          {dnsCheckCount > 0 && !dnsMessage.includes('✓') && (
                            <span className="block mt-1 text-xs opacity-70">
                              Checked {dnsCheckCount} time{dnsCheckCount > 1 ? 's' : ''}
                              {dnsLastCheck && ` • Last: ${dnsLastCheck.toLocaleTimeString()}`}
                            </span>
                          )}
                        </div>
                      )}

                      {/* DNS Control Buttons */}
                      <div className="flex gap-3">
                        {!dnsPolling ? (
                          <button
                            onClick={startDnsPolling}
                            disabled={!dnsDomain.trim() || startCooldown > 0}
                            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 disabled:cursor-not-allowed"
                            style={{ backgroundColor: startCooldown > 0 ? '#6b7280' : theme.primaryColor }}
                          >
                            {startCooldown > 0 ? (
                              <>
                                <Clock className="h-4 w-4" />
                                Wait {Math.ceil(startCooldown / 1000)}s
                              </>
                            ) : (
                              <>
                                <RefreshCw className="h-4 w-4" />
                                Start Auto-Check (10 min)
                              </>
                            )}
                          </button>
                        ) : (
                          <button
                            onClick={() => stopDnsPolling(true)}
                            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold border-2 border-red-500/30 text-red-600 hover:bg-red-500/10 transition-all duration-200"
                          >
                            <X className="h-4 w-4" />
                            Stop Auto-Check
                          </button>
                        )}

                        {/* Manual Check Button (with cooldown) */}
                        {!dnsPolling && dnsCheckCount > 0 && (
                          <button
                            onClick={handleManualDnsCheck}
                            disabled={manualCheckCooldown > 0 || !dnsDomain.trim()}
                            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium border-2 border-border hover:bg-muted transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {manualCheckCooldown > 0 ? (
                              <>
                                <Clock className="h-4 w-4" />
                                {Math.ceil(manualCheckCooldown / 1000)}s
                              </>
                            ) : (
                              <>
                                <RefreshCw className="h-4 w-4" />
                                Check Now
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground">
                        Auto-check runs every 60 seconds for 10 minutes. Stopping early applies a 3-minute cooldown. Manual checks have 5-minute cooldown.
                      </p>
                    </div>
                  ) : (
                    /* Standard proof input for other methods */
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        {verification.method === 'message_sign' && 'Signature (address:signature)'}
                        {verification.method === 'user_agent' && 'User Agent String'}
                        {verification.method === 'port_challenge' && 'Port Challenge Proof'}
                      </label>
                      <input
                        type="text"
                        value={proof}
                        onChange={(e) => setProof(e.target.value)}
                        placeholder={
                          verification.method === 'message_sign' ? 'DAbcd...123:H1234...' :
                          verification.method === 'user_agent' ? 'MyCustomUserAgent/1.0' :
                          verification.method === 'port_challenge' ? 'Port binding proof' :
                          'Enter proof...'
                        }
                        className="w-full px-4 py-3 border-2 border-border rounded-xl bg-background focus:outline-none transition-all duration-200 hover:border-muted-foreground"
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = theme.primaryColor;
                          e.currentTarget.style.boxShadow = `0 0 0 3px ${theme.primaryColor}20`;
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = 'var(--color-border)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      />
                    </div>
                  )}

                  {/* Turnstile for proof submission (non-DNS methods) */}
                  {requiresTurnstile && verification.method !== 'dns_txt' && (
                    <div className="flex justify-center">
                      <TurnstileWidget
                        onSuccess={setTurnstileToken}
                        onError={() => setError('CAPTCHA verification failed')}
                        onExpire={() => setTurnstileToken(null)}
                      />
                    </div>
                  )}

                  {/* Show Back/Submit buttons only for non-DNS methods */}
                  {verification.method !== 'dns_txt' && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => setStep('select')}
                        className="px-6 py-3 border-2 border-border rounded-xl hover:bg-muted transition-all duration-200 font-medium hover:shadow-md"
                        disabled={loading}
                      >
                        Back
                      </button>
                      <button
                        onClick={handleSubmitProof}
                        disabled={loading || !proof || (requiresTurnstile && !turnstileToken)}
                        className="flex-1 px-6 py-3 rounded-xl font-semibold text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0"
                        style={{ backgroundColor: theme.primaryColor }}
                      >
                        {loading && <Loader2 className="h-5 w-5 animate-spin" />}
                        {loading ? 'Verifying...' : 'Submit Verification'}
                      </button>
                    </div>
                  )}

                  {/* Back button for DNS (separate since it doesn't have submit) */}
                  {verification.method === 'dns_txt' && !dnsPolling && (
                    <button
                      onClick={() => {
                        stopDnsPolling();
                        setStep('select');
                      }}
                      className="px-6 py-3 border-2 border-border rounded-xl hover:bg-muted transition-all duration-200 font-medium hover:shadow-md"
                    >
                      Back to Methods
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Complete */}
          {step === 'complete' && (
            <div className="text-center py-12 animate-fade-in-scale">
              <div
                className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-6 shadow-2xl animate-pulse"
                style={{
                  backgroundColor: `${theme.primaryColor}20`,
                  boxShadow: `0 0 40px ${theme.primaryColor}40`,
                }}
              >
                <CheckCircle className="h-10 w-10 text-green-500" />
              </div>
              <h3 className="text-2xl font-bold mb-3">
                {verification.requiresAdminApproval ? 'Verification Submitted!' : 'Node Verified!'}
              </h3>
              <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">
                {verification.requiresAdminApproval
                  ? 'Your verification has been submitted for admin review. You\'ll be notified once it\'s approved.'
                  : 'Your node ownership has been verified. You can now customize your node profile!'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
