'use client';

/**
 * Verification Page
 *
 * Handles magic link verification for:
 * - Email verification (type=email)
 * - Password reset (type=recovery)
 *
 * This page is called when users click the link in their email.
 */

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, AlertCircle, CheckCircle, Shield } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getThemeConfig } from '@/config';
import { parseAuthError } from '@/lib/auth/errors';

type VerificationState = 'verifying' | 'success' | 'error';

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const theme = getThemeConfig();

  const [state, setState] = useState<VerificationState>('verifying');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const verifyToken = async () => {
      try {
        const token = searchParams?.get('token');
        const type = searchParams?.get('type') as 'email' | 'recovery' | null;
        const redirectTo = searchParams?.get('redirect_to') || '/';

        if (!token) {
          throw new Error('Verification token is missing');
        }

        if (!type) {
          throw new Error('Verification type is missing');
        }

        const supabase = createClient();

        // Verify the token with Supabase
        const { data, error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: type,
        });

        if (verifyError) {
          throw verifyError;
        }

        if (!data.session) {
          throw new Error('No session returned from verification');
        }

        // If this is a password recovery, set flag to force password update
        if (type === 'recovery') {
          await supabase.auth.updateUser({
            data: { password_reset_required: true }
          });
        }

        setState('success');

        // Redirect based on type
        setTimeout(() => {
          if (type === 'recovery') {
            // Password reset - go to reset password page
            router.push('/auth/reset-password');
          } else {
            // Email verification - go to redirect URL or home
            window.location.href = redirectTo;
          }
        }, 1500);
      } catch (err: any) {
        console.error('Verification error:', err);
        const parsedError = parseAuthError(err);
        setError(parsedError.message);
        setState('error');

        // Redirect to login after 5 seconds on error
        setTimeout(() => {
          router.push('/auth');
        }, 5000);
      }
    };

    verifyToken();
  }, [searchParams, router]);

  if (state === 'verifying') {
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
          <div className="glass-strong rounded-2xl shadow-2xl p-8 text-center space-y-6 animate-fade-in-scale">
            <div
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-lg"
              style={{ backgroundColor: `${theme.primaryColor}20` }}
            >
              <Shield className="h-8 w-8 animate-pulse" style={{ color: theme.primaryColor }} />
            </div>

            <h1 className="text-2xl font-bold">Verifying...</h1>
            <p className="text-muted-foreground">Please wait while we verify your request</p>

            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          </div>
        </div>
      </div>
    );
  }

  if (state === 'success') {
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
          <div className="glass-strong rounded-2xl shadow-2xl p-8 text-center space-y-6 animate-fade-in-scale">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-lg bg-green-500/20">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>

            <h1 className="text-2xl font-bold">Verification Successful!</h1>
            <p className="text-muted-foreground">Redirecting you now...</p>

            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
          </div>
        </div>
      </div>
    );
  }

  // Error state
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
        <div className="glass-strong rounded-2xl shadow-2xl p-8 text-center space-y-6 animate-fade-in-scale">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-lg bg-red-500/20">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>

          <h1 className="text-2xl font-bold">Verification Failed</h1>

          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-sm text-red-500">{error || 'An error occurred during verification'}</p>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              This link may have expired or already been used.
            </p>
            <p className="text-xs text-muted-foreground">
              Redirecting to login in 5 seconds...
            </p>
          </div>

          <button
            onClick={() => router.push('/auth')}
            className="w-full py-3 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
            style={{ backgroundColor: theme.primaryColor }}
          >
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Loading fallback
 */
function VerifyLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

/**
 * Verify page wrapper with Suspense
 */
export default function VerifyPage() {
  return (
    <Suspense fallback={<VerifyLoading />}>
      <VerifyContent />
    </Suspense>
  );
}
