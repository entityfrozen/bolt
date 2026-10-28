import {installArenaPolish} from "./arena-v3.js?v=3";

const E=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const SOCIAL_EMOJI={"smile":"😄","laugh":"😂","joy":"😂","heart":"❤️","fire":"🔥","skull":"💀","cry":"😭","sob":"😭","thumbsup":"👍","eyes":"👀","party":"🎉","sparkles":"✨","wave":"👋","pray":"🙏","thinking":"🤔","cool":"😎","100":"💯"};
const EMOJI_PICKER=["❤️","🔥","😂","😭","👍","💀","🎉","👀","✨"];
const toEmoji=text=>String(text).replace(/:([a-z0-9_]+):/gi,(match,name)=>SOCIAL_EMOJI[name.toLowerCase()]||match).replace(/(^|\s):\)(?=\s|$)/g,"$1🙂").replace(/(^|\s)<3(?=\s|$)/g,"$1❤️");
const PIECES={K:"♔",Q:"♕",R:"♖",B:"♗",N:"♘",P:"♙",k:"♚",q:"♛",r:"♜",b:"♝",n:"♞",p:"♟"};
const UPDATES=[
["Lightning Social","Discord-inspired channels for community discussion, game coordination and feature suggestions. Messages and sign-ins use existing Lightning accounts."],
["The Arcade","Chess offers queued matches and direct challenges, with legal moves validated on the server. Rock Paper Scissors includes 1v1 matchmaking and four-player tournaments."],
["WorldPvP Alpha","A shared, real-time territory-conquest match with troops, gold, attacking, cities, factories, forts, coastal ports, allies and nuclear strikes. Reach 80% global control to win."],
["Browser & AI","Faster initial load via lazy-loaded games, improved AI formatting/copy controls, suggestions and removal of the separate video player."]
];
let INSTANCE=null;
class Hub{
 constructor(root){
  this.root=root;this.view="chat";this.channel="general";this.name="";this.id="";this.users=[];this.history={};this.direct={};this.peer=null;this.unread={total:0,channels:{},direct:{}};this.summary={users:0};this.socket=null;this.active=false;this.chess=null;this.rps=null;this.world=null;this.tile=null;this.selectedSquare=null;this.worldQueueing=false;this.worldActive=false;this.worldGeometry=null;this.camera={zoom:1,x:0,y:0};this.pointers=new Map();
  root.innerHTML='<div class="hub-shell"><aside class="hub-rail"><div class="hub-logo"><span class="hub-label">LIGHTNING NETWORK</span><strong>Social hub.</strong><small>Your space. Your people.</small></div><nav class="hub-nav"><div class="hub-nav-title">CHANNELS</div>'+
   ["general","games","suggestions","support"].map(c=>'<button class="hub-link" data-view="chat" data-channel="'+c+'"><i>#</i><span>'+c+'</span></button>').join("")+
   '<div class="hub-nav-title hub-dm-heading">DIRECT MESSAGES <button type="button" data-act="newDm" title="New message">＋</button></div><div id="hubDirectList"></div><button class="hub-link" data-view="inbox"><i>✉</i><span>All messages</span></button><div class="hub-nav-title">EXPLORE</div><button class="hub-link" data-view="games"><i>♞</i><span>Multiplayer games</span></button><button class="hub-link" data-view="updates"><i>↗</i><span>Update log</span></button></nav><div class="hub-user"><div class="hub-avatar" id="hubAvatar">L</div><div><strong id="hubUsername">Lightning user</strong><span id="hubConnection">Connecting…</span></div></div></aside>'+
   '<main class="hub-main"><header class="hub-head"><div><h2 id="hubTitle"># general</h2><p id="hubSubtitle">The Lightning network</p></div><span class="hub-spacer"></span><span class="hub-pill" id="hubOnline">0 online</span><button class="hub-x" data-act="close" aria-label="Close hub">×</button></header><div class="hub-content" id="hubContent"></div></main>'+
   '<div id="hubWorld" class="hub-world" hidden></div><div id="hubToast" class="hub-toast" hidden></div></div>';
  root.addEventListener("click",e=>{
   const nav=e.target.closest("[data-view]");
   if(nav)return this.show(nav.dataset.view,nav.dataset.channel);
   const action=e.target.closest("[data-act]");
   if(action)this.act(action.dataset.act,action);
  });
  window.addEventListener("resize",()=>{if(this.view==="world")this.draw()});
  document.addEventListener("pointerdown",event=>{
    if(this.active&&!this.root.contains(event.target)&&!event.target.closest("[data-hub]")&&!event.target.closest("#lightningSuggestionButton"))this.close();
  });
 }
 $(q){return this.root.querySelector(q)}
 $$(q){return [...this.root.querySelectorAll(q)]}
 flash(t){const box=this.$("#hubToast");box.textContent=t;box.hidden=false;clearTimeout(this.timer);this.timer=setTimeout(()=>box.hidden=true,3000)}
 send(payload){
  if(this.socket?.readyState!==WebSocket.OPEN){this.flash("Connecting to Lightning Live…");return false}
  this.socket.send(JSON.stringify(payload));return true;
 }
 connect(){
  if(this.socket&&this.socket.readyState<=1)return;
  const target=new URL("/live",location.href);
  target.protocol=location.protocol==="https:"?"wss:":"ws:";
  const ws=new WebSocket(target);this.socket=ws;
  ws.addEventListener("open",()=>{this.$("#hubConnection").textContent="Connected";if(this.worldActive||this.worldQueueing)this.send({type:"worldQueue"});});
  ws.addEventListener("message",e=>{try{this.onMessage(JSON.parse(e.data))}catch(err){console.warn("Hub:",err)}});
  ws.addEventListener("close",()=>{if(this.socket!==ws)return;this.socket=null;this.$("#hubConnection").textContent="Offline";setTimeout(()=>this.connect(),2300)});
 }
 onMessage(m){
  if(m.type==="hello"){
   this.id=m.id;this.name=m.name;this.history=m.history||{};this.direct=m.dms||{};this.unread=m.unread||{total:0,channels:{},direct:{}};this.users=m.online||[];this.summary=m.summary||{};
   this.$("#hubUsername").textContent=this.name;this.$("#hubAvatar").textContent=this.name[0]?.toUpperCase()||"L";this.presence();this.renderDirectList();this.unreadChanged();
   if(this.active&&(this.view==="chat"||this.view==="dm"||this.view==="inbox"))this.render();
  }else if(m.type==="presence"){
   this.summary=m;if(m.online)this.users=m.online;this.presence();if(this.view==="chat")this.members();this.renderDirectList();
  }else if(m.type==="chat"){
   if(m.entry){(this.history[m.entry.channel]??=[]).push(m.entry);if(m.entry.channel===this.channel&&this.view==="chat"){this.messages();this.markRead()} }
  }else if(this.socialEvent(m))return;
  else if(m.type==="queued")this.flash("Queued for "+m.game+". Waiting for an opponent.");
  else if(m.type==="chessStart"){this.chess={...m,turn:m.turn||"w",over:!!m.over};this.selectedSquare=null;this.view="chess";this.render()}
  else if(m.type==="chessState"){if(this.chess?.id===m.id){Object.assign(this.chess,m);this.selectedSquare=null;if(this.view==="chess")this.chessScreen();if(m.over)this.flash(m.result||"Game over")}}
  else if(m.type==="rpsStart"){this.rps={...m,waiting:false,result:null};this.view="rps";this.render()}
  else if(m.type==="rpsWaiting"){if(this.rps?.id===m.id){this.rps.waiting=true;if(this.view==="rps")this.rpsScreen()}}
  else if(m.type==="rpsResult"){if(this.rps?.id===m.id){this.rps.result=m;if(this.view==="rps")this.rpsScreen()}}
  else if(m.type==="tournamentJoined")this.flash("Tournament: "+m.players+"/4 players joined");
  else if(m.type==="tournamentStarted")this.flash("Tournament has started!");
  else if(m.type==="tournamentWinner")this.flash("Tournament won by "+m.winner);
  else if(m.type==="world"){this.world=m;if(this.view==="world")this.worldUpdate()}
  else if(m.type==="worldQueued"){this.worldQueueing=true;this.worldActive=false;if(this.view==="world")this.worldScreen()}
  else if(m.type==="worldMatch"){this.worldActive=true;this.worldQueueing=false;this.tile=null;if(this.view==="world")this.worldScreen()}
  else if(m.type==="worldQueueCancelled"){this.worldQueueing=false;if(this.view==="world")this.worldScreen()}
  else if(m.type==="worldEnded"){this.worldActive=false;this.worldQueueing=false;this.world=null;this.camera={zoom:1,x:0,y:0};if(this.view==="world")this.worldScreen()}
  else if(m.type==="worldInfo")this.flash(m.text);
  else if(m.type==="error")this.flash(m.message||"Request failed");
 }
 presence(){this.$("#hubOnline").textContent=(this.summary.users||0)+" online"}
 open(view="chat"){
  this.active=true;this.root.hidden=false;this.connect();
  this.show(view==="suggestions"?"chat":view,view==="suggestions"?"suggestions":null);
 }
 close(){this.active=false;this.root.hidden=true}
 show(page,channel){
  this.view=page;if(channel)this.channel=channel;this.render();this.renderDirectList();
 }
 header(title,subtitle){
  this.$("#hubTitle").textContent=title;this.$("#hubSubtitle").textContent=subtitle;
  this.$$("#hubWorld")[0].hidden=this.view!=="world";
  this.$$(".hub-link").forEach(b=>b.classList.toggle("active",
   b.dataset.view===this.view&&(!b.dataset.channel||b.dataset.channel===this.channel)||
   ["chess","rps","world"].includes(this.view)&&b.dataset.view==="games"));
 }
 render(){
  if(this.view==="chat")this.chat();
  else if(this.view==="inbox")this.inbox();
  else if(this.view==="dm")this.dm();
  else if(this.view==="games")this.games();
  else if(this.view==="updates")this.updates();
  else if(this.view==="chess")this.chessScreen();
  else if(this.view==="rps")this.rpsScreen();
  else if(this.view==="world")this.worldScreen();
 }

