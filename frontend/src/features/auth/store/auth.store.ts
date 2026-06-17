'use client';

import { create } from 'zustand';
import type { AuthUser, ClientSession } from '../types/auth.types';

type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  status: AuthStatus;
  initialized: boolean;
  user: AuthUser | null;
  setLoading: () => void;
  setSession: (session: ClientSession) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'idle',
  initialized: false,
  user: null,
  setLoading: () => {
    set((state) => ({
      ...state,
      status: 'loading',
    }));
  },
  setSession: (session) => {
    set({
      status: 'authenticated',
      initialized: true,
      user: session.user,
    });
  },
  clearSession: () => {
    set({
      status: 'unauthenticated',
      initialized: true,
      user: null,
    });
  },
}));
