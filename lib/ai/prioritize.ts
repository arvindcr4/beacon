import { cachedSystem, client, hashFor, lookupCache, MODELS, writeCache } from "./client";
import type { MailEnvelope } from "@/lib/providers/types";

export type Priority = "high" | "medium" | "low";

export interface PriorityResult {
  id: string;
  priority: Priority;
  reason: string;
}

const SYSTEM_PROMPT = `You are Beacon's email triage classifier.

For each email envelope, decide the priority for the *recipient*:
- "high":   needs the recipient's attention soon — direct asks, time-sensitive, blocking decisions, from a real person addressed to them.
- "medium": worth reading today — coworker FYIs, replies in a thread the recipient started, security notices about their own account.
- "low":    can be skimmed or skipped — newsletters, marketing, automated digests, password resets the user requested.

Also write a one-sentence "reason" the user could read on the inbox card.

Output strict JSON. No prose, no markdown fences. Schema:
{"items":[{"id":"...","priority":"high|medium|low","reason":"..."}, ...]}

Be conservative — when in doubt, prefer "medium" over "high".`.trim();

export async function prioritizeBatch(
  envelopes: MailEnvelope[],
  recipientAddress: string,
): Promise<PriorityResult[]> {
  if (envelopes.length === 0) return [];

  // Cache lookup: prioritization is deterministic per (recipient, envelope core fields).
  const cacheKeys = envelopes.map((e) =>
    hashFor("priority", {
      recipient: recipientAddress,
      id: e.id,
      from: e.from.address,
      subject: e.subject,
      snippet: e.snippet,
    }),
  );
  const cached = await Promise.all(cacheKeys.map((k) => lookupCache("priority", k)));

  const missing: { idx: number; envelope: MailEnvelope }[] = [];
  envelopes.forEach((e, i) => {
    if (!cached[i]) missing.push({ idx: i, envelope: e });
  });

  const out = new Array<PriorityResult>(envelopes.length);
  cached.forEach((c, i) => {
    if (c) out[i] = JSON.parse(c) as PriorityResult;
  });

  if (missing.length === 0) return out;

  const payload = {
    recipient: recipientAddress,
    items: missing.map(({ envelope: e }) => ({
      id: e.id,
      from: e.from.address,
      from_name: e.from.name,
      subject: e.subject,
      snippet: e.snippet,
      received: e.receivedAt.toISOString(),
      to_me: e.to.some((t) => t.address.toLowerCase() === recipientAddress.toLowerCase()),
    })),
  };

  const resp = await client().messages.create({
    model: MODELS.fast,
    max_tokens: Math.min(4096, missing.length * 80 + 200),
    system: cachedSystem(SYSTEM_PROMPT),
    messages: [
      {
        role: "user",
        content: JSON.stringify(payload),
      },
    ],
  });

  const raw = resp.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("")
    .trim();

  const parsed = safeParse(raw);
  const map = new Map<string, PriorityResult>();
  for (const item of parsed.items ?? []) {
    if (item?.id && item.priority && item.reason) {
      map.set(item.id, {
        id: item.id,
        priority: normalizePriority(item.priority),
        reason: String(item.reason).slice(0, 280),
      });
    }
  }

  await Promise.all(
    missing.map(async ({ idx, envelope }, i) => {
      const result =
        map.get(envelope.id) ??
        ({ id: envelope.id, priority: "medium", reason: "No clear signal." } as PriorityResult);
      out[idx] = result;
      const key = cacheKeys[idx];
      if (key) await writeCache("priority", key, JSON.stringify(result), MODELS.fast);
    }),
  );

  return out;
}

function safeParse(s: string): { items?: Array<Partial<PriorityResult>> } {
  try {
    return JSON.parse(s) as { items?: Array<Partial<PriorityResult>> };
  } catch {
    // Model occasionally wraps in fences despite the system prompt — strip and retry.
    const stripped = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
    try {
      return JSON.parse(stripped) as { items?: Array<Partial<PriorityResult>> };
    } catch {
      return {};
    }
  }
}

function normalizePriority(p: string): Priority {
  const v = p.toLowerCase();
  if (v === "high" || v === "medium" || v === "low") return v;
  return "medium";
}