 chat(){
  this.header("# "+this.channel,"Live community · "+this.channel);
  this.$("#hubContent").innerHTML='<div class="hub-main"><div class="hub-chat-stream" id="hubMessages"></div><div class="hub-composer"><form id="hubChatForm" class="hub-compose-form"><input id="hubChatInput" maxlength="1000" autocomplete="off" placeholder="'+E(this.channel==="suggestions"?"Your idea for Lightning…":"Message #"+this.channel)+'"><button class="hub-btn primary">Send ↗</button></form><div class="hub-emoji-suggestions" id="hubEmojiSuggestions" hidden></div><div class="hub-footer">Use @username to mention someone · :heart: for ❤️ · hover to react or delete your message.</div></div></div><aside class="hub-members"><span class="hub-label">ONLINE</span><div id="hubMembers"></div></aside>';
  this.composer("hubChatForm","hubChatInput",message=>({type:"chat",channel:this.channel,message}));
  this.messages();this.members();this.markRead();
 }
 messageHtml(message,scope){
  const attributes=scope.peer?'data-peer="'+E(scope.peer)+'"':'data-channel="'+E(scope.channel)+'"';
  const isMine=message.userId===this.id;
  const reactions=Object.entries(message.reactions||{}).filter(([,users])=>Array.isArray(users)&&users.length)
   .map(([emoji,users])=>'<button class="hub-reaction '+(users.includes(this.id)?"mine":"")+'" type="button" data-act="react" data-id="'+E(message.id)+'" '+attributes+' data-emoji="'+E(emoji)+'">'+E(emoji)+' <b>'+users.length+'</b></button>').join("");
  const picker=this.reactionPicker===message.id?'<span class="hub-reaction-picker">'+EMOJI_PICKER.map(emoji=>'<button type="button" data-act="react" data-id="'+E(message.id)+'" '+attributes+' data-emoji="'+E(emoji)+'">'+E(emoji)+'</button>').join("")+'</span>':"";
  const text=E(message.message).replace(/@([a-z0-9._-]{3,32})/gi,'<mark class="hub-mention">@$1</mark>');
  return '<div class="hub-chat-line" data-msg="'+E(message.id)+'"><span class="hub-chat-avatar">'+E(message.by?.slice(0,1).toUpperCase()||"?")+'</span><div class="hub-message-main"><div class="hub-chat-top"><strong>'+E(message.by)+'</strong><time>'+new Date(message.at).toLocaleString()+'</time></div><p>'+text+'</p><div class="hub-message-bottom">'+reactions+'<button class="hub-quick-react" data-act="reactMenu" data-id="'+E(message.id)+'" type="button" title="Add a reaction">☺ ＋</button>'+(isMine?'<button class="hub-msg-delete" data-act="deleteMsg" data-id="'+E(message.id)+'" '+attributes+' type="button">Delete</button>':"")+picker+'</div></div></div>';
 }
 messages(){
  const el=this.$("#hubMessages");if(!el)return;
  const intro=this.channel==="suggestions"?"Post the features you want Lightning to build next.":"This is the start of the "+this.channel+" channel.";
  const nearBottom=el.scrollHeight-el.scrollTop-el.clientHeight<100;
  el.innerHTML='<div class="hub-chat-welcome"><strong>Welcome to #'+E(this.channel)+'</strong><p>'+E(intro)+'</p></div>'+
   (this.history[this.channel]||[]).slice(-120).map(m=>this.messageHtml(m,{channel:this.channel})).join("");
  if(nearBottom)el.scrollTop=el.scrollHeight;
 }
 composer(formId,inputId,payload){
  const form=this.$("#"+formId),input=this.$("#"+inputId),list=this.$("#hubEmojiSuggestions");
  const autoEmoji=()=>{try{return JSON.parse(localStorage.getItem("bolt.prefs")||"{}").autoEmoji!==false}catch{return true}};
  form.addEventListener("submit",event=>{
   event.preventDefault();const message=(autoEmoji()?toEmoji(input.value):input.value).trim();
   if(message&&this.send(payload(message))){input.value="";list.hidden=true}
  });
  input.addEventListener("input",()=>{
   if(autoEmoji()&&/:([a-z0-9_]+):/i.test(input.value)){
    const at=input.selectionStart,converted=toEmoji(input.value);input.value=converted;
    input.setSelectionRange(Math.min(at,converted.length),Math.min(at,converted.length));
   }
   const token=autoEmoji()?input.value.slice(0,input.selectionStart).match(/:([a-z0-9_]{2,})$/i):null;
   const options=token?Object.entries(SOCIAL_EMOJI).filter(([name])=>name.startsWith(token[1].toLowerCase())).slice(0,6):[];
   list.hidden=!options.length;
   list.innerHTML=options.map(([name,emoji])=>'<button type="button" data-shortcode="'+E(name)+'">'+E(emoji)+' <span>:'+E(name)+':</span></button>').join("");
   list.querySelectorAll("[data-shortcode]").forEach(button=>button.addEventListener("mousedown",e=>{
    e.preventDefault();
    const at=input.selectionStart,match=input.value.slice(0,at).match(/:([a-z0-9_]{2,})$/i);
    if(!match)return;
    input.value=input.value.slice(0,at-match[0].length)+SOCIAL_EMOJI[button.dataset.shortcode]+input.value.slice(at);
    input.focus();list.hidden=true;
   }));
  });
 }
 members(){
  const el=this.$("#hubMembers");if(!el)return;
  el.innerHTML=this.users.map(u=>'<div class="hub-member"><span class="hub-statusdot"></span>'+E(u.name)+'<button class="hub-member-copy" type="button" title="Send direct message" data-act="dmOpen" data-peer="'+E(u.id)+'">✉</button><button class="hub-member-copy" type="button" title="Copy player ID" data-act="copyUser" data-id="'+E(u.id)+'">⧉</button></div>').join("")||'<p class="hub-footer">Connecting…</p>';
 }

