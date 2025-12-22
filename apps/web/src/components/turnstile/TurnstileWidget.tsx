'use client';

/**
 * Turnstile Widget Component
 *
 * Cloudflare Turnstile CAPTCHA widget for bot protection.
 * Conditionally renders based on feature flags.
 */

import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { useRef, useCallback } from 'react';
import { useTurnstileEnabled, useTurnstileSiteKey, useTurnstileMode } from '@/hooks/use-feature-flags';

interface TurnstileWidgetProps {
  /**
   * Callback when verification succeeds
   */
  onSuccess: (token: string) => void;

  /**
   * Callback when verification fails
   */
  onError?: (error: Error | string) => void;

  /**
   * Callback when verification expires
   */
  onExpire?: () => void;

  /**
   * Theme (auto, light, dark)
   */
  theme?: 'auto' | 'light' | 'dark';

  /**
   * Size (normal, compact)
   */
  size?: 'normal' | 'compact';

  /**
   * Tab index for accessibility
   */
  tabIndex?: number;

  /**
   * Additional className for container
   */
  className?: string;
}

export function TurnstileWidget({
  onSuccess,
  onError,
  onExpire,
  theme = 'auto',
  size = 'normal',
  tabIndex,
  className = '',
}: TurnstileWidgetProps) {
  const isEnabled = useTurnstileEnabled();
  const siteKey = useTurnstileSiteKey();
  const mode = useTurnstileMode();
  const turnstileRef = useRef<TurnstileInstance>(null);

  const handleSuccess = useCallback((token: string) => {
    onSuccess(token);
  }, [onSuccess]);

  const handleError = useCallback((error: Error | string) => {
    console.error('Turnstile error:', error);
    onError?.(error);
  }, [onError]);

  const handleExpire = useCallback(() => {
    console.warn('Turnstile token expired');
    onExpire?.();
  }, [onExpire]);

  // If Turnstile is not enabled or not configured, don't render anything
  if (!isEnabled || !siteKey) {
    return null;
  }

  return (
    <div className={`turnstile-widget ${className}`}>
      <Turnstile
        ref={turnstileRef}
        siteKey={siteKey}
        onSuccess={handleSuccess}
        onError={handleError}
        onExpire={handleExpire}
        options={{
          theme,
          size,
        }}
      />
    </div>
  );
}

/**
 * Hook to programmatically control Turnstile widget
 */
export function useTurnstile() {
  const turnstileRef = useRef<TurnstileInstance>(null);

  const reset = useCallback(() => {
    turnstileRef.current?.reset();
  }, []);

  const getResponse = useCallback((): string | undefined => {
    return turnstileRef.current?.getResponse();
  }, []);

  return {
    turnstileRef,
    reset,
    getResponse,
  };
}
