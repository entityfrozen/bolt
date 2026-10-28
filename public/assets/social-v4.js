/* Lightning community chat: account-scoped read markers and realtime controls. */
const CHANNELS=["general","games","suggestions","support"];
const EMOJI=["👍","❤️","😂","🔥","😭","💀","🎉","👀","🙏","✨"];
const SHORTCODES={smile:"😄",laugh:"😂",joy:"😂",heart:"❤️",fire:"🔥",cry:"😢",sob:"😭",skull:"💀",thumbsup:"👍",eyes:"👀",party:"🎉",sparkles:"✨",wave:"👋",pray:"🙏",thinking:"🤔",cool:"😎",100:"💯"};
const emojiEnabled=()=>window.LightningPrefs?.autoEmoji!==false;
const emojiify=text=>String(text).replace(/:([a-z0-9_]+):/gi,(match,name)=>SHORTCODES[name.toLowerCase()]||match);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const get=(k,def)=>{try{return JSON.parse(localStorage.getItem(k))??def}catch{return def}};
const put=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
const avatar=n=>["#c4a4d5","#b0bf8c","#80b6ce","#d0ad77","#83bca9"][String(n||"").split("").reduce((a,c)=>a+c.charCodeAt(0),0)%5];
export function installSocial(Hub){
 const oldMessage=Hub.prototype.onMessage,oldShow=Hub.prototype.show,oldConnect=Hub.prototype.connect;
 Hub.prototype.socialInit=function(){
   if(this.socialReady)return;
   this.socialReady=true;
   this.readMarkers={};this.unread={};this.typing=new Map();this.reply=null;
   this.notifyMode=get("lightning:notify-mode","mentions");
   this.desktopAlerts=get("lightning:notify-desktop",false);
   this.originalTitle=document.title;
   this.root.addEventListener("click",event=>{
     const b=event.target.closest("[data-social]");
     if(!b)return;
     const action=b.dataset.social;
     if(action==="desktop")this.enableAlerts();
     if(action==="mode"){
       this.notifyMode={mentions:"all",all:"off",off:"mentions"}[this.notifyMode]||"mentions";
       put("lightning:notify-mode",this.notifyMode);this.badges();
     }
     if(action==="reply"){
       this.reply=this.history[this.channel]?.find(x=>x.id===b.dataset.id)||null;
       this.replyUi();this.$("#hubChatInput")?.focus();
     }
     if(action==="cancel"){this.reply=null;this.replyUi()}
     if(action==="react")this.send({type:"chatReact",channel:this.channel,id:b.dataset.id,emoji:b.dataset.emoji});
     if(action==="edit"){
       const m=this.history[this.channel]?.find(x=>x.id===b.dataset.id);
       if(!m||m.userId!==this.id)return;
       const next=prompt("Edit your message",m.message);
       if(next?.trim())this.send({type:"chatEdit",channel:this.channel,id:m.id,message:next.trim()});
     }
     if(action==="delete"&&confirm("Delete this message for everyone?"))
       this.send({type:"chatDelete",channel:this.channel,id:b.dataset.id});
   });
 };
 Hub.prototype.badges=function(){
   let total=0;
   for(const channel of CHANNELS){
     const n=this.unread[channel]||0;total+=n;
     const link=this.$('.hub-link[data-channel="'+channel+'"]');
     if(!link)continue;
     let badge=link.querySelector(".social-unread");
     if(!badge){badge=document.createElement("span");badge.className="social-unread";link.append(badge)}
     badge.hidden=!n;badge.textContent=n>99?"99+":String(n);
   }
   const rail=document.querySelector('[data-hub="chat"]');
   if(rail){
     let badge=rail.querySelector(".social-app-unread");
     if(!badge){badge=document.createElement("span");badge.className="social-app-unread";rail.append(badge)}
     badge.hidden=!total;badge.textContent=total>99?"99+":String(total);
   }
   document.dispatchEvent(new CustomEvent("lightning:community-unread",{detail:{count:total}}));
   const mode=this.$("#socialMode");if(mode)mode.textContent="Alerts: "+this.notifyMode;
   const desktop=this.$("#socialDesktop");if(desktop)desktop.textContent=this.desktopAlerts&&window.Notification?.permission==="granted"?"Desktop on":"Enable desktop";
 };
 Hub.prototype.readChannel=function(channel){
   if(!this.id||!CHANNELS.includes(channel))return;
   this.readMarkers[channel]=Math.max(this.readMarkers[channel]||0,this.history[channel]?.at(-1)?.at||Date.now());
   this.unread[channel]=0;put("lightning:read:"+this.id,this.readMarkers);this.badges();
 };
 Hub.prototype.restoreUnread=function(){
   this.readMarkers=get("lightning:read:"+this.id,{});
   for(const channel of CHANNELS){
     const rows=this.history[channel]||[];
     if(!this.readMarkers[channel])this.readMarkers[channel]=rows.at(-1)?.at||Date.now();
     this.unread[channel]=rows.filter(m=>!m.deleted&&m.userId!==this.id&&m.at>this.readMarkers[channel]).length;
   }
   put("lightning:read:"+this.id,this.readMarkers);this.badges();
 };
 Hub.prototype.enableAlerts=async function(){
   if(!("Notification" in window)||!isSecureContext)return this.flash("Desktop notifications require a supported HTTPS browser.");
   let result=Notification.permission;
   if(result==="default")result=await Notification.requestPermission();
   this.desktopAlerts=result==="granted";put("lightning:notify-desktop",this.desktopAlerts);
   this.badges();this.flash(this.desktopAlerts?"Desktop notifications enabled.":"Notification permission not granted.");
 };
 Hub.prototype.newChatNotice=function(entry){
   if(entry.userId===this.id)return;
   if(this.active&&this.view==="chat"&&this.channel===entry.channel&&!document.hidden){this.readChannel(entry.channel);return}
   this.unread[entry.channel]=(this.unread[entry.channel]||0)+1;this.badges();
   const mentioned=[...String(entry.message||"").matchAll(/(?:^|[^a-z0-9._-])@([a-z0-9._-]{3,32})(?![a-z0-9._-])/gi)].map(m=>m[1].toLowerCase());
   const mentions=mentioned.includes(String(this.username||this.name||"").toLowerCase());
   if(this.notifyMode==="off"||(this.notifyMode==="mentions"&&!mentions))return;
   if(this.desktopAlerts&&window.Notification?.permission==="granted"&&document.hidden){
     try{
       const n=new Notification(entry.by+" in #"+entry.channel,{body:entry.message.slice(0,130),icon:"/favicon.svg",tag:"lightning-"+entry.channel});
       n.onclick=()=>{window.focus();this.open("chat");this.show("chat",entry.channel);n.close()};
     }catch{}
   }else if(!this.active){
     const toast=document.querySelector("#toast");
     if(toast){toast.textContent=entry.by+" in #"+entry.channel+": "+entry.message.slice(0,60);
       toast.classList.add("show");clearTimeout(this.noticeTimer);this.noticeTimer=setTimeout(()=>toast.classList.remove("show"),3600)}
   }
 };
 Hub.prototype.onMessage=function(m){
   this.socialInit();
   oldMessage.call(this,m);
   if(m.type==="hello"){
     this.username=m.username||this.name;
     this.restoreUnread();if(this.active&&this.view==="chat")this.readChannel(this.channel);
   }else if(m.type==="chat"&&m.entry)this.newChatNotice(m.entry);
   else if(m.type==="chatDeleted"){
     const rows=this.history[m.channel]||[];
     const index=rows.findIndex(row=>row.id===m.id);
     if(index>=0)rows.splice(index,1);
     if(this.view==="chat"&&this.channel===m.channel)this.messages();
     this.restoreUnread();
   }
   else if(m.type==="chatUpdate"&&m.entry){
     const rows=this.history[m.channel]||[],index=rows.findIndex(x=>x.id===m.entry.id);
     if(index>=0){rows[index]=m.entry;if(this.view==="chat"&&this.channel===m.channel)this.messages()}
   }else if(m.type==="chatTyping"&&m.userId!==this.id){
     this.typing.set(m.userId,{channel:m.channel,name:m.by,until:Date.now()+3200});this.typingUi();
   }
 };
 Hub.prototype.typingUi=function(){
   const el=this.$("#socialTyping");
   for(const [key,item] of this.typing)if(item.until<Date.now())this.typing.delete(key);
   if(el){const names=[...this.typing.values()].filter(x=>x.channel===this.channel).map(x=>x.name);
     el.textContent=names.length===1?names[0]+" is typing…":names.length>1?names.slice(0,2).join(" and ")+" are typing…":"";}
   clearTimeout(this.typingTimeout);
   if(this.typing.size)this.typingTimeout=setTimeout(()=>this.typingUi(),900);
 };
 Hub.prototype.replyUi=function(){
   const box=this.$("#socialReply");if(!box)return;
   box.hidden=!this.reply;
   if(this.reply)box.querySelector("span").textContent="↳ "+this.reply.by+": "+this.reply.message.slice(0,110);
 };
 Hub.prototype.chat=function(){
   this.socialInit();this.header("# "+this.channel,"Community · #"+this.channel);
   this.$("#hubContent").innerHTML=
     '<div class="social-layout"><main class="social-main">'+
     '<header class="social-channel-head"><div><strong># '+esc(this.channel)+'</strong><small>Chat</small></div>'+
     '<div class="social-head-actions"><button type="button" data-social="mode" id="socialMode">Alerts: '+esc(this.notifyMode)+'</button>'+
     '<button type="button" data-social="desktop" id="socialDesktop">Enable desktop</button></div></header>'+
     '<div class="hub-chat-stream social-messages" id="hubMessages"></div>'+
     '<div id="socialTyping" class="social-typing" aria-live="polite"></div>'+
     '<div class="social-compose-outer"><div id="socialReply" class="social-reply" hidden><span></span><button data-social="cancel" type="button">×</button></div>'+
     '<form id="hubChatForm" class="social-form"><textarea id="hubChatInput" rows="1" maxlength="1000" aria-label="Message" placeholder="Message #'+esc(this.channel)+'"></textarea>'+
     '<button type="submit">Send ↗</button></form><p>Enter to send · Shift+Enter for a new line · @username to mention</p></div></main>'+
     '<aside class="hub-members social-members"><span class="hub-label">WHO\'S HERE</span><div id="hubMembers"></div></aside></div>';
   const form=this.$("#hubChatForm"),input=this.$("#hubChatInput");
   form.addEventListener("submit",e=>{
     e.preventDefault();const message=input.value.trim();if(!message)return;
     if(this.send({type:"chat",channel:this.channel,message,replyTo:this.reply?.id||null})){
       input.value="";input.style.height="auto";this.reply=null;this.replyUi();
     }
   });
   input.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.isComposing){e.preventDefault();form.requestSubmit()}});
   input.addEventListener("input",()=>{
     input.style.height="auto";input.style.height=Math.min(130,input.scrollHeight)+"px";
     if(Date.now()-(this.lastTyping||0)>2200){this.lastTyping=Date.now();this.send({type:"typing",channel:this.channel})}
   });
   this.messages();this.members();this.typingUi();this.replyUi();
   if(this.active&&!document.hidden)this.readChannel(this.channel);else this.badges();
 };
 Hub.prototype.messages=function(){
   const el=this.$("#hubMessages");if(!el)return;
   const bottom=el.scrollHeight-el.scrollTop-el.clientHeight<80;
   const rows=(this.history[this.channel]||[]).filter(row=>!row.deleted),byId=new Map(rows.map(row=>[row.id,row]));
   if(!rows.length){el.innerHTML='<div class="social-empty"><strong># '+esc(this.channel)+'</strong><p>Be the first to say something.</p></div>';return}
   el.innerHTML=rows.slice(-120).map(m=>{
     const reply=byId.get(m.replyTo),deleted=!!m.deleted;
     const content=deleted?'<i>Message deleted</i>':esc(m.message).replace(/(^|[\s])(@[a-z0-9._-]{3,32})/gi,'$1<span class="social-mention">$2</span>').replace(/\n/g,"<br>");
     const react=Object.entries(m.reactions||{}).filter(([,ids])=>Array.isArray(ids)&&ids.length)
       .map(([emoji,ids])=>'<button type="button" class="social-reaction" data-social="react" data-emoji="'+esc(emoji)+'" data-id="'+esc(m.id)+'">'+esc(emoji)+' '+ids.length+'</button>').join("");
     return '<article class="social-msg"><div class="social-avatar" style="--av:'+avatar(m.by)+'">'+esc(m.by?.[0]?.toUpperCase()||"?")+'</div>'+
       '<div class="social-msg-body"><div class="social-msg-meta"><strong>'+esc(m.by)+'</strong><time>'+new Date(m.at).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})+'</time>'+(m.editedAt?'<span>edited</span>':'')+'</div>'+
       (reply?'<div class="social-reference">↳ '+esc(reply.by)+': '+esc(reply.deleted?"Deleted":reply.message.slice(0,95))+'</div>':'')+
       '<div class="social-text">'+content+'</div><div class="social-reactions">'+react+'</div></div>'+
       (deleted?'':'<div class="social-message-actions"><button data-social="reply" data-id="'+esc(m.id)+'" title="Reply">↳</button>'+
       EMOJI.map(emoji=>'<button data-social="react" data-emoji="'+esc(emoji)+'" data-id="'+esc(m.id)+'" title="React">'+emoji+'</button>').join("")+
       (m.userId===this.id&&Date.now()-m.at<900000?'<button data-social="edit" data-id="'+esc(m.id)+'" title="Edit">✎</button>':'')+
       (m.userId===this.id?'<button data-social="delete" data-id="'+esc(m.id)+'" title="Delete">×</button>':'')+'</div>')+'</article>';
   }).join("");
   if(bottom)el.scrollTop=el.scrollHeight;
 };
 Hub.prototype.members=function(){
   const box=this.$("#hubMembers");if(!box)return;
   box.innerHTML='<small>'+this.users.length+' online</small>'+
     this.users.map(user=>'<div class="social-member"><span class="social-avatar" style="--av:'+avatar(user.name)+'">'+esc(user.name?.[0]?.toUpperCase()||"?")+'</span><span>'+esc(user.name)+'</span><span class="social-dot">●</span></div>').join("");
 };
 Hub.prototype.show=function(view,channel){
   oldShow.call(this,view,channel);
   if(view==="chat"&&this.active&&!document.hidden)this.readChannel(this.channel);
   this.badges();
 };
 Hub.prototype.close=function(){
   this.active=false;this.root.hidden=true;clearInterval(this.worldQueueInterval);this.worldQueueInterval=null;
   const frame=this.$("#hubWorld");if(frame){frame.replaceChildren();frame.classList.remove("hub-openfront-port")}
 };
 Hub.prototype.connect=function(){
   if(this.socket&&this.socket.readyState<=1)return;
   oldConnect.call(this);
   const socket=this.socket;
   socket?.addEventListener("close",()=>setTimeout(()=>{if(this.socket===socket)this.connect()},2800));
 };
}
