import { ImapFlow, type FetchMessageObject } from "imapflow";
import { simpleParser, type ParsedMail } from "mailparser";
import { createTransport } from "nodemailer";
import type {
  Folder,
  ImapCredentials,
  ListOptions,
  MailEnvelope,
  MailMessage,
  MailProvider,
  SendOptions,
} from "./types";

const INBOX = "INBOX";

export class ImapProvider implements MailProvider {
  readonly kind = "imap" as const;

  constructor(
    readonly accountId: string,
    readonly emailAddress: string,
    private readonly creds: ImapCredentials,
  ) {}

  private async client(): Promise<ImapFlow> {
    const c = new ImapFlow({
      host: this.creds.host,
      port: this.creds.port,
      secure: this.creds.secure,
      auth: { user: this.creds.username, pass: this.creds.password },
      logger: false,
    });
    await c.connect();
    return c;
  }

  async listFolders(): Promise<Folder[]> {
    const c = await this.client();
    try {
      const list = await c.list();
      return list.map((m) => ({
        name: m.name,
        path: m.path,
        specialUse: mapSpecialUse(m.specialUse ?? null),
      }));
    } finally {
      await c.logout();
    }
  }

  async listMessages(opts: ListOptions = {}): Promise<MailEnvelope[]> {
    const folder = opts.folder ?? INBOX;
    const limit = opts.limit ?? 50;
    const c = await this.client();
    try {
      const lock = await c.getMailboxLock(folder);
      try {
        const mailbox = c.mailbox as { exists: number } | false;
        if (!mailbox || mailbox.exists === 0) return [];
        const from = Math.max(1, mailbox.exists - limit + 1);
        const range = `${from}:${mailbox.exists}`;
        const envelopes: MailEnvelope[] = [];
        for await (const msg of c.fetch(range, {
          uid: true,
          envelope: true,
          flags: true,
          internalDate: true,
          bodyStructure: true,
        })) {
          envelopes.push(toEnvelope(msg, folder));
        }
        return envelopes.reverse();
      } finally {
        lock.release();
      }
    } finally {
      await c.logout();
    }
  }

  async getMessage(id: string, folder = INBOX): Promise<MailMessage> {
    const c = await this.client();
    try {
      const lock = await c.getMailboxLock(folder);
      try {
        const uid = Number(id);
        const result = await c.fetchOne(
          uid,
          { uid: true, envelope: true, flags: true, internalDate: true, source: true },
          { uid: true },
        );
        if (!result || !result.source) {
          throw new Error(`Message ${id} not found in ${folder}`);
        }
        const parsed = await simpleParser(result.source);
        const env = toEnvelope(result, folder);
        return {
          ...env,
          textBody: parsed.text ?? "",
          htmlBody: typeof parsed.html === "string" ? parsed.html : undefined,
          headers: {
            messageId: parsed.messageId,
            inReplyTo: parsed.inReplyTo,
            references: arrayify(parsed.references),
          },
          attachments: (parsed.attachments ?? []).map((a) => ({
            filename: a.filename ?? "attachment",
            contentType: a.contentType,
            size: a.size,
            contentId: a.contentId,
          })),
        };
      } finally {
        lock.release();
      }
    } finally {
      await c.logout();
    }
  }

  async sendMessage(opts: SendOptions): Promise<{ id: string }> {
    const transport = createTransport({
      host: this.creds.smtpHost,
      port: this.creds.smtpPort,
      secure: this.creds.smtpSecure,
      auth: { user: this.creds.username, pass: this.creds.password },
    });
    const info = await transport.sendMail({
      from: { name: this.emailAddress, address: this.emailAddress },
      to: opts.to.map(toNm),
      cc: opts.cc?.map(toNm),
      bcc: opts.bcc?.map(toNm),
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
      inReplyTo: opts.inReplyTo,
      references: opts.references,
    });
    transport.close();
    return { id: (info as { messageId?: string }).messageId ?? "" };
  }

  async search(query: string, opts: ListOptions = {}): Promise<MailEnvelope[]> {
    const folder = opts.folder ?? INBOX;
    const c = await this.client();
    try {
      const lock = await c.getMailboxLock(folder);
      try {
        const uids = await c.search({ text: query }, { uid: true });
        if (!uids || uids.length === 0) return [];
        const recent = uids.slice(-Math.min(uids.length, opts.limit ?? 50));
        const envelopes: MailEnvelope[] = [];
        for await (const msg of c.fetch(
          recent.join(","),
          { uid: true, envelope: true, flags: true, internalDate: true, bodyStructure: true },
          { uid: true },
        )) {
          envelopes.push(toEnvelope(msg, folder));
        }
        return envelopes.reverse();
      } finally {
        lock.release();
      }
    } finally {
      await c.logout();
    }
  }

  async markRead(id: string, read: boolean, folder = INBOX): Promise<void> {
    await this.withFolder(folder, async (c) => {
      const action = read ? c.messageFlagsAdd : c.messageFlagsRemove;
      await action.call(c, Number(id), ["\\Seen"], { uid: true });
    });
  }

  async flag(id: string, flagged: boolean, folder = INBOX): Promise<void> {
    await this.withFolder(folder, async (c) => {
      const action = flagged ? c.messageFlagsAdd : c.messageFlagsRemove;
      await action.call(c, Number(id), ["\\Flagged"], { uid: true });
    });
  }

