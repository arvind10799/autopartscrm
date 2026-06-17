'use client';

import { create } from 'zustand';
import { clientEnv } from '@/lib/config/env.client';
import {
  MAX_VISIBLE_TOASTS,
} from '@/lib/constants/app';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

type ToastInput = {
  title: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
};

export type ToastRecord = {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  durationMs: number;
};

type ToastState = {
  toasts: ToastRecord[];
  pushToast: (toast: ToastInput) => string;
  dismissToast: (id: string) => void;
  clearToasts: () => void;
};

let toastSequence = 0;

function buildToastId() {
  toastSequence += 1;
  return `toast-${toastSequence}`;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  pushToast: (toastInput) => {
    const nextToast: ToastRecord = {
      id: buildToastId(),
      title: toastInput.title,
      description: toastInput.description,
      variant: toastInput.variant ?? 'info',
      durationMs:
        toastInput.durationMs ?? clientEnv.NEXT_PUBLIC_TOAST_DURATION_MS,
    };

    set((state) => ({
      toasts: [nextToast, ...state.toasts].slice(0, MAX_VISIBLE_TOASTS),
    }));

    return nextToast.id;
  },
  dismissToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    }));
  },
  clearToasts: () => {
    set({ toasts: [] });
  },
}));

export const toast = {
  show(toastInput: ToastInput) {
    return useToastStore.getState().pushToast(toastInput);
  },
  success(title: string, description?: string, durationMs?: number) {
    return useToastStore.getState().pushToast({
      title,
      description,
      durationMs,
      variant: 'success',
    });
  },
  error(title: string, description?: string, durationMs?: number) {
    return useToastStore.getState().pushToast({
      title,
      description,
      durationMs,
      variant: 'error',
    });
  },
  warning(title: string, description?: string, durationMs?: number) {
    return useToastStore.getState().pushToast({
      title,
      description,
      durationMs,
      variant: 'warning',
    });
  },
  info(title: string, description?: string, durationMs?: number) {
    return useToastStore.getState().pushToast({
      title,
      description,
      durationMs,
      variant: 'info',
    });
  },
  dismiss(id: string) {
    useToastStore.getState().dismissToast(id);
  },
  clear() {
    useToastStore.getState().clearToasts();
  },
};
