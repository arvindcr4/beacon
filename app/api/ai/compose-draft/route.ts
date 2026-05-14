import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/lib/auth";
import { cachedSystem, client, MODELS } from "@/lib/ai/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  subject: z.string().min(1),
  intent: z.string().min(1),
  to: z.string().optional(),
});

const SYSTEM_PROMPT = `You are Beacon's email composer.
Write a concise email body matching the user's intent. Rules:
- Plain text, no markdown.
- 3–6 sentences unless told otherwise.
- No subject line, no signature beyond a short closing ("Thanks," / "Best,").
- Don't invent facts the user didn't give. Use [placeholder] inline if something is needed.`.trim();

export async function POST(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return new Response("unauthorized", { status: 401 });
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return new Response(JSON.stringify(parsed.error.flatten()), { status: 400 });
  }

  const stream = await client().messages.create({
    model: MODELS.smart,
    max_tokens: 700,
    stream: true,
    system: cachedSystem(SYSTEM_PROMPT),
    messages: [
      {
        role: "user",
        content: `Subject: ${parsed.data.subject}
To: ${parsed.data.to ?? "(unspecified)"}
Intent: ${parsed.data.intent}

Write the body.`,
      },
    ],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream as AsyncIterable<Anthropic.Messages.RawMessageStreamEvent>) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      } catch (err) {
        controller.enqueue(
          encoder.encode(`\n\n[error: ${err instanceof Error ? err.message : String(err)}]`),
        );
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
