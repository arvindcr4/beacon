import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

/* ---------- Auth.js v5 (Drizzle adapter) tables ---------- */

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified", { mode: "timestamp_ms" }),
  image: text("image"),
});

export const accounts = sqliteTable(
  "accounts",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (a) => [primaryKey({ columns: [a.provider, a.providerAccountId] })],
);

export const sessions = sqliteTable("sessions", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
});

export const verificationTokens = sqliteTable(
  "verificationTokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
  },
  (v) => [primaryKey({ columns: [v.identifier, v.token] })],
);

/* ---------- Beacon-specific tables ---------- */

/**
 * A connected mailbox. One user can have many. `credentials` is an
 * encrypted JSON blob — shape depends on `kind`:
 *   - "imap":   { host, port, secure, username, password, smtpHost, smtpPort }
 *   - "gmail":  { accessToken, refreshToken, expiresAt }
 *   - "o365":   { accessToken, refreshToken, expiresAt }
 */
export const mailAccounts = sqliteTable(
  "mail_accounts",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["imap", "gmail", "o365"] }).notNull(),
    displayName: text("display_name").notNull(),
    emailAddress: text("email_address").notNull(),
    credentials: text("credentials").notNull(), // encrypted via lib/crypto/vault
    color: text("color"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    lastSyncedAt: integer("last_synced_at", { mode: "timestamp_ms" }),
  },
  (t) => [index("mail_accounts_user_idx").on(t.userId)],
);

/**
 * Cached message metadata — keeps the unified inbox snappy.
 * The body is fetched on demand from the provider; we only cache enough
 * for list rendering + AI prioritization.
 */
export const messageCache = sqliteTable(
  "message_cache",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    accountId: text("account_id")
      .notNull()
      .references(() => mailAccounts.id, { onDelete: "cascade" }),
    providerMessageId: text("provider_message_id").notNull(),
    threadId: text("thread_id"),
    folder: text("folder").notNull().default("INBOX"),
    fromName: text("from_name"),
    fromAddr: text("from_addr").notNull(),
    toAddrs: text("to_addrs").notNull(), // json array
    subject: text("subject"),
    snippet: text("snippet"),
    receivedAt: integer("received_at", { mode: "timestamp_ms" }).notNull(),
    isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
    isFlagged: integer("is_flagged", { mode: "boolean" }).notNull().default(false),
    labels: text("labels"), // json array
    priority: text("priority", { enum: ["high", "medium", "low"] }),
    priorityReason: text("priority_reason"),
    aiSummary: text("ai_summary"),
  },
  (t) => [
    index("message_cache_account_idx").on(t.accountId),
    index("message_cache_received_idx").on(t.receivedAt),
    index("message_cache_provider_idx").on(t.accountId, t.providerMessageId),
  ],
);

/**
 * Cache for AI outputs keyed by (kind, sourceHash). Avoids paying Anthropic
 * twice for the same input.
 */
export const aiCache = sqliteTable(
  "ai_cache",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    kind: text("kind", { enum: ["summary", "draft", "priority"] }).notNull(),
    sourceHash: text("source_hash").notNull(),
    output: text("output").notNull(),
    model: text("model").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("ai_cache_lookup_idx").on(t.kind, t.sourceHash)],
);

export type MailAccount = typeof mailAccounts.$inferSelect;
export type NewMailAccount = typeof mailAccounts.$inferInsert;
export type MessageCacheRow = typeof messageCache.$inferSelect;
export type NewMessageCacheRow = typeof messageCache.$inferInsert;