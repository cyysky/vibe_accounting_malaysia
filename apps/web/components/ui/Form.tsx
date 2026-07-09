'use client';

import clsx from 'clsx';
import { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, forwardRef, ReactNode } from 'react';

export interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function Field({ label, hint, error, required, children, className }: FieldProps) {
  return (
    <label className={clsx('block text-sm', className)}>
      <span className="mb-1 block font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-rose-600">{error}</span>}
    </label>
  );
}

const inputClasses = clsx(
  'block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm',
  'focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500',
  'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500',
);

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={clsx(inputClasses, className)} {...rest} />;
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {}
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={clsx(inputClasses, 'pr-8', className)} {...rest}>
      {children}
    </select>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {}
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={clsx(inputClasses, className)} {...rest} />;
});

export interface BadgeProps {
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  children: ReactNode;
  className?: string;
}

const TONES = {
  default: 'bg-slate-100 text-slate-700',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-800',
  danger: 'bg-rose-100 text-rose-700',
  info: 'bg-sky-100 text-sky-700',
};

export function Badge({ tone = 'default', children, className }: BadgeProps) {
  return <span className={clsx('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', TONES[tone], className)}>{children}</span>;
}

export function EinvoiceStatusBadge({ status }: { status?: string }) {
  const map: Record<string, BadgeProps['tone']> = {
    NOT_SUBMITTED: 'default',
    PENDING: 'warning',
    SUBMITTED: 'info',
    VALID: 'success',
    INVALID: 'danger',
    CANCELLED: 'danger',
  };
  return <Badge tone={map[status ?? 'NOT_SUBMITTED'] ?? 'default'}>{status ?? 'NOT_SUBMITTED'}</Badge>;
}
