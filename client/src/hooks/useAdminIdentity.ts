import { useEffect, useState } from 'react';

export interface AdminIdentity {
  name: string;
  role: string;
  initials: string;
}

function initialsFor(name: string) {
  return name.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'AD';
}

function readPersistedIdentity(): AdminIdentity {
  try {
    const raw = localStorage.getItem('gullybid-auth');
    const user = raw ? JSON.parse(raw)?.state?.user : null;
    const name = typeof user?.name === 'string' && user.name.trim() ? user.name.trim() : 'Admin';
    return { name, role: typeof user?.role === 'string' ? user.role : 'ADMIN', initials: initialsFor(name) };
  } catch {
    return { name: 'Admin', role: 'ADMIN', initials: 'AD' };
  }
}

/**
 * The real application should preferably pass the auth-store user directly.
 * This fallback reads the same persisted Zustand record used by authStore so
 * the standalone feature still renders the authenticated administrator name.
 */
export function useAdminIdentity() {
  const [identity, setIdentity] = useState<AdminIdentity>(() => readPersistedIdentity());

  useEffect(() => {
    const refresh = () => setIdentity(readPersistedIdentity());
    window.addEventListener('storage', refresh);
    window.addEventListener('gullybid-auth-updated', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('gullybid-auth-updated', refresh);
    };
  }, []);

  return identity;
}