 room(peer){return [this.id,peer].sort().join("|")}
 peerName(peer){
  const member=this.users.find(u=>u.id===peer);
  if(member)return member.name;
  const messages=this.direct[this.room(peer)]||[];
  return [...messages].reverse().find(m=>m.userId===peer)?.by||peer;
 }
 dmPeers(){
  return Object.entries(this.direct).filter(([room])=>room.split("|").includes(this.id)).map(([room,messages])=>{
   const peer=room.split("|").find(id=>id!==this.id);
   return {peer,messages,last:messages.at(-1)?.at||0};
  }).filter(item=>item.peer).sort((a,b)=>b.last-a.last);
 }
 renderDirectList(){
  const el=this.$("#hubDirectList");if(!el||!this.id)return;
  el.innerHTML=this.dmPeers().map(item=>{
   const count=this.unread.direct?.[item.peer]||0;
   return '<button class="hub-link hub-dm-link '+(this.view==="dm"&&this.peer===item.peer?"active":"")+'" type="button" data-act="dmOpen" data-peer="'+E(item.peer)+'"><i>◉</i><span>'+E(this.peerName(item.peer))+'</span>'+(count?'<b class="hub-unread">'+count+'</b>':"")+'</button>';
  }).join("");
 }
 unreadChanged(){
  window.dispatchEvent(new CustomEvent("lightning:unread",{detail:{count:this.unread.total||0}}));
  this.renderDirectList();
  for(const button of this.$("[data-channel]")){
   const count=this.unread.channels?.[button.dataset.channel]||0;
   let badge=button.querySelector(".hub-unread");
   if(!count){badge?.remove();continue}
   if(!badge){badge=document.createElement("b");badge.className="hub-unread";button.append(badge)}
   badge.textContent=count;
  }
 }
 notify(title,body,peer){
  if(!document.hidden&&this.active)return;
  if(!("Notification" in window)||Notification.permission!=="granted")return;
  try{
   const notification=new Notification(title,{body:body.slice(0,180),icon:"/favicon.svg",tag:"lightning-"+(peer||"mention")});
   notification.onclick=()=>{window.focus();this.open("chat");if(peer)this.openDm(peer);notification.close()};
  }catch{}
 }
 socialEvent(m){
  if(m.type==="unread"){this.unread=m;this.unreadChanged();return true}
  if(m.type==="mention"){
   if(m.entry&&!(this.active&&this.view==="chat"&&this.channel===m.entry.channel&&!document.hidden))this.notify("Mention from "+m.entry.by,m.entry.message);
   return true;
  }
  if(m.type==="dm"){
   const entry=m.entry;if(!entry)return true;
   const peer=entry.userId===this.id?entry.to:entry.userId;
   const room=this.room(peer);
   (this.direct[room]??=[]).push(entry);
   this.direct[room]=this.direct[room].slice(-120);
   if(this.active&&this.view==="dm"&&this.peer===peer){this.dmMessages();this.markRead()}
   else if(entry.userId!==this.id)this.notify("Message from "+entry.by,entry.message,peer);
   this.renderDirectList();return true;
  }
  if(m.type==="socialDeleted"||m.type==="socialReaction"){
   const apply=messages=>{
    const index=messages.findIndex(entry=>entry.id===m.id);if(index<0)return false;
    if(m.type==="socialDeleted")messages.splice(index,1);
    else messages[index].reactions=m.reactions||{};
    return true;
   };
   let changed=false;
   for(const channel of Object.keys(this.history))changed=apply(this.history[channel])||changed;
   for(const room of Object.keys(this.direct))changed=apply(this.direct[room])||changed;
   if(changed&&this.view==="chat")this.messages();
   if(changed&&this.view==="dm")this.dmMessages();
   if(changed)this.renderDirectList();
   return true;
  }
  return false;
 }
 markRead(){
  if(!this.active||document.hidden||!this.id)return;
  if(this.view==="chat")this.send({type:"socialRead",channel:this.channel});
  if(this.view==="dm"&&this.peer)this.send({type:"socialRead",peer:this.peer});
 }
 openDm(peer){
  if(!peer||peer===this.id)return this.flash("Choose another Lightning member.");
  this.peer=peer;this.show("dm");
 }

