import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";

/**
 * Beacon's user-identity auth.
 *
 * Per-mailbox credentials (Gmail OAuth tokens, IMAP passwords) live in
 * `mail_accounts.credentials` (encrypted). This Auth.js setup is only for
 * the *user* of Beacon — i.e. "who is logged into this app".
 *
 * For the eval demo we use a passwordless lookup-by-email Credentials
 * provider that creates a user row on first sight. In a real deployment,
 * swap this for the magic-link Email provider or OAuth (Google sign-in).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: schema.users,
    accountsTable: schema.accounts,
    sessionsTable: schema.sessions,
    verificationTokensTable: schema.verificationTokens,
  }),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/signin",
  },
  providers: [
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
      },
      async authorize(creds) {
        const email = String(creds?.email ?? "").trim().toLowerCase();
        if (!email || !email.includes("@")) return null;
        const existing = await db.query.users.findFirst({
          where: eq(schema.users.email, email),
        });
        if (existing) return { id: existing.id, email: existing.email, name: existing.name };
        const inserted = await db
          .insert(schema.users)
          .values({ email })
          .returning();
        const u = inserted[0]!;
        return { id: u.id, email: u.email, name: u.name };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.uid = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token.uid && session.user) {
        (session.user as { id?: string }).id = token.uid as string;
      }
      return session;
    },
  },
});

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
