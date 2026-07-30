import React from 'react';
import { Spinner } from './Spinner';

interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  loadingText?: React.ReactNode;
  spinnerSize?: 'xs' | 'sm' | 'md' | 'lg';
}

export function LoadingButton({
  isLoading = false,
  loadingText,
  spinnerSize = 'xs',
  disabled,
  className = '',
  children,
  type = 'button',
  ...props
}: LoadingButtonProps) {
  const content = isLoading && loadingText !== undefined ? loadingText : children;

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      className={`inline-flex items-center justify-center gap-2 ${className}`.trim()}
      {...props}
    >
      {isLoading && <Spinner size={spinnerSize} />}
      {content}
    </button>
  );
}