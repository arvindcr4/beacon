import { google, type gmail_v1 } from "googleapis";
import type {
  Folder,
  ListOptions,
  MailEnvelope,
  MailMessage,
  MailProvider,
  OAuthCredentials,
  SendOptions,
} from "./types";

export class GmailProvider implements MailProvider {
  readonly kind = "gmail" as const;

  constructor(
    readonly accountId: string,
    readonly emailAddress: string,
    private readonly creds: OAuthCredentials,
    private readonly onTokenRefresh?: (next: OAuthCredentials) => Promise<void>,
  ) {}

  private gmail(): gmail_v1.Gmail {
    const client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    );
    client.setCredentials({
      access_token: this.creds.accessToken,
      refresh_token: this.creds.refreshToken,
      expiry_date: this.creds.expiresAt,
    });
    client.on("tokens", (tokens) => {
      if (!this.onTokenRefresh) return;
      const next: OAuthCredentials = {
        accessToken: tokens.access_token ?? this.creds.accessToken,
        refreshToken: tokens.refresh_token ?? this.creds.refreshToken,
        expiresAt: tokens.expiry_date ?? this.creds.expiresAt,
        scope: tokens.scope ?? this.creds.scope,
      };
      void this.onTokenRefresh(next);
    });
    return google.gmail({ version: "v1", auth: client });
  }

  async listFolders(): Promise<Folder[]> {
    const g = this.gmail();
    const { data } = await g.users.labels.list({ userId: "me" });
    return (data.labels ?? []).map((l) => ({
      name: l.name ?? l.id ?? "",
      path: l.id ?? l.name ?? "",
      specialUse: mapLabelToSpecialUse(l.id),
    }));
  }

  async listMessages(opts: ListOptions = {}): Promise<MailEnvelope[]> {
    const g = this.gmail();
    const labelIds = [folderToLabel(opts.folder ?? "INBOX")];
    const { data } = await g.users.messages.list({
      userId: "me",
      labelIds,
      maxResults: opts.limit ?? 50,
      q: opts.search,
    });
    const ids = (data.messages ?? []).map((m) => m.id!).filter(Boolean);
    return Promise.all(ids.map((id) => this.envelopeFor(g, id)));
  }

  async getMessage(id: string): Promise<MailMessage> {
    const g = this.gmail();
    const { data } = await g.users.messages.get({
      userId: "me",
      id,
      format: "full",
    });
    const env = parseEnvelope(data);
    const { text, html, attachments } = decodeBody(data.payload);
    return {
      ...env,
      textBody: text,
      htmlBody: html,
      headers: {
        messageId: header(data.payload?.headers, "Message-ID"),
        inReplyTo: header(data.payload?.headers, "In-Reply-To"),
        references: header(data.payload?.headers, "References")?.split(/\s+/),
      },
      attachments,
    };
  }

  async sendMessage(opts: SendOptions): Promise<{ id: string }> {
    const g = this.gmail();
    const raw = buildRawMime({ ...opts, from: this.emailAddress });
    const { data } = await g.users.messages.send({
      userId: "me",
      requestBody: { raw },
    });
    return { id: data.id ?? "" };
  }

  async search(query: string, opts: ListOptions = {}): Promise<MailEnvelope[]> {
    return this.listMessages({ ...opts, search: query });
  }

  async markRead(id: string, read: boolean): Promise<void> {
    const g = this.gmail();
    await g.users.messages.modify({
      userId: "me",
      id,
      requestBody: read
        ? { removeLabelIds: ["UNREAD"] }
        : { addLabelIds: ["UNREAD"] },
    });
  }

  async flag(id: string, flagged: boolean): Promise<void> {
    const g = this.gmail();
    await g.users.messages.modify({
      userId: "me",
      id,
      requestBody: flagged
        ? { addLabelIds: ["STARRED"] }
        : { removeLabelIds: ["STARRED"] },
    });
  }

  async archive(id: string): Promise<void> {
    const g = this.gmail();
    await g.users.messages.modify({
      userId: "me",
      id,
      requestBody: { removeLabelIds: ["INBOX"] },
    });
  }

  async trash(id: string): Promise<void> {
    const g = this.gmail();
    await g.users.messages.trash({ userId: "me", id });
  }

  async addLabel(id: string, label: string): Promise<void> {
    const g = this.gmail();
    await g.users.messages.modify({
      userId: "me",
      id,
      requestBody: { addLabelIds: [label] },
    });
  }

  async removeLabel(id: string, label: string): Promise<void> {
    const g = this.gmail();
    await g.users.messages.modify({
      userId: "me",
      id,
      requestBody: { removeLabelIds: [label] },
    });
  }

  async close(): Promise<void> {
    // Stateless — no pool to drain.
  }

  private async envelopeFor(g: gmail_v1.Gmail, id: string): Promise<MailEnvelope> {
    const { data } = await g.users.messages.get({
      userId: "me",
      id,
      format: "metadata",
      metadataHeaders: ["From", "To", "Cc", "Subject", "Date"],
    });
    return parseEnvelope(data);
  }
}

