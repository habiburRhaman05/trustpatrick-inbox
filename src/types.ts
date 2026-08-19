export interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  tags: string[];
  dateUpdated?: string | null;
}

/** One GHL custom field on a contact. Ids vary per location. */
export interface ContactCustomField {
  id?: string;
  key?: string;
  value?: unknown;
  [key: string]: unknown;
}

/** The full contact record behind the "View info" panel. */
export interface ContactDetail extends Contact {
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  timezone: string | null;
  website: string | null;
  source: string | null;
  type: string | null;
  assignedTo: string | null;
  dnd: boolean;
  dateAdded: string | null;
  dateOfBirth: string | null;
  customFields: ContactCustomField[];
}

/** An SMS message in a conversation. */
export interface ConversationMessage {
  id: string;
  direction: 'inbound' | 'outbound' | string;
  messageType: string | null;
  text: string;
  status: string | null;
  dateAdded: string | null;
}

export interface Conversation {
  id: string;
  contactId: string;
  [key: string]: unknown;
}

export interface AuthUser {
  email: string;
  expiresAt: number;
}

export interface ApiErrorShape {
  error: string;
  details?: unknown;
}
