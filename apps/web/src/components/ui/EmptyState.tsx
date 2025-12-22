'use client';

/**
 * EmptyState Component
 *
 * Beautiful empty state component with icon, title, description, and action button.
 * Perfect for showing when lists are empty, searches return no results, etc.
 */

import { LucideIcon, Inbox, Search, FileX, Database, AlertCircle } from 'lucide-react';
import { getThemeConfig } from '@/config';

interface EmptyStateProps {
  /**
   * Icon to display (Lucide icon component or preset)
   */
  icon?: LucideIcon | 'inbox' | 'search' | 'file' | 'database' | 'error';

  /**
   * Title text
   */
  title: string;

  /**
   * Description text
   */
  description?: string;

  /**
   * Action button
   */
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  };

  /**
   * Additional className
   */
  className?: string;

  /**
   * Size variant
   */
  size?: 'sm' | 'md' | 'lg';
}

const iconPresets = {
  inbox: Inbox,
  search: Search,
  file: FileX,
  database: Database,
  error: AlertCircle,
};

const sizeConfig = {
  sm: {
    icon: 'h-12 w-12',
    title: 'text-lg',
    padding: 'p-8',
  },
  md: {
    icon: 'h-16 w-16',
    title: 'text-xl',
    padding: 'p-12',
  },
  lg: {
    icon: 'h-20 w-20',
    title: 'text-2xl',
    padding: 'p-16',
  },
};

export function EmptyState({
  icon = 'inbox',
  title,
  description,
  action,
  className = '',
  size = 'md',
}: EmptyStateProps) {
  const theme = getThemeConfig();

  // Get icon component
  const IconComponent = typeof icon === 'string' ? iconPresets[icon] : icon;
  const config = sizeConfig[size];

  return (
    <div className={`flex flex-col items-center justify-center text-center ${config.padding} ${className}`}>
      {/* Icon with gradient background */}
      <div
        className={`${config.icon} mb-6 rounded-full flex items-center justify-center transition-transform hover:scale-105`}
        style={{
          backgroundColor: `${theme.primaryColor}15`,
        }}
      >
        <IconComponent
          className={`${config.icon === 'h-12 w-12' ? 'h-6 w-6' : config.icon === 'h-16 w-16' ? 'h-8 w-8' : 'h-10 w-10'} text-muted-foreground`}
          style={{ color: theme.primaryColor }}
        />
      </div>

      {/* Title */}
      <h3 className={`font-bold mb-2 text-foreground ${config.title}`}>
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p className="text-muted-foreground text-sm max-w-md mb-6">
          {description}
        </p>
      )}

      {/* Action Button */}
      {action && (
        <button
          onClick={action.onClick}
          className={`px-6 py-2.5 rounded-lg font-medium transition-all duration-200 ${
            action.variant === 'secondary'
              ? 'bg-muted hover:bg-muted/80 text-foreground'
              : 'text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5'
          }`}
          style={
            action.variant !== 'secondary'
              ? { backgroundColor: theme.primaryColor }
              : {}
          }
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

/**
 * Error State variant
 */
interface ErrorStateProps {
  title?: string;
  message: string;
  retry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  retry,
  className = '',
}: ErrorStateProps) {
  return (
    <EmptyState
      icon="error"
      title={title}
      description={message}
      action={
        retry
          ? {
              label: 'Try Again',
              onClick: retry,
              variant: 'primary',
            }
          : undefined
      }
      className={className}
    />
  );
}
