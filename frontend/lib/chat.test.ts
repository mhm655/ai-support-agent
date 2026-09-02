import { afterEach, describe, expect, it, vi } from "vitest";
import { streamChat } from "./chat";

// Builds a fake fetch Response whose body is a ReadableStream emitting the
// given raw SSE text, chunked exactly as passed in — this exercises the
// same manual buffer/split parsing streamChat uses on a real fetch stream
// (see the comment in chat.ts on why EventSource can't be used here).
function fakeSseResponse(chunks: string[], ok = true, status = 200) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return { ok, status, body: stream } as unknown as Response;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("streamChat", () => {
  it("dispatches conversation, token, and done events in order", async () => {
    const sse =
      `event: conversation\ndata: {"conversation_id":"conv-1"}\n\n` +
      `event: token\ndata: {"text":"Hel"}\n\n` +
      `event: token\ndata: {"text":"lo"}\n\n` +
      `event: done\ndata: {}\n\n`;

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fakeSseResponse([sse])));

    const onConversationId = vi.fn();
    const onToken = vi.fn();
    const onDone = vi.fn();

    await streamChat("agent-1", "hi", null, "visitor-1", {
      onConversationId,
      onToken,
      onDone,
    });

    expect(onConversationId).toHaveBeenCalledWith("conv-1");
    expect(onToken).toHaveBeenNthCalledWith(1, "Hel");
    expect(onToken).toHaveBeenNthCalledWith(2, "lo");
    expect(onDone).toHaveBeenCalledOnce();
  });

  it("handles an SSE event split across multiple stream chunks", async () => {
    // The event is split mid-line to prove the buffer correctly holds the
    // incomplete tail until the next chunk arrives.
    const chunks = [`event: token\ndata: {"te`, `xt":"world"}\n\n`];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fakeSseResponse(chunks)));

    const onToken = vi.fn();
    await streamChat("agent-1", "hi", null, "visitor-1", { onToken });

    expect(onToken).toHaveBeenCalledWith("world");
  });

  it("forwards a lead_captured event", async () => {
    const sse = `event: lead_captured\ndata: {"name":"Alex","email":"a@example.com"}\n\n`;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fakeSseResponse([sse])));

    const onLeadCaptured = vi.fn();
    await streamChat("agent-1", "hi", null, "visitor-1", {
      onToken: vi.fn(),
      onLeadCaptured,
    });

    expect(onLeadCaptured).toHaveBeenCalledWith({ name: "Alex", email: "a@example.com" });
  });

  it("forwards a server-sent error event via onError", async () => {
    const sse = `event: error\ndata: {"message":"Gemini quota exceeded"}\n\n`;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fakeSseResponse([sse])));

    const onError = vi.fn();
    await streamChat("agent-1", "hi", null, "visitor-1", { onToken: vi.fn(), onError });

    expect(onError).toHaveBeenCalledWith("Gemini quota exceeded");
  });

  it("throws when the HTTP response itself is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, body: null } as unknown as Response)
    );

    await expect(
      streamChat("agent-1", "hi", null, "visitor-1", { onToken: vi.fn() })
    ).rejects.toThrow("Chat request failed (500)");
  });

  it("sends the conversation_id and visitor_id in the request body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(fakeSseResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await streamChat("agent-42", "hello there", "conv-9", "visitor-7", { onToken: vi.fn() });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/public/agents/agent-42/chat"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          message: "hello there",
          conversation_id: "conv-9",
          visitor_id: "visitor-7",
        }),
      })
    );
  });
});
