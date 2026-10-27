// Keep the active game mounted while community chat opens beside it.
const escapeText=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const gameViews=new Set(["games","chess","rps","world","uma","2048","mines"]);
export function installSplitChat(Hub){
 const initialize=Hub.prototype.v2Setup;
 const receive=Hub.prototype.onMessage;
 Hub.prototype.v2Setup=function(){
  initialize.call(this);
  if(this.splitReady)return;
  this.splitReady=true;
  this.splitServerId="lightning-main";
  this.splitChannel="general";
  const aside=document.createElement("aside");
  aside.id="lightningSideChat";aside.className="lightning-side-chat";aside.hidden=true;
  aside.setAttribute("aria-label","Live community chat");
  aside.innerHTML='<header><div class="sc-header-title"><small>COMMUNITY</small><strong>Chat while you play</strong></div>'+
    '<button type="button" data-split="close" aria-label="Close side chat">×</button></header>'+
    '<div class="sc-destination"><label for="splitChannelSelect">CHANNEL</label><select id="splitChannelSelect" aria-label="Choose chat channel"></select></div>'+
    '<div class="sc-messages" id="splitMessages" aria-live="polite"></div>'+
    '<form id="splitCompose" class="sc-compose"><textarea id="splitInput" rows="2" maxlength="1500" placeholder="Message #general…" aria-label="Write a community message"></textarea>'+
      '<button type="submit">Send ↗</button></form>';
  this.root.append(aside);
  const button=document.createElement("button");
  button.type="button";button.className="sc-toggle";
  button.dataset.split="toggle";button.setAttribute("aria-expanded","false");
  button.setAttribute("aria-controls","lightningSideChat");
  button.innerHTML='<span class="sc-unread-dot" hidden></span>Chat alongside game';
  this.$(".v2-topbar")?.append(button);
  this.root.addEventListener("click",e=>{
   const control=e.target.closest("[data-split]");if(!control)return;
   if(control.dataset.split==="toggle")this.splitToggle();
   else if(control.dataset.split==="close")this.splitToggle(false);
  });
  this.$("#splitChannelSelect").addEventListener("change",e=>{
   this.splitChannel=e.target.value;this.splitDraw();
  });
  this.$("#splitCompose").addEventListener("submit",e=>{
   e.preventDefault();
   const input=this.$("#splitInput"),message=input.value.trim();
   if(!message)return;
   const server=this.v2Servers.find(s=>s.id===this.splitServerId);
   const channel=server?.channels.find(c=>c.id===this.splitChannel);
   if(channel?.readOnly&&!server.canManage)return;
   if(this.send({type:"v2Message",serverId:this.splitServerId,channel:this.splitChannel,message})){
    input.value="";
   }
  });
 };
 Hub.prototype.splitToggle=function(force){
  const panel=this.$("#lightningSideChat"),control=this.$(".sc-toggle");
  if(!panel)return;
  const open=force===undefined?panel.hidden:!!force;
  panel.hidden=!open;this.root.classList.toggle("split-chat-open",open);
  control?.setAttribute("aria-expanded",String(open));
  if(open)this.splitDraw();
 };
 Hub.prototype.splitDraw=function(){
  const panel=this.$("#lightningSideChat");if(!panel||panel.hidden)return;
  const server=this.v2Servers.find(s=>s.id===this.splitServerId)||this.v2Servers.find(s=>s.permanent);
  const select=this.$("#splitChannelSelect"),list=this.$("#splitMessages"),input=this.$("#splitInput");
  if(!server){list.innerHTML='<div class="sc-empty">Connecting to your community…</div>';return;}
  this.splitServerId=server.id;
  const allowed=server.channels||[];
  if(!allowed.some(c=>c.id===this.splitChannel))this.splitChannel=allowed.some(c=>c.id==="general")?"general":allowed[0]?.id||"general";
  // Rebuild only when channels change, not on every incoming message.
  const hash=server.id+"|"+allowed.map(c=>c.id+":"+c.name).join("|");
  if(select.dataset.hash!==hash){
   select.innerHTML=allowed.map(c=>'<option value="'+escapeText(c.id)+'">'+(c.id==="announcements"?"📢 ":"# ")+escapeText(c.name)+'</option>').join("");
   select.dataset.hash=hash;
  }
  select.value=this.splitChannel;
  const ch=allowed.find(c=>c.id===this.splitChannel);
  const readonly=!!ch?.readOnly&&!server.canManage;
  input.disabled=readonly;
  input.placeholder=readonly?"Only staff can post here":"Message #"+this.splitChannel+"…";
  this.$("#splitCompose button").disabled=readonly;
  const entries=(server.messages?.[this.splitChannel]||[]).slice(-90);
  list.innerHTML=entries.length?entries.map(m=>
   '<article class="sc-message"><div><strong>'+escapeText(m.by)+'</strong><time>'+
   new Date(m.at).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})+'</time></div>'+
   '<p>'+escapeText(m.deleted?"Message deleted":m.message)+'</p></article>').join(""):
   '<div class="sc-empty">No messages in #'+escapeText(this.splitChannel)+' yet.</div>';
  list.scrollTop=list.scrollHeight;
 };
 Hub.prototype.onMessage=function(m){
  receive.call(this,m);
  if(!this.splitReady)return;
  if(["v2State","v2Server","v2Message","v2MessageUpdate"].includes(m.type)){
   if(!this.$("#lightningSideChat")?.hidden)this.splitDraw();
  }
 };
 // The toggle stays accessible on every game screen, including active matches.
 const show=Hub.prototype.show;
 Hub.prototype.show=function(view,channel){
  const result=show.call(this,view,channel);
  this.$(".sc-toggle")?.classList.toggle("sc-playing",gameViews.has(this.view));
  return result;
 };
}
