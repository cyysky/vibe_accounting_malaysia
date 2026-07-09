'use client';

import clsx from 'clsx';
import { ReactNode, useEffect } from 'react';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const SIZE: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({ open, onClose, title, children, footer, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className={clsx('w-full overflow-hidden rounded-lg bg-white shadow-xl', SIZE[size])}>
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.225 4.811a1 1 0 011.414 0L10 7.172l2.361-2.361a1 1 0 111.414 1.414L11.414 8.586l2.361 2.361a1 1 0 11-1.414 1.414L10 10l-2.361 2.361a1 1 0 11-1.414-1.414l2.361-2.361-2.361-2.361a1 1 0 010-1.414z" />
            </svg>
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t bg-slate-50 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}
