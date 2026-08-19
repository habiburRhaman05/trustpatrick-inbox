import { useMemo, useState } from 'react';
import './App.css';
import { ContactList } from './components/ContactList';
import { LoginPage } from './components/LoginPage';
import { Spinner } from './components/Spinner';
import { SyncScreen } from './components/SyncScreen';
import { ThreadView } from './components/ThreadView';
import { useToast } from './components/Toast';
import { useAuth } from './hooks/useAuth';
import { useContacts } from './hooks/useContacts';
import { useThread } from './hooks/useThread';
import type { Contact } from './types';

function App() {
  const { user, checking, login, logout } = useAuth();

  if (checking) {
    return (
      <div className="app-splash">
        <Spinner size={22} />
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLogin={login} />;
  }

  return <Dashboard userEmail={user.email} onLogout={logout} />;
}

function Dashboard({ userEmail, onLogout }: { userEmail: string; onLogout: () => Promise<void> }) {
  const toast = useToast();
  const [selected, setSelected] = useState<Contact | null>(null);
  const [mobileView, setMobileView] = useState<'list' | 'thread'>('list');
  const [search, setSearch] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // GHL credentials are hardcoded server-side, so the sync starts on mount —
  // no connect step, no settings form.
  const { contacts, loading: contactsLoading, error: contactsError, synced, reload: reloadContacts } = useContacts();
  const { conversationId, messages, loading: threadLoading, error: threadError, reload: reloadThread } = useThread(
    selected?.id ?? null
  );

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q)
    );
  }, [contacts, search]);

  const handleSelect = (contact: Contact) => {
    setSelected(contact);
    setMobileView('thread');
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await onLogout();
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Failed to sign out.', 'error');
      setLoggingOut(false);
    }
  };

  // First sync after login — friendly skeleton instead of an empty shell.
  if (!synced) {
    return <SyncScreen subtitle={`Signed in as ${userEmail}`} />;
  }

  // The very first sync failed outright (server misconfigured, GHL down, …).
  // Nothing to show behind it, so keep the full-screen treatment.
  if (contactsError && !contacts.length) {
    return <SyncScreen subtitle={`Signed in as ${userEmail}`} error={contactsError} onRetry={reloadContacts} />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-title">
         
    <img src="https://trustpatrick.com/trustpatrick-logo.webp" width={170} alt="" />

    
        </div>
        <div className="app-header-actions">
          <span className="status-dot status-connected" />
          <span className="status-label">
            {contactsLoading ? 'Syncing…' : `${contacts.length} positive replies`}
          </span>
          <button className="btn btn-secondary" onClick={reloadContacts} disabled={contactsLoading}>
            {contactsLoading ? <Spinner /> : 'Refresh'}
          </button>

          <div className="user-menu">
            <button
              className="user-menu-trigger"
              onClick={() => setUserMenuOpen((o) => !o)}
              aria-haspopup="true"
              aria-expanded={userMenuOpen}
            >
              <span className="avatar avatar-user">{userEmail[0]?.toUpperCase()}</span>
            </button>
            {userMenuOpen && (
              <>
                <div className="user-menu-backdrop" onClick={() => setUserMenuOpen(false)} />
                <div className="user-menu-dropdown">
                  <div className="user-menu-email">{userEmail}</div>
                  <button className="btn btn-ghost btn-block" onClick={handleLogout} disabled={loggingOut}>
                    {loggingOut ? (
                      <>
                        <Spinner /> Signing out…
                      </>
                    ) : (
                      'Log out'
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <main className={`app-body mobile-${mobileView}`}>
        <aside className="app-sidebar">
          <div className="search-bar">
            <span className="search-icon" aria-hidden="true">
              🔍
            </span>
            <input
              type="search"
              className="search-input"
              placeholder="Search contacts"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search contacts"
            />
          </div>
          <div className="app-sidebar-header">
            <span>Tagged</span>
            <strong>positive-replied</strong>
            <span className="count-badge">{filteredContacts.length}</span>
          </div>
          <ContactList
            contacts={filteredContacts}
            loading={contactsLoading}
            error={contactsError}
            selectedId={selected?.id ?? null}
            onSelect={handleSelect}
            onRetry={reloadContacts}
          />
        </aside>

        <section className="app-main">
          <ThreadView
            contact={selected}
            conversationId={conversationId}
            messages={messages}
            loading={threadLoading}
            error={threadError}
            onRetry={reloadThread}
            onBack={() => setMobileView('list')}
          />
        </section>
      </main>
    </div>
  );
}

export default App;
