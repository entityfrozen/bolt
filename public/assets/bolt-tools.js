(() => {
  "use strict";
  if (!document.getElementById("boltShell")) return;

  const root = document.createElement("div");
  root.id = "boltTools";
  root.innerHTML = '<button type="button" class="bolt-bubble" id="boltBubble" aria-label="Open Lightning AI" aria-expanded="false" aria-controls="boltAiPanel" title="Lightning AI · drag to move"><svg viewBox="0 0 64 64" aria-hidden="true"><path d="M37 5 14 35h17l-3 24L52 26H36Z"/><path d="M30 20h12l-5 6H25Z" fill="#16130e" opacity=".65"/></svg></button>' +
    '<aside class="bolt-ai-panel" id="boltAiPanel" role="dialog" aria-label="Lightning AI" aria-modal="false" aria-hidden="true">' +
      '<header class="bolt-aux-head"><span class="bolt-aux-brand"><svg viewBox="0 0 64 64" aria-hidden="true"><path d="M37 5 14 35h17l-3 24L52 26H36Z"/><path d="M30 20h12l-5 6H25Z" fill="#16130e" opacity=".65"/></svg></span><div><div class="bolt-aux-title">Lightning AI</div><div class="bolt-aux-subtitle">Your browsing companion</div></div><span class="bolt-aux-spacer"></span><button class="bolt-aux-btn" id="boltAiClear" title="New chat">New chat</button><button class="bolt-aux-btn" id="boltAiClose" type="button" aria-label="Close AI" title="Close AI">×</button></header>' +
      '<div class="bolt-ai-messages" id="boltAiMessages" aria-live="polite"></div>' +
      '<form class="bolt-ai-compose" id="boltAiForm"><div class="bolt-ai-shortcuts"><button type="button" id="boltUseSelection">Use selected text</button><button type="button" id="boltUsePage">Add page link</button><button type="button" id="boltAiWeb" aria-pressed="false" title="Search the web for this answer">Web: auto</button></div>' +
      '<textarea class="bolt-ai-textarea" id="boltAiInput" maxlength="9000" placeholder="Ask Lightning anything..."></textarea><div class="bolt-ai-error" id="boltAiError" role="status"></div><div class="bolt-ai-actions"><span class="bolt-ai-hint">↵ send &nbsp; · &nbsp; shift ↵ newline</span><button class="bolt-ai-send" id="boltAiSend" type="submit">Send ↗</button></div></form></aside>' +
    '<section class="bolt-devdock" id="boltDevDock" aria-label="Lightning DevTools">' +
      '<nav class="bolt-dev-tabs"><button type="button" data-bolt-devtab="elements" class="on">Elements</button><button type="button" data-bolt-devtab="console">Console</button><button type="button" data-bolt-devtab="network">Network</button><button type="button" id="boltDevPick">Pick element</button><span class="bolt-aux-spacer"></span><button type="button" id="boltDevClose" title="Close DevTools">✕</button></nav>' +
      '<div class="bolt-dev-body" id="boltDevBody"></div><form class="bolt-dev-expression" id="boltDevExpr"><span>›</span><input id="boltDevInput" spellcheck="false" autocomplete="off" placeholder="JavaScript expression in active page"><button type="submit">Run</button></form>' +
    '</section>';
  document.body.append(root);

  const el = id => document.getElementById(id);
  const bubble = el("boltBubble");
  const input = el("boltAiInput");
  const messageView = el("boltAiMessages");
  const errorView = el("boltAiError");
  const sendButton = el("boltAiSend");
  const devBody = el("boltDevBody");
  let messages = [];
  let busy = false;
  let devtab = "elements";
  let consoleLines = [];
  let lastSelected = null;
  let selectedText = "";
  let pickerCleanup = null;

  try {
    const loaded = JSON.parse(localStorage.getItem("bolt.ai.messages") || "[]");
    if (Array.isArray(loaded)) messages = loaded.filter(x => x && ["user","assistant"].includes(x.role) && typeof x.content === "string").slice(-24);
  } catch {}

  function saveChat() {
    try { localStorage.setItem("bolt.ai.messages", JSON.stringify(messages.slice(-24))); } catch {}
  }
  function openAI(open = !document.body.classList.contains("bolt-ai-open")) {
    document.body.classList.toggle("bolt-ai-open", open);
    bubble.setAttribute("aria-expanded", String(open));
    el("boltAiPanel").setAttribute("aria-hidden", String(!open));
    if (open) { renderChat(); void loadMarkdown(); input.focus({preventScroll: true}); }
  }
  function openDev(open = !document.body.classList.contains("bolt-dev-open")) {
    document.body.classList.toggle("bolt-dev-open", open);
    if (open) renderDev();
    else stopPicker();
  }
  let markdownPromise = null;
  function loadMarkdown() {
    if (window.marked?.parse && window.DOMPurify?.sanitize) return Promise.resolve();
    if (markdownPromise) return markdownPromise;
    const load = src => new Promise((resolve,reject) => {
      const tag = document.createElement("script");
      tag.src = src;
      tag.async = true;
      tag.onload = resolve;
      tag.onerror = reject;
      document.head.append(tag);
    });
    markdownPromise = load("/vendor/marked.js").then(() => load("/vendor/purify.js"))
      .then(() => { if (window.marked?.setOptions) window.marked.setOptions({gfm:true,breaks:true}); renderChat(); })
      .catch(() => { markdownPromise=null; /* plain text remains usable */ });
    return markdownPromise;
  }

  function setRichText(target, raw) {
    if (window.marked?.parse && window.DOMPurify?.sanitize) {
      try {
        target.innerHTML = window.DOMPurify.sanitize(window.marked.parse(raw), {USE_PROFILES:{html:true}});
        target.querySelectorAll("a").forEach(a => {
          const url = a.getAttribute("href") || "";
          try {
            const parsed = new URL(url, location.origin);
            if (!["http:","https:","mailto:"].includes(parsed.protocol)) a.removeAttribute("href");
            else {a.target="_blank";a.rel="noopener noreferrer";}
          } catch {a.removeAttribute("href");}
        });
        return;
      } catch {}
    }
    target.textContent=raw;
  }

  let webMode = "auto";
  const webButton = el("boltAiWeb");
  webButton.addEventListener("click", () => {
    webMode = {auto:"on",on:"off",off:"auto"}[webMode];
    webButton.textContent = "Web: " + webMode;
    webButton.setAttribute("aria-pressed",String(webMode==="on"));
  });
  function renderChat() {
    messageView.replaceChildren();
    if (!messages.length) {
      const empty = document.createElement("div");
      empty.className = "bolt-ai-empty";
      empty.innerHTML =
        '<div class="bolt-ai-intro"><span class="bolt-ai-kicker">A hand when you need one</span>' +
        '<strong>What can I help with?</strong><p>Get unstuck, find the right words, or untangle something complicated.</p></div>' +
        '<div class="bolt-ai-suggest-label">A place to start</div>' +
        '<div class="bolt-ai-suggestions">' +
        '<button class="bolt-ai-suggestion" type="button" data-ai-suggestion="Can you help me improve a paragraph I wrote?">Polish my writing</button>' +
        '<button class="bolt-ai-suggestion" type="button" data-ai-suggestion="Explain something complicated to me in simple terms.">Explain something simply</button>' +
        '</div>';
      empty.querySelectorAll("[data-ai-suggestion]").forEach(button =>
        button.addEventListener("click", () => {
          input.value = button.dataset.aiSuggestion;
          input.focus({preventScroll: true});
        })
      );
      messageView.append(empty);
    }
    for (const message of messages) {
      const node = document.createElement("div");
      node.className = "bolt-ai-msg " + message.role;
      if (message.role === "assistant") {
        const body = document.createElement("div");
        body.className = "bolt-ai-rich";
        body.dir = "auto";
        setRichText(body,message.content);
        node.append(body);
        if (Array.isArray(message.sources) && message.sources.length) {
          const refs = document.createElement("div");
          refs.className = "bolt-ai-sources";
          const title = document.createElement("strong");
          title.textContent = "Sources";
          refs.append(title);
          for (const [i, source] of message.sources.entries()) {
            try {
              const url = new URL(source.url);
              if (!["https:", "http:"].includes(url.protocol)) continue;
              const a = document.createElement("a");
              a.href = url.href;a.target = "_blank";a.rel = "noopener noreferrer";
              a.textContent = "[" + (i + 1) + "] " + source.title;
              refs.append(a);
            } catch {}
          }
          node.append(refs);
        } else if(message.searchError) {
          const note = document.createElement("small");
          note.className = "bolt-ai-search-fail";
          note.textContent = message.searchError;
          node.append(note);
        }
        const copy = document.createElement("button");
        copy.className = "bolt-ai-copy";
        copy.type = "button";
        copy.textContent = "⧉ Copy";
        copy.title = "Copy reply";
        copy.addEventListener("click", async () => {
          try {await navigator.clipboard.writeText(message.content);copy.textContent="✓ Copied";}
          catch {
            const box=document.createElement("textarea");
            box.value=message.content;
            document.body.append(box);box.select();
            try { document.execCommand("copy");copy.textContent="✓ Copied"; }
            catch {copy.textContent="Copy unavailable";}
            box.remove();
          }
        });
        node.append(copy);
      } else {
        node.textContent = message.content;
        node.dir = "auto";
      }
      messageView.append(node);
    }
    messageView.scrollTop = messageView.scrollHeight;
  }
  function setError(value) { errorView.textContent = value || ""; }

  async function sendMessage(evt) {
    evt.preventDefault();
    const value = input.value.trim();
    if (!value || busy) return;
    messages.push({role:"user",content:value});
    messages = messages.slice(-24);
    saveChat();
    input.value = "";
    renderChat();
    busy = true;
    sendButton.disabled = true;
    sendButton.textContent = "Thinking…";
    setError("");
    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        credentials: "same-origin",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({messages: messages.slice(-16).map(({role,content})=>({role,content})), webSearch: webMode==="auto"?undefined:webMode==="on"})
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "AI request failed");
      if (typeof data.reply !== "string" || !data.reply.trim()) throw new Error("AI returned an empty reply");
      messages.push({role:"assistant",content:data.reply.trim(),sources:data.sources||[],searchError:data.searchError||null});
      saveChat();
      renderChat();
    } catch (error) {
      setError(error.message || "Could not contact the AI server.");
    } finally {
      busy = false;
      sendButton.disabled = false;
      sendButton.textContent = "Send ↗";
    }
  }
  el("boltAiForm").addEventListener("submit", sendMessage);
  input.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); el("boltAiForm").requestSubmit(); }});
  el("boltAiClose").addEventListener("click", () => { openAI(false); bubble.focus({preventScroll: true}); });
  el("boltAiClear").addEventListener("click", () => { messages=[];saveChat();setError("");renderChat();input.focus(); });

  function activePage() {
    const iframe = document.querySelector(".proxy-frame.active");
    if (!iframe) return {doc: document,win:window,isApp:true};
    try {
      const doc = iframe.contentDocument;
      if (doc && doc.documentElement) return {doc,win:iframe.contentWindow,isApp:false};
    } catch {}
    return null;
  }
  function grabSelection() {
    let text = "";
    const page = activePage();
    try { if (page && !page.isApp) text = page.win.getSelection().toString().trim(); } catch {}
    if (!text) try { text = window.getSelection().toString().trim(); } catch {}
    return text.slice(0,3500);
  }
  document.addEventListener("selectionchange", () => { const text = grabSelection(); if (text) selectedText = text; });
  el("boltUseSelection").addEventListener("click", () => {
    const text = grabSelection() || selectedText;
    if (!text) { setError("Select some text first."); return; }
    input.value = (input.value ? input.value + "\n\n" : "") + "Help me with this text:\n\n" + text;
    setError("");openAI(true);
  });
  el("boltUsePage").addEventListener("click", () => {
    const url = el("addressInput")?.value;
    if (!url || !/^https?:\/\//i.test(url)) { setError("Open a webpage first."); return; }
    input.value = (input.value ? input.value + "\n\n" : "") + "Page: " + url;
    setError("");openAI(true);
  });

  let didMove = false;
  let drag = null;
  try {
    const coords = JSON.parse(localStorage.getItem("bolt.ai.position") || "null");
    if (coords && Number.isFinite(coords.x) && Number.isFinite(coords.y)) {
      bubble.style.left = Math.min(Math.max(coords.x,4),innerWidth-52) + "px";
      bubble.style.top = Math.min(Math.max(coords.y,4),innerHeight-52) + "px";
      bubble.style.right = "auto";
    }
  } catch {}
  bubble.addEventListener("pointerdown", event => {
    if (event.button !== 0) return;
    const rect = bubble.getBoundingClientRect();
    drag = {x:event.clientX,y:event.clientY,left:rect.left,top:rect.top};
    didMove = false;
    bubble.setPointerCapture(event.pointerId);
  });
  bubble.addEventListener("pointermove", event => {
    if (!drag) return;
    const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
    if (Math.abs(dx)+Math.abs(dy)>6) didMove=true;
    if (!didMove) return;
    bubble.style.left = Math.min(Math.max(4,drag.left+dx),innerWidth-51) + "px";
    bubble.style.top = Math.min(Math.max(4,drag.top+dy),innerHeight-51) + "px";
    bubble.style.right = "auto";
  });
  bubble.addEventListener("pointerup", () => {
    if (!drag) return;
    drag=null;
    if (!didMove) {openAI(true);return;}
    try {localStorage.setItem("bolt.ai.position",JSON.stringify({x:parseFloat(bubble.style.left),y:parseFloat(bubble.style.top)}));} catch {}
  });
  bubble.addEventListener("pointercancel", () => {drag=null;});
  bubble.addEventListener("click", e => {e.preventDefault(); if (e.detail === 0) openAI(true);});

  function logConsole(type, text) {
    consoleLines.push({type,text:String(text).slice(0,6000),at:new Date().toLocaleTimeString()});
    consoleLines=consoleLines.slice(-120);
    if (devtab === "console") renderDev();
  }
  function renderDev() {
    devBody.replaceChildren();
    if (devtab === "console") {
      if (!consoleLines.length) {
        devBody.textContent = "Run an expression below to inspect the current page. This is an in-page console, not native Chromium DevTools.";
      } else for (const line of consoleLines) {
        const row=document.createElement("div");
        row.textContent="["+line.at+"] "+line.type+"  "+line.text;
        row.style.color=line.type==="error"?"#ef8f9a":"#bbc9d2";
        devBody.append(row);
      }
      return;
    }
    const page=activePage();
    if (!page) {
      devBody.textContent="This tab does not expose its document to Lightning. Use Chromium's native DevTools for cross-origin frames.";
      return;
    }
    if (devtab === "network") {
      let resources=[];
      try {resources=page.win.performance.getEntriesByType("resource").slice(-140).reverse();} catch {}
      if (!resources.length) {devBody.textContent="No resource timings are available in this page.";return;}
      for (const item of resources) {
        const line=document.createElement("div");
        line.className="bolt-dev-line";
        line.textContent=Math.round(item.duration)+" ms  "+item.name;
        devBody.append(line);
      }
      return;
    }
    const nodes=page.doc.querySelectorAll("html,head,body,main,section,article,div,h1,h2,h3,p,a,button,input,form,img,iframe");
    if (!nodes.length) {devBody.textContent="No elements available.";return;}
    const count=Math.min(150,nodes.length);
    for (let i=0;i<count;i++) {
      const node=nodes[i];
      if (node.closest?.("#boltTools")) continue;
      const line=document.createElement("button");
      line.type="button";
      line.className="bolt-dev-line";
      line.textContent="<"+node.tagName.toLowerCase()+(node.id?" #"+node.id:"")+(node.classList?.length?" ."+[...node.classList].slice(0,2).join("."):"")+">  "+(node.textContent||"").trim().slice(0,75);
      line.addEventListener("click", () => {
        lastSelected=node;
        const html=node.outerHTML.slice(0,9000);
        const details=document.createElement("pre");
        details.style.whiteSpace="pre-wrap";
        details.textContent=html;
        devBody.replaceChildren(details);
      });
      devBody.append(line);
    }
  }
  el("boltDevClose").addEventListener("click", () => openDev(false));
  document.querySelectorAll("[data-bolt-devtab]").forEach(btn=>btn.addEventListener("click", () => {
    devtab=btn.dataset.boltDevtab;
    document.querySelectorAll("[data-bolt-devtab]").forEach(x=>x.classList.toggle("on",x===btn));
    renderDev();
  }));
  el("boltDevExpr").addEventListener("submit", e => {
    e.preventDefault();
    const code=el("boltDevInput").value.trim();
    if (!code) return;
    const page=activePage();
    if (!page || page.isApp) {logConsole("error","Run JavaScript after opening an inspectable webpage.");return;}
    try {
      const value=page.win.eval(code);
      logConsole("result",typeof value==="object"?JSON.stringify(value,null,2):String(value));
    } catch (error) {logConsole("error",error.stack||error.message);}
    el("boltDevInput").value="";
    devtab="console";
    document.querySelectorAll("[data-bolt-devtab]").forEach(x=>x.classList.toggle("on",x.dataset.boltDevtab==="console"));
    renderDev();
  });
  function stopPicker() {if (pickerCleanup) {pickerCleanup();pickerCleanup=null;}}
  el("boltDevPick").addEventListener("click", () => {
    stopPicker();
    const page=activePage();
    if (!page || page.isApp) {logConsole("error","Open an inspectable webpage before picking.");return;}
    let previous=null,oldOutline="";
    const hover=e=>{
      if (previous) previous.style.outline=oldOutline;
      previous=e.target;oldOutline=previous.style.outline;
      previous.style.outline="2px solid #f2c861";
    };
    const pick=e=>{
      e.preventDefault();e.stopPropagation();
      lastSelected=e.target;
      stopPicker();
      devtab="elements";
      document.querySelectorAll("[data-bolt-devtab]").forEach(x=>x.classList.toggle("on",x.dataset.boltDevtab==="elements"));
      const pre=document.createElement("pre");
      pre.style.whiteSpace="pre-wrap";
      pre.textContent=lastSelected.outerHTML.slice(0,9000);
      devBody.replaceChildren(pre);
    };
    page.doc.addEventListener("pointerover",hover,true);
    page.doc.addEventListener("click",pick,true);
    pickerCleanup=()=>{
      page.doc.removeEventListener("pointerover",hover,true);
      page.doc.removeEventListener("click",pick,true);
      if(previous)previous.style.outline=oldOutline;
    };
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && document.body.classList.contains("bolt-ai-open")) {
      e.preventDefault();openAI(false);bubble.focus({preventScroll: true});return;
    }
    if (e.altKey&&e.shiftKey&&e.key.toLowerCase()==="a") {e.preventDefault();openAI();return;}
    if (e.altKey&&e.shiftKey&&e.key.toLowerCase()==="d") {e.preventDefault();openDev();return;}
    if(e.key==="Escape"&&pickerCleanup)stopPicker();
  });
  renderChat();
})();