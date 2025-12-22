'use client';

/**
 * ProgressSteps Component
 *
 * Modern step indicator for multi-step processes like verification.
 * Shows current step, completed steps, and upcoming steps with smooth animations.
 */

import { Check } from 'lucide-react';
import { getThemeConfig } from '@/config';

export interface Step {
  id: string;
  title: string;
  description?: string;
}

interface ProgressStepsProps {
  steps: Step[];
  currentStep: number;
  orientation?: 'horizontal' | 'vertical';
  variant?: 'dots' | 'lines' | 'circles';
  className?: string;
}

export function ProgressSteps({
  steps,
  currentStep,
  orientation = 'horizontal',
  variant = 'circles',
  className = '',
}: ProgressStepsProps) {
  const theme = getThemeConfig();

  if (variant === 'dots') {
    return (
      <div className={`flex items-center justify-center gap-2 ${className}`}>
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;

          return (
            <div
              key={step.id}
              className={`
                h-2 rounded-full transition-all duration-300
                ${isCurrent ? 'w-8' : 'w-2'}
                ${isCompleted || isCurrent ? '' : 'bg-muted'}
              `}
              style={
                isCompleted || isCurrent
                  ? { backgroundColor: theme.primaryColor }
                  : {}
              }
              title={step.title}
            />
          );
        })}
      </div>
    );
  }

  if (orientation === 'horizontal') {
    return (
      <div className={`flex items-center ${className}`}>
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isLast = index === steps.length - 1;

          return (
            <div key={step.id} className="flex items-center flex-1">
              {/* Step circle */}
              <div className="flex flex-col items-center">
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm
                    transition-all duration-300 border-2
                    ${
                      isCompleted
                        ? 'border-transparent text-white'
                        : isCurrent
                        ? 'border-current text-white'
                        : 'border-border bg-muted text-muted-foreground'
                    }
                  `}
                  style={
                    isCompleted || isCurrent
                      ? { backgroundColor: theme.primaryColor, borderColor: theme.primaryColor }
                      : {}
                  }
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
                <div className="mt-3 text-center hidden sm:block">
                  <p
                    className={`text-sm font-medium transition-colors ${
                      isCompleted || isCurrent
                        ? 'text-foreground'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {step.title}
                  </p>
                  {step.description && (
                    <p className="text-xs text-muted-foreground mt-1 max-w-[120px]">
                      {step.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div className="flex-1 h-0.5 mx-4 bg-border relative overflow-hidden">
                  <div
                    className="absolute inset-0 transition-all duration-500"
                    style={{
                      backgroundColor: theme.primaryColor,
                      transform: isCompleted
                        ? 'translateX(0)'
                        : 'translateX(-100%)',
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Vertical orientation
  return (
    <div className={`flex flex-col ${className}`}>
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;
        const isLast = index === steps.length - 1;

        return (
          <div key={step.id} className="flex">
            {/* Step circle */}
            <div className="flex flex-col items-center">
              <div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm
                  transition-all duration-300 border-2
                  ${
                    isCompleted
                      ? 'border-transparent text-white'
                      : isCurrent
                      ? 'border-current text-white'
                      : 'border-border bg-muted text-muted-foreground'
                  }
                `}
                style={
                  isCompleted || isCurrent
                    ? { backgroundColor: theme.primaryColor, borderColor: theme.primaryColor }
                    : {}
                }
              >
                {isCompleted ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>

              {/* Connector line */}
              {!isLast && (
                <div className="w-0.5 flex-1 my-2 bg-border relative overflow-hidden min-h-[40px]">
                  <div
                    className="absolute inset-0 transition-all duration-500"
                    style={{
                      backgroundColor: theme.primaryColor,
                      transform: isCompleted
                        ? 'translateY(0)'
                        : 'translateY(-100%)',
                    }}
                  />
                </div>
              )}
            </div>

            {/* Step content */}
            <div className="ml-4 pb-8">
              <p
                className={`text-sm font-medium transition-colors ${
                  isCompleted || isCurrent
                    ? 'text-foreground'
                    : 'text-muted-foreground'
                }`}
              >
                {step.title}
              </p>
              {step.description && (
                <p className="text-xs text-muted-foreground mt-1">
                  {step.description}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
