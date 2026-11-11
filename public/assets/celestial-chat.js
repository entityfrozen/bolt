/* Shared chat is separate from browser state, so proxy tabs keep running. */
(() => {
  let interval = null;
  let snapshot = null;
  const $ = (selector, root = document) => root.querySelector(selector);
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
  const initials = name => String(name || "?").slice(0, 2).toUpperCase();
  const role = name => name === "admin" ? "admin" : name === "moderator" ? "mod" : "member";
  const timestamp = time => new Date(time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  async function api(url, options) {
    const response = await fetch(url, { credentials: "same-origin", ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Chat is unavailable.");
    return data;
  }

  function memberHtml(member) {
    return '<div class="cel-member' + (member.online ? ' online' : '') + '">' +
      '<span class="cel-member-avatar">' + escapeHtml(initials(member.username)) +
      '<i class="cel-presence"></i></span><span class="cel-member-label"><b>' +
      escapeHtml(member.username) + '</b><small>' +
      (member.disabled ? "Disabled" : member.online ? "Online" : "Offline") +
      '</small></span>' + (member.role === "admin" ? '<span class="cel-tag admin">ADMIN</span>' : '') + '</div>';
  }

  function messageHtml(message, self) {
    const admin = self?.role === "admin";
    return '<article class="cel-message" data-message="' + escapeHtml(message.id) + '">' +
      '<div class="cel-message-avatar">' + escapeHtml(initials(message.username)) + '</div>' +
      '<div class="cel-message-content"><div class="cel-message-meta"><strong>' +
      escapeHtml(message.username) + '</strong><span class="cel-tag ' + role(message.role) + '">' +
      escapeHtml(message.role).toUpperCase() + '</span><time>' + timestamp(message.at) + '</time>' +
      (admin ? '<button class="cel-message-delete" data-delete="' + escapeHtml(message.id) + '" type="button" title="Delete message">✕</button>' : '') +
      '</div><p>' + escapeHtml(message.body) + '</p></div></article>';
  }

  async function refresh(root, quiet = true) {
    try {
      const data = await api("/api/celestial/chat");
      if (!root.isConnected) return;
      const feed = $("#celChatMessages", root);
      const nearBottom = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 90;
      const existing = snapshot?.messages?.at(-1)?.id;
      const incoming = data.messages.at(-1)?.id;
      if (!snapshot || existing !== incoming || data.messages.length !== snapshot.messages.length) {
        feed.innerHTML = data.messages.length
          ? data.messages.map(message => messageHtml(message, data.self)).join("")
          : '<p class="cel-chat-empty">It’s quiet here. Be the first to say something.</p>';
        if (nearBottom || !snapshot) feed.scrollTop = feed.scrollHeight;
      }
      const online = data.members.filter(x => x.online).length;
      $("#celChatOnline", root).textContent = online + " online";
      $("#celChatMembers", root).innerHTML = data.members.map(memberHtml).join("");
      snapshot = data;
      $("#celChatStatus", root).textContent = "";
    } catch (error) {
      if (!quiet) $("#celChatStatus", root).textContent = error.message;
    }
  }

  window.renderCelestialChatPanel = function ({ dom }) {
    if (interval) clearInterval(interval);
    snapshot = null;
    dom.panelKicker.textContent = "COMMUNITY";
    dom.panelTitle.textContent = "Chat";
    dom.panelBody.innerHTML = '<div class="cel-chat"><div class="cel-chat-top">' +
      '<div class="cel-chat-intro"><span class="cel-kicker">LOUNGE</span><p>A little corner of the universe.</p></div>' +
      '<span id="celChatOnline" class="cel-online-count">Connecting…</span></div>' +
      '<div class="cel-chat-feed" id="celChatMessages" role="log" aria-live="polite"></div>' +
      '<form id="celChatForm" class="cel-chat-form"><textarea id="celChatInput" rows="2" maxlength="1000" placeholder="Message the lounge…" aria-label="Write a message"></textarea>' +
      '<div><small id="celChatStatus"></small><button type="submit">Send ↗</button></div></form>' +
      '<div class="cel-member-head"><strong>Members</strong><span>Online & offline</span></div>' +
      '<div class="cel-member-list" id="celChatMembers"></div></div>';
    const root = $(".cel-chat", dom.panelBody);
    const form = $("#celChatForm", root);
    const input = $("#celChatInput", root);
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const body = input.value.trim();
      if (!body) return;
      const button = $("button", form);
      button.disabled = true;
      try {
        await api("/api/celestial/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body })
        });
        input.value = "";
        await refresh(root, false);
        const feed = $("#celChatMessages", root);
        feed.scrollTop = feed.scrollHeight;
      } catch (error) {
        $("#celChatStatus", root).textContent = error.message;
      } finally {
        button.disabled = false;
        input.focus();
      }
    });
    input.addEventListener("keydown", event => {
      if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        form.requestSubmit();
      }
    });
    $("#celChatMessages", root).addEventListener("click", async event => {
      const deleteButton = event.target.closest("[data-delete]");
      if (!deleteButton) return;
      try {
        await api("/api/celestial/chat/" + encodeURIComponent(deleteButton.dataset.delete), { method: "DELETE" });
        snapshot = null;
        await refresh(root, false);
      } catch (error) {
        $("#celChatStatus", root).textContent = error.message;
      }
    });
    refresh(root, false);
    interval = setInterval(() => {
      if (!root.isConnected) return clearInterval(interval);
      refresh(root);
    }, 4500);
  };
})();