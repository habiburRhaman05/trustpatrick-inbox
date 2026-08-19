import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Contact } from '../types';

/**
 * Auto-syncs the positive-replied contacts from GoHighLevel as soon as the
 * app mounts (i.e. right after login). GHL credentials live in server env
 * vars, so there is nothing to connect first.
 *
 * `synced` flips true after the first attempt settles — the app uses it to
 * decide when to swap the sync skeleton for the real UI.
 */
export function useContacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [synced, setSynced] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { contacts } = await api.getContacts();
      setContacts(contacts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contacts.');
    } finally {
      setLoading(false);
      setSynced(true);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { contacts, loading, error, synced, reload };
}
