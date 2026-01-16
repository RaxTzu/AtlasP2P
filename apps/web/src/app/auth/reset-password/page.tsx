'use client';

/**
 * Password Reset Page
 *
 * Supports both:
 * 1. Magic Link: Users land here after clicking link in email
 * 2. OTP Code: Users can enter 6-digit code if link doesn't work
 */

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, Loader2, AlertCircle, CheckCircle, ArrowLeft, Shield } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthEnabled } from '@/hooks/use-feature-flags';
import { getThemeConfig } from '@/config';
import { parseAuthError } from '@/lib/auth/errors';
import { PasswordResetOTPInput } from '@/components/auth/PasswordResetOTPInput';

type ResetMode = 'validating' | 'magic-link' | 'otp' | 'reset-password';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const theme = getThemeConfig();
  const isAuthEnabled = useAuthEnabled();

  const [mode, setMode] = useState<ResetMode>('validating');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Redirect if authentication is disabled
  useEffect(() => {
    if (!isAuthEnabled) {
      router.push('/');
    }
  }, [isAuthEnabled, router]);

  // Determine mode on mount: magic link or OTP
  useEffect(() => {
    const determineMode = async () => {
      try {
        const supabase = createClient();
        const { data: { session }, error } = await supabase.auth.getSession();

        if (session) {
          // User came via magic link and has valid session
          setMode('magic-link');
          setTimeout(() => setMode('reset-password'), 500);
        } else {
          // No session - need OTP code
          const emailParam = searchParams?.get('email');
          if (emailParam) {
            setEmail(emailParam);
          }
          setMode('otp');
        }
      } catch (err) {
        console.error('Error determining reset mode:', err);
        setMode('otp');
      }
    };

    determineMode();
  }, [searchParams]);

  // Handle OTP verification success
  const handleOTPSuccess = (token: string) => {
    console.log('OTP verified successfully');
    setMode('reset-password');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!password || !confirmPassword) {
      setError('Both password fields are required');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      // Update password AND clear the password_reset_required flag
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
        data: { password_reset_required: false }
      });

      if (updateError) {
        throw updateError;
      }

      setSuccess(true);

      // Redirect to home after 2 seconds
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (err: any) {
      console.error('Password reset error:', err);
      const parsedError = parseAuthError(err);
      setError(parsedError.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthEnabled) {
    return null;
  }

  if (mode === 'validating') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">Validating reset link...</p>
        </div>
      </div>
    );
  }

  // Show OTP input if no magic link session
  if (mode === 'otp') {
    return (
      <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-muted opacity-50" />
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 50%, ${theme.primaryColor}40 0%, transparent 50%), radial-gradient(circle at 80% 80%, ${theme.primaryColor}30 0%, transparent 50%)`,
          }}
        />

        <div className="w-full max-w-md relative z-10">
          {/* Back to Home */}
          <button
            onClick={() => router.push('/')}
            className="mb-6 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-all duration-200 hover:gap-3 group"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Back to Home
          </button>

          {/* OTP Card */}
          <div className="glass-strong rounded-2xl shadow-2xl p-8 animate-fade-in-scale">
            {!email ? (
              /* Email input if not in URL */
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-center">Reset Password</h2>
                <p className="text-sm text-muted-foreground text-center">
                  Enter your email to receive a verification code
                </p>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-4 py-3 border-2 border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-200"
                />
                <button
                  onClick={async () => {
                    if (!email) return;
                    try {
                      const supabase = createClient();
                      await supabase.auth.resetPasswordForEmail(email, {
                        redirectTo: `${window.location.origin}/auth/reset-password?email=${email}`,
                      });
                      // Email will be set, component will rerender with OTP input
                    } catch (err) {
                      console.error(err);
                    }
                  }}
                  disabled={!email}
                  className="w-full py-3 text-white font-semibold rounded-lg transition-all duration-200 disabled:opacity-50"
                  style={{ backgroundColor: theme.primaryColor }}
                >
                  Send Code
                </button>
              </div>
            ) : (
              <PasswordResetOTPInput
                email={email}
                onSuccess={handleOTPSuccess}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-muted opacity-50" />
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `radial-gradient(circle at 20% 50%, ${theme.primaryColor}40 0%, transparent 50%), radial-gradient(circle at 80% 80%, ${theme.primaryColor}30 0%, transparent 50%)`,
        }}
      />

      <div className="w-full max-w-md relative z-10">
        {/* Back to Home */}
        <button
          onClick={() => router.push('/')}
          className="mb-6 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-all duration-200 hover:gap-3 group"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Back to Home
        </button>

        {/* Reset Password Card */}
        <div className="glass-strong rounded-2xl shadow-2xl p-8 animate-fade-in-scale">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-lg transition-transform hover:scale-105"
              style={{ backgroundColor: `${theme.primaryColor}20` }}
            >
              <Shield className="h-8 w-8" style={{ color: theme.primaryColor }} />
            </div>

            <h1 className="text-3xl font-bold mb-2 bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text">
              {mode === 'magic-link' ? 'Set New Password' : 'Complete Password Reset'}
            </h1>
            <p className="text-muted-foreground text-sm">
              {mode === 'magic-link'
                ? 'Enter your new password below'
                : 'Your identity is verified. Choose a new password to secure your account.'}
            </p>
          </div>

          {/* Success Message */}
          {success && (
            <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-green-500 font-medium">Password updated successfully!</p>
                <p className="text-xs text-green-500/80 mt-1">Redirecting you to the home page...</p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-destructive font-medium">{error}</p>
                  {error.toLowerCase().includes('invalid') || error.toLowerCase().includes('expired') && (
                    <p className="text-xs text-destructive/80 mt-2">
                      Reset links expire after a certain time. Request a new one from the login page.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* New Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2">
                New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                  disabled={success}
                  className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-200 hover:border-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  required
                  disabled={success}
                  className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-200 hover:border-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* Mode indicator */}
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                {mode === 'magic-link'
                  ? '✓ Link verified! Set your new password below.'
                  : '✓ Code verified! Choose a new password to complete the reset.'}
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || success}
              className="w-full py-3 text-white font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0"
              style={{ backgroundColor: theme.primaryColor }}
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Updating password...
                </>
              ) : success ? (
                'Password Updated!'
              ) : (
                'Update Password'
              )}
            </button>
          </form>

          {/* Back to Login */}
          {!success && (
            <div className="mt-6 text-center">
              <button
                onClick={() => router.push('/auth')}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Back to login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Loading fallback
 */
function ResetPasswordLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

/**
 * Reset password page wrapper with Suspense
 */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordLoading />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
