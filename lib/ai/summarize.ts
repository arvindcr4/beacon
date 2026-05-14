import { bodyToText, cachedSystem, clampBody, client, hashFor, lookupCache, MODELS, writeCache } from "./client";
import type { MailMessage } from "@/lib/providers/types";

const SYSTEM_PROMPT = `You are Beacon's email summarizer.

Goal: in one or two short sentences, tell the reader the single most useful thing about this email. No fluff, no "this email is about". Lead with what's needed or what just changed.

Rules:
- Plain text, no markdown, no emoji.
- Max 240 characters.
- If there is a clear action the reader must take, lead with it: "Action: ..." or "Reply by Friday with ...".
- If it's a notification (newsletter, receipt, no action), describe what changed in one sentence.
- Never invent facts. If the email is ambiguous, say so.`.trim();

export interface SummarizeInput {
  subject: string;
  from: string;
  receivedAt: Date | string;
  text?: string;
  html?: string;
}

export async function summarizeMessage(input: SummarizeInput): Promise<string> {
  const body = clampBody(bodyToText({ text: input.text, html: input.html }));
  const sourceHash = hashFor("summary", {
    subject: input.subject,
    from: input.from,
    body,
  });
  const cached = await lookupCache("summary", sourceHash);
  if (cached) return cached;

  const userPrompt = renderPrompt(input, body);
  const resp = await client().messages.create({
    model: MODELS.fast,
    max_tokens: 200,
    system: cachedSystem(SYSTEM_PROMPT),
    messages: [
      {
        role: "user",
        content: userPrompt,
      },
    ],
  });

  const output = resp.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("")
    .trim();

  await writeCache("summary", sourceHash, output, MODELS.fast);
  return output;
}

/** Helper that pulls fields from a fully-fetched MailMessage. */
export async function summarizeMailMessage(msg: MailMessage): Promise<string> {
  return summarizeMessage({
    subject: msg.subject,
    from: msg.from.address,
    receivedAt: msg.receivedAt,
    text: msg.textBody,
    html: msg.htmlBody,
  });
}

function renderPrompt(input: SummarizeInput, body: string): string {
  return `From: ${input.from}
Subject: ${input.subject}
Received: ${typeof input.receivedAt === "string" ? input.receivedAt : input.receivedAt.toISOString()}

---
${body || "(empty body)"}
---

Summarize.`;
}
