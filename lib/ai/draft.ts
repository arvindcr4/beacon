import Anthropic from "@anthropic-ai/sdk";
import { bodyToText, cachedSystem, clampBody, client, MODELS } from "./client";

export type DraftTone = "neutral" | "warm" | "direct" | "apologetic" | "enthusiastic";

const SYSTEM_PROMPT = `You are Beacon's reply drafter.

Goal: write a single, concise email reply that the user can send with minor edits.

Rules:
- Match the requested tone exactly.
- Default length: 3–6 sentences. If the user gives explicit length guidance, follow it.
- Do not invent commitments, dates, or facts. If the answer requires info the user hasn't given, leave a clearly marked placeholder like [confirm date] inline.
- Plain text body. No subject line. No "Hi [Name]," unless the original had a name we can reuse.
- Sign off as the user (no name) — end with a short closing like "Thanks," or "Best,".
- If the request is ambiguous, write the safest, most neutral reply and add one short [need: ...] note at the very end.`.trim();

export interface DraftInput {
  /** The original message we're replying to. */
  original: {
    subject: string;
    from: string;
    text?: string;
    html?: string;
  };
  /** Optional natural-language guidance from the user ("decline politely", "ask for slides", etc). */
  intent?: string;
  tone?: DraftTone;
  /** Optional: thread context (previous turns), most recent last. */
  context?: Array<{ from: string; text: string }>;
}

export async function draftReply(input: DraftInput): Promise<string> {
  const tone = input.tone ?? "neutral";
  const body = clampBody(bodyToText(input.original));
  const messages = buildMessages(input, body, tone);

  const resp = await client().messages.create({
    model: MODELS.smart,
    max_tokens: 800,
    system: cachedSystem(SYSTEM_PROMPT),
    messages,
  });

  return resp.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("")
    .trim();
}

/**
 * Streaming variant — used by the compose UI to show tokens as they arrive.
 * Returns an async iterable of plain-text deltas.
 */
export async function* draftReplyStream(input: DraftInput): AsyncIterable<string> {
  const tone = input.tone ?? "neutral";
  const body = clampBody(bodyToText(input.original));
  const messages = buildMessages(input, body, tone);

  const stream = await client().messages.create({
    model: MODELS.smart,
    max_tokens: 800,
    stream: true,
    system: cachedSystem(SYSTEM_PROMPT),
    messages,
  });

  for await (const event of stream as AsyncIterable<Anthropic.Messages.RawMessageStreamEvent>) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text;
    }
  }
}

function buildMessages(
  input: DraftInput,
  body: string,
  tone: DraftTone,
): Anthropic.Messages.MessageParam[] {
  const contextBlock = input.context?.length
    ? "\n\nThread (oldest → newest):\n" +
      input.context
        .map((c) => `--- ${c.from} ---\n${c.text}`)
        .join("\n\n")
    : "";

  return [
    {
      role: "user",
      content: `Tone: ${tone}
${input.intent ? `Intent: ${input.intent}\n` : ""}
The email I'm replying to:
From: ${input.original.from}
Subject: ${input.original.subject}

${body || "(empty body)"}${contextBlock}

Write the reply.`,
    },
  ];
}