function parseEnvelope(msg: gmail_v1.Schema$Message): MailEnvelope {
  const headers = msg.payload?.headers ?? [];
  const from = parseAddress(header(headers, "From"));
  const to = (header(headers, "To") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(parseAddress);
  const cc = (header(headers, "Cc") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(parseAddress);
  const labels = msg.labelIds ?? [];
  return {
    id: msg.id!,
    threadId: msg.threadId ?? undefined,
    folder: labels.includes("INBOX") ? "INBOX" : labels[0] ?? "INBOX",
    from,
    to,
    cc,
    subject: header(headers, "Subject") ?? "(no subject)",
    snippet: msg.snippet ?? "",
    receivedAt: new Date(Number(msg.internalDate ?? Date.now())),
    isRead: !labels.includes("UNREAD"),
    isFlagged: labels.includes("STARRED"),
    labels: labels.filter((l) => !SYSTEM_LABELS.has(l)),
    hasAttachments: hasAttachmentParts(msg.payload),
  };
}

const SYSTEM_LABELS = new Set([
  "INBOX",
  "UNREAD",
  "STARRED",
  "IMPORTANT",
  "SENT",
  "DRAFT",
  "TRASH",
  "SPAM",
  "CHAT",
  "CATEGORY_PERSONAL",
  "CATEGORY_SOCIAL",
  "CATEGORY_UPDATES",
  "CATEGORY_FORUMS",
  "CATEGORY_PROMOTIONS",
]);

function header(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string | undefined {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? undefined;
}

function parseAddress(raw: string | undefined): { name?: string; address: string } {
  if (!raw) return { address: "" };
  const match = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (match) return { name: match[1]?.trim() || undefined, address: match[2]!.trim() };
  return { address: raw.trim() };
}

function decodeBody(payload: gmail_v1.Schema$MessagePart | undefined): {
  text: string;
  html?: string;
  attachments: MailMessage["attachments"];
} {
  let text = "";
  let html: string | undefined;
  const attachments: MailMessage["attachments"] = [];

  const visit = (part?: gmail_v1.Schema$MessagePart): void => {
    if (!part) return;
    if (part.filename && part.body?.attachmentId) {
      attachments.push({
        filename: part.filename,
        contentType: part.mimeType ?? "application/octet-stream",
        size: part.body.size ?? 0,
      });
    } else if (part.mimeType === "text/plain" && part.body?.data) {
      text += decodeBase64Url(part.body.data);
    } else if (part.mimeType === "text/html" && part.body?.data) {
      html = (html ?? "") + decodeBase64Url(part.body.data);
    }
    part.parts?.forEach(visit);
  };
  visit(payload);
  return { text, html, attachments };
}

function decodeBase64Url(s: string): string {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function hasAttachmentParts(payload: gmail_v1.Schema$MessagePart | undefined): boolean {
  if (!payload) return false;
  if (payload.filename && payload.body?.attachmentId) return true;
  return (payload.parts ?? []).some(hasAttachmentParts);
}

function folderToLabel(folder: string): string {
  const map: Record<string, string> = {
    INBOX: "INBOX",
    Sent: "SENT",
    Drafts: "DRAFT",
    Trash: "TRASH",
    Spam: "SPAM",
    Starred: "STARRED",
  };
  return map[folder] ?? folder;
}

function mapLabelToSpecialUse(id: string | null | undefined): Folder["specialUse"] {
  switch (id) {
    case "INBOX":
      return "inbox";
    case "SENT":
      return "sent";
    case "DRAFT":
      return "drafts";
    case "TRASH":
      return "trash";
    case "SPAM":
      return "junk";
    default:
      return null;
  }
}

function buildRawMime(opts: SendOptions & { from: string }): string {
  const lines: string[] = [];
  lines.push(`From: ${opts.from}`);
  lines.push(`To: ${opts.to.map(formatAddr).join(", ")}`);
  if (opts.cc?.length) lines.push(`Cc: ${opts.cc.map(formatAddr).join(", ")}`);
  if (opts.bcc?.length) lines.push(`Bcc: ${opts.bcc.map(formatAddr).join(", ")}`);
  lines.push(`Subject: ${opts.subject}`);
  if (opts.inReplyTo) lines.push(`In-Reply-To: ${opts.inReplyTo}`);
  if (opts.references?.length) lines.push(`References: ${opts.references.join(" ")}`);
  lines.push("MIME-Version: 1.0");
  if (opts.html) {
    lines.push('Content-Type: text/html; charset="UTF-8"');
    lines.push("");
    lines.push(opts.html);
  } else {
    lines.push('Content-Type: text/plain; charset="UTF-8"');
    lines.push("");
    lines.push(opts.text ?? "");
  }
  return Buffer.from(lines.join("\r\n"), "utf8").toString("base64url");
}

function formatAddr(a: { name?: string; address: string }): string {
  return a.name ? `"${a.name}" <${a.address}>` : a.address;
}
