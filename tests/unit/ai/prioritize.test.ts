import { beforeEach, describe, expect, it, vi } from "vitest";

const createMock = vi.fn();

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: createMock },
  })),
}));

vi.mock("@/lib/db/client", () => ({ db: {}, schema: {} }));
vi.mock("@/lib/ai/client", async (orig) => {
  const real = await orig<typeof import("@/lib/ai/client")>();
  return {
    ...real,
    lookupCache: async () => null,
    writeCache: async () => {},
  };
});

import { prioritizeBatch } from "@/lib/ai/prioritize";

const sampleEnvelopes = [
  {
    id: "1",
    folder: "INBOX",
    from: { address: "boss@company.com", name: "Boss" },
    to: [{ address: "me@example.com" }],
    subject: "Need numbers by EOD",
    snippet: "Hey, can you send the Q2 numbers?",
    receivedAt: new Date(),
    isRead: false,
    isFlagged: false,
    labels: [],
    hasAttachments: false,
  },
  {
    id: "2",
    folder: "INBOX",
    from: { address: "newsletter@news.com", name: "Newsletter" },
    to: [{ address: "me@example.com" }],
    subject: "Today's headlines",
    snippet: "...",
    receivedAt: new Date(),
    isRead: false,
    isFlagged: false,
    labels: [],
    hasAttachments: false,
  },
];

describe("prioritizeBatch", () => {
  beforeEach(() => createMock.mockReset());

  it("parses Claude's JSON output and maps results per id", async () => {
    createMock.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            items: [
              { id: "1", priority: "high", reason: "Direct ask, blocking your boss." },
              { id: "2", priority: "low", reason: "Newsletter. Skim later." },
            ],
          }),
        },
      ],
    });
    const result = await prioritizeBatch(sampleEnvelopes, "me@example.com");
    expect(result).toHaveLength(2);
    expect(result[0]?.priority).toBe("high");
    expect(result[1]?.priority).toBe("low");
  });

  it("falls back to medium when Claude returns malformed output — never leaves UI empty", async () => {
    createMock.mockResolvedValue({
      content: [{ type: "text", text: "I'm Claude and I refuse to JSON today." }],
    });
    const result = await prioritizeBatch(sampleEnvelopes, "me@example.com");
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.priority === "medium")).toBe(true);
  });

  it("survives code-fence wrapping (Claude sometimes ignores 'no fences' instruction)", async () => {
    createMock.mockResolvedValue({
      content: [
        {
          type: "text",
          text: '```json\n{"items":[{"id":"1","priority":"high","reason":"x"},{"id":"2","priority":"low","reason":"y"}]}\n```',
        },
      ],
    });
    const result = await prioritizeBatch(sampleEnvelopes, "me@example.com");
    expect(result[0]?.priority).toBe("high");
    expect(result[1]?.priority).toBe("low");
  });

  it("does not call Claude when the input is empty", async () => {
    const result = await prioritizeBatch([], "me@example.com");
    expect(result).toEqual([]);
    expect(createMock).not.toHaveBeenCalled();
  });
});