  async archive(id: string, folder = INBOX): Promise<void> {
    // IMAP doesn't have a universal "Archive" — try `All Mail` / `Archive`, fall back to keyword remove from INBOX.
    await this.withFolder(folder, async (c) => {
      const dest =
        (await findFolder(c, ["Archive", "All Mail", "[Gmail]/All Mail"])) ?? "Archive";
      try {
        await c.messageMove(Number(id), dest, { uid: true });
      } catch {
        // Some servers won't auto-create; just unflag from inbox as a best effort.
        await c.messageFlagsAdd(Number(id), ["\\Seen"], { uid: true });
      }
    });
  }

  async trash(id: string, folder = INBOX): Promise<void> {
    await this.withFolder(folder, async (c) => {
      const dest = (await findFolder(c, ["Trash", "Deleted", "[Gmail]/Trash"])) ?? "Trash";
      await c.messageMove(Number(id), dest, { uid: true });
    });
  }

  async addLabel(id: string, label: string, folder = INBOX): Promise<void> {
    await this.withFolder(folder, async (c) => {
      await c.messageFlagsAdd(Number(id), [label], { uid: true });
    });
  }

  async removeLabel(id: string, label: string, folder = INBOX): Promise<void> {
    await this.withFolder(folder, async (c) => {
      await c.messageFlagsRemove(Number(id), [label], { uid: true });
    });
  }

  async close(): Promise<void> {
    // No persistent pool — connections are per-call.
  }

  private async withFolder(folder: string, fn: (c: ImapFlow) => Promise<void>): Promise<void> {
    const c = await this.client();
    try {
      const lock = await c.getMailboxLock(folder);
      try {
        await fn(c);
      } finally {
        lock.release();
      }
    } finally {
      await c.logout();
    }
  }
}

function toEnvelope(msg: FetchMessageObject, folder: string): MailEnvelope {
  const env = msg.envelope;
  return {
    id: String(msg.uid),
    folder,
    from: {
      name: env?.from?.[0]?.name ?? undefined,
      address: env?.from?.[0]?.address ?? "",
    },
    to: (env?.to ?? []).map((a) => ({ name: a.name, address: a.address ?? "" })),
    cc: (env?.cc ?? []).map((a) => ({ name: a.name, address: a.address ?? "" })),
    subject: env?.subject ?? "(no subject)",
    snippet: "",
    receivedAt: toDate(env?.date) ?? toDate(msg.internalDate as string | Date | undefined) ?? new Date(),
    isRead: msg.flags?.has("\\Seen") ?? false,
    isFlagged: msg.flags?.has("\\Flagged") ?? false,
    labels: [...(msg.flags ?? [])].filter((f) => !f.startsWith("\\")),
    hasAttachments: detectAttachments(msg.bodyStructure),
  };
}

function toDate(v: string | Date | undefined): Date | undefined {
  if (!v) return undefined;
  return v instanceof Date ? v : new Date(v);
}

/** nodemailer's Address.name is non-optional; coerce ours into the strict shape. */
function toNm(a: { name?: string; address: string }): { name: string; address: string } {
  return { name: a.name ?? "", address: a.address };
}

function detectAttachments(structure: unknown): boolean {
  if (!structure || typeof structure !== "object") return false;
  const s = structure as { disposition?: string; childNodes?: unknown[] };
  if (s.disposition === "attachment") return true;
  if (Array.isArray(s.childNodes)) return s.childNodes.some((c) => detectAttachments(c));
  return false;
}

function arrayify(v: string | string[] | undefined): string[] | undefined {
  if (!v) return undefined;
  return Array.isArray(v) ? v : [v];
}

function mapSpecialUse(s: string | null): Folder["specialUse"] {
  switch (s) {
    case "\\Inbox":
      return "inbox";
    case "\\Sent":
      return "sent";
    case "\\Drafts":
      return "drafts";
    case "\\Trash":
      return "trash";
    case "\\Archive":
      return "archive";
    case "\\Junk":
      return "junk";
    default:
      return null;
  }
}

async function findFolder(c: ImapFlow, candidates: string[]): Promise<string | undefined> {
  const list = await c.list();
  const paths = new Set(list.map((m) => m.path));
  return candidates.find((p) => paths.has(p));
}

/** Pre-baked configs for the four IMAP providers we promise to support. */
export const IMAP_PRESETS = {
  yahoo: {
    host: "imap.mail.yahoo.com",
    port: 993,
    secure: true,
    smtpHost: "smtp.mail.yahoo.com",
    smtpPort: 465,
    smtpSecure: true,
    note: "Yahoo requires an app password (Account → Security → App passwords).",
  },
  aol: {
    host: "imap.aol.com",
    port: 993,
    secure: true,
    smtpHost: "smtp.aol.com",
    smtpPort: 465,
    smtpSecure: true,
    note: "AOL requires an app password.",
  },
  icloud: {
    host: "imap.mail.me.com",
    port: 993,
    secure: true,
    smtpHost: "smtp.mail.me.com",
    smtpPort: 587,
    smtpSecure: false,
    note: "iCloud requires an app-specific password from appleid.apple.com.",
  },
  fastmail: {
    host: "imap.fastmail.com",
    port: 993,
    secure: true,
    smtpHost: "smtp.fastmail.com",
    smtpPort: 465,
    smtpSecure: true,
    note: "Fastmail requires an app password from Settings → Privacy & Security.",
  },
} as const;

export type ImapPreset = keyof typeof IMAP_PRESETS;
