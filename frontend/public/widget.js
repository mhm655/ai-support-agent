/**
 * Embeddable AI support widget.
 *
 * A business drops this on their site with:
 *   <script src="https://your-domain.com/widget.js"
 *           data-agent-id="AGENT_ID"
 *           data-api-url="https://your-api-domain.com"></script>
 *
 * Deliberately plain JS with zero dependencies and no build step — it
 * has to work by just being <script> tag dropped onto ANY website,
 * regardless of what framework (or no framework) that site uses.
 */
(function () {
  const scriptTag = document.currentScript;
  const agentId = scriptTag.getAttribute("data-agent-id");
  const apiUrl = scriptTag.getAttribute("data-api-url") || "http://localhost:8000";

  if (!agentId) {
    console.error("[AI widget] Missing data-agent-id on the script tag.");
    return;
  }

  // Visitor identity persists across page loads (same browser) via
  // localStorage, so returning visitors keep their conversation history.
  const VISITOR_KEY = "ai_widget_visitor_id";
  const CONVERSATION_KEY = `ai_widget_conversation_id_${agentId}`;

  function getOrCreateVisitorId() {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = "visitor-" + Math.random().toString(36).slice(2) + Date.now();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  }

  const visitorId = getOrCreateVisitorId();
  let conversationId = localStorage.getItem(CONVERSATION_KEY);

  // ---------- Build the UI ----------
  const style = document.createElement("style");
  style.textContent = `
    .aiw-bubble {
      position: fixed; bottom: 20px; right: 20px; width: 56px; height: 56px;
      border-radius: 50%; background: #111; color: #fff; border: none;
      cursor: pointer; font-size: 24px; z-index: 999999;
      box-shadow: 0 4px 14px rgba(0,0,0,0.25);
    }
    .aiw-panel {
      position: fixed; bottom: 88px; right: 20px; width: 340px; height: 460px;
      background: #fff; border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,0.2);
      display: none; flex-direction: column; overflow: hidden; z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .aiw-panel.aiw-open { display: flex; }
    .aiw-header { background: #111; color: #fff; padding: 12px 16px; font-size: 14px; font-weight: 600; }
    .aiw-messages { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
    .aiw-msg { max-width: 80%; padding: 8px 12px; border-radius: 10px; font-size: 13px; line-height: 1.4; }
    .aiw-msg.user { align-self: flex-end; background: #111; color: #fff; }
    .aiw-msg.assistant { align-self: flex-start; background: #f0f0f0; color: #111; }
    .aiw-input-row { display: flex; border-top: 1px solid #eee; }
    .aiw-input { flex: 1; border: none; padding: 10px 12px; font-size: 13px; outline: none; }
    .aiw-send { border: none; background: #111; color: #fff; padding: 0 16px; cursor: pointer; font-size: 13px; }
  `;
  document.head.appendChild(style);

  const bubble = document.createElement("button");
  bubble.className = "aiw-bubble";
  bubble.textContent = "💬";
  bubble.setAttribute("aria-label", "Open chat");

  const panel = document.createElement("div");
  panel.className = "aiw-panel";
  panel.innerHTML = `
    <div class="aiw-header">Chat with us</div>
    <div class="aiw-messages"></div>
    <div class="aiw-input-row">
      <input class="aiw-input" type="text" placeholder="Type a message…" />
      <button class="aiw-send">Send</button>
    </div>
  `;

  document.body.appendChild(bubble);
  document.body.appendChild(panel);

  const messagesEl = panel.querySelector(".aiw-messages");
  const inputEl = panel.querySelector(".aiw-input");
  const sendBtn = panel.querySelector(".aiw-send");

  bubble.addEventListener("click", () => {
    panel.classList.toggle("aiw-open");
  });

  function addMessage(role, text) {
    const div = document.createElement("div");
    div.className = `aiw-msg ${role}`;
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text) return;
    inputEl.value = "";
    addMessage("user", text);
    const assistantEl = addMessage("assistant", "");

    try {
      const res = await fetch(`${apiUrl}/public/agents/${agentId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          conversation_id: conversationId,
          visitor_id: visitorId,
        }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const rawEvent of events) {
          const lines = rawEvent.split("\n");
          const eventLine = lines.find((l) => l.startsWith("event: "));
          const dataLine = lines.find((l) => l.startsWith("data: "));
          if (!eventLine || !dataLine) continue;

          const eventName = eventLine.replace("event: ", "").trim();
          const data = JSON.parse(dataLine.replace("data: ", ""));

          if (eventName === "conversation") {
            conversationId = data.conversation_id;
            localStorage.setItem(CONVERSATION_KEY, conversationId);
          } else if (eventName === "token") {
            assistantEl.textContent += data.text;
            messagesEl.scrollTop = messagesEl.scrollHeight;
          }
        }
      }
    } catch (err) {
      assistantEl.textContent = "Sorry, something went wrong.";
      console.error("[AI widget]", err);
    }
  }

  sendBtn.addEventListener("click", sendMessage);
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
  });
})();
