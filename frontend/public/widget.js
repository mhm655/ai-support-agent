/**
 * Embeddable AI support widget.
 *
 * A business drops this on their site with:
 *   <script src="https://your-domain.com/widget.js"
 *           data-agent-id="AGENT_ID"
 *           data-api-url="https://your-api-domain.com"></script>
 *
 * Deliberately plain JS with zero dependencies and no build step — it
 * has to work by just being a <script> tag dropped onto ANY website,
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
  let streaming = false;

  // ---------- Build the UI ----------
  // Colors are the same tokens the dashboard and landing page use (see
  // app/globals.css), hard-coded here because this file can't import
  // anything. Everything is scoped under .aiw- and every property is set
  // explicitly, since the host page's CSS reset is unknowable.
  //
  // System font stack on purpose, not a web font — this script has to stay
  // dependency-free and shouldn't add a font request to every site that
  // embeds it.
  const style = document.createElement("style");
  style.textContent = `
    .aiw-root, .aiw-root * { box-sizing: border-box; }

    .aiw-bubble {
      position: fixed; bottom: 20px; right: 20px; width: 56px; height: 56px;
      border-radius: 50%; background: #E8A33D; color: #0A0C1A; border: none;
      cursor: pointer; z-index: 2147483000; display: flex; align-items: center;
      justify-content: center; padding: 0;
      box-shadow: 0 4px 16px rgba(232,163,61,0.35), 0 2px 6px rgba(10,12,26,0.3);
      transition: transform 0.18s ease, box-shadow 0.18s ease;
    }
    .aiw-bubble:hover { transform: scale(1.06); box-shadow: 0 6px 22px rgba(232,163,61,0.45); }
    .aiw-bubble:active { transform: scale(0.98); }
    .aiw-bubble:focus-visible { outline: 2px solid #E8A33D; outline-offset: 3px; }
    .aiw-bubble svg { transition: opacity 0.15s ease, transform 0.2s ease; }
    .aiw-bubble .aiw-icon-close { display: none; }
    .aiw-bubble[aria-expanded="true"] .aiw-icon-open { display: none; }
    .aiw-bubble[aria-expanded="true"] .aiw-icon-close { display: block; }

    .aiw-panel {
      position: fixed; bottom: 88px; right: 20px; width: 360px; height: 520px;
      max-height: calc(100vh - 120px);
      background: #101227; border: 1px solid #262B4C; border-radius: 18px;
      box-shadow: 0 24px 60px -20px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.4);
      display: flex; flex-direction: column; overflow: hidden; z-index: 2147483000;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #F4F2EC;
      opacity: 0; visibility: hidden; pointer-events: none;
      transform: translateY(12px) scale(0.98); transform-origin: bottom right;
      transition: opacity 0.2s ease, transform 0.2s ease, visibility 0.2s;
    }
    .aiw-panel.aiw-open {
      opacity: 1; visibility: visible; pointer-events: auto;
      transform: translateY(0) scale(1);
    }

    /* On a phone the floating card wastes the screen — go near full-bleed. */
    @media (max-width: 480px) {
      .aiw-panel {
        right: 12px; left: 12px; width: auto; bottom: 84px;
        height: calc(100vh - 104px);
      }
    }

    .aiw-header {
      display: flex; align-items: center; gap: 9px;
      background: #1D2140; border-bottom: 1px solid #262B4C;
      padding: 13px 16px; font-size: 13px; font-weight: 600;
    }
    .aiw-header-sub { margin-left: auto; font-size: 10px; font-weight: 400; color: #6B7499;
      letter-spacing: 0.08em; text-transform: uppercase; }
    .aiw-dot { position: relative; display: inline-flex; width: 7px; height: 7px; flex: none; }
    .aiw-dot::before, .aiw-dot::after {
      content: ""; position: absolute; inset: 0; border-radius: 50%; background: #34D399;
    }
    .aiw-dot::before { animation: aiw-ping 1.8s cubic-bezier(0,0,0.2,1) infinite; }
    @keyframes aiw-ping { 75%, 100% { transform: scale(2.2); opacity: 0; } }

    .aiw-messages {
      flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column;
      gap: 10px; background: #101227;
      scrollbar-width: thin; scrollbar-color: #363C68 transparent;
    }
    .aiw-empty { color: #A2AAC6; font-size: 13px; line-height: 1.55; margin: 0; }

    .aiw-msg {
      max-width: 82%; padding: 9px 13px; font-size: 13px; line-height: 1.5;
      white-space: pre-wrap; word-wrap: break-word;
      animation: aiw-rise 0.22s ease-out;
    }
    @keyframes aiw-rise { from { opacity: 0; transform: translateY(4px); } }
    .aiw-msg.user {
      align-self: flex-end; background: #E8A33D; color: #0A0C1A; font-weight: 500;
      border-radius: 14px 14px 4px 14px;
    }
    .aiw-msg.assistant {
      align-self: flex-start; background: #1D2140; color: #F4F2EC;
      border: 1px solid #262B4C; border-radius: 14px 14px 14px 4px;
    }

    /* Shown in place of the assistant bubble's text until the first token
       arrives, so a slow first response doesn't look like a dead widget. */
    .aiw-typing { display: inline-flex; gap: 4px; padding: 3px 0; }
    .aiw-typing span {
      width: 5px; height: 5px; border-radius: 50%; background: #6B7499;
      animation: aiw-blink 1.2s infinite ease-in-out;
    }
    .aiw-typing span:nth-child(2) { animation-delay: 0.16s; }
    .aiw-typing span:nth-child(3) { animation-delay: 0.32s; }
    @keyframes aiw-blink { 0%, 60%, 100% { opacity: 0.3; } 30% { opacity: 1; } }

    .aiw-input-row {
      display: flex; align-items: center; gap: 8px; padding: 10px;
      border-top: 1px solid #262B4C; background: #101227;
    }
    .aiw-input {
      flex: 1; min-width: 0; border: 1px solid #262B4C; background: #1D2140;
      border-radius: 999px; padding: 10px 14px; font-size: 13px; outline: none;
      color: #F4F2EC; font-family: inherit;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .aiw-input::placeholder { color: #6B7499; }
    .aiw-input:focus-visible { border-color: #E8A33D; box-shadow: 0 0 0 3px rgba(232,163,61,0.2); }

    .aiw-send {
      flex: none; width: 38px; height: 38px; border: none; border-radius: 50%;
      background: #E8A33D; color: #0A0C1A; cursor: pointer; display: flex;
      align-items: center; justify-content: center; padding: 0;
      transition: opacity 0.15s ease, transform 0.15s ease;
    }
    .aiw-send:hover:not(:disabled) { transform: scale(1.05); }
    .aiw-send:disabled { opacity: 0.4; cursor: not-allowed; }
    .aiw-send:focus-visible { outline: 2px solid #E8A33D; outline-offset: 2px; }

    @media (prefers-reduced-motion: reduce) {
      .aiw-bubble, .aiw-panel, .aiw-msg, .aiw-send, .aiw-dot::before, .aiw-typing span {
        animation: none !important; transition: none !important;
      }
    }
  `;
  document.head.appendChild(style);

  const ICON_CHAT =
    '<svg class="aiw-icon-open" viewBox="0 0 20 20" fill="none" width="22" height="22" aria-hidden="true">' +
    '<path d="M3 5.5A2.5 2.5 0 0 1 5.5 3h9A2.5 2.5 0 0 1 17 5.5v6A2.5 2.5 0 0 1 14.5 14H9l-3.5 3v-3H5.5A2.5 2.5 0 0 1 3 11.5v-6Z" ' +
    'stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';
  const ICON_CLOSE =
    '<svg class="aiw-icon-close" viewBox="0 0 20 20" fill="none" width="20" height="20" aria-hidden="true">' +
    '<path d="M5.5 5.5l9 9m0-9l-9 9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

  const bubble = document.createElement("button");
  bubble.className = "aiw-root aiw-bubble";
  bubble.type = "button";
  bubble.setAttribute("aria-label", "Open chat");
  bubble.setAttribute("aria-expanded", "false");
  bubble.setAttribute("aria-controls", "aiw-panel");
  bubble.innerHTML = ICON_CHAT + ICON_CLOSE;

  const panel = document.createElement("div");
  panel.className = "aiw-root aiw-panel";
  panel.id = "aiw-panel";
  panel.innerHTML = `
    <div class="aiw-header">
      <span class="aiw-dot"></span>
      <span>Chat with us</span>
      <span class="aiw-header-sub">online</span>
    </div>
    <div class="aiw-messages" role="log" aria-live="polite">
      <p class="aiw-empty">Ask us anything — hours, pricing, availability.</p>
    </div>
    <div class="aiw-input-row">
      <input class="aiw-input" type="text" placeholder="Type a message…" aria-label="Type a message" />
      <button class="aiw-send" type="button" aria-label="Send message">
        <svg viewBox="0 0 20 20" fill="none" width="17" height="17" aria-hidden="true">
          <path d="M3.5 10 16.5 4l-4 12.5-2.75-5.25L3.5 10Z" stroke="currentColor"
                stroke-width="1.6" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
  `;

  document.body.appendChild(bubble);
  document.body.appendChild(panel);

  const messagesEl = panel.querySelector(".aiw-messages");
  const inputEl = panel.querySelector(".aiw-input");
  const sendBtn = panel.querySelector(".aiw-send");

  function setOpen(open) {
    panel.classList.toggle("aiw-open", open);
    bubble.setAttribute("aria-expanded", String(open));
    bubble.setAttribute("aria-label", open ? "Close chat" : "Open chat");
    if (open) inputEl.focus();
  }

  bubble.addEventListener("click", () => setOpen(!panel.classList.contains("aiw-open")));

  // Escape closes the panel and returns focus to the bubble, so keyboard
  // users aren't trapped in a widget they can't dismiss.
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && panel.classList.contains("aiw-open")) {
      setOpen(false);
      bubble.focus();
    }
  });

  function syncSendState() {
    sendBtn.disabled = streaming || !inputEl.value.trim();
  }
  inputEl.addEventListener("input", syncSendState);
  syncSendState();

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

  function showTyping(el) {
    el.innerHTML = '<span class="aiw-typing"><span></span><span></span><span></span></span>';
  }

  // The first token has to clear the typing indicator before appending, or
  // the dots would stay stuck in front of the answer.
  function appendToken(el, text) {
    if (el.querySelector(".aiw-typing")) el.textContent = "";
    el.textContent += text;
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text || streaming) return;
    inputEl.value = "";
    streaming = true;
    syncSendState();

    addMessage("user", text);
    const assistantEl = addMessage("assistant", "");
    showTyping(assistantEl);

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
            appendToken(assistantEl, data.text);
          } else if (eventName === "error") {
            assistantEl.textContent = data.message;
            messagesEl.scrollTop = messagesEl.scrollHeight;
          }
        }
      }

      // A stream that closed without ever emitting a token would otherwise
      // leave the dots animating forever.
      if (assistantEl.querySelector(".aiw-typing")) {
        assistantEl.textContent = "Sorry, no response came back. Please try again.";
      }
    } catch (err) {
      assistantEl.textContent = "Sorry, something went wrong.";
      console.error("[AI widget]", err);
    } finally {
      streaming = false;
      syncSendState();
    }
  }

  sendBtn.addEventListener("click", sendMessage);
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
  });
})();
