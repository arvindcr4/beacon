import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db/client";
import { providerForAccount } from "@/lib/providers";
import { draftReplyStream } from "@/lib/ai/draft";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  accountId: z.string(),
  messageId: z.string(),
  folder: z.string().optional(),
  intent: z.string().optional(),
  tone: z.enum(["neutral", "warm", "direct", "apologetic", "enthusiastic"]).optional(),
});

export async function POST(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("unauthorized", { status: 401 });
  }
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return new Response(JSON.stringify(parsed.error.flatten()), { status: 400 });
  }
  const { accountId, messageId, folder, intent, tone } = parsed.data;

  const row = await db.query.mailAccounts.findFirst({
    where: and(
      eq(schema.mailAccounts.id, accountId),
      eq(schema.mailAccounts.userId, session.user.id),
    ),
  });
  if (!row) return new Response("account not found", { status: 404 });

  const provider = await providerForAccount(accountId);
  const message = await provider.getMessage(messageId, folder);
  await provider.close();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of draftReplyStream({
          original: {
            subject: message.subject,
            from: message.from.address,
            text: message.textBody,
            html: message.htmlBody,
          },
          intent,
          tone,
        })) {
          controller.enqueue(encoder.encode(chunk));
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

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
