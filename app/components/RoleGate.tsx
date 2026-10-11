'use client';
import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '../providers/AppProvider';

export default function RoleGate({
  role,
  children,
}: {
  role: 'customer' | 'operator';
  children: ReactNode;
}) {
  const app = useApp();
  const router = useRouter();
  const ok = app.current?.role === role;
  useEffect(() => {
    if (app.current && !ok) router.replace(role === 'customer' ? '/cases' : '/overview');
  }, [app.current, ok, role, router]);
  if (!ok) return null;
  return <>{children}</>;
}
