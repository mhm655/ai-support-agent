/**
 * Embeddable AI support widget.
 *
 * A business drops this on their site with:
 *   <script src="https://your-domain.com/widget.js"
 *           data-agent-id="AGENT_ID"
 *           data-api-url="https://your-api-domain.com"></script>
 *
 * Optional attributes:
 *   data-greeting="Questions? Ask away."   nudge text, or "off" to disable
 *   data-greeting-delay="8000"             ms before the nudge appears
 *
 * Deliberately plain JS with zero dependencies and no build step — it
 * has to work by just being a <script> tag dropped onto ANY website,
 * regardless of what framework (or no framework) that site uses.
 */
(function () {
  const scriptTag = document.currentScript;
  const agentId = scriptTag.getAttribute("data-agent-id");
  const apiUrl = scriptTag.getAttribute("data-api-url") || "http://localhost:8000";
  const greetingText = scriptTag.getAttribute("data-greeting") || "Questions? Ask away. I answer instantly.";
  const greetingDelay = Number(scriptTag.getAttribute("data-greeting-delay")) || 8000;

  if (!agentId) {
    console.error("[AI widget] Missing data-agent-id on the script tag.");
    return;
  }

  // Visitor identity persists across page loads (same browser) via
  // localStorage, so returning visitors keep their conversation history.
  const VISITOR_KEY = "ai_widget_visitor_id";
  const CONVERSATION_KEY = `ai_widget_conversation_id_${agentId}`;
  const GREETED_KEY = `ai_widget_greeted_${agentId}`;

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
  let lastUserMessage = null;

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
    .aiw-bubble .aiw-icon-close { display: none; }
    .aiw-bubble[aria-expanded="true"] .aiw-icon-open { display: none; }
    .aiw-bubble[aria-expanded="true"] .aiw-icon-close { display: block; }

    /* Unread dot, shown when the nudge is waiting and the panel is shut. */
    .aiw-badge {
      position: absolute; top: -2px; right: -2px; width: 14px; height: 14px;
      border-radius: 50%; background: #F2705F; border: 2px solid #fff;
      display: none;
    }
    .aiw-bubble.aiw-has-unread .aiw-badge { display: block; }

    /* Proactive nudge. Sits beside the bubble rather than covering the page,
       and never reappears once dismissed in this session. */
    .aiw-nudge {
      position: fixed; bottom: 30px; right: 88px; max-width: 230px;
      background: #171A33; color: #F4F2EC; border: 1px solid #262B4C;
      border-radius: 14px 14px 4px 14px; padding: 11px 34px 11px 14px;
      font-size: 13px; line-height: 1.45; z-index: 2147483000;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      box-shadow: 0 14px 36px -14px rgba(0,0,0,0.7);
      cursor: pointer; opacity: 0; transform: translateY(6px);
      transition: opacity 0.25s ease, transform 0.25s ease;
      pointer-events: none;
    }
    .aiw-nudge.aiw-show { opacity: 1; transform: translateY(0); pointer-events: auto; }
    .aiw-nudge-close {
      position: absolute; top: 6px; right: 6px; width: 20px; height: 20px;
      border: none; background: transparent; color: #6B7499; cursor: pointer;
      border-radius: 6px; display: flex; align-items: center; justify-content: center;
      padding: 0; font-size: 14px; line-height: 1;
    }
    .aiw-nudge-close:hover { color: #F4F2EC; }
    @media (max-width: 480px) { .aiw-nudge { display: none; } }

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

    /* On a phone the floating card wastes the screen — go near full-bleed.
       dvh rather than vh so the panel isn't hidden behind the mobile URL bar
       or pushed off-screen when the keyboard opens. */
    @media (max-width: 480px) {
      .aiw-panel {
        right: 12px; left: 12px; width: auto; bottom: 84px;
        height: calc(100dvh - 104px);
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
      overscroll-behavior: contain;
    }
    .aiw-empty { color: #A2AAC6; font-size: 13px; line-height: 1.55; margin: 0; }

    /* Starter chips: the hardest part of a blank chat is knowing what it
       can answer. */
    .aiw-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
    .aiw-chip {
      background: #1D2140; color: #A2AAC6; border: 1px solid #262B4C;
      border-radius: 999px; padding: 6px 11px; font-size: 12px; cursor: pointer;
      font-family: inherit; transition: color 0.15s ease, border-color 0.15s ease;
    }
    .aiw-chip:hover { color: #F4F2EC; border-color: rgba(232,163,61,0.4); }
    .aiw-chip:focus-visible { outline: 2px solid #E8A33D; outline-offset: 2px; }

    .aiw-time {
      align-self: center; font-size: 10px; color: #6B7499; letter-spacing: 0.06em;
      text-transform: uppercase; margin: 2px 0;
    }

    .aiw-msg {
      max-width: 82%; padding: 9px 13px; font-size: 13px; line-height: 1.5;
      white-space: pre-wrap; word-wrap: break-word; overflow-wrap: anywhere;
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
    .aiw-msg a { color: #F7CE8A; text-decoration: underline; text-underline-offset: 2px; }
    .aiw-msg.user a { color: #0A0C1A; }

    .aiw-retry {
      display: block; margin-top: 7px; background: transparent; border: none;
      padding: 0; color: #F7CE8A; font-size: 12px; font-weight: 600; cursor: pointer;
      font-family: inherit; text-decoration: underline; text-underline-offset: 2px;
    }
    .aiw-retry:focus-visible { outline: 2px solid #E8A33D; outline-offset: 2px; }

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
      border-radius: 999px; padding: 10px 14px; font-size: 16px; outline: none;
      color: #F4F2EC; font-family: inherit;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    /* 16px above keeps iOS Safari from zooming the page on focus; step it
       back down where that behaviour doesn't apply. */
    @media (min-width: 481px) { .aiw-input { font-size: 13px; } }
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
      .aiw-bubble, .aiw-panel, .aiw-msg, .aiw-send, .aiw-nudge,
      .aiw-dot::before, .aiw-typing span {
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
  bubble.innerHTML = ICON_CHAT + ICON_CLOSE + '<span class="aiw-badge"></span>';

  const nudge = document.createElement("div");
  nudge.className = "aiw-root aiw-nudge";
  nudge.innerHTML =
    '<button class="aiw-nudge-close" type="button" aria-label="Dismiss">&times;</button>' +
    '<span class="aiw-nudge-text"></span>';
  nudge.querySelector(".aiw-nudge-text").textContent = greetingText;

  const panel = document.createElement("div");
  panel.className = "aiw-root aiw-panel";
  panel.id = "aiw-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Chat with us");
  panel.innerHTML = `
    <div class="aiw-header">
      <span class="aiw-dot"></span>
      <span>Chat with us</span>
      <span class="aiw-header-sub">online</span>
    </div>
    <div class="aiw-messages" role="log" aria-live="polite">
      <div>
        <p class="aiw-empty">Ask us anything: hours, pricing, availability.</p>
        <div class="aiw-chips"></div>
      </div>
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
  document.body.appendChild(nudge);
  document.body.appendChild(panel);

  const messagesEl = panel.querySelector(".aiw-messages");
  const inputEl = panel.querySelector(".aiw-input");
  const sendBtn = panel.querySelector(".aiw-send");
  const chipsEl = panel.querySelector(".aiw-chips");

  ["What are your hours?", "Where are you located?", "How much does it cost?"].forEach((text) => {
    const chip = document.createElement("button");
    chip.className = "aiw-chip";
    chip.type = "button";
    chip.textContent = text;
    chip.addEventListener("click", () => {
      inputEl.value = text;
      sendMessage();
    });
    chipsEl.appendChild(chip);
  });

  // ---------- Open / close ----------
  function setOpen(open) {
    panel.classList.toggle("aiw-open", open);
    bubble.setAttribute("aria-expanded", String(open));
    bubble.setAttribute("aria-label", open ? "Close chat" : "Open chat");
    if (open) {
      hideNudge();
      bubble.classList.remove("aiw-has-unread");
      inputEl.focus();
    }
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

  // ---------- Proactive nudge ----------
  function hideNudge() {
    nudge.classList.remove("aiw-show");
    try {
      sessionStorage.setItem(GREETED_KEY, "1");
    } catch {
      // Private mode can throw on sessionStorage. Not worth failing over —
      // worst case the nudge shows again on the next page.
    }
  }

  nudge.querySelector(".aiw-nudge-close").addEventListener("click", (e) => {
    e.stopPropagation();
    hideNudge();
    bubble.classList.remove("aiw-has-unread");
  });
  nudge.addEventListener("click", () => setOpen(true));

  let alreadyGreeted = false;
  try {
    alreadyGreeted = sessionStorage.getItem(GREETED_KEY) === "1";
  } catch {
    // Ignore — treated as "not greeted yet".
  }

  if (greetingText !== "off" && !alreadyGreeted && !conversationId) {
    setTimeout(() => {
      if (panel.classList.contains("aiw-open")) return;
      nudge.classList.add("aiw-show");
      bubble.classList.add("aiw-has-unread");
    }, greetingDelay);
  }

  // ---------- Messages ----------
  function syncSendState() {
    sendBtn.disabled = streaming || !inputEl.value.trim();
  }
  inputEl.addEventListener("input", syncSendState);
  syncSendState();

  function clearEmptyState() {
    const empty = messagesEl.querySelector(".aiw-empty");
    if (empty) empty.parentElement.remove();
  }

  // A single "3:42 PM" marker the first time a message is sent, rather than
  // a timestamp under every bubble — in a 360px panel that reads as clutter.
  function stampOnce() {
    if (messagesEl.querySelector(".aiw-time")) return;
    const time = document.createElement("div");
    time.className = "aiw-time";
    time.textContent = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    messagesEl.appendChild(time);
  }

  function addMessage(role, text) {
    clearEmptyState();
    stampOnce();
    const div = document.createElement("div");
    div.className = `aiw-msg ${role}`;
    div.textContent = text;
    div.title = new Date().toLocaleString();
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

  /*
   * Turn bare URLs and email addresses in a finished reply into real links.
   * Built with DOM nodes rather than innerHTML: the reply is model output
   * and must never be parsed as markup.
   */
  // Both branches must stop before trailing sentence punctuation, or
  // "email us@example.com." yields a mailto: with a dot on the end.
  const LINK_RE = /(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)])|([\w.+-]+@[\w-]+\.[\w.]*\w)/g;
  function linkify(el) {
    const text = el.textContent;
    if (!LINK_RE.test(text)) return;
    LINK_RE.lastIndex = 0;

    const frag = document.createDocumentFragment();
    let lastIndex = 0;
    let match;
    while ((match = LINK_RE.exec(text)) !== null) {
      if (match.index > lastIndex) {
        frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
      }
      const a = document.createElement("a");
      a.textContent = match[0];
      a.href = match[1] ? match[0] : `mailto:${match[0]}`;
      if (match[1]) {
        a.target = "_blank";
        a.rel = "noopener noreferrer nofollow";
      }
      frag.appendChild(a);
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) frag.appendChild(document.createTextNode(text.slice(lastIndex)));

    el.textContent = "";
    el.appendChild(frag);
  }

  function showRetry(el, message) {
    el.textContent = message;
    const retry = document.createElement("button");
    retry.className = "aiw-retry";
    retry.type = "button";
    retry.textContent = "Try again";
    retry.addEventListener("click", () => {
      if (streaming || !lastUserMessage) return;
      // Drop the failed exchange so the retry doesn't read as a second
      // question that went unanswered.
      el.remove();
      const previous = messagesEl.querySelector(".aiw-msg.user:last-of-type");
      if (previous) previous.remove();
      inputEl.value = lastUserMessage;
      sendMessage();
    });
    el.appendChild(retry);
  }

  async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text || streaming) return;
    inputEl.value = "";
    lastUserMessage = text;
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
      let errored = false;

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
            errored = true;
            showRetry(assistantEl, data.message);
            messagesEl.scrollTop = messagesEl.scrollHeight;
          }
        }
      }

      // A stream that closed without ever emitting a token would otherwise
      // leave the dots animating forever.
      if (assistantEl.querySelector(".aiw-typing")) {
        errored = true;
        showRetry(assistantEl, "Sorry, no response came back.");
      }

      if (!errored) linkify(assistantEl);
    } catch (err) {
      showRetry(assistantEl, "Sorry, something went wrong.");
      console.error("[AI widget]", err);
    } finally {
      streaming = false;
      syncSendState();
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  }

  sendBtn.addEventListener("click", sendMessage);
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
  });
})();
