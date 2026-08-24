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
  // Colors match the dashboard/landing brand system (navy/cream/amber) so
  // the widget doesn't look like a bolted-on third-party tool. System font
  // stack on purpose, not a web font — this script has to stay
  // dependency-free and shouldn't add a font request to every site that
  // embeds it.
  const style = document.createElement("style");
  style.textContent = `
    .aiw-bubble {
      position: fixed; bottom: 20px; right: 20px; width: 56px; height: 56px;
      border-radius: 50%; background: #12142B; color: #fff; border: none;
      cursor: pointer; z-index: 999999; display: flex; align-items: center;
      justify-content: center; box-shadow: 0 4px 14px rgba(18,20,43,0.35);
      transition: transform 0.15s ease;
    }
    .aiw-bubble:hover { transform: scale(1.05); }
    .aiw-bubble:focus-visible { outline: 2px solid #E8A33D; outline-offset: 2px; }
    .aiw-panel {
      position: fixed; bottom: 88px; right: 20px; width: 340px; height: 460px;
      background: #fff; border-radius: 16px; box-shadow: 0 8px 30px rgba(18,20,43,0.25);
      display: none; flex-direction: column; overflow: hidden; z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .aiw-panel.aiw-open { display: flex; }
    .aiw-header {
      background: #12142B; color: #F4F2EC; padding: 14px 16px; font-size: 13px;
      font-weight: 600; display: flex; align-items: center; gap: 6px;
    }
    .aiw-dot { position: relative; display: inline-flex; width: 7px; height: 7px; }
    .aiw-dot::before, .aiw-dot::after {
      content: ""; position: absolute; inset: 0; border-radius: 50%; background: #34D399;
    }
    .aiw-dot::before { animation: aiw-ping 1.8s cubic-bezier(0,0,0.2,1) infinite; }
    @keyframes aiw-ping { 75%, 100% { transform: scale(2.2); opacity: 0; } }
    @media (prefers-reduced-motion: reduce) { .aiw-dot::before { animation: none; } }
    .aiw-messages {
      flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column;
      gap: 8px; background: #F4F2EC;
    }
    .aiw-empty { color: #5B5F73; font-size: 13px; line-height: 1.5; }
    .aiw-msg { max-width: 80%; padding: 8px 12px; border-radius: 10px; font-size: 13px; line-height: 1.45; }
    .aiw-msg.user { align-self: flex-end; background: #E8A33D; color: #12142B; }
    .aiw-msg.assistant { align-self: flex-start; background: #fff; color: #12142B; border: 1px solid rgba(18,20,43,0.08); }
    .aiw-input-row { display: flex; border-top: 1px solid rgba(18,20,43,0.08); background: #fff; }
    .aiw-input { flex: 1; border: none; padding: 12px 14px; font-size: 13px; outline: none; background: transparent; color: #12142B; }
    .aiw-input::placeholder { color: #8892B0; }
    .aiw-input:focus-visible { box-shadow: inset 0 0 0 2px #E8A33D; }
    .aiw-send {
      border: none; background: transparent; color: #E8A33D; padding: 0 16px;
      cursor: pointer; font-size: 13px; font-weight: 600;
    }
    .aiw-send:hover { color: #12142B; }
    .aiw-send:focus-visible { outline: 2px solid #E8A33D; outline-offset: -2px; }
  `;
  document.head.appendChild(style);

  const bubble = document.createElement("button");
  bubble.className = "aiw-bubble";
  bubble.setAttribute("aria-label", "Open chat");
  bubble.innerHTML =
    '<svg viewBox="0 0 20 20" fill="none" width="22" height="22" aria-hidden="true">' +
    '<path d="M3 5.5A2.5 2.5 0 0 1 5.5 3h9A2.5 2.5 0 0 1 17 5.5v6A2.5 2.5 0 0 1 14.5 14H9l-3.5 3v-3H5.5A2.5 2.5 0 0 1 3 11.5v-6Z" ' +
    'stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>';

  const panel = document.createElement("div");
  panel.className = "aiw-panel";
  panel.innerHTML = `
    <div class="aiw-header"><span class="aiw-dot"></span>Chat with us</div>
    <div class="aiw-messages"><p class="aiw-empty">Ask us anything — hours, pricing, availability.</p></div>
    <div class="aiw-input-row">
      <input class="aiw-input" type="text" placeholder="Type a message…" aria-label="Type a message" />
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
    const empty = messagesEl.querySelector(".aiw-empty");
    if (empty) empty.remove();
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
          } else if (eventName === "error") {
            assistantEl.textContent = data.message;
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
