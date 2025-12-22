'use client';

/**
 * Toast Component
 *
 * Modern toast notification system with animations.
 * Supports success, error, warning, and info variants.
 */

import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  onClose: (id: string) => void;
}

const iconMap = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const colorMap = {
  success: {
    bg: 'bg-green-50 dark:bg-green-900/20',
    border: 'border-green-200 dark:border-green-800',
    icon: 'text-green-600',
    text: 'text-green-900 dark:text-green-100',
  },
  error: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    icon: 'text-red-600',
    text: 'text-red-900 dark:text-red-100',
  },
  warning: {
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    border: 'border-yellow-200 dark:border-yellow-800',
    icon: 'text-yellow-600',
    text: 'text-yellow-900 dark:text-yellow-100',
  },
  info: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    icon: 'text-blue-600',
    text: 'text-blue-900 dark:text-blue-100',
  },
};

export function Toast({ id, type, title, message, duration = 5000, onClose }: ToastProps) {
  const [isExiting, setIsExiting] = useState(false);
  const Icon = iconMap[type];
  const colors = colorMap[type];

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onClose(id);
    }, 300); // Match animation duration
  };

  return (
    <div
      className={`
        pointer-events-auto w-full max-w-sm rounded-lg border shadow-lg
        transition-all duration-300 ease-out
        ${colors.bg} ${colors.border}
        ${
          isExiting
            ? 'translate-x-full opacity-0'
            : 'translate-x-0 opacity-100 animate-slide-in-right'
        }
      `}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${colors.icon}`} />
          <div className="flex-1 min-w-0">
            <p className={`font-semibold text-sm ${colors.text}`}>{title}</p>
            {message && (
              <p className={`mt-1 text-sm ${colors.text} opacity-90`}>{message}</p>
            )}
          </div>
          <button
            onClick={handleClose}
            className={`flex-shrink-0 rounded-lg p-1 hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${colors.text}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      {/* Progress bar */}
      {duration > 0 && (
        <div className="h-1 bg-black/10 dark:bg-white/10 overflow-hidden rounded-b-lg">
          <div
            className={`h-full ${colors.icon}`}
            style={{
              backgroundColor: 'currentColor',
              animation: `progress ${duration}ms linear`,
              transformOrigin: 'left',
            }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Toast Container
 */
interface ToastData extends Omit<ToastProps, 'id' | 'onClose'> {
  id: string;
}

interface ToastContainerProps {
  toasts: ToastData[];
  onClose: (id: string) => void;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center';
}

const positionClasses = {
  'top-right': 'top-20 right-4', // Account for navbar height (h-16 = 64px + gap)
  'top-left': 'top-20 left-4',
  'bottom-right': 'bottom-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'top-center': 'top-20 left-1/2 -translate-x-1/2',
};

export function ToastContainer({ toasts, onClose, position = 'top-right' }: ToastContainerProps) {
  return (
    <div
      className={`fixed z-[9999] pointer-events-none flex flex-col gap-3 ${positionClasses[position]}`}
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onClose={onClose} />
      ))}
    </div>
  );
}

/**
 * Toast Hook
 */
export function useToast() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast = (toast: Omit<ToastData, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const toast = {
    success: (title: string, message?: string, duration?: number) =>
      addToast({ type: 'success', title, message, duration }),
    error: (title: string, message?: string, duration?: number) =>
      addToast({ type: 'error', title, message, duration }),
    warning: (title: string, message?: string, duration?: number) =>
      addToast({ type: 'warning', title, message, duration }),
    info: (title: string, message?: string, duration?: number) =>
      addToast({ type: 'info', title, message, duration }),
  };

  return { toast, toasts, removeToast };
}
