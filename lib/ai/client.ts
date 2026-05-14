import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import { convert } from "html-to-text";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";

/** Beacon's Claude models — Haiku for cheap, Sonnet for tone-sensitive output. */
export const MODELS = {
  fast: "claude-haiku-4-5-20251001",
  smart: "claude-sonnet-4-6",
} as const;

let _client: Anthropic | null = null;

export function client(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  _client = new Anthropic({ apiKey });
  return _client;
}

/**
 * Build a system-prompt array with prompt caching turned on. We cast through
 * `unknown` because the SDK's TextBlockParam type lags the API — cache_control
 * is wire-supported but not typed on this minor version.
 */
export function cachedSystem(text: string): Anthropic.Messages.TextBlockParam[] {
  return [
    {
      type: "text",
      text,
      cache_control: { type: "ephemeral" },
    } as unknown as Anthropic.Messages.TextBlockParam,
  ];
}

/** Stable SHA-256 hash for caching keys (kind + content). */
export function hashFor(kind: string, payload: unknown): string {
  const s = typeof payload === "string" ? payload : JSON.stringify(payload);
  return createHash("sha256").update(kind + "\0" + s).digest("hex");
}

/** Look up a cached AI result. Returns null on miss. */
export async function lookupCache(
  kind: "summary" | "draft" | "priority",
  sourceHash: string,
): Promise<string | null> {
  const row = await db.query.aiCache.findFirst({
    where: and(eq(schema.aiCache.kind, kind), eq(schema.aiCache.sourceHash, sourceHash)),
  });
  return row?.output ?? null;
}

export async function writeCache(
  kind: "summary" | "draft" | "priority",
  sourceHash: string,
  output: string,
  model: string,
): Promise<void> {
  await db
    .insert(schema.aiCache)
    .values({ kind, sourceHash, output, model })
    .onConflictDoNothing();
}

/** Convert an HTML body to plain text suitable for Claude's context window. */
export function bodyToText(opts: { text?: string; html?: string }): string {
  if (opts.text && opts.text.trim().length > 0) return opts.text;
  if (opts.html) {
    return convert(opts.html, {
      wordwrap: false,
      selectors: [
        { selector: "a", options: { ignoreHref: false } },
        { selector: "img", format: "skip" },
        { selector: "script", format: "skip" },
        { selector: "style", format: "skip" },
      ],
    });
  }
  return "";
}

/** Clamp long bodies — Claude can take a lot, but huge marketing emails waste tokens. */
export function clampBody(body: string, maxChars = 12_000): string {
  if (body.length <= maxChars) return body;
  return body.slice(0, maxChars) + "\n\n[truncated]";
}
