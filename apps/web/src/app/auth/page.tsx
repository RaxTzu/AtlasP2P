'use client';

/**
 * Authentication Page
 *
 * Combined login and signup page with Turnstile integration.
 * Only rendered when ENABLE_AUTHENTICATION is true.
 */

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Lock, User, Loader2, AlertCircle, CheckCircle, ArrowLeft, Shield } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { TurnstileWidget } from '@/components/turnstile/TurnstileWidget';
import { EmailVerificationInput } from '@/components/auth/EmailVerificationInput';
import { useAuthEnabled, useTurnstileEnabled } from '@/hooks/use-feature-flags';
import { getThemeConfig } from '@/config';

type AuthMode = 'login' | 'signup' | 'verify-email';

function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const theme = getThemeConfig();
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

    // Validation
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

    // Check Turnstile
    if (isTurnstileEnabled && !turnstileToken) {
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
      } else {
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
      }
    } catch (err: any) {
      console.error('Auth error:', err);

      // Provide user-friendly error messages
      let errorMessage = 'Authentication failed';

      if (err.message) {
        // Map common error messages to user-friendly ones
        if (err.message.includes('fetch')) {
          errorMessage = 'Unable to connect to authentication service. Please check your connection and try again.';
        } else if (err.message.includes('Invalid login credentials')) {
          errorMessage = 'Invalid email or password. Please try again.';
        } else if (err.message.includes('Email not confirmed')) {
          errorMessage = 'Please check your email and confirm your account before logging in.';
        } else if (err.message.includes('User already registered')) {
          errorMessage = 'An account with this email already exists. Please login instead.';
        } else {
          errorMessage = err.message;
        }
      }

      setError(errorMessage);
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
                {mode === 'login' ? 'Welcome Back' : 'Create Account'}
              </h1>
              <p className="text-muted-foreground text-sm">
                {mode === 'login'
                  ? 'Login to verify nodes and customize profiles'
                  : 'Sign up to start verifying and customizing your nodes'
                }
              </p>
            </div>

          {/* Alerts */}
          {error && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-green-500">{success}</p>
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

            {/* Password */}
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

            {/* Turnstile Widget */}
            {isTurnstileEnabled && (
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
              disabled={loading || (isTurnstileEnabled && !turnstileToken)}
              className="w-full py-3 text-white font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0"
              style={{ backgroundColor: theme.primaryColor }}
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {mode === 'login' ? 'Logging in...' : 'Creating account...'}
                </>
              ) : (
                mode === 'login' ? 'Login' : 'Create Account'
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

            {/* Forgot Password */}
            {mode === 'login' && (
              <div className="mt-4 text-center">
                <button
                  onClick={() => {
                    // TODO: Implement forgot password flow
                    alert('Password reset coming soon!');
                  }}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Forgot password?
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
