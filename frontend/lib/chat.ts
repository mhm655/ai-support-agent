const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type ChatStreamHandlers = {
  onConversationId?: (id: string) => void;
  onToken: (text: string) => void;
  onLeadCaptured?: (lead: Record<string, string>) => void;
  onError?: (message: string) => void;
  onDone?: () => void;
};

// Parses Server-Sent Events out of a fetch stream. The browser's built-in
// EventSource API can't be used here because it only supports GET
// requests — we need POST to send the message body, so we read the
// stream manually instead.
export async function streamChat(
  agentId: string,
  message: string,
  conversationId: string | null,
  visitorId: string,
  handlers: ChatStreamHandlers
): Promise<void> {
  const res = await fetch(`${API_BASE}/public/agents/${agentId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      conversation_id: conversationId,
      visitor_id: visitorId,
    }),
  });

  if (!res.ok || !res.body) {
    throw new Error(`Chat request failed (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() || ""; // last chunk may be incomplete, keep it for next read

    for (const rawEvent of events) {
      const lines = rawEvent.split("\n");
      const eventLine = lines.find((l) => l.startsWith("event: "));
      const dataLine = lines.find((l) => l.startsWith("data: "));
      if (!eventLine || !dataLine) continue;

      const eventName = eventLine.replace("event: ", "").trim();
      const data = JSON.parse(dataLine.replace("data: ", ""));

      if (eventName === "conversation") handlers.onConversationId?.(data.conversation_id);
      else if (eventName === "token") handlers.onToken(data.text);
      else if (eventName === "lead_captured") handlers.onLeadCaptured?.(data);
      else if (eventName === "error") handlers.onError?.(data.message);
      else if (eventName === "done") handlers.onDone?.();
    }
  }
}
