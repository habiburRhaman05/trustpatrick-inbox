// Thin wrapper around the GoHighLevel (LeadConnector) v2 REST API.
// Real API calls only — no mock data. Paths/payloads below match the
// GHL v2 Conversations & Contacts API. If the API keys you send over need a
// small field-name tweak, this is the only file that needs to change.
//
// This app is SMS-only: threads render SMS messages and replies go out as
// SMS. Email is deliberately filtered out (see isSmsMessage below).

const BASE_URL = 'https://services.leadconnectorhq.com';
const API_VERSION = '2021-07-28';

class GhlApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = 'GhlApiError';
    this.status = status || 502;
    this.details = details;
  }
}

async function ghlFetch(token, path, { method = 'GET', body, query } = {}) {
  const url = new URL(BASE_URL + path);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    }
  }

  let res;
  try {
    res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Version: API_VERSION,
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new GhlApiError(`Could not reach GoHighLevel (${err.message})`, 502);
  }

  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    const message =
      json?.message || json?.error || `GoHighLevel returned ${res.status}`;
    throw new GhlApiError(message, res.status, json);
  }

  return json;
}

// ---- Contacts -------------------------------------------------------------

/** Contacts in a location that carry a given tag (default: positive-replied). */
async function getContactsByTag(locationId, token, tag = 'positive-replied') {
  const json = await ghlFetch(token, '/contacts/search', {
    method: 'POST',
    body: {
      locationId,
      pageLimit: 100,
      filters: [{ field: 'tags', operator: 'contains', value: tag }],
    },
  });
  const raw = json.contacts || json.data || [];
  return raw.map(normalizeContact);
}

/**
 * Full record for one contact. The search endpoint above returns a trimmed
 * shape (phone is often missing there), so the UI's "View info" panel pulls
 * the complete contact from here.
 */
async function getContact(token, contactId) {
  const json = await ghlFetch(token, `/contacts/${contactId}`);
  const raw = json.contact || json.data || json;
  return normalizeContactDetail(raw);
}

function normalizeContact(c) {
  return {
    id: c.id || c.contactId,
    name:
      c.contactName ||
      [c.firstName, c.lastName].filter(Boolean).join(' ') ||
      c.email ||
      c.phone ||
      'Unknown',
    email: c.email || null,
    phone: c.phone || null,
    tags: c.tags || [],
    dateUpdated: c.dateUpdated || null,
  };
}

/**
 * Everything GHL knows about a contact, flattened for the info panel.
 * `customFields` is passed through as-is — field ids vary per location, so
 * the UI renders whatever comes back rather than assuming a schema.
 */
function normalizeContactDetail(c) {
  return {
    ...normalizeContact(c),
    firstName: c.firstName || null,
    lastName: c.lastName || null,
    companyName: c.companyName || null,
    address: c.address1 || c.address || null,
    city: c.city || null,
    state: c.state || null,
    postalCode: c.postalCode || null,
    country: c.country || null,
    timezone: c.timezone || null,
    website: c.website || null,
    source: c.source || null,
    type: c.type || null,
    assignedTo: c.assignedTo || null,
    dnd: Boolean(c.dnd),
    dateAdded: c.dateAdded || c.dateCreated || null,
    dateOfBirth: c.dateOfBirth || null,
    customFields: Array.isArray(c.customFields) ? c.customFields : [],
  };
}

// ---- Conversations ----------------------------------------------------

/** Conversations for a given contact (to find the thread to open/reply on). */
async function searchConversations(locationId, token, contactId) {
  const json = await ghlFetch(token, '/conversations/search', {
    query: { locationId, contactId },
  });
  return json.conversations || json.data || [];
}

/** Create a new conversation for a contact. */
async function createConversation(token, { locationId, contactId }) {
  return ghlFetch(token, '/conversations/', {
    method: 'POST',
    body: { locationId, contactId },
  });
}

/** Get a single conversation by id. */
async function getConversation(token, conversationId) {
  return ghlFetch(token, `/conversations/${conversationId}`);
}

/** Update a conversation (e.g. mark read, star). */
async function updateConversation(token, conversationId, updates) {
  return ghlFetch(token, `/conversations/${conversationId}`, {
    method: 'PUT',
    body: updates,
  });
}

/**
 * True for SMS messages. GHL labels the channel as "TYPE_SMS" (and older
 * payloads sometimes just "SMS"). A message that declares no channel at all
 * is kept rather than dropped — better to show an untyped message than to
 * render an empty thread if GHL renames the field.
 */
function isSmsMessage(m) {
  const label = m.messageType || m.type;
  if (label === undefined || label === null || label === '') return true;
  return String(label).toUpperCase().includes('SMS');
}

/** SMS messages within a conversation, oldest-first ordering left to the UI. */
async function getMessages(token, conversationId) {
  const json = await ghlFetch(token, `/conversations/${conversationId}/messages`);
  const raw = json.messages?.messages || json.messages || json.data || [];
  return raw.filter(isSmsMessage).map(normalizeMessage);
}

function normalizeMessage(m) {
  return {
    id: m.id,
    // direction and messageType are different fields — inbound/outbound must
    // never fall back to the channel label or the bubbles align wrongly.
    direction: m.direction || 'inbound',
    messageType: m.messageType || m.type || null,
    text: m.body || m.message || '',
    status: m.status || null,
    dateAdded: m.dateAdded || m.dateCreated || null,
  };
}

/**
 * Send an SMS reply on a conversation. toNumber/fromNumber are optional —
 * GHL falls back to the contact's number and the location's provisioned
 * number when they are omitted.
 */
async function sendSmsReply(token, { locationId, conversationId, contactId, message, toNumber, fromNumber }) {
  return ghlFetch(token, '/conversations/messages', {
    method: 'POST',
    body: {
      type: 'SMS',
      locationId,
      conversationId,
      contactId,
      message,
      ...(toNumber ? { toNumber } : {}),
      ...(fromNumber ? { fromNumber } : {}),
    },
  });
}

module.exports = {
  GhlApiError,
  getContactsByTag,
  getContact,
  searchConversations,
  createConversation,
  getConversation,
  updateConversation,
  getMessages,
  sendSmsReply,
};
