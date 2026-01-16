'use client';

/**
 * Password Reset OTP Input Component
 *
 * For users who can't access the magic link in their email.
 * Features: 6-digit OTP, expiration timer, resend logic, auto-verification.
 */

import { useState, useEffect, useRef, KeyboardEvent, ClipboardEvent, useCallback } from 'react';
import { CheckCircle, XCircle, Clock, RefreshCw, Mail, Shield, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getThemeConfig } from '@/config';

interface PasswordResetOTPInputProps {
  email: string;
  onSuccess: (token: string) => void;
}

type VerificationState = 'idle' | 'verifying' | 'success' | 'error' | 'expired';

// OTP configuration
const OTP_EXPIRY_DURATION = 10 * 60 * 1000; // 10 minutes
const RESEND_COOLDOWN = 60 * 1000; // 60 seconds
const MAX_RESEND_ATTEMPTS = 3;

export function PasswordResetOTPInput({ email, onSuccess }: PasswordResetOTPInputProps) {
  const theme = getThemeConfig();

  // OTP state
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const [state, setState] = useState<VerificationState>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Timer state
  const [expiresAt, setExpiresAt] = useState<Date>(new Date(Date.now() + OTP_EXPIRY_DURATION));
  const [timeRemaining, setTimeRemaining] = useState<number>(600); // seconds

  // Resend state
  const [resendCooldown, setResendCooldown] = useState<number>(0); // milliseconds
  const [resendCount, setResendCount] = useState<number>(0);
  const [resending, setResending] = useState<boolean>(false);

  // Refs
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const cooldownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const expiryIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Expiry timer countdown
  useEffect(() => {
    const updateExpiry = () => {
      const remaining = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
      setTimeRemaining(remaining);

      if (remaining === 0 && state !== 'expired' && state !== 'success') {
        setState('expired');
        setErrorMessage('Verification code has expired');
      }
    };

    updateExpiry();
    expiryIntervalRef.current = setInterval(updateExpiry, 1000);

    return () => {
      if (expiryIntervalRef.current) {
        clearInterval(expiryIntervalRef.current);
      }
    };
  }, [expiresAt, state]);

  // Resend cooldown timer
  const startCooldownTimer = useCallback((cooldownEnd: number) => {
    if (cooldownIntervalRef.current) {
      clearInterval(cooldownIntervalRef.current);
    }

    const updateCooldown = () => {
      const remaining = Math.max(0, cooldownEnd - Date.now());
      setResendCooldown(remaining);
      if (remaining === 0 && cooldownIntervalRef.current) {
        clearInterval(cooldownIntervalRef.current);
        cooldownIntervalRef.current = null;
      }
    };

    updateCooldown();
    cooldownIntervalRef.current = setInterval(updateCooldown, 1000);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cooldownIntervalRef.current) {
        clearInterval(cooldownIntervalRef.current);
      }
      if (expiryIntervalRef.current) {
        clearInterval(expiryIntervalRef.current);
      }
    };
  }, []);

  // Format time remaining
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle digit change
  const handleDigitChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newDigits = [...digits];
    newDigits[index] = value;
    setDigits(newDigits);

    // Clear error on new input
    if (state === 'error') {
      setState('idle');
      setErrorMessage('');
    }

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-verify when all digits entered
    if (newDigits.every(d => d) && newDigits.join('').length === 6) {
      verifyCode(newDigits.join(''));
    }
  };

  // Handle backspace
  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }

    if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    }

    if (e.key === 'ArrowRight' && index < 5) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle paste
  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();

    // Only accept 6 digits
    if (/^\d{6}$/.test(pastedData)) {
      const newDigits = pastedData.split('');
      setDigits(newDigits);
      inputRefs.current[5]?.focus();
      verifyCode(pastedData);
    }
  };

  // Helper: Extract error message from various error formats
  const getErrorMessage = (error: any): string => {
    if (typeof error === 'string') return error;
    if (error?.message) return String(error.message);
    if (error?.error_description) return String(error.error_description);
    if (error?.msg) return String(error.msg);
    if (error?.error) return String(error.error);
    return 'An unexpected error occurred';
  };

  // Verify code with Supabase
  const verifyCode = async (code: string) => {
    if (state === 'expired') return;

    setState('verifying');

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'recovery',
      });

      if (error) throw error;

      if (data.session) {
        // Set flag to force password update before accessing other routes
        await supabase.auth.updateUser({
          data: { password_reset_required: true }
        });

        setState('success');
        setTimeout(() => {
          onSuccess(code);
        }, 1000);
      } else {
        throw new Error('No session returned');
      }
    } catch (error: any) {
      setState('error');
      setErrorMessage(getErrorMessage(error) || 'Invalid verification code');
      // Clear digits after error
      setTimeout(() => {
        setDigits(Array(6).fill(''));
        inputRefs.current[0]?.focus();
        setState('idle');
      }, 1000);
    }
  };

  // Resend code
  const handleResend = async () => {
    if (resending || resendCooldown > 0 || resendCount >= MAX_RESEND_ATTEMPTS) return;

    setResending(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) throw error;

      // Reset states
      setResendCount(resendCount + 1);
      const cooldownEnd = Date.now() + RESEND_COOLDOWN;
      startCooldownTimer(cooldownEnd);
      setExpiresAt(new Date(Date.now() + OTP_EXPIRY_DURATION));
      setState('idle');
      setErrorMessage('');
      setDigits(Array(6).fill(''));
      inputRefs.current[0]?.focus();

      // Show success message
      setSuccessMessage('New verification code sent! Check your email.');
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (error: any) {
      // Handle rate limiting
      if (error.status === 429 || error.message?.includes('rate limit') || error.message?.includes('too many')) {
        const cooldownEnd = Date.now() + RESEND_COOLDOWN;
        startCooldownTimer(cooldownEnd);
        setErrorMessage(`Please wait ${Math.ceil(RESEND_COOLDOWN / 1000)} seconds before requesting a new code.`);
      } else {
        setErrorMessage(getErrorMessage(error) || 'Failed to resend code. Please try again.');
      }
    } finally {
      setResending(false);
    }
  };

  // Get timer color based on remaining time
  const getTimerColor = () => {
    if (timeRemaining < 60) return 'text-red-600';
    if (timeRemaining < 180) return 'text-amber-600';
    return 'text-muted-foreground';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-3">
        <div
          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-2 shadow-lg transition-all duration-300"
          style={{
            backgroundColor: `${theme.primaryColor}20`,
            transform: state === 'success' ? 'scale(1.1)' : 'scale(1)',
          }}
        >
          {state === 'success' ? (
            <CheckCircle className="h-8 w-8 text-green-500" />
          ) : (
            <Mail className="h-8 w-8" style={{ color: theme.primaryColor }} />
          )}
        </div>

        <h2 className="text-2xl font-bold">Enter Verification Code</h2>
        <p className="text-sm text-muted-foreground">
          We sent a 6-digit code to<br />
          <span className="font-medium text-foreground">{email}</span>
        </p>
      </div>

      {/* Timer */}
      <div className={`flex items-center justify-center gap-2 text-sm font-medium transition-colors ${getTimerColor()}`}>
        <Clock className="h-4 w-4" />
        <span>
          {state === 'expired' ? 'Code expired' : `Expires in ${formatTime(timeRemaining)}`}
        </span>
      </div>

      {/* OTP Digit Inputs */}
      <div>
        <label className="block text-sm font-medium mb-3">Verification Code</label>
        <div className="flex gap-2.5 justify-center">
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={el => { inputRefs.current[index] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleDigitChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={index === 0 ? handlePaste : undefined}
              disabled={state === 'verifying' || state === 'success' || state === 'expired'}
              className={`
                w-12 h-16 text-center text-2xl font-bold rounded-lg
                bg-background border-2 transition-all duration-200
                focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed
                ${digit ? 'border-primary' : 'border-border'}
                ${state === 'error' ? 'animate-shake border-red-500' : ''}
                ${state === 'success' ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : ''}
              `}
              style={{
                borderColor: digit ? theme.primaryColor : undefined,
              }}
              onFocus={(e) => {
                if (state === 'idle' && !digit) {
                  e.currentTarget.style.borderColor = theme.primaryColor;
                  e.currentTarget.style.boxShadow = `0 0 0 3px ${theme.primaryColor}50`;
                }
              }}
              onBlur={(e) => {
                if (!digit) {
                  e.currentTarget.style.borderColor = 'var(--color-border)';
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}
              aria-label={`Digit ${index + 1}`}
            />
          ))}
        </div>

        {/* State Messages */}
        <div className="mt-4 min-h-[3rem]">
          {state === 'verifying' && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Verifying code...</span>
            </div>
          )}

          {state === 'success' && (
            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 text-green-700 dark:text-green-200 text-sm flex items-center gap-2 animate-fade-in">
              <CheckCircle className="h-4 w-4 flex-shrink-0" />
              <span>Code verified! Loading password reset...</span>
            </div>
          )}

          {state === 'error' && errorMessage && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-200 text-sm flex items-center gap-2 animate-fade-in">
              <XCircle className="h-4 w-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {state === 'expired' && (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-200 text-sm flex items-center gap-2 animate-fade-in">
              <XCircle className="h-4 w-4 flex-shrink-0" />
              <span>Code expired. Request a new one below.</span>
            </div>
          )}
        </div>
      </div>

      {/* Resend Button */}
      <div>
        <label className="block text-sm font-medium mb-2">Didn't receive the code?</label>
        <button
          onClick={handleResend}
          disabled={resending || resendCooldown > 0 || resendCount >= MAX_RESEND_ATTEMPTS || state === 'success'}
          className={`
            w-full py-3 px-4 rounded-xl font-medium
            transition-all duration-200
            flex items-center justify-center gap-2
            ${resendCooldown > 0 || resendCount >= MAX_RESEND_ATTEMPTS || state === 'success'
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : 'border-2 border-border hover:bg-muted hover:shadow-md'
            }
          `}
        >
          {resending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Sending...</span>
            </>
          ) : resendCooldown > 0 ? (
            <>
              <Clock className="h-4 w-4" />
              <span>Resend in {Math.ceil(resendCooldown / 1000)}s</span>
            </>
          ) : resendCount >= MAX_RESEND_ATTEMPTS ? (
            <span>Maximum resend attempts reached</span>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              <span>Resend verification code</span>
            </>
          )}
        </button>

        {resendCount > 0 && resendCount < MAX_RESEND_ATTEMPTS && (
          <p className="text-xs text-center text-muted-foreground mt-2">
            {MAX_RESEND_ATTEMPTS - resendCount} resend{MAX_RESEND_ATTEMPTS - resendCount !== 1 ? 's' : ''} remaining
          </p>
        )}

        {/* Success Message */}
        {successMessage && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 mt-3">
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-300 flex-shrink-0" />
            <p className="text-sm text-green-700 dark:text-green-200">{successMessage}</p>
          </div>
        )}
      </div>

      {/* Security Note */}
      <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            For your security, verification codes expire after 10 minutes.
            Never share your code with anyone.
          </p>
        </div>
      </div>
    </div>
  );
}
