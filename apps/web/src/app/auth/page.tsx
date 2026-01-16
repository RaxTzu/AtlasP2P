'use client';

/**
 * Authentication Page
 *
 * Combined login and signup page with Turnstile integration.
 * Only rendered when ENABLE_AUTHENTICATION is true.
 */

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Lock, User, Loader2, AlertCircle, CheckCircle, ArrowLeft, Shield, HelpCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { TurnstileWidget } from '@/components/turnstile/TurnstileWidget';
import { EmailVerificationInput } from '@/components/auth/EmailVerificationInput';
import { useAuthEnabled, useTurnstileEnabled } from '@/hooks/use-feature-flags';
import { getThemeConfig, getContentConfig } from '@/config';
import { parseAuthError, shouldShowSupportContact } from '@/lib/auth/errors';

type AuthMode = 'login' | 'signup' | 'verify-email' | 'forgot-password';

function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const theme = getThemeConfig();
  const content = getContentConfig();
  const isAuthEnabled = useAuthEnabled();
  const isTurnstileEnabled = useTurnstileEnabled();

  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showSupport, setShowSupport] = useState<boolean>(false);

  const redirectTo = searchParams?.get('redirectTo') || '/';

  // Redirect if authentication is disabled
  useEffect(() => {
    if (!isAuthEnabled) {
      router.push('/');
    }
  }, [isAuthEnabled, router]);

  // Check if user is already logged in
  useEffect(() => {
    const supabase = createClient();
    let redirected = false;

    const doRedirect = () => {
      if (!redirected) {
        redirected = true;
        // Use href assignment which is more reliable than replace
        window.location.href = redirectTo;
      }
    };

    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        doRedirect();
      }
    });

    // Also listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
        doRedirect();
      }
    });

    return () => subscription.unsubscribe();
  }, [redirectTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setShowSupport(false);

    // Validation for forgot password (only email needed)
    if (mode === 'forgot-password') {
      if (!email) {
        setError('Email address is required');
        return;
      }
    } else {
      // Validation for login/signup
      if (!email || !password) {
        setError('Email and password are required');
        return;
      }

      if (mode === 'signup') {
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          return;
        }

        if (password.length < 8) {
          setError('Password must be at least 8 characters');
          return;
        }
      }
    }

    // Check Turnstile (skip for password reset)
    if (isTurnstileEnabled && !turnstileToken && mode !== 'forgot-password') {
      setError('Please complete the verification');
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      if (mode === 'login') {
        // Login
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (authError) {
          throw authError;
        }

        if (data.user) {
          setSuccess('Login successful! Redirecting...');
          // Force immediate redirect with replace to avoid back button issues
          window.location.replace(redirectTo);
        }
      } else if (mode === 'signup') {
        // Signup
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: displayName || email.split('@')[0],
            },
          },
        });

        if (authError) {
          throw authError;
        }

        if (data.user) {
          // Check if email confirmation is required
          if (data.user.identities && data.user.identities.length === 0) {
            setSuccess('Account already exists. Please login.');
            setTimeout(() => setMode('login'), 2000);
          } else {
            // Show email verification input
            setMode('verify-email');
            setSuccess('Account created! Check your email for the verification code.');
          }
        }
      } else if (mode === 'forgot-password') {
        // Password reset request
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/reset-password?email=${encodeURIComponent(email)}`,
        });

        if (resetError) {
          throw resetError;
        }

        setSuccess('Password reset email sent! The email contains both a link and a 6-digit code. Use either one to reset your password.');
        // Keep the success message visible longer (no auto-redirect)
      }
    } catch (err: any) {
      console.error('Auth error:', err);

      // Parse error with structured error handling
      const parsedError = parseAuthError(err);
      setError(parsedError.message);

      // Show support contact for unknown/network errors
      setShowSupport(shouldShowSupportContact(err));
    } finally {
      setLoading(false);
    }
  };

  const handleTurnstileSuccess = (token: string) => {
    setTurnstileToken(token);
    setError(null);
  };

  const handleTurnstileError = () => {
    setTurnstileToken(null);
    setError('Verification failed. Please try again.');
  };

  if (!isAuthEnabled) {
    return null; // Will redirect via useEffect
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

        {/* Show Email Verification Input if in verify-email mode */}
        {mode === 'verify-email' ? (
          <div className="glass-strong rounded-2xl shadow-2xl animate-fade-in-scale">
            <EmailVerificationInput
              email={email}
              onSuccess={() => {
                window.location.replace(redirectTo);
              }}
              onBack={() => {
                setMode('login');
                setSuccess(null);
                setError(null);
              }}
            />
          </div>
        ) : (
          /* Auth Card with glass morphism */
          <div className="glass-strong rounded-2xl shadow-2xl p-8 animate-fade-in-scale">
            {/* Header */}
            <div className="text-center mb-8">
              {/* Logo icon */}
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-lg transition-transform hover:scale-105"
                style={{ backgroundColor: `${theme.primaryColor}20` }}
              >
                <Shield className="h-8 w-8" style={{ color: theme.primaryColor }} />
              </div>

              <h1 className="text-3xl font-bold mb-2 bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text">
                {mode === 'login' ? 'Welcome Back' : mode === 'forgot-password' ? 'Reset Password' : 'Create Account'}
              </h1>
              <p className="text-muted-foreground text-sm">
                {mode === 'login'
                  ? 'Login to verify nodes and customize profiles'
                  : mode === 'forgot-password'
                  ? 'Enter your email to receive a password reset link'
                  : 'Sign up to start verifying and customizing your nodes'
                }
              </p>
            </div>

          {/* Alerts */}
          {error && (
            <div className="mb-6 space-y-3">
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              </div>

              {/* Contact Support Section */}
              {showSupport && content.support?.enabled && (content.support.email || content.support.discord) && (
                <div className="p-4 bg-muted/50 border border-border rounded-lg">
                  <div className="flex items-start gap-3">
                    <HelpCircle className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <p className="text-sm font-medium text-foreground">Need Help?</p>
                      <p className="text-xs text-muted-foreground">
                        If this problem persists, contact our support team:
                      </p>
                      <div className="flex flex-col gap-2 mt-2">
                        {content.support.email && (
                          <a
                            href={`mailto:${content.support.email}`}
                            className="text-sm font-medium hover:underline transition-colors"
                            style={{ color: theme.primaryColor }}
                          >
                            {content.support.email}
                          </a>
                        )}
                        {content.support.discord && (
                          <a
                            href={content.support.discord}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium hover:underline transition-colors"
                            style={{ color: theme.primaryColor }}
                          >
                            Join Discord Support
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-green-500 font-medium">{success}</p>
                  {mode === 'forgot-password' && (
                    <div className="text-xs text-green-600 dark:text-green-400 mt-3 space-y-1">
                      <p>• Click the link in the email for instant reset</p>
                      <p>• Or enter the 6-digit code at the reset page</p>
                      <p className="mt-2">Check spam folder if you don't see it</p>
                    </div>
                  )}
                </div>
              </div>
              {mode === 'forgot-password' && (
                <button
                  onClick={() => {
                    setMode('login');
                    setSuccess(null);
                  }}
                  className="mt-3 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 hover:-translate-y-0.5"
                  style={{ backgroundColor: theme.primaryColor, color: 'white' }}
                >
                  Back to Login
                </button>
              )}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Display Name (signup only) */}
            {mode === 'signup' && (
              <div>
                <label htmlFor="displayName" className="block text-sm font-medium mb-2">
                  Display Name (optional)
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <input
                    id="displayName"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-200 hover:border-muted-foreground"
                  />
                </div>
              </div>
            )}

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-200 hover:border-muted-foreground"
                />
              </div>
            </div>

            {/* Password (not shown in forgot-password mode) */}
            {mode !== 'forgot-password' && (
              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'}
                    required
                    className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-200 hover:border-muted-foreground"
                  />
                </div>
              </div>
            )}

            {/* Confirm Password (signup only) */}
            {mode === 'signup' && (
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2">
                  Confirm Password
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
                    className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-200 hover:border-muted-foreground"
                  />
                </div>
              </div>
            )}

            {/* Informational notice for password reset */}
            {mode === 'forgot-password' && !success && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      Two ways to reset
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                      We'll send you an email with:<br/>
                      1. A secure link - click it to reset directly<br/>
                      2. A 6-digit code - use if the link doesn't work
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Turnstile Widget (hidden for password reset) */}
            {isTurnstileEnabled && mode !== 'forgot-password' && (
              <div className="flex justify-center">
                <TurnstileWidget
                  onSuccess={handleTurnstileSuccess}
                  onError={handleTurnstileError}
                  theme="auto"
                  size="normal"
                />
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || (isTurnstileEnabled && !turnstileToken && mode !== 'forgot-password')}
              className="w-full py-3 text-white font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0"
              style={{ backgroundColor: theme.primaryColor }}
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {mode === 'login' ? 'Logging in...' : mode === 'forgot-password' ? 'Sending reset link...' : 'Creating account...'}
                </>
              ) : (
                mode === 'login' ? 'Login' : mode === 'forgot-password' ? 'Send Reset Link' : 'Create Account'
              )}
            </button>
          </form>

          {/* Toggle Mode */}
          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login');
                setError(null);
                setSuccess(null);
                setShowSupport(false);
                setTurnstileToken(null);
              }}
              className="text-sm text-muted-foreground hover:text-foreground transition-all duration-200 group"
            >
              {mode === 'login' ? (
                <>
                  Don't have an account?{' '}
                  <span
                    className="font-semibold group-hover:underline"
                    style={{ color: theme.primaryColor }}
                  >
                    Sign up
                  </span>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <span
                    className="font-semibold group-hover:underline"
                    style={{ color: theme.primaryColor }}
                  >
                    Login
                  </span>
                </>
              )}
            </button>
          </div>

            {/* Forgot Password / Back to Login */}
            {mode === 'login' && (
              <div className="mt-4 text-center">
                <button
                  onClick={() => {
                    setMode('forgot-password');
                    setError(null);
                    setSuccess(null);
                    setShowSupport(false);
                  }}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Forgot password?
                </button>
              </div>
            )}
            {mode === 'forgot-password' && (
              <div className="mt-4 text-center">
                <button
                  onClick={() => {
                    setMode('login');
                    setError(null);
                    setSuccess(null);
                    setShowSupport(false);
                  }}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Back to login
                </button>
              </div>
            )}
          </div>
        )}

        {/* Info */}
        {mode !== 'verify-email' && (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Loading fallback for auth page
 */
function AuthPageLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

/**
 * Auth page wrapper with Suspense boundary for useSearchParams
 */
export default function AuthPage() {
  return (
    <Suspense fallback={<AuthPageLoading />}>
      <AuthPageContent />
    </Suspense>
  );
}
