import { Client, type AuthenticationProvider } from "@microsoft/microsoft-graph-client";
import type {
  Folder,
  ListOptions,
  MailEnvelope,
  MailMessage,
  MailProvider,
  OAuthCredentials,
  SendOptions,
} from "./types";

const GRAPH = "https://graph.microsoft.com/v1.0";

export class O365Provider implements MailProvider {
  readonly kind = "o365" as const;

  constructor(
    readonly accountId: string,
    readonly emailAddress: string,
    private readonly creds: OAuthCredentials,
    private readonly onTokenRefresh?: (next: OAuthCredentials) => Promise<void>,
  ) {}

  private async ensureToken(): Promise<string> {
    if (this.creds.expiresAt > Date.now() + 60_000) return this.creds.accessToken;
    // Refresh via the Microsoft identity platform.
    const tenant = process.env.MICROSOFT_TENANT_ID || "common";
    const resp = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID ?? "",
        client_secret: process.env.MICROSOFT_CLIENT_SECRET ?? "",
        grant_type: "refresh_token",
        refresh_token: this.creds.refreshToken,
        scope: "offline_access Mail.ReadWrite Mail.Send User.Read",
      }),
    });
    if (!resp.ok) throw new Error(`O365 token refresh failed: ${resp.status}`);
    const data = (await resp.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };
    const next: OAuthCredentials = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? this.creds.refreshToken,
      expiresAt: Date.now() + data.expires_in * 1000,
      scope: this.creds.scope,
    };
    await this.onTokenRefresh?.(next);
    (this.creds as unknown as OAuthCredentials).accessToken = next.accessToken;
    (this.creds as unknown as OAuthCredentials).refreshToken = next.refreshToken;
    (this.creds as unknown as OAuthCredentials).expiresAt = next.expiresAt;
    return next.accessToken;
  }

  private async client(): Promise<Client> {
    const token = await this.ensureToken();
    const authProvider: AuthenticationProvider = {
      getAccessToken: async () => token,
    };
    return Client.initWithMiddleware({ authProvider });
  }

  async listFolders(): Promise<Folder[]> {
    const c = await this.client();
    const data = await c.api("/me/mailFolders").get();
    return (data.value as MgFolder[]).map((f) => ({
      name: f.displayName,
      path: f.id,
      unread: f.unreadItemCount,
      total: f.totalItemCount,
      specialUse: mapWellKnown(f.displayName),
    }));
  }

  async listMessages(opts: ListOptions = {}): Promise<MailEnvelope[]> {
    const c = await this.client();
    const folder = opts.folder ?? "Inbox";
    const top = opts.limit ?? 50;
    const path = isWellKnown(folder)
      ? `/me/mailFolders/${folder}/messages`
      : `/me/mailFolders/${folder}/messages`;
    let request = c
      .api(path)
      .top(top)
      .orderby("receivedDateTime desc")
      .select(
        "id,subject,from,toRecipients,ccRecipients,bodyPreview,receivedDateTime,isRead,flag,hasAttachments,parentFolderId,categories",
      );
    if (opts.search) request = request.search(`"${opts.search}"`);
    const data = await request.get();
    return (data.value as MgMessage[]).map(toEnvelope);
  }

  async getMessage(id: string): Promise<MailMessage> {
    const c = await this.client();
    const msg = (await c.api(`/me/messages/${id}`).get()) as MgMessage;
    const env = toEnvelope(msg);
    return {
      ...env,
      textBody: msg.body?.contentType === "text" ? msg.body.content ?? "" : "",
      htmlBody: msg.body?.contentType === "html" ? msg.body.content ?? undefined : undefined,
      headers: {
        messageId: msg.internetMessageId,
      },
      attachments: (msg.attachments ?? []).map((a) => ({
        filename: a.name,
        contentType: a.contentType,
        size: a.size,
      })),
    };
  }

  async sendMessage(opts: SendOptions): Promise<{ id: string }> {
    const c = await this.client();
    await c.api("/me/sendMail").post({
      message: {
        subject: opts.subject,
        body: opts.html
          ? { contentType: "html", content: opts.html }
          : { contentType: "text", content: opts.text ?? "" },
        toRecipients: opts.to.map(toRecipient),
        ccRecipients: opts.cc?.map(toRecipient),
        bccRecipients: opts.bcc?.map(toRecipient),
      },
      saveToSentItems: true,
    });
    return { id: "" }; // Graph sendMail doesn't return the new id directly.
  }

  async search(query: string, opts: ListOptions = {}): Promise<MailEnvelope[]> {
    return this.listMessages({ ...opts, search: query });
  }

  async markRead(id: string, read: boolean): Promise<void> {
    const c = await this.client();
    await c.api(`/me/messages/${id}`).patch({ isRead: read });
  }

  async flag(id: string, flagged: boolean): Promise<void> {
    const c = await this.client();
    await c.api(`/me/messages/${id}`).patch({
      flag: { flagStatus: flagged ? "flagged" : "notFlagged" },
    });
  }

  async archive(id: string): Promise<void> {
    const c = await this.client();
    await c.api(`/me/messages/${id}/move`).post({ destinationId: "archive" });
  }

  async trash(id: string): Promise<void> {
    const c = await this.client();
    await c.api(`/me/messages/${id}/move`).post({ destinationId: "deleteditems" });
  }

  async addLabel(id: string, label: string): Promise<void> {
    const c = await this.client();
    const msg = (await c.api(`/me/messages/${id}`).select("categories").get()) as MgMessage;
    const next = Array.from(new Set([...(msg.categories ?? []), label]));
    await c.api(`/me/messages/${id}`).patch({ categories: next });
  }

  async removeLabel(id: string, label: string): Promise<void> {
    const c = await this.client();
    const msg = (await c.api(`/me/messages/${id}`).select("categories").get()) as MgMessage;
    const next = (msg.categories ?? []).filter((l) => l !== label);
    await c.api(`/me/messages/${id}`).patch({ categories: next });
  }

  async close(): Promise<void> {
    // Stateless.
  }
}

