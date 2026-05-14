import { beforeEach, describe, expect, it, vi } from "vitest";

const createMock = vi.fn();

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: createMock },
  })),
}));

const cacheStore = new Map<string, string>();
vi.mock("@/lib/db/client", () => ({
  db: {},
  schema: {},
}));
vi.mock("@/lib/ai/client", async (orig) => {
  const real = await orig<typeof import("@/lib/ai/client")>();
  return {
    ...real,
    lookupCache: async (kind: string, hash: string) => cacheStore.get(`${kind}:${hash}`) ?? null,
    writeCache: async (kind: string, hash: string, out: string) => {
      cacheStore.set(`${kind}:${hash}`, out);
    },
  };
});

import { summarizeMessage } from "@/lib/ai/summarize";

describe("summarizeMessage", () => {
  beforeEach(() => {
    cacheStore.clear();
    createMock.mockReset();
  });

  it("calls Claude exactly once for the same email — verifies caching saves money", async () => {
    createMock.mockResolvedValue({
      content: [{ type: "text", text: "Action: confirm dinner Friday." }],
    });
    const input = {
      subject: "Dinner?",
      from: "kavya@example.com",
      receivedAt: new Date("2026-05-12"),
      text: "Hey, free Friday for dinner at 7?",
    };
    const a = await summarizeMessage(input);
    const b = await summarizeMessage(input);
    expect(a).toBe("Action: confirm dinner Friday.");
    expect(b).toBe(a);
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("strips HTML before sending to the model — wastes tokens otherwise", async () => {
    createMock.mockResolvedValue({ content: [{ type: "text", text: "ok" }] });
    await summarizeMessage({
      subject: "Receipt",
      from: "store@example.com",
      receivedAt: new Date(),
      html: "<html><body><h1>Order</h1><p>Thanks!</p><script>alert(1)</script></body></html>",
    });
    const userMsg = createMock.mock.calls[0]?.[0]?.messages?.[0]?.content as string;
    expect(userMsg).toContain("Thanks!");
    expect(userMsg).not.toContain("<script>");
    expect(userMsg).not.toContain("alert(1)");
  });

  it("prefers plain text when both text and html are present (matches RFC convention)", async () => {
    createMock.mockResolvedValue({ content: [{ type: "text", text: "ok" }] });
    await summarizeMessage({
      subject: "x",
      from: "x@x",
      receivedAt: new Date(),
      text: "PLAIN_BODY_MARKER",
      html: "<p>HTML_BODY_MARKER</p>",
    });
    const userMsg = createMock.mock.calls[0]?.[0]?.messages?.[0]?.content as string;
    expect(userMsg).toContain("PLAIN_BODY_MARKER");
    expect(userMsg).not.toContain("HTML_BODY_MARKER");
  });
});
