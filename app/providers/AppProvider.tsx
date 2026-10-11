'use client';
import { createContext, useContext, type ReactNode } from 'react';
import { useBananaApp } from '../hooks/useBananaApp';
import { useFocusModality } from '../hooks/useFocusModality';

const AppContext = createContext<ReturnType<typeof useBananaApp> | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const app = useBananaApp();
  useFocusModality();
  return <AppContext.Provider value={app}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider.');
  return ctx;
}