/* ---------- Helpers + Graph response shapes ---------- */

type MgFolder = {
  id: string;
  displayName: string;
  unreadItemCount?: number;
  totalItemCount?: number;
};

type MgRecipient = { emailAddress: { name?: string; address: string } };

type MgMessage = {
  id: string;
  subject?: string;
  from?: MgRecipient;
  toRecipients?: MgRecipient[];
  ccRecipients?: MgRecipient[];
  bodyPreview?: string;
  receivedDateTime: string;
  isRead?: boolean;
  flag?: { flagStatus?: "flagged" | "notFlagged" | "complete" };
  hasAttachments?: boolean;
  parentFolderId?: string;
  categories?: string[];
  conversationId?: string;
  internetMessageId?: string;
  body?: { contentType: "text" | "html"; content?: string };
  attachments?: Array<{ name: string; contentType: string; size: number }>;
};

function toEnvelope(m: MgMessage): MailEnvelope {
  return {
    id: m.id,
    threadId: m.conversationId,
    folder: m.parentFolderId ?? "inbox",
    from: {
      name: m.from?.emailAddress.name,
      address: m.from?.emailAddress.address ?? "",
    },
    to: (m.toRecipients ?? []).map((r) => ({
      name: r.emailAddress.name,
      address: r.emailAddress.address,
    })),
    cc: (m.ccRecipients ?? []).map((r) => ({
      name: r.emailAddress.name,
      address: r.emailAddress.address,
    })),
    subject: m.subject ?? "(no subject)",
    snippet: m.bodyPreview ?? "",
    receivedAt: new Date(m.receivedDateTime),
    isRead: m.isRead ?? false,
    isFlagged: m.flag?.flagStatus === "flagged",
    labels: m.categories ?? [],
    hasAttachments: m.hasAttachments ?? false,
  };
}

function toRecipient(a: { name?: string; address: string }): MgRecipient {
  return { emailAddress: { name: a.name, address: a.address } };
}

const WELL_KNOWN = new Set([
  "inbox",
  "drafts",
  "sentitems",
  "deleteditems",
  "junkemail",
  "outbox",
  "archive",
]);

function isWellKnown(folder: string): boolean {
  return WELL_KNOWN.has(folder.toLowerCase());
}

function mapWellKnown(name: string): Folder["specialUse"] {
  const n = name.toLowerCase();
  if (n === "inbox") return "inbox";
  if (n === "sent items" || n === "sentitems") return "sent";
  if (n === "drafts") return "drafts";
  if (n === "deleted items" || n === "deleteditems") return "trash";
  if (n === "archive") return "archive";
  if (n === "junk email" || n === "junkemail") return "junk";
  return null;
}
