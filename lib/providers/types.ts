/**
 * Beacon's provider-neutral mail interface.
 *
 * All three adapters (IMAP, Gmail, Microsoft Graph) implement this same
 * surface. The UI / API routes never branch on provider — they call the
 * methods here and let the adapter translate.
 */

export type MailKind = "imap" | "gmail" | "o365";

export interface MailAddress {
  name?: string;
  address: string;
}

export interface MailHeaders {
  messageId?: string;
  inReplyTo?: string;
  references?: string[];
}

/** Lightweight envelope used for inbox lists. Body is fetched on demand. */
export interface MailEnvelope {
  id: string; // provider-native id (uid for IMAP, gmail message id, etc.)
  threadId?: string;
  folder: string;
  from: MailAddress;
  to: MailAddress[];
  cc?: MailAddress[];
  subject: string;
  snippet: string;
  receivedAt: Date;
  isRead: boolean;
  isFlagged: boolean;
  labels: string[];
  hasAttachments: boolean;
}

export interface MailMessage extends MailEnvelope {
  textBody: string;
  htmlBody?: string;
  headers?: MailHeaders;
  attachments: Array<{
    filename: string;
    contentType: string;
    size: number;
    contentId?: string;
  }>;
}

export interface ListOptions {
  folder?: string;
  limit?: number;
  before?: Date;
  search?: string;
}

export interface SendOptions {
  to: MailAddress[];
  cc?: MailAddress[];
  bcc?: MailAddress[];
  subject: string;
  text?: string;
  html?: string;
  inReplyTo?: string;
  references?: string[];
}

export interface Folder {
  name: string;
  path: string;
  unread?: number;
  total?: number;
  specialUse?: "inbox" | "sent" | "drafts" | "trash" | "archive" | "junk" | null;
}

export interface MailProvider {
  readonly kind: MailKind;
  readonly accountId: string;
  readonly emailAddress: string;

  listFolders(): Promise<Folder[]>;
  listMessages(opts?: ListOptions): Promise<MailEnvelope[]>;
  getMessage(id: string, folder?: string): Promise<MailMessage>;
  sendMessage(opts: SendOptions): Promise<{ id: string }>;
  search(query: string, opts?: ListOptions): Promise<MailEnvelope[]>;

  markRead(id: string, read: boolean, folder?: string): Promise<void>;
  flag(id: string, flagged: boolean, folder?: string): Promise<void>;
  archive(id: string, folder?: string): Promise<void>;
  trash(id: string, folder?: string): Promise<void>;
  addLabel(id: string, label: string, folder?: string): Promise<void>;
  removeLabel(id: string, label: string, folder?: string): Promise<void>;

  /** Release any persistent connections / pools (mainly IMAP). */
  close(): Promise<void>;
}

/** Adapter-specific credentials shapes, all serializable to JSON. */
export type ImapCredentials = {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
};

export type OAuthCredentials = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
  scope?: string;
};

export type AnyCredentials = ImapCredentials | OAuthCredentials;
