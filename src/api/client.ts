// Small fetch wrapper: every backend error becomes an ApiError with a
// human-readable message so components can just show err.message.

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// Fired whenever a request comes back 401 so the app can drop to the login
// screen from anywhere (expired 3-day session, cookie cleared, etc).
export const AUTH_EVENT = 'pr:unauthorized';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`https://trustpatrick-inbox-production.up.railway.app/api${path}`, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      ...init,
    });
  } catch {
    throw new ApiError('Could not reach the server. Check your connection and try again.', 0);
  }

  const text = await res.text();
  const json = text ? JSON.parse(text) : {};

  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/')) {
      window.dispatchEvent(new Event(AUTH_EVENT));
    }
    throw new ApiError(json.error || `Request failed (${res.status})`, res.status);
  }
  return json as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ email: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
  me: () => request<import('../types').AuthUser>('/auth/me'),

  getContacts: () => request<{ contacts: import('../types').Contact[] }>('/contacts'),

  getContact: (contactId: string) =>
    request<{ contact: import('../types').ContactDetail }>(
      `/contacts/${encodeURIComponent(contactId)}`
    ),

  getConversations: (contactId: string) =>
    request<{ conversations: import('../types').Conversation[] }>(
      `/conversations?contactId=${encodeURIComponent(contactId)}`
    ),

  getMessages: (conversationId: string) =>
    request<{ messages: import('../types').ConversationMessage[] }>(
      `/conversations/${encodeURIComponent(conversationId)}/messages`
    ),

  // Replies go out as SMS — plain text, no subject.
  sendReply: (
    conversationId: string,
    payload: { contactId: string; message: string; toNumber?: string; fromNumber?: string }
  ) =>
    request<{ result: unknown }>(`/conversations/${encodeURIComponent(conversationId)}/reply`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
