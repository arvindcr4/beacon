import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { decryptJSON, encryptJSON } from "@/lib/crypto/vault";
import { GmailProvider } from "./gmail";
import { O365Provider } from "./o365";
import { ImapProvider } from "./imap";
import type {
  AnyCredentials,
  ImapCredentials,
  MailProvider,
  OAuthCredentials,
} from "./types";

export { IMAP_PRESETS, type ImapPreset } from "./imap";
export * from "./types";

/**
 * Build a {@link MailProvider} for a stored mailbox row. The factory:
 *   1. decrypts the row's credentials,
 *   2. instantiates the right adapter (IMAP / Gmail / O365),
 *   3. wires a token-refresh callback that re-encrypts and persists new tokens.
 */
export async function providerForAccount(accountId: string): Promise<MailProvider> {
  const row = await db.query.mailAccounts.findFirst({
    where: eq(schema.mailAccounts.id, accountId),
  });
  if (!row) throw new Error(`mail account ${accountId} not found`);
  const creds = decryptJSON<AnyCredentials>(row.credentials);

  const saveTokens = async (next: OAuthCredentials): Promise<void> => {
    await db
      .update(schema.mailAccounts)
      .set({ credentials: encryptJSON(next) })
      .where(eq(schema.mailAccounts.id, accountId));
  };

  switch (row.kind) {
    case "imap":
      return new ImapProvider(row.id, row.emailAddress, creds as ImapCredentials);
    case "gmail":
      return new GmailProvider(
        row.id,
        row.emailAddress,
        creds as OAuthCredentials,
        saveTokens,
      );
    case "o365":
      return new O365Provider(
        row.id,
        row.emailAddress,
        creds as OAuthCredentials,
        saveTokens,
      );
  }
}

/** Fan-out a per-account async fn across all of a user's mailboxes, in parallel. */
export async function forEachAccount<T>(
  userId: string,
  fn: (provider: MailProvider, account: typeof schema.mailAccounts.$inferSelect) => Promise<T>,
): Promise<Array<{ account: typeof schema.mailAccounts.$inferSelect; result: T | Error }>> {
  const accounts = await db.query.mailAccounts.findMany({
    where: eq(schema.mailAccounts.userId, userId),
  });
  return Promise.all(
    accounts.map(async (account) => {
      try {
        const provider = await providerForAccount(account.id);
        try {
          const result = await fn(provider, account);
          return { account, result };
        } finally {
          await provider.close();
        }
      } catch (err) {
        return { account, result: err instanceof Error ? err : new Error(String(err)) };
      }
    }),
  );
}
