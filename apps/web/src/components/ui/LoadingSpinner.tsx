'use client';

/**
 * LoadingSpinner Component
 *
 * Modern, theme-aware loading spinner with multiple sizes and variants.
 * Supports CSS variable theming and dark mode.
 */

import { Loader2 } from 'lucide-react';
import { getThemeConfig } from '@/config';

interface LoadingSpinnerProps {
  /**
   * Size of the spinner
   */
  size?: 'sm' | 'md' | 'lg' | 'xl';

  /**
   * Variant style
   */
  variant?: 'primary' | 'muted' | 'white';

  /**
   * Optional text to display below spinner
   */
  text?: string;

  /**
   * Center in container
   */
  center?: boolean;

  /**
   * Full screen overlay
   */
  fullScreen?: boolean;

  /**
   * Additional className
   */
  className?: string;
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
  xl: 'h-16 w-16',
};

export function LoadingSpinner({
  size = 'md',
  variant = 'primary',
  text,
  center = false,
  fullScreen = false,
  className = '',
}: LoadingSpinnerProps) {
  const theme = getThemeConfig();

  const getColor = () => {
    switch (variant) {
      case 'primary':
        return theme.primaryColor;
      case 'white':
        return '#ffffff';
      case 'muted':
      default:
        return undefined; // Uses CSS variable
    }
  };

  const spinner = (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <Loader2
        className={`${sizeClasses[size]} animate-spin ${variant === 'muted' ? 'text-muted-foreground' : ''}`}
        style={variant !== 'muted' ? { color: getColor() } : {}}
      />
      {text && (
        <p className="text-sm text-muted-foreground animate-pulse">
          {text}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        {spinner}
      </div>
    );
  }

  if (center) {
    return (
      <div className="flex items-center justify-center py-12">
        {spinner}
      </div>
    );
  }

  return spinner;
}

/**
 * Skeleton Loader for content placeholders
 */
interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  count?: number;
}

export function Skeleton({
  className = '',
  variant = 'text',
  width,
  height,
  count = 1,
}: SkeletonProps) {
  const baseClasses = 'animate-pulse bg-muted';

  const variantClasses = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };

  const style = {
    width: width ? (typeof width === 'number' ? `${width}px` : width) : undefined,
    height: height ? (typeof height === 'number' ? `${height}px` : height) : undefined,
  };

  if (count > 1) {
    return (
      <div className="space-y-3">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className={`${baseClasses} ${variantClasses[variant]} ${className}`}
            style={style}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={style}
    />
  );
}
