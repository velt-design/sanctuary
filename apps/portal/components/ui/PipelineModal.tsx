'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import Modal from '@/components/ui/modal/Modal';

type PipelineModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;

  title: string;
  description?: string;

  children?: React.ReactNode;

  actions: React.ReactNode;

  hint?: React.ReactNode;

  size?: 'sm' | 'md';
};

export const PIPELINE_MODAL_ACTION_CLASSES = {
  primary:
    'h-11 w-full rounded-lg bg-neutral-900 text-sm font-semibold text-white hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-300',
  secondary:
    'h-11 w-full rounded-lg border border-neutral-200 bg-white text-sm font-semibold text-neutral-900 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-200',
  danger:
    'h-11 w-full rounded-lg text-sm font-semibold text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-200',
} as const;

export function PipelineModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  actions,
  hint,
  size = 'md',
}: PipelineModalProps) {
  const maxWidthPx = size === 'sm' ? 460 : 560;

  return (
    <Modal
      open={open}
      onClose={() => onOpenChange(false)}
      ariaLabel={title}
      maxWidthPx={maxWidthPx}
      panelClassName="w-full overflow-auto rounded-2xl border border-black/10 bg-white shadow-[0_30px_80px_rgba(0,0,0,0.25)]"
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-base font-semibold leading-6 text-neutral-900">{title}</div>
            {description ? (
              <div className="mt-1 text-sm text-neutral-600">{description}</div>
            ) : null}
          </div>

          <button
            type="button"
            aria-label="Close"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-300"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {children ? <div className="mt-4">{children}</div> : null}

        <div className="mt-6 flex flex-col gap-2">{actions}</div>

        {hint ? <div className="mt-3 text-xs text-neutral-500">{hint}</div> : null}
      </div>
    </Modal>
  );
}
