(() => {
  "use strict";
  if (!document.getElementById("boltShell")) return;

  const root = document.createElement("div");
  root.id = "boltTools";
  root.innerHTML = '<button type="button" class="bolt-bubble" id="boltBubble" aria-label="Open Lightning AI" aria-expanded="false" aria-controls="boltAiPanel" title="Lightning AI · drag to move"><img class="lightning-mark" src="/assets/lightning-mark.svg?v=1" alt="" aria-hidden="true"></button>' +
    '<aside class="bolt-ai-panel" id="boltAiPanel" role="dialog" aria-label="Lightning AI" aria-modal="false" aria-hidden="true">' +
      '<header class="bolt-aux-head" id="boltAiDrag" tabindex="0" title="Drag to move · Alt+arrow keys to move"><span class="bolt-aux-brand"><img class="lightning-mark" src="/assets/lightning-mark.svg?v=1" alt="" aria-hidden="true"></span><div><div class="bolt-aux-title">AI chat</div><div class="bolt-aux-subtitle">Ask a question</div></div><span class="bolt-aux-spacer"></span><button class="bolt-aux-btn" id="boltAiClear" title="New chat">New chat</button><button type="button" class="bolt-ai-head-tool" id="boltAiSize" aria-label="Maximize AI" title="Maximize or restore">□</button><button class="bolt-aux-btn" id="boltAiClose" type="button" aria-label="Close AI" title="Close AI">×</button></header>' +
      '<div class="bolt-ai-workspace-top"><button type="button" id="boltAiChatsToggle" aria-expanded="false">☷ Conversations</button><span id="boltAiChatTitle" title="Current chat">New conversation</span><button type="button" id="boltAiPersonalityToggle" title="Customize Lightning AI">⚙ Customize</button></div>' +
      '<section class="bolt-ai-workspace-drawer" id="boltAiChatsDrawer" hidden><div class="bolt-ai-drawer-head"><strong>YOUR CHATS</strong><button type="button" id="boltAiCreateChat">＋ New chat</button></div><div class="bolt-ai-thread-list" id="boltAiThreadList"></div></section>' +
      '<section class="bolt-ai-personality" id="boltAiPersonality" hidden><div class="bolt-ai-drawer-head"><strong>MAKE IT YOURS</strong><button type="button" id="boltAiPersonalityClose" aria-label="Close AI customization">×</button></div><form id="boltAiPreferencesForm"><label>Assistant name<input id="boltAiPersonaName" maxlength="50" placeholder="Lightning AI"></label><label>Personality<select id="boltAiTone"><option value="balanced">Balanced</option><option value="casual">Friendly & casual</option><option value="professional">Professional</option><option value="direct">Straight to the point</option><option value="creative">Creative</option></select></label><label>Response detail<select id="boltAiLength"><option value="short">Short</option><option value="balanced">Balanced</option><option value="detailed">Detailed</option></select></label><label>Custom instructions<textarea id="boltAiInstructions" maxlength="1200" rows="4" placeholder="e.g. Explain coding in a practical way, use examples, and skip filler."></textarea></label><p>These settings apply to future AI responses and sync to your Lightning account.</p><button type="submit" id="boltAiPrefsSave">Save preferences</button></form></section>' +
      '<div class="bolt-ai-messages" id="boltAiMessages" aria-live="polite"></div>' +
      '<section class="bolt-ai-activity" id="boltAiActivity" aria-label="AI response progress" hidden><details id="boltAiThinkingDetails" open><summary class="bolt-ai-thinking-heading"><span class="bolt-ai-thinking-pulse" aria-hidden="true"></span><strong>Thinking</strong><span class="bolt-ai-thinking-chevron" aria-hidden="true">⌄</span></summary><div class="bolt-ai-thinking-body"><ol class="bolt-ai-thought-log" id="boltAiThoughtLog" aria-live="polite"></ol><div class="bolt-ai-activity-sites" id="boltAiActivitySites" hidden></div></div></details></section>' +
      '<span class="bolt-ai-grip" aria-hidden="true"></span>' +
      '<form class="bolt-ai-compose" id="boltAiForm"><div class="bolt-ai-shortcuts"><button type="button" id="boltUseSelection">Use selected text</button><button type="button" id="boltUsePage">Add page link</button><button type="button" id="boltAiWeb" aria-pressed="false" title="Search the web for this answer">Web: auto</button></div>' +
      '<textarea class="bolt-ai-textarea" id="boltAiInput" maxlength="9000" placeholder="Ask a question..."></textarea><div class="bolt-ai-error" id="boltAiError" role="status"></div><div class="bolt-ai-actions"><span class="bolt-ai-hint">↵ send &nbsp; · &nbsp; shift ↵ newline</span><button class="bolt-ai-send" id="boltAiSend" type="submit">Send ↗</button></div></form></aside>' +
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

  // AI conversations live on the account, not in one shared browser transcript.
  let chats=[],activeChatId=null,workspaceReady=false,preferences={name:"Lightning AI",tone:"balanced",length:"balanced",instructions:""};
  let writeQueue=Promise.resolve(),switchingChat=false;
  const apiAi=async(url,options={})=>{
    const response=await fetch(url,{credentials:"same-origin",cache:"no-store",...options,
      headers:{"Content-Type":"application/json",...(options.headers||{})}});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||"AI workspace request failed");
    return data;
  };
  const safeText=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function renderChatList(){
    const list=el("boltAiThreadList");
    if(!list)return;
    list.innerHTML=chats.length?chats.slice().sort((a,b)=>b.updatedAt-a.updatedAt).map(chat=>
      '<div class="bolt-ai-thread'+(chat.id===activeChatId?" current":"")+'"><button type="button" data-ai-chat="'+safeText(chat.id)+'" title="'+safeText(chat.title)+'"><strong>'+safeText(chat.title)+'</strong><small>'+Number(chat.messageCount||0)+' messages</small></button>'+
      '<button type="button" class="bolt-ai-thread-action" data-ai-rename="'+safeText(chat.id)+'" aria-label="Rename '+safeText(chat.title)+'" title="Rename">✎</button>'+
      '<button type="button" class="bolt-ai-thread-action" data-ai-delete="'+safeText(chat.id)+'" aria-label="Delete '+safeText(chat.title)+'" title="Delete">×</button></div>'
    ).join(""):'<p class="bolt-ai-thread-empty">No conversations yet.</p>';
    el("boltAiChatTitle").textContent=chats.find(chat=>chat.id===activeChatId)?.title||"New conversation";
  }
  function renderPreferences(){
    el("boltAiPersonaName").value=preferences.name||"Lightning AI";
    el("boltAiTone").value=preferences.tone||"balanced";
    el("boltAiLength").value=preferences.length||"balanced";
    el("boltAiInstructions").value=preferences.instructions||"";
    document.querySelector(".bolt-aux-title").textContent=preferences.name||"AI chat";
  }
  async function loadWorkspace(){
    try{
      const state=await apiAi("/api/account/ai/workspace");
      chats=state.chats||[];preferences=state.preferences||preferences;
      renderPreferences();
      if(!chats.length){await createChat();return}
      workspaceReady=true;
      await switchChat(state.activeId&&chats.some(c=>c.id===state.activeId)?state.activeId:chats[0].id);
    }catch(error){setError(error.message);workspaceReady=true;sendButton.disabled=false}
  }
  async function createChat(){
    if(busy||switchingChat)return;
    try{
      await writeQueue.catch(()=>{});
      const data=await apiAi("/api/account/ai/chats",{method:"POST",body:JSON.stringify({title:"New conversation"})});
      chats.unshift({...data.chat,messageCount:0});
      activeChatId=data.chat.id;messages=[];workspaceReady=true;
      setError("");setActivity("");renderChatList();renderChat();input.focus();
    }catch(error){setError(error.message)}
  }
  async function switchChat(id){
    if(!id||busy||switchingChat)return;
    switchingChat=true;
    try{
      await writeQueue.catch(()=>{});
      const {chat}=await apiAi("/api/account/ai/chats/"+encodeURIComponent(id));
      activeChatId=chat.id;messages=Array.isArray(chat.messages)?chat.messages.slice(-48):[];
      el("boltAiChatsDrawer").hidden=true;el("boltAiChatsToggle").setAttribute("aria-expanded","false");
      setError("");setActivity("");renderChatList();renderChat();
    }catch(error){setError(error.message)}
    finally{switchingChat=false}
  }
  function saveChat(){
    const id=activeChatId;
    if(!id)return Promise.resolve();
    const snapshot=messages.slice(-48).map(({role,content,sources,searched})=>({role,content,
      ...(sources?{sources}:{}),...(searched?{searched:true}:{})}));
    const next=writeQueue.catch(()=>{}).then(()=>apiAi("/api/account/ai/chats/"+encodeURIComponent(id)+"/messages",{
      method:"PUT",body:JSON.stringify({messages:snapshot})
    })).then(({chat})=>{
      const existing=chats.find(c=>c.id===chat.id);
      if(existing)Object.assign(existing,chat);
      if(activeChatId===chat.id)renderChatList();
    });
    writeQueue=next;
    next.catch(error=>setError("Chat sync: "+error.message));
    return next;
  }
  el("boltAiChatsToggle").addEventListener("click",()=>{
    const drawer=el("boltAiChatsDrawer");drawer.hidden=!drawer.hidden;
    el("boltAiChatsToggle").setAttribute("aria-expanded",String(!drawer.hidden));
    el("boltAiPersonality").hidden=true;
    renderChatList();
  });
  el("boltAiCreateChat").addEventListener("click",createChat);
  el("boltAiThreadList").addEventListener("click",async event=>{
    const button=event.target.closest("button");if(!button)return;
    const open=button.dataset.aiChat,rename=button.dataset.aiRename,remove=button.dataset.aiDelete;
    if(open){await switchChat(open);return}
    if(busy||switchingChat)return;
    const item=chats.find(c=>c.id===(rename||remove));if(!item)return;
    if(rename){
      const title=prompt("Rename conversation",item.title);
      if(title===null||!title.trim())return;
      try{
        const {chat}=await apiAi("/api/account/ai/chats/"+encodeURIComponent(item.id),{
          method:"PATCH",body:JSON.stringify({title:title.trim().slice(0,80)})});
        Object.assign(item,chat);renderChatList();
      }catch(error){setError(error.message)}
    }else if(remove){
      if(!confirm('Delete "'+item.title+'"? This cannot be undone.'))return;
      try{
        await writeQueue.catch(()=>{});
        await apiAi("/api/account/ai/chats/"+encodeURIComponent(item.id),{method:"DELETE"});
        chats=chats.filter(c=>c.id!==item.id);
        if(activeChatId===item.id){
          activeChatId=null;messages=[];
          if(chats.length)await switchChat(chats[0].id);
          else await createChat();
        }
        renderChatList();renderChat();
      }catch(error){setError(error.message)}
    }
  });
  el("boltAiPersonalityToggle").addEventListener("click",()=>{
    const panel=el("boltAiPersonality");panel.hidden=!panel.hidden;
    el("boltAiChatsDrawer").hidden=true;el("boltAiChatsToggle").setAttribute("aria-expanded","false");
  });
  el("boltAiPersonalityClose").addEventListener("click",()=>{el("boltAiPersonality").hidden=true});
  el("boltAiPreferencesForm").addEventListener("submit",async event=>{
    event.preventDefault();
    const body={name:el("boltAiPersonaName").value.trim(),tone:el("boltAiTone").value,
      length:el("boltAiLength").value,instructions:el("boltAiInstructions").value};
    const button=el("boltAiPrefsSave");button.disabled=true;
    try{
      const data=await apiAi("/api/account/ai/preferences",{method:"PATCH",body:JSON.stringify(body)});
      preferences=data.preferences;renderPreferences();el("boltAiPersonality").hidden=true;
      setError("");setActivity("AI preferences saved for future replies");
    }catch(error){setError(error.message)}
    finally{button.disabled=false}
  });
  sendButton.disabled=true;
  void loadWorkspace();
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
        '<div class="bolt-ai-intro"><span class="bolt-ai-kicker">AI CHAT</span>' +
        '<strong>What do you need?</strong><p>Ask a question, search the web, or paste something to work on.</p></div>' +
        '<div class="bolt-ai-suggest-label">TRY THIS</div>' +
        '<div class="bolt-ai-suggestions">' +
        '<button class="bolt-ai-suggestion" type="button" data-ai-suggestion="Can you help me improve a paragraph I wrote?">Edit some text</button>' +
        '<button class="bolt-ai-suggestion" type="button" data-ai-suggestion="Explain something complicated to me in simple terms.">Explain a topic</button>' +
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
        if (message.searched) {
          const status = document.createElement("div");
          status.className = "bolt-ai-web-status";
          status.textContent = message.sources?.length
            ? "Searched " + (message.provider || "the web") + " · " + message.sources.length + " sources"
            : "Search unavailable · No verified sources";
          node.append(status);
        }
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
  // These are public, verifiable work summaries, not the model's private reasoning.
  // Keep a short timeline like a Thinking panel rather than showing raw answer tokens.
  let lastThoughtStage = "";
  let thoughtTopic = "";
  function describeActivity(message) {
    const value = String(message || "");
    if (/checking the request|checking whether live sources/i.test(value)) {
      return ["Understanding the request", thoughtTopic
        ? 'Focusing on: “' + thoughtTopic + '”'
        : "Checking what information the answer needs."];
    }
    if (/searching the web|requesting live web|looking for live sources/i.test(value)) {
      return ["Searching for information", "Looking for current sources that might help answer the question."];
    }
    if (/reading \d+ search results|reviewing \d+ search snippets/i.test(value)) {
      return ["Reviewing the results", "Looking over the returned page titles and excerpts for relevant details."];
    }
    if (/no verified live|no live sources/i.test(value)) {
      return ["Checking available evidence", "The search did not return verified links to support a current answer."];
    }
    if (/connecting to the ai model|preparing the answer|preparing an answer/i.test(value)) {
      return ["Preparing the response", "Sending the question and any available source excerpts to the AI model."];
    }
    if (/primary model was slow|trying another available ai model|trying a backup|using the faster ai model/i.test(value)) {
      return ["Switching AI models", "The first model was slow or unavailable, so Lightning is trying another."];
    }
    if (/working through the question|generating the answer/i.test(value)) {
      return ["Working through the details", "The model is processing the request and preparing its response."];
    }
    if (/writing the answer/i.test(value)) {
      return ["Writing the reply", "The model has started sending the finished answer."];
    }
    return ["Working on the reply", value.slice(0,180) || "Preparing a response."];
  }
  function setActivity(message) {
    const activity = el("boltAiActivity");
    if (!message) {
      activity.hidden = true;
      el("boltAiThoughtLog").replaceChildren();
      const sites = el("boltAiActivitySites");
      sites.replaceChildren();
      sites.hidden = true;
      lastThoughtStage = "";
      thoughtTopic = "";
      return;
    }

    if (activity.hidden) {
      activity.hidden = false;
      el("boltAiThinkingDetails").open = true;
      el("boltAiThoughtLog").replaceChildren();
      lastThoughtStage = "";
    }
    const [heading, detail] = describeActivity(message);
    if (heading === lastThoughtStage) return;
    lastThoughtStage = heading;

    const entry = document.createElement("li");
    entry.className = "bolt-ai-thought-entry";
    const title = document.createElement("strong");
    title.textContent = heading;
    const description = document.createElement("em");
    description.textContent = detail;
    entry.append(title, description);

    const log = el("boltAiThoughtLog");
    log.append(entry);
    while (log.children.length > 6) log.firstElementChild.remove();
    entry.scrollIntoView?.({block:"nearest",behavior:"instant"});
  }
  function showSearchedSites(data) {
    const list = el("boltAiActivitySites");
    list.replaceChildren();
    const sources = Array.isArray(data?.sources) ? data.sources : [];
    if (!sources.length) {
      list.hidden = true;
      return;
    }
    const label = document.createElement("small");
    label.textContent = sources.length + " search result" + (sources.length === 1 ? "" : "s") +
      (data.provider ? " via " + String(data.provider).slice(0,40) : "") + ":";
    list.append(label);
    for (const source of sources.slice(0,6)) {
      try {
        const url = new URL(source.url);
        if (!["https:","http:"].includes(url.protocol)) continue;
        const link = document.createElement("a");
        link.href = url.href;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = (source.title || url.hostname).slice(0,120);
        link.title = url.hostname.replace(/^www\./,"");
        list.append(link);
      } catch {}
    }
    list.hidden = !list.querySelector("a");
  }
  function showGeneratedText(chunk) {
    // Completion chunks mark genuine answer progress. The full answer is
    // rendered only after completion; this panel stays a short activity summary.
    if (chunk && lastThoughtStage !== "Writing the reply") {
      setActivity("Writing the answer…");
    }
  }
  async function readAiEvents(response){
    if(!response.ok){
      const error=await response.json().catch(()=>({}));
      throw new Error(error.error||"AI request failed ("+response.status+").");
    }
    if(!response.headers.get("Content-Type")?.includes("text/event-stream"))return response.json();
    if(!response.body)throw new Error("The browser did not receive the AI response stream.");
    const reader=response.body.getReader(),decoder=new TextDecoder();
    let buffer="",finalAnswer=null;
    function event(raw){
      const lines=raw.split(/\r?\n/);
      const type=lines.find(line=>line.startsWith("event:"))?.slice(6).trim()||"message";
      const payload=lines.filter(line=>line.startsWith("data:")).map(line=>line.slice(5).trimStart()).join("\n");
      if(!payload)return;
      let data;
      try{data=JSON.parse(payload)}catch{return}
      if(type==="status")setActivity(String(data.message||"Working…"));
      if(type==="sources")showSearchedSites(data);
      if(type==="delta")showGeneratedText(data.text||"");
      if(type==="answer")finalAnswer=data;
      if(type==="error")throw new Error(data.message||"The AI request failed.");
    }
    try{
      for(;;){
        const {value,done}=await reader.read();
        if(done)break;
        buffer+=decoder.decode(value,{stream:true});
        if(buffer.length>100000)throw new Error("The AI response stream grew too large.");
        let n;
        while((n=buffer.search(/\r?\n\r?\n/))!==-1){
          const separator=buffer.match(/\r?\n\r?\n/)[0];
          const eventText=buffer.slice(0,n);
          buffer=buffer.slice(n+separator.length);
          event(eventText);
        }
      }
      if(buffer.trim())event(buffer);
      if(!finalAnswer?.reply)throw new Error("The AI connection ended before the answer was finished.");
      return finalAnswer;
    }finally{try{await reader.cancel()}catch{}reader.releaseLock()}
  }

  async function sendMessage(evt) {
    evt.preventDefault();
    const value = input.value.trim();
    if (!value || busy || !workspaceReady || !activeChatId || switchingChat) return;
    messages.push({role:"user",content:value});
    messages = messages.slice(-24);
    saveChat();
    input.value = "";
    renderChat();
    busy = true;
    sendButton.disabled = true;
    sendButton.textContent = "Thinking…";
    setError("");
    thoughtTopic = value.replace(/\\s+/g," ").slice(0,100);
    setActivity("Checking the request…");
    setActivity(webMode === "on" ? "Looking for live sources…" : webMode === "off" ? "Preparing an answer without web search…" : "Checking whether live sources will help…");
    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        credentials: "same-origin",
        headers: {"Content-Type":"application/json","Accept":"text/event-stream"},
        body: JSON.stringify({messages: messages.slice(-16).map(({role,content})=>({role,content})), webSearch: webMode==="auto"?undefined:webMode==="on"})
      });
      const data=await readAiEvents(response);
      if (typeof data.reply !== "string" || !data.reply.trim()) throw new Error("AI returned an empty reply");
      messages.push({role:"assistant",content:data.reply.trim(),sources:data.sources||[],searchError:data.searchError||null,searched:!!data.searched,provider:data.provider||null});
      setActivity("");
      saveChat();
      renderChat();
    } catch (error) {
      setActivity("");
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
  el("boltAiClear").addEventListener("click",()=>{void createChat();});

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

  // Independent floating assistant. Keyboard: focus title bar, then Alt + arrow keys.
  const aiPanel = el("boltAiPanel");
  const aiHandle = el("boltAiDrag");
  const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));
  function moveAi(left, top) {
    const rect = aiPanel.getBoundingClientRect();
    aiPanel.style.left = clamp(left, 6, innerWidth - rect.width - 6) + "px";
    aiPanel.style.top = clamp(top, 6, innerHeight - rect.height - 6) + "px";
    aiPanel.style.right = "auto";
    aiPanel.style.bottom = "auto";
  }
  function saveAiWindow() {
    if (aiPanel.classList.contains("bolt-ai-maxed")) return;
    const rect = aiPanel.getBoundingClientRect();
    try {
      localStorage.setItem("bolt.ai.window.v2", JSON.stringify({
        left: rect.left, top: rect.top, width: rect.width, height: rect.height
      }));
    } catch {}
  }
  try {
    const pos = JSON.parse(localStorage.getItem("bolt.ai.window.v2") || "null");
    if (pos && Number.isFinite(pos.left) && Number.isFinite(pos.top)) {
      if (Number.isFinite(pos.width)) aiPanel.style.width = clamp(pos.width, 310, innerWidth - 12) + "px";
      if (Number.isFinite(pos.height)) aiPanel.style.height = clamp(pos.height, 350, innerHeight - 12) + "px";
      moveAi(pos.left, pos.top);
    }
  } catch {}
  el("boltAiSize").addEventListener("click", () => {
    const maximized = aiPanel.classList.toggle("bolt-ai-maxed");
    el("boltAiSize").textContent = maximized ? "❐" : "□";
    el("boltAiSize").setAttribute("aria-label", maximized ? "Restore AI window" : "Maximize AI window");
    if (!maximized) saveAiWindow();
  });
  let windowDrag = null;
  aiHandle.addEventListener("pointerdown", event => {
    if (event.button !== 0 || event.target.closest("button") || aiPanel.classList.contains("bolt-ai-maxed")) return;
    const rect = aiPanel.getBoundingClientRect();
    windowDrag = {id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top};
    aiHandle.setPointerCapture(event.pointerId);
  });
  aiHandle.addEventListener("pointermove", event => {
    if (!windowDrag || event.pointerId !== windowDrag.id) return;
    moveAi(windowDrag.left + event.clientX - windowDrag.x, windowDrag.top + event.clientY - windowDrag.y);
  });
  const stopDrag = () => {if(windowDrag){windowDrag=null;saveAiWindow();}};
  aiHandle.addEventListener("pointerup", stopDrag);
  aiHandle.addEventListener("pointercancel", stopDrag);
  aiHandle.addEventListener("keydown", event => {
    if (!event.altKey || !["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const rect = aiPanel.getBoundingClientRect();
    moveAi(rect.left + (event.key === "ArrowLeft" ? -20 : event.key === "ArrowRight" ? 20 : 0),
      rect.top + (event.key === "ArrowUp" ? -20 : event.key === "ArrowDown" ? 20 : 0));
    saveAiWindow();
  });
  if ("ResizeObserver" in window) new ResizeObserver(() => {
    if (document.body.classList.contains("bolt-ai-open")) saveAiWindow();
  }).observe(aiPanel);
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