 inbox(){
  this.header("Direct messages","Private conversations · only you and your recipient can read these");
  const peers=this.dmPeers();
  this.$("#hubContent").innerHTML='<section class="hub-inbox"><div class="hub-inbox-hero"><span class="hub-label">PRIVATE MESSAGES</span><h2>Your conversations.</h2><p>Start a DM with an online member, or paste the account ID of someone on Lightning.</p><form id="hubStartDm" class="hub-compose-form"><input id="hubNewDmId" placeholder="Lightning account ID" maxlength="100" autocomplete="off"><button class="hub-btn primary">Open DM ↗</button></form></div><div class="hub-inbox-list">'+(peers.map(item=>'<button class="hub-inbox-item" type="button" data-act="dmOpen" data-peer="'+E(item.peer)+'"><span class="hub-chat-avatar">'+E(this.peerName(item.peer).slice(0,1).toUpperCase())+'</span><span><strong>'+E(this.peerName(item.peer))+'</strong><small>'+E(item.messages.at(-1)?.message||"Start talking")+'</small></span>'+(this.unread.direct?.[item.peer]?'<b class="hub-unread">'+this.unread.direct[item.peer]+'</b>':"")+'</button>').join("")||'<p class="hub-footer">No conversations yet. Say hi to someone!</p>')+'</div></section>';
  this.$("#hubStartDm").addEventListener("submit",e=>{
   e.preventDefault();this.openDm(this.$("#hubNewDmId").value.trim());
  });
 }
 dm(){
  if(!this.peer)return this.inbox();
  this.header("✉ "+this.peerName(this.peer),"Private messages · visible only to the participants");
  this.$("#hubContent").innerHTML='<div class="hub-main"><div class="hub-chat-stream" id="hubDmMessages"></div><div class="hub-composer"><form id="hubDmForm" class="hub-compose-form"><input id="hubDmInput" maxlength="1000" autocomplete="off" placeholder="Message '+E(this.peerName(this.peer))+' privately…"><button class="hub-btn primary">Send ↗</button></form><div class="hub-emoji-suggestions" id="hubEmojiSuggestions" hidden></div><div class="hub-footer">Only the two of you can see this conversation · :smile: becomes 😄</div></div></div>';
  this.composer("hubDmForm","hubDmInput",message=>({type:"dm",to:this.peer,message}));
  this.dmMessages();this.markRead();
 }
 dmMessages(){
  const el=this.$("#hubDmMessages");if(!el||!this.peer)return;
  const nearBottom=el.scrollHeight-el.scrollTop-el.clientHeight<100;
  el.innerHTML='<div class="hub-chat-welcome"><strong>Just you and '+E(this.peerName(this.peer))+'</strong><p>This is your private conversation.</p></div>'+
   (this.direct[this.room(this.peer)]||[]).slice(-120).map(m=>this.messageHtml(m,{peer:this.peer})).join("");
  if(nearBottom)el.scrollTop=el.scrollHeight;
 }
 games(){
  this.header("Games","Live multiplayer arcade");
  this.$("#hubContent").innerHTML='<section class="hub-games"><div class="hub-games-head"><span class="hub-label">PLAY WITH LIGHTNING</span><h2>Pick your arena.</h2><p>Queue for a live match or challenge another member. No downloads required.</p></div><div class="hub-game-grid">'+[
    ["♞","Chess","Real-time chess. Legal moves and turns are verified by the server.","chessView","Queue • Duel"],
    ["✊","Rock Paper Scissors","Fast 1v1 duels, hidden choices and four-player tournaments.","rpsView","Queue • Tournaments"],
    ["◈","WorldPvP","The entire Earth. Human opponents, AI nations, military campaigns and real-time conquest.","worldView","Worldwide • Bot generals"]
  ].map(x=>'<article class="hub-game-card"><div><div class="hub-game-icon">'+x[0]+'</div><h3>'+x[1]+'</h3><p>'+x[2]+'</p></div><div><small>'+x[4]+'</small><br><button class="hub-btn primary" data-act="'+x[3]+'">Play now ↗</button></div></article>').join("")+'</div></section>';
 }
 updates(){
  this.header("What's New","Lightning · Releases");
  const patches=[
   {version:"2.1",tag:"WORLD EXPANSION",date:"October 2026",title:"A world worth conquering.",desc:"A real global coastline, zoom-and-pan controls, matchmaking, AI nations and inland/naval attack rules.",items:["WorldPvP · Queue and play lobby","360 × 180 global strategy map","Bot nations and coastal naval landings","Chess move highlights and AI opponent"]},
   {version:"2.0",tag:"MULTIPLAYER ALPHA",date:"October 2026",title:"Lightning goes live.",desc:"The first version of Lightning's competitive and community multiplayer hub.",items:["Live community channels and suggestions","Chess matchmaking and RPS tournaments","WorldPvP proof of concept","Better AI Markdown and browser loading"]},
   {version:"1.9",tag:"BROWSER",date:"Earlier",title:"A quieter browser.",desc:"The foundation: proxy browsing, tabs, music, design polish and Lightning AI.",items:["Gold-on-obsidian redesign","Core browsing and AI tools"]}
  ];
  this.$("#hubContent").innerHTML='<section class="hub-release-scroll"><div class="hub-release-hero"><span class="hub-label">THE LIGHTNING CHANGELOG</span><h1>Built to get<br><em>better.</em></h1><p>Every release, a stronger browser and a better place to play.</p><div class="hub-release-badges"><span>✦ CURRENT · 2.1 ALPHA</span><span>⚡ LIVE NETWORK</span></div></div><div class="hub-release-list">'+patches.map((p,i)=>'<article class="hub-release"><div class="hub-release-meta"><span class="hub-release-version">'+E(p.version)+'</span><div><span class="hub-label">'+E(p.tag)+'</span><small>'+E(p.date)+'</small></div></div><div class="hub-release-body"><span class="hub-release-number">0'+(i+1)+'</span><h2>'+E(p.title)+'</h2><p>'+E(p.desc)+'</p><div class="hub-release-items">'+p.items.map(x=>'<div><span>↗</span>'+E(x)+'</div>').join("")+'</div></div></article>').join("")+'</div></section>';
 }
 chessScreen(){
  this.header("Chess","Live matches · Real rules · Bot practice");
  const host=this.$("#hubContent"),g=this.chess;
  if(!g){
   host.innerHTML='<section class="hub-game-area hub-chess-lobby"><span class="hub-label">THE LIGHTNING CHESS CLUB</span><h2>Make your move.</h2><p>Find a human or practice against the Lightning bot. Select a piece, then tap a highlighted destination.</p><div class="hub-actions"><button class="hub-btn primary" data-act="chessQueue">⚔ Find a player</button><button class="hub-btn" data-act="chessBot">♟ Play vs bot</button></div><div class="hub-actions"><input id="hubDuelId" placeholder="Opponent user ID"><button class="hub-btn" data-act="chessDuel">Challenge player</button></div><button class="hub-btn" data-act="back">← All games</button></section>';return;
  }
  const board=g.fen.split(" ")[0].split("/").map(row=>{const cells=[];for(const ch of row){if(/[1-8]/.test(ch))for(let i=0;i<Number(ch);i++)cells.push("");else cells.push(ch)}return cells});
  const order=g.color==="b"?[7,6,5,4,3,2,1,0]:[0,1,2,3,4,5,6,7],myTurn=!g.over&&g.turn===g.color,legal=myTurn?(g.legal||[]):[];
  const destinations=new Set(legal.filter(m=>m.from===this.selectedSquare).map(m=>m.to));let squares="";
  for(const y of order)for(const x of order){
   const sq="abcdefgh"[x]+(8-y),piece=board[y]?.[x]||"";
   squares+='<button type="button" class="hub-square '+((x+y)%2?"dark":"light")+(this.selectedSquare===sq?" selected":"")+(destinations.has(sq)?" target":"")+'" data-act="square" data-square="'+sq+'" title="'+sq+'"><span>'+(PIECES[piece]||"")+'</span></button>';
  }
  const hint=g.over?E(g.result||"Game finished"):myTurn?this.selectedSquare?"Tap a highlighted square to move.":"Your move · Select a piece":"Opponent is thinking…";
  host.innerHTML='<section class="hub-chess-layout"><div class="hub-chess-panel"><div class="hub-chess-status"><span class="hub-label">MATCH · '+E(g.id.slice(0,7).toUpperCase())+'</span><strong>'+(g.over?"GAME OVER":myTurn?"YOUR TURN":"OPPONENT'S TURN")+'</strong></div><div class="hub-chess-board"><div class="hub-chess">'+squares+'</div></div></div><aside class="hub-chess-sidebar"><span class="hub-label">YOUR MATCH</span><h2>Chess.</h2><p>You play <b>'+(g.color==="w"?"White ♙":"Black ♟")+'</b></p><p class="hub-chess-hint">'+hint+'</p><div class="hub-chess-card">Latest move <strong>'+E(g.last||"Opening position")+'</strong></div><div class="hub-chess-card">Legal moves <strong>'+legal.length+'</strong></div><button class="hub-btn" data-act="back">← Arcade</button></aside></section>';
 }
 rpsScreen(){
  this.header("Rock Paper Scissors","Lightning Arena · Fast rounds");
  const g=this.rps,host=this.$("#hubContent");
  if(!g){
   host.innerHTML='<section class="hub-rps-lobby"><div class="hub-rps-huge">✊ <span>✋</span> ✌</div><div class="hub-label">THE LIGHTNING ARENA</div><h1>Rock. Paper.<br><em>Scissors.</em></h1><p>Quick duels, real players, hidden choices. A round takes seconds. A rivalry might last all night.</p><div class="hub-rps-buttons"><button class="hub-btn primary" data-act="rpsQueue">⚔ Find an opponent</button><button class="hub-btn" data-act="rpsBot">✊ Practice with bot</button><button class="hub-btn" data-act="tournament">🏆 4-player tournament</button></div><div class="hub-actions"><input id="hubDuelId" placeholder="Online player ID"><button class="hub-btn" data-act="rpsDuel">Challenge</button></div><button class="hub-btn hub-back" data-act="back">← Arcade</button></section>';return;
  }
  const result=g.result,mine=result?.choices?.[this.id],other=result?Object.entries(result.choices||{}).find(([id])=>id!==this.id)?.[1]:null;
  const opponentName=g.players?.[g.ids?.indexOf(this.id)===1?0:1]||"OPPONENT";
  const heading=result?(result.tie?"DRAW ROUND":result.winner===this.id?"VICTORY":"DEFEAT"):g.waiting?"AWAITING OPPONENT":"CHOOSE YOUR MOVE";
  const symbol={rock:"✊",paper:"✋",scissors:"✌️"};
  host.innerHTML='<section class="hub-rps-match"><div class="hub-label">LIGHTNING ARENA · '+E(g.id.slice(0,7).toUpperCase())+'</div><h1>'+heading+'</h1><p>'+ (result?result.tie?"Both players picked the same move.":result.winner===this.id?"You read their move perfectly.":"The opponent took this round.":g.waiting?"Your choice is locked. Waiting for the other player…":"Every move is hidden until both sides have chosen.")+'</p><div class="hub-rps-versus"><div class="hub-rps-fighter"><span>YOU</span><strong>'+(mine?symbol[mine]:"?")+'</strong><small>'+E(mine||"Secret move")+'</small></div><div class="hub-rps-vs">VS</div><div class="hub-rps-fighter"><span>'+E(opponentName)+'</span><strong>'+(other?symbol[other]:"?")+'</strong><small>'+E(other||"Secret move")+'</small></div></div>'+(result?'<div class="hub-rps-buttons"><button class="hub-btn primary" data-act="'+(g.bot?"rpsBot":"rpsQueue")+'">Play again ↗</button></div>':'<div class="hub-rps-choices">'+["rock","paper","scissors"].map((v,i)=>'<button class="hub-rps-choice" data-act="rpsPick" data-choice="'+v+'" '+(g.waiting?"disabled":"")+'><span>'+["✊","✋","✌️"][i]+'</span><b>'+v+'</b></button>').join("")+'</div>')+'<div class="hub-actions"><button class="hub-btn" data-act="back">← All games</button></div></section>';
 }
 worldScreen(){
  this.header("WorldPvP","Global conquest · Live nations");
  this.$("#hubContent").innerHTML="";
  const mount=this.$("#hubWorld");
  const me=this.world?.players?.find(p=>p.id===this.id);
  if(!this.worldActive&&!me){
   mount.innerHTML='<section class="world-lobby"><div class="world-lobby-ambient"><span>◈</span></div><div class="world-lobby-main"><div class="world-lobby-kicker">LIGHTNING ARCADE <b> / </b> GRAND STRATEGY</div><h1>World<span>PvP.</span></h1><p class="world-lobby-sub">One planet. A dozen nations. One empire left standing.</p><div class="world-lobby-actions">'+(this.worldQueueing?'<button class="world-play waiting" disabled><span class="world-loader"></span> MATCHMAKING…</button><button class="hub-btn" data-act="worldCancel">Cancel queue</button>':'<button class="world-play" data-act="worldQueue">⚔ &nbsp; PLAY WORLD PVP <span>→</span></button>')+'<button class="world-secondary" data-act="back">← Back to arcade</button></div><div class="world-queue-status"><i></i><span>'+(this.worldQueueing?"Finding your world…":"Live matchmaking · Solo players get NPC opponents")+'</span><b>'+(this.world?.queued||0)+' queued</b></div></div><div class="world-lobby-footer"><div><strong>01</strong><span>Full Earth map<br><small>Zoom · Drag · Conquer</small></span></div><div><strong>02</strong><span>NPC empires<br><small>Bot nations fight back</small></span></div><div><strong>03</strong><span>Real-time warfare<br><small>Coastal navy · Land attacks</small></span></div></div></section>';
   return;
  }
  mount.innerHTML='<div class="hub-world-top"><div class="hub-world-brand"><b>WORLD<span>PVP</span></b><small>LIVE CONQUEST</small></div><div class="hub-world-stat"><span>LAND</span><b id="hubLand">0%</b></div><div class="hub-world-stat"><span>TROOPS</span><b id="hubTroops">0</b></div><div class="hub-world-stat"><span>GOLD</span><b id="hubGold">0</b></div><div class="hub-world-stat"><span>NATIONS</span><b id="hubNations">0</b></div><span class="hub-spacer"></span><span class="world-live-dot">● LIVE MATCH</span><button class="hub-btn" data-act="back">← Arcade</button></div><div class="hub-world-stage"><canvas id="hubWorldCanvas"></canvas><div class="hub-world-maptools"><button data-act="zoomIn" title="Zoom in">+</button><button data-act="zoomOut" title="Zoom out">−</button><button data-act="centerMap" title="Reset view">⌖</button><span id="hubZoom">100%</span></div><div class="hub-world-tooltip" id="hubWorldInfo"><b>Choose a region</b><small>Drag to explore · Scroll to zoom.</small></div><div id="hubWorldLegend" class="hub-world-legend"></div><div class="world-instructions">DRAG TO PAN &nbsp; · &nbsp; SCROLL / PINCH TO ZOOM &nbsp; · &nbsp; TAP TO SELECT</div><div class="hub-world-bottom"><span class="hub-label">SEND</span><select id="hubRatio" aria-label="Army commitment"><option value=".2">20%</option><option value=".4" selected>40%</option><option value=".65">65%</option><option value=".9">90%</option></select><button class="hub-btn primary" data-act="attack">⚔ Attack</button><button class="hub-btn" data-act="build" data-kind="city">⌂ City</button><button class="hub-btn" data-act="build" data-kind="factory">⚒ Factory</button><button class="hub-btn" data-act="build" data-kind="port">⚓ Port</button><button class="hub-btn" data-act="build" data-kind="fort">⬟ Fort</button><button class="hub-btn" data-act="ally">🤝 Ally</button><button class="hub-btn" data-act="nuke">☢ Nuke</button></div></div>';
  const canvas=this.$("#hubWorldCanvas");
  canvas.style.touchAction="none";
  canvas.addEventListener("wheel",event=>{event.preventDefault();const r=canvas.getBoundingClientRect();this.zoomMap(event.deltaY<0?1.18:1/1.18,event.clientX-r.left,event.clientY-r.top)},{passive:false});
  canvas.addEventListener("pointerdown",event=>{
   canvas.setPointerCapture(event.pointerId);
   this.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY,downX:event.clientX,downY:event.clientY,moved:false});
  });
  canvas.addEventListener("pointermove",event=>{
   const state=this.pointers.get(event.pointerId);if(!state)return;
   const dx=event.clientX-state.x,dy=event.clientY-state.y;
   if(Math.hypot(event.clientX-state.downX,event.clientY-state.downY)>6)state.moved=true;
   state.x=event.clientX;state.y=event.clientY;
   if(this.pointers.size===1){this.camera.x+=dx;this.camera.y+=dy;this.clampCamera();this.draw()}
   else if(this.pointers.size===2){
    const points=[...this.pointers.values()],distance=Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y);
    if(this.lastPinchDist&&distance>0)this.zoomMap(distance/this.lastPinchDist,((points[0].x+points[1].x)/2)-canvas.getBoundingClientRect().left,((points[0].y+points[1].y)/2)-canvas.getBoundingClientRect().top);
    this.lastPinchDist=distance;points.forEach(p=>p.moved=true);
   }
  });
  const release=event=>{
   const state=this.pointers.get(event.pointerId);if(!state)return;
   this.pointers.delete(event.pointerId);
   if(this.pointers.size<2)this.lastPinchDist=null;
   if(!state.moved&&this.pointers.size===0){const r=canvas.getBoundingClientRect();const cell=this.mapCell(event.clientX-r.left,event.clientY-r.top);if(cell){this.tile=cell;this.worldInfo();this.draw()}}
  };
  canvas.addEventListener("pointerup",release);
  canvas.addEventListener("pointercancel",release);
  if(!this.worldGeometry)fetch("/assets/world-geography.json").then(r=>r.ok?r.json():null).then(data=>{this.worldGeometry=data;this.draw()}).catch(()=>{});
  this.worldUpdate();
 }
 mapFit(){
  const c=this.$("#hubWorldCanvas"),r=c?.getBoundingClientRect();
  return r?.width&&r?.height?Math.min(r.width/1440,r.height/720)*.98:1;
 }
 mapCell(x,y){
  const c=this.$("#hubWorldCanvas");if(!c)return null;
  const r=c.getBoundingClientRect(),scale=this.mapFit()*this.camera.zoom;
  const mx=(x-r.width/2-this.camera.x)/scale+720,my=(y-r.height/2-this.camera.y)/scale+360;
  const w=this.world?.width||360,h=this.world?.height||180;
  const cx=Math.floor(mx/1440*w),cy=Math.floor(my/720*h);
  return cx>=0&&cx<w&&cy>=0&&cy<h?{x:cx,y:cy}:null;
 }
 clampCamera(){
  const c=this.$("#hubWorldCanvas");if(!c)return;
  const r=c.getBoundingClientRect(),scale=this.mapFit()*this.camera.zoom;
  const maxX=Math.max(0,(1440*scale-r.width)/2),maxY=Math.max(0,(720*scale-r.height)/2);
  this.camera.x=Math.max(-maxX,Math.min(maxX,this.camera.x));
  this.camera.y=Math.max(-maxY,Math.min(maxY,this.camera.y));
 }
 zoomMap(factor,x,y){
  const c=this.$("#hubWorldCanvas");if(!c)return;
  const r=c.getBoundingClientRect(),prev=this.camera.zoom,next=Math.max(1,Math.min(22,prev*factor));
  const anchorX=Number.isFinite(x)?x:r.width/2,anchorY=Number.isFinite(y)?y:r.height/2;
  this.camera.x+=(anchorX-r.width/2-this.camera.x)*(1-next/prev);
  this.camera.y+=(anchorY-r.height/2-this.camera.y)*(1-next/prev);
  this.camera.zoom=next;this.clampCamera();this.draw();
 }
 countryAt(lon,lat){
  const features=this.worldGeometry?.features;
  if(!features)return "";
  const inside=ring=>{
   let hit=false;
   for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];
    if((a[1]>lat)!==(b[1]>lat)&&lon<(b[0]-a[0])*(lat-a[1])/(b[1]-a[1])+a[0])hit=!hit;
   }
   return hit;
  };
  for(const feature of features){
   const g=feature.geometry,polys=g.type==="Polygon"?[g.coordinates]:g.type==="MultiPolygon"?g.coordinates:[];
   for(const rings of polys)if(inside(rings[0])&&!rings.slice(1).some(inside))return feature.properties?.name||"";
  }
  return "";
 }
 worldInfo(){
  const el=this.$("#hubWorldInfo"),w=this.world;if(!el)return;
  if(!this.tile||!w){el.innerHTML="<b>Planet Earth</b><small>Click land to inspect the territory. Drag to look around.</small>";return}
  const {x,y}=this.tile,i=y*w.width+x,owner=w.cells[i],structure=w.structures.find(a=>a.i===i)?.kind||"Unbuilt";
  const name=owner===-1?"Ocean":owner===""?"Unclaimed land":w.players.find(p=>p.id===owner)?.name||"Unknown empire";
  const lat=(90-(y+.5)*180/w.height).toFixed(1),lon=(-180+(x+.5)*360/w.width).toFixed(1),country=this.countryAt(Number(lon),Number(lat));
  el.innerHTML='<b>'+E(name)+'</b><small>'+(country?E(country)+' · ':'')+lat+'° N/S · '+lon+'° E/W<br>Structure: '+E(structure)+'<br>'+(owner===this.id?"Your territory":owner===-1?"Ships cannot land in open water.":"Attack any reachable landmass. Cross water from the coast.")+'</small>';
 }
 worldUpdate(){
  if(!this.world||this.view!=="world")return;
  const w=this.world,me=w.players.find(p=>p.id===this.id);
  if(me&&!this.worldActive){this.worldActive=true;this.worldQueueing=false;this.worldScreen();return}
  if(!me&&!this.worldActive){const count=this.$(".world-queue-status b");if(count)count.textContent=(w.queued||0)+" queued";return}
  if(!this.$("#hubWorldCanvas"))return;
  const set=(q,value)=>{const el=this.$(q);if(el)el.textContent=value};
  set("#hubLand",((me?.land||0)*100/(w.landTotal||1)).toFixed(2)+"%");
  set("#hubTroops",(me?.troops||0).toLocaleString());
  set("#hubGold",(me?.gold||0).toLocaleString());
  set("#hubNations",w.players.length);
  const legend=this.$("#hubWorldLegend");
  if(legend)legend.innerHTML='<strong>WORLD POWERS</strong>'+w.players.slice().sort((a,b)=>b.land-a.land).slice(0,10).map(p=>'<div><span style="background:'+E(p.color)+'"></span><label>'+E(p.name)+(p.bot?' <small>BOT</small>':'')+'</label><b>'+p.land.toLocaleString()+'</b></div>').join("");
  this.worldInfo();this.draw();
 }
 buildWorldSurface(w,detail){
  const W=w.width||360,H=w.height||180,tw=1440/W,th=720/H;
  const image=document.createElement("canvas");image.width=1440;image.height=720;
  const ctx=image.getContext("2d"),palette=new Map(w.players.map(p=>[p.id,p.color]));
  ctx.clearRect(0,0,1440,720);
  // Fill entire contiguous runs rather than painting 64,800 tiny squares.
  for(let y=0;y<H;y++)for(let x=0;x<W;){
   const owner=w.cells[y*W+x];if(owner===-1){x++;continue}
   let end=x+1;while(end<W&&w.cells[y*W+end]===owner)end++;
   ctx.fillStyle=palette.get(owner)||(["#9bb691","#b5c099","#c5c9a5","#9aaa7a"][(x*19+y*7)%4]);
   ctx.fillRect(x*tw,y*th,(end-x)*tw+.14,th+.14);x=end;
  }
  // Natural Earth political boundaries and detailed coastlines.
  if(this.worldGeometry?.features){
   ctx.lineWidth=.65;ctx.strokeStyle="#142d3799";
   for(const feature of this.worldGeometry.features){
    const g=feature.geometry,polys=g.type==="Polygon"?[g.coordinates]:g.type==="MultiPolygon"?g.coordinates:[];
    ctx.beginPath();
    for(const poly of polys)for(const ring of poly){
     let prev=null;
     for(const p of ring){
      const px=(p[0]+180)*4,py=(90-p[1])*4;
      if(!prev||Math.abs(px-prev[0])>700)ctx.moveTo(px,py);else ctx.lineTo(px,py);
      prev=[px,py];
     }
    }
    ctx.stroke();
   }
  }
  if(detail){
   ctx.strokeStyle="#102d3e95";ctx.lineWidth=.4;
   for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const i=y*W+x,owner=w.cells[i];if(owner===-1)continue;
    if(x<W-1&&w.cells[i+1]!==owner){ctx.beginPath();ctx.moveTo((x+1)*tw,y*th);ctx.lineTo((x+1)*tw,(y+1)*th);ctx.stroke()}
    if(y<H-1&&w.cells[i+W]!==owner){ctx.beginPath();ctx.moveTo(x*tw,(y+1)*th);ctx.lineTo((x+1)*tw,(y+1)*th);ctx.stroke()}
   }
  }
  if(detail)for(const s of w.structures.slice(0,500)){
   const x=s.i%W,y=Math.floor(s.i/W);
   ctx.fillStyle="#132833";ctx.font="bold 8px sans-serif";ctx.textAlign="center";
   ctx.fillText(({city:"⌂",factory:"⚒",port:"⚓",fort:"◆"})[s.kind]||"·",(x+.5)*tw,(y+.7)*th);
  }
  const centroids=new Map(w.players.map(p=>[p.id,{x:0,y:0,n:0}]));
  for(let i=0;i<w.cells.length;i++){
   const entry=centroids.get(w.cells[i]);
   if(entry){entry.x+=(i%W+.5)*tw;entry.y+=(Math.floor(i/W)+.5)*th;entry.n++}
  }
  this.worldSurface={data:w,geometry:this.worldGeometry,detail,image,centroids};
 }
 draw(){
  const c=this.$("#hubWorldCanvas"),w=this.world;
  if(!c||!w||this.view!=="world")return;
  const r=c.getBoundingClientRect();if(!r.width||!r.height)return;
  const dpr=Math.min(window.devicePixelRatio||1,2),pw=Math.floor(r.width*dpr),ph=Math.floor(r.height*dpr);
  if(c.width!==pw||c.height!==ph){c.width=pw;c.height=ph}
  const detail=this.camera.zoom>3,cache=this.worldSurface;
  if(!cache||cache.data!==w||cache.geometry!==this.worldGeometry||cache.detail!==detail)this.buildWorldSurface(w,detail);
  const ctx=c.getContext("2d",{alpha:false}),scale=this.mapFit()*this.camera.zoom;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  const ocean=ctx.createLinearGradient(0,0,0,r.height);
  ocean.addColorStop(0,"#142e43");ocean.addColorStop(.5,"#204c67");ocean.addColorStop(1,"#0f2b40");
  ctx.fillStyle=ocean;ctx.fillRect(0,0,r.width,r.height);
  this.clampCamera();
  const originX=r.width/2+this.camera.x,originY=r.height/2+this.camera.y;
  ctx.translate(originX,originY);ctx.scale(scale,scale);ctx.translate(-720,-360);
  ctx.fillStyle="#22536c";ctx.fillRect(0,0,1440,720);
  ctx.drawImage(this.worldSurface.image,0,0);
  if(this.tile){
   const tw=1440/w.width,th=720/w.height,{x,y}=this.tile;
   ctx.strokeStyle="#fff4a3";ctx.lineWidth=Math.max(.6,2/scale);
   ctx.strokeRect(x*tw+.15,y*th+.15,tw-.3,th-.3);
  }
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.font="700 11px system-ui";ctx.textAlign="center";ctx.lineWidth=3;
  for(const p of w.players){
   const entry=this.worldSurface.centroids.get(p.id);
   if(!entry?.n)continue;
   const x=originX+((entry.x/entry.n)-720)*scale,y=originY+((entry.y/entry.n)-360)*scale;
   if(x<0||y<0||x>r.width||y>r.height)continue;
   ctx.strokeStyle="#122534";ctx.strokeText(p.name,x,y);
   ctx.fillStyle="#fff4d6";ctx.fillText(p.name,x,y);
  }
  const indicator=this.$("#hubZoom");if(indicator)indicator.textContent=Math.round(this.camera.zoom*100)+"%";
 }
 act(action,button){
  if(action==="close")return this.close();
  if(action==="newDm"){this.show("inbox");this.$("#hubNewDmId")?.focus();return}
  if(action==="dmOpen")return this.openDm(button.dataset.peer);
  if(action==="reactMenu"){
   this.reactionPicker=this.reactionPicker===button.dataset.id?null:button.dataset.id;
   if(this.view==="dm")this.dmMessages();else if(this.view==="chat")this.messages();
   return;
  }
  if(action==="react"||action==="deleteMsg"){
   const scope=button.dataset.peer?{peer:button.dataset.peer}:{channel:button.dataset.channel};
   if(action==="deleteMsg"){
    if(!confirm("Delete this message for everyone?"))return;
    return this.send({type:"socialDelete",id:button.dataset.id,...scope});
   }
   this.reactionPicker=null;
   return this.send({type:"socialReact",id:button.dataset.id,emoji:button.dataset.emoji,...scope});
  }
  if(action==="copyUser"){
    if(navigator.clipboard?.writeText)navigator.clipboard.writeText(button.dataset.id).then(()=>this.flash("Player ID copied")).catch(()=>this.flash("Copy isn't available"));
    else this.flash("Your browser doesn't allow copying here.");
    return;
  }
  if(action==="back")return this.show("games");
  if(action==="chessView"){if(!this.chess?.over)this.chess=this.chess||null;else this.chess=null;return this.show("chess")}
  if(action==="rpsView"){if(!this.rps?.result)this.rps=this.rps||null;else this.rps=null;return this.show("rps")}
  if(action==="worldView"){this.worldActive=false;this.worldQueueing=false;this.world=null;this.camera={zoom:1,x:0,y:0};return this.show("world")};
  if(action==="chessBot"){this.chess=null;return this.send({type:"chessBot"})}
  if(action==="rpsBot"){this.rps=null;return this.send({type:"rpsBot"})}
  if(action==="chessQueue"||action==="rpsQueue")return this.send({type:"queue",game:action==="chessQueue"?"chess":"rps"});
  if(action==="tournament")return this.send({type:"tournamentJoin"});
  if(action==="chessDuel"||action==="rpsDuel"){const target=this.$("#hubDuelId")?.value.trim();if(!target)return this.flash("Enter an opponent user ID.");return this.send({type:"duel",game:action==="chessDuel"?"chess":"rps",target})}
  if(action==="square"){
   const g=this.chess;
   if(!g||g.over)return;
   if(g.turn!==g.color)return this.flash("Wait for your opponent.");
   const sq=button.dataset.square,legal=g.legal||[];
   if(this.selectedSquare===sq){this.selectedSquare=null;return this.chessScreen()}
   if(this.selectedSquare&&legal.some(m=>m.from===this.selectedSquare&&m.to===sq)){
    const from=this.selectedSquare;this.selectedSquare=null;
    this.send({type:"chessMove",id:g.id,from,to:sq,promotion:"q"});
    return this.chessScreen();
   }
   if(legal.some(m=>m.from===sq)){this.selectedSquare=sq;return this.chessScreen()}
   this.flash("Select your piece, then a highlighted square.");
  }
  if(action==="rpsPick")return this.send({type:"rpsChoice",id:this.rps?.id,choice:button.dataset.choice});
  if(action==="worldQueue"){this.worldQueueing=true;this.worldScreen();if(!this.send({type:"worldQueue"})){this.worldQueueing=false;this.worldScreen()}return}
  if(action==="worldCancel"){this.worldQueueing=false;this.worldScreen();return this.send({type:"worldCancel"})}
  if(action==="zoomIn")return this.zoomMap(1.45);
  if(action==="zoomOut")return this.zoomMap(1/1.45);
  if(action==="centerMap"){this.camera={zoom:1,x:0,y:0};return this.draw()}
  if(["attack","build","nuke","ally"].includes(action)){
   if(!this.tile)return this.flash("Select a territory on the map first.");
   const {x,y}=this.tile;
   const owner=this.world?.cells[y*(this.world?.width||360)+x];
   return this.send({type:"worldAction",action:action==="attack"?"attack":action==="nuke"?"nuke":action==="ally"?"alliance":"build",x,y,kind:button.dataset.kind,target:owner,ratio:Number(this.$("#hubRatio")?.value)||.25});
  }
 }
}
installArenaPolish(Hub);
export function openHub(view="chat"){
 const root=document.getElementById("hubMount");if(!root)return;
 if(!document.getElementById("lightningHubCss")){
  const css=document.createElement("link");css.id="lightningHubCss";css.rel="stylesheet";css.href="/assets/hub.css?v=4";document.head.append(css);
   const arena=document.createElement("link");arena.id="lightningArenaCss";arena.rel="stylesheet";arena.href="/assets/arena-v3.css?v=2";document.head.append(arena);
 }
 if(!INSTANCE)INSTANCE=new Hub(root);
 INSTANCE.open(view);
}
export function bootHubNotifications(){
 const root=document.getElementById("hubMount");
 if(!root)return;
 if(!INSTANCE)INSTANCE=new Hub(root);
 INSTANCE.connect();
}
