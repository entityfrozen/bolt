/* Lightning account space: editable profiles, private messages, account history. */
(()=>{
 "use strict";
 const escape=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const emojiNames={smile:"😄",heart:"❤️",fire:"🔥",laugh:"😂",joy:"😂",cry:"😢",sob:"😭",skull:"💀",thumbsup:"👍",eyes:"👀",party:"🎉",wave:"👋",sparkles:"✨"};
 const emojiify=text=>String(text).replace(/:([a-z0-9_]+):/gi,(word,name)=>emojiNames[name.toLowerCase()]||word);
 const $=(s,r=document)=>r.querySelector(s);
 const all=(s,r=document)=>Array.from(r.querySelectorAll(s));
 const identity=()=>window.LightningAccount?.profile;
 async function api(url,options={}){
  const r=await fetch(url,{credentials:"same-origin",cache:"no-store",...options,
   headers:{"Content-Type":"application/json",...(options.headers||{})}});
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(j.error||"Request failed");
  return j;
 }
 let profile=null,activeTab="profile",selected=null,threads=[],messages=[],busy=false,searchTimer=null,poll=null;
 const bust=()=>{if(poll){clearInterval(poll);poll=null;}};
 const notice=text=>{const el=$("#accountNotice");if(el)el.textContent=text||"";};
 function dialog(){
  let box=$("#lightningAccountSpace");if(box)return box;
  box=document.createElement("dialog");box.id="lightningAccountSpace";box.className="account-space";
  box.setAttribute("aria-labelledby","accountSpaceTitle");
  box.innerHTML='<div class="as-layout"><aside class="as-rail"><header><img src="/assets/lightning-mark.svg?v=1" alt="" class="lightning-mark"><strong>My Lightning</strong></header>'+
   '<nav aria-label="Account pages"><button data-as-tab="profile" class="active">Profile</button>'+
   '<button data-as-tab="messages">Direct messages</button><button data-as-tab="security">Login & password</button></nav><p>Synced to your account</p></aside>'+
   '<main class="as-main"><header class="as-top"><div><small>YOUR ACCOUNT</small><h2 id="accountSpaceTitle">Profile</h2></div>'+
   '<button data-as="close" aria-label="Close account settings">×</button></header>'+
   '<div class="as-content" id="asContent"></div><div id="accountNotice" role="status"></div></main></div>';
  document.body.append(box);
  box.addEventListener("click",async event=>{
   const tab=event.target.closest("[data-as-tab]");
   if(tab){activeTab=tab.dataset.asTab;selected=null;await draw();return;}
   const b=event.target.closest("[data-as]");if(!b)return;
   const action=b.dataset.as;
   if(action==="deleteMessage"){
    if(!selected||!confirm("Delete this private message for both people?"))return;
    try{
     await api("/api/account/dms/"+encodeURIComponent(selected)+"/"+encodeURIComponent(b.dataset.id),{method:"DELETE"});
     await loadMessages();await loadThreads();renderChat();
    }catch(error){notice(error.message)}
    return;
   }
   if(action==="reactMessage"){
    if(!selected)return;
    try{
     await api("/api/account/dms/"+encodeURIComponent(selected)+"/"+encodeURIComponent(b.dataset.id)+"/reactions",
      {method:"POST",body:JSON.stringify({emoji:b.dataset.emoji})});
     await loadMessages();renderChat();
    }catch(error){notice(error.message)}
    return;
   }
   if(action==="close"){box.close();bust();return;}
   if(action==="dm"){selected=b.dataset.id;await loadMessages();await draw();return;}
   if(action==="back"){selected=null;await draw();return;}
   if(action==="refresh"){await loadThreads();await draw();return;}
  });
  box.addEventListener("submit",async e=>{
   const form=e.target;if(!form.matches("[data-as-form]"))return;
   e.preventDefault();if(busy)return;busy=true;const submit=form.querySelector("[type=submit]");
   if(submit)submit.disabled=true;
   try{
    if(form.dataset.asForm==="profile"){
     const f=new FormData(form);
     const result=await api("/api/account/profile",{method:"PATCH",body:JSON.stringify({
       displayName:f.get("displayName"),bio:f.get("bio"),accent:f.get("accent")
     })});
     profile=result.profile;window.LightningAccount.profile=profile;
     document.dispatchEvent(new CustomEvent("lightning:profile-updated",{detail:profile}));
     notice("Profile updated. Your display name appears in community messages.");
    }
    if(form.dataset.asForm==="search"){
     const q=new FormData(form).get("q").trim();
     if(q.length<2)throw Error("Search at least two characters.");
     const result=await api("/api/account/people?q="+encodeURIComponent(q));
     $("#asPeopleResults").innerHTML=result.people.length?
       result.people.map(user=>person(user)).join(""):'<p class="as-muted">No matching members.</p>';
    }
    if(form.dataset.asForm==="credentials"){
     const fields=new FormData(form);
     const username=String(fields.get("username")||"").trim().toLowerCase();
     const pass=String(fields.get("password")||"");
     const confirmation=String(fields.get("confirm")||"");
     if(pass&&pass!==confirmation)throw Error("New passwords don't match.");
     const values={currentPassword:String(fields.get("current")||"")};
     if(username!==profile?.username)values.username=username;
     if(pass)values.newPassword=pass;
     if(!values.username&&!values.newPassword)throw Error("No changes to save.");
     await api("/api/account/credentials",{method:"PATCH",body:JSON.stringify(values)});
     await loadProfile();
     form.querySelectorAll('input[type="password"]').forEach(input=>input.value="");
     form.querySelector('input[name="username"]').value=profile.username;
     notice("Account updated.");
    }
    if(form.dataset.asForm==="message"){
     const input=$("#asMessage");
     if(!selected||!input?.value.trim())return;
     await api("/api/account/dms/"+encodeURIComponent(selected),{method:"POST",body:JSON.stringify({text:window.LightningPrefs?.autoEmoji===false?input.value:emojiify(input.value)})});
     input.value="";await loadMessages();await loadThreads();renderChat();
    }
   }catch(error){notice(error.message);}
   finally{busy=false;if(submit)submit.disabled=false;}
  });
  box.addEventListener("input",event=>{
   if(event.target.id!=="asMessage"||window.LightningPrefs?.autoEmoji===false)return;
   const input=event.target,before=input.value,caret=input.selectionStart;
   input.value=emojiify(before);
   const at=Math.max(0,caret-(before.length-input.value.length));
   input.setSelectionRange(at,at);
  });
  box.addEventListener("keydown",event=>{
   if(event.target.id==="asMessage"&&event.key==="Enter"&&!event.shiftKey){
    event.preventDefault();event.target.form?.requestSubmit();
   }
  });
  box.addEventListener("close",bust);
  return box;
 }
 const person=(user,unread=0)=>'<button type="button" class="as-person" data-as="dm" data-id="'+escape(user.id)+'">'+
  '<span class="as-avatar" style="--user-color:'+escape(user.accent)+'">'+escape((user.displayName||user.username||"?")[0].toUpperCase())+'</span>'+
  '<span><strong>'+escape(user.displayName||user.username)+'</strong><small>@'+escape(user.username)+'</small></span><i>Message →</i>'+(unread?'<b class="as-unread">'+(unread>99?"99+":unread)+'</b>':"")+'</button>';
 async function loadProfile(){const data=await api("/api/account/profile");profile=data.profile;window.LightningAccount.profile=profile;}
 async function loadThreads(){threads=(await api("/api/account/dms")).threads||[];}
 async function loadMessages(){if(!selected)return;const data=await api("/api/account/dms/"+encodeURIComponent(selected));messages=data.messages||[];document.dispatchEvent(new CustomEvent("lightning:dm-refresh"));}
 const messagesArea=()=>{
  if(!selected)return '<div class="as-muted">Choose a member or search above to start a private conversation.</div>';
  const thread=threads.find(t=>t.user.id===selected),other=thread?.user;
  return '<div class="as-chat-head"><button type="button" data-as="back">←</button>'+
    '<div><strong>'+escape(other?.displayName||"Private conversation")+'</strong><small>Only you and this member can view these messages.</small></div></div>'+
    '<div id="asChatMessages" class="as-messages" aria-live="polite"></div>'+
    '<form class="as-message-form" data-as-form="message"><textarea id="asMessage" maxlength="1500" rows="2" placeholder="Write a private message…" aria-label="Private message" required></textarea>'+
    '<button type="submit">Send ↗</button></form>';
 };
 function renderChat(){
  const target=$("#asChatMessages");if(!target||!profile)return;
  target.innerHTML=messages.length?messages.map(m=>
   '<div class="as-message '+(m.from===profile.id?"mine":"theirs")+'"><div>'+escape(m.text)+'</div>'+
   '<time>'+new Date(m.at).toLocaleString([],{hour:"numeric",minute:"2-digit",month:"short",day:"numeric"})+'</time></div>').join(""):
   '<p class="as-muted">No messages yet. Say hello privately.</p>';
  target.scrollTop=target.scrollHeight;
 }
 async function draw(){
  const box=dialog(),content=$("#asContent",box);
  all(".as-rail nav button",box).forEach(b=>b.classList.toggle("active",b.dataset.asTab===activeTab));
  $("#accountSpaceTitle",box).textContent=activeTab==="profile"?"Your profile":activeTab==="security"?"Login & password":"Direct messages";
  notice("");
  if(activeTab==="profile"){
   if(!profile)await loadProfile();
   content.innerHTML='<div class="as-profile-hero"><span class="as-large-avatar" style="--user-color:'+escape(profile.accent)+'">'+escape(profile.displayName[0]?.toUpperCase()||"L")+'</span>'+
    '<div><h3>'+escape(profile.displayName)+'</h3><p>@'+escape(profile.username)+'</p></div>'+
    '<span class="as-role">'+escape(profile.role)+'</span></div>'+
    '<form class="as-profile-form" data-as-form="profile">'+
    '<label>Display name<input name="displayName" minlength="2" maxlength="32" required value="'+escape(profile.displayName)+'"></label>'+
    '<label>Username <small>Permanent login handle</small><input disabled value="@'+escape(profile.username)+'"></label>'+
    '<label>Bio<textarea name="bio" maxlength="280" rows="4" placeholder="A little about you…">'+escape(profile.bio||"")+'</textarea></label>'+
    '<label>Profile color<input name="accent" type="color" value="'+escape(profile.accent)+'"></label>'+
    '<button class="as-primary" type="submit">Save profile</button></form>';
  }else if(activeTab==="security"){
   if(!profile)await loadProfile();
   content.innerHTML='<form class="as-profile-form as-security-form" data-as-form="credentials" autocomplete="on">'+
    '<label>Username<input name="username" required minlength="3" maxlength="32" pattern="[A-Za-z0-9._-]{3,32}" autocomplete="username" value="'+escape(profile.username)+'"></label>'+
    '<label>Current password<input type="password" name="current" required autocomplete="current-password"></label>'+
    '<label>New password <small>Leave blank to keep it</small><input type="password" name="password" minlength="10" maxlength="128" autocomplete="new-password"></label>'+
    '<label>Confirm new password<input type="password" name="confirm" minlength="10" maxlength="128" autocomplete="new-password"></label>'+
    '<p class="as-security-tip">Changing your password signs out your other sessions. Your profile and messages stay the same.</p>'+
    '<button class="as-primary" type="submit">Save changes</button></form>';
  }else{
   await loadThreads();
   content.innerHTML='<form class="as-search" data-as-form="search"><input type="search" name="q" placeholder="Find a member by username…" aria-label="Find member" minlength="2" maxlength="32" required><button type="submit">Search</button></form>'+
    '<div id="asPeopleResults"></div>'+
    (selected?messagesArea():
     '<div class="as-thread-list"><div class="as-thread-title"><strong>Conversations</strong><button type="button" data-as="refresh">Refresh</button></div>'+
      (threads.length?threads.map(t=>person(t.user,t.unread)).join(""):'<div class="as-muted">No direct messages yet. Search for a member to start one.</div>')+'</div>');
   if(selected){
    if(!threads.some(t=>t.user.id===selected)){
     const selectedProfile=await api("/api/account/dms/"+encodeURIComponent(selected));
     messages=selectedProfile.messages;const label=$(".as-chat-head strong");
     if(label)label.textContent=selectedProfile.user.displayName;
    }else await loadMessages();
    renderChat();
   }
  }
 }
 async function open(tab="profile",userId=null){
  const box=dialog();activeTab=tab==="messages"?"messages":"profile";if(userId){activeTab="messages";selected=userId;}
  if(!box.open)box.showModal();
  try{await draw();}catch(error){notice(error.message);}
  bust();
  if(activeTab==="messages")poll=setInterval(async()=>{
   if(!box.open){bust();return;}
   if(!selected)return;
   try{await loadMessages();renderChat();}catch{}
  },7000);
 }
 const accountSettings={
  values:{},ready:false,pending:new Map(),
  async load(){
   const data=await api("/api/account/settings");
   this.values=data.settings||{};this.ready=true;
   document.dispatchEvent(new CustomEvent("lightning:account-settings-loaded",{detail:{...this.values}}));
   return this.values;
  },
  get(key,fallback=null){return Object.prototype.hasOwnProperty.call(this.values,key)?this.values[key]:fallback},
  set(key,value){
   this.values[key]=value;
   // Queue writes per setting; a later edit must not be overwritten by an older one.
   const old=this.pending.get(key)||Promise.resolve();
   const next=old.catch(()=>{}).then(()=>api("/api/account/settings/"+encodeURIComponent(key),
      {method:"PUT",body:JSON.stringify({value})}));
   this.pending.set(key,next);
   next.finally(()=>{if(this.pending.get(key)===next)this.pending.delete(key);}).catch(()=>{});
   return next;
  }
 };
 window.LightningAccount={open,profile:null,settings:accountSettings,
  refreshProfile:async()=>{await loadProfile();return profile},
  history:{
   async load(kind){return (await api("/api/account/history/"+encodeURIComponent(kind))).items},
   async save(kind,items){return api("/api/account/history/"+encodeURIComponent(kind),{method:"PUT",body:JSON.stringify({items})});}
  }};
 document.addEventListener("click",e=>{
  const button=e.target.closest("[data-account-space]");
  if(button){e.preventDefault();void open(button.dataset.accountSpace||"profile",button.dataset.userId||null);}
 });
})();
