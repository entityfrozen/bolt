
const E=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
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
  this.root=root;this.view="chat";this.channel="general";this.name="";this.id="";this.users=[];this.history={};this.summary={users:0};this.socket=null;this.active=false;this.chess=null;this.rps=null;this.world=null;this.tile=null;this.selectedSquare=null;this.worldQueueing=false;this.worldActive=false;this.worldGeometry=null;this.camera={zoom:1,x:0,y:0};this.pointers=new Map();
  root.innerHTML='<div class="hub-shell"><aside class="hub-rail"><div class="hub-logo"><span class="hub-label">LIGHTNING NETWORK</span><strong>Social hub.</strong><small>Your space. Your people.</small></div><nav class="hub-nav"><div class="hub-nav-title">CHANNELS</div>'+
   ["general","games","suggestions","support"].map(c=>'<button class="hub-link" data-view="chat" data-channel="'+c+'"><i>#</i><span>'+c+'</span></button>').join("")+
   '<div class="hub-nav-title">EXPLORE</div><button class="hub-link" data-view="games"><i>♞</i><span>Multiplayer games</span></button><button class="hub-link" data-view="updates"><i>↗</i><span>Update log</span></button></nav><div class="hub-user"><div class="hub-avatar" id="hubAvatar">L</div><div><strong id="hubUsername">Lightning user</strong><span id="hubConnection">Connecting…</span></div></div></aside>'+
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
  ws.addEventListener("close",()=>{if(this.socket!==ws)return;this.$("#hubConnection").textContent="Offline";if(this.active)setTimeout(()=>this.connect(),2300)});
 }
 onMessage(m){
  if(m.type==="hello"){
   this.id=m.id;this.name=m.name;this.history=m.history||{};this.users=m.online||[];this.summary=m.summary||{};
   this.$("#hubUsername").textContent=this.name;this.$("#hubAvatar").textContent=this.name[0]?.toUpperCase()||"L";this.presence();
   if(this.view==="chat")this.chat();
  }else if(m.type==="presence"){
   this.summary=m;if(m.online)this.users=m.online;this.presence();if(this.view==="chat")this.members();
  }else if(m.type==="chat"){
   if(m.entry){(this.history[m.entry.channel]??=[]).push(m.entry);if(m.entry.channel===this.channel&&this.view==="chat")this.messages()}
  }else if(m.type==="queued")this.flash("Queued for "+m.game+". Waiting for an opponent.");
  else if(m.type==="chessStart"){this.chess={...m,turn:m.turn||"w",over:false};this.selectedSquare=null;this.view="chess";this.render()}
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
 close(){this.active=false;this.root.hidden=true;if(this.socket){this.socket.close();this.socket=null}}
 show(page,channel){
  this.view=page;if(channel)this.channel=channel;this.render();
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
  else if(this.view==="games")this.games();
  else if(this.view==="updates")this.updates();
  else if(this.view==="chess")this.chessScreen();
  else if(this.view==="rps")this.rpsScreen();
  else if(this.view==="world")this.worldScreen();
 }
 chat(){
  this.header("# "+this.channel,"Live community · "+this.channel);
  this.$("#hubContent").innerHTML='<div class="hub-main"><div class="hub-chat-stream" id="hubMessages"></div><div class="hub-composer"><form id="hubChatForm" class="hub-compose-form"><input id="hubChatInput" maxlength="1000" autocomplete="off" placeholder="'+E(this.channel==="suggestions"?"Your idea for Lightning…":"Message #"+this.channel)+'"><button class="hub-btn primary">Send ↗</button></form><div class="hub-footer">Your messages are visible to everyone in this channel.</div></div></div><aside class="hub-members"><span class="hub-label">ONLINE</span><div id="hubMembers"></div></aside>';
  this.$("#hubChatForm").addEventListener("submit",e=>{
   e.preventDefault();const input=this.$("#hubChatInput"),msg=input.value.trim();
   if(msg&&this.send({type:"chat",channel:this.channel,message:msg}))input.value="";
  });
  this.messages();this.members();
 }
 messages(){
  const el=this.$("#hubMessages");if(!el)return;
  const intro=this.channel==="suggestions"?"Post the features you want Lightning to build next.":"This is the start of the "+this.channel+" channel.";
  el.innerHTML='<div class="hub-chat-welcome"><strong>Welcome to #'+E(this.channel)+'</strong><p>'+E(intro)+'</p></div>'+
   (this.history[this.channel]||[]).slice(-120).map(m=>'<div class="hub-chat-line"><span class="hub-chat-avatar">'+E(m.by?.slice(0,1).toUpperCase()||"?")+'</span><div><div class="hub-chat-top"><strong>'+E(m.by)+'</strong><time>'+new Date(m.at).toLocaleString()+'</time></div><p>'+E(m.message)+'</p></div></div>').join("");
  el.scrollTop=el.scrollHeight;
 }
 members(){
  const el=this.$("#hubMembers");if(!el)return;
  el.innerHTML=this.users.map(u=>'<div class="hub-member"><span class="hub-statusdot"></span>'+E(u.name)+'<button class="hub-member-copy" type="button" title="Copy player ID" data-act="copyUser" data-id="'+E(u.id)+'">⧉</button></div>').join("")||'<p class="hub-footer">Connecting…</p>';
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
  this.header("Rock Paper Scissors","Quick rounds & tournaments");
  const g=this.rps,host=this.$("#hubContent");
  if(!g){
   host.innerHTML='<section class="hub-game-area"><span class="hub-label">QUICK MATCH</span><h2>Rock. Paper. Scissors.</h2><p>Choose secretly, then reveal at the same time.</p><div class="hub-actions"><button class="hub-btn primary" data-act="rpsQueue">Find opponent</button><button class="hub-btn" data-act="tournament">Join 4-player tournament</button></div><div class="hub-actions"><input id="hubDuelId" placeholder="Opponent user ID"><button class="hub-btn" data-act="rpsDuel">Duel player</button></div><button class="hub-btn" data-act="back">← All games</button></section>';return
  }
  const result=g.result;
  host.innerHTML='<section class="hub-game-area"><span class="hub-label">MATCH · '+E(g.id)+'</span><h2>'+(result?result.tie?"Tie round":result.winner===this.id?"You win":"You lose":"Choose your move")+'</h2><p>'+(result?E(Object.entries(result.choices).map(([k,v])=>(k===this.id?"You":"Opponent")+": "+v).join(" • ")):g.waiting?"Waiting for your opponent…":"Both players select a move in secret.")+'</p><div class="hub-rps-choices">'+["rock","paper","scissors"].map((v,i)=>'<button class="hub-btn '+(!g.waiting&&!result?"primary":"")+'" data-act="rpsPick" data-choice="'+v+'" '+(g.waiting||result?"disabled":"")+'> '+["✊","✋","✌️"][i]+" "+v+'</button>').join("")+'</div><div class="hub-actions"><button class="hub-btn" data-act="back">← All games</button></div></section>';
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
 worldInfo(){
  const el=this.$("#hubWorldInfo"),w=this.world;if(!el)return;
  if(!this.tile||!w){el.innerHTML="<b>Planet Earth</b><small>Click land to inspect the territory. Drag to look around.</small>";return}
  const {x,y}=this.tile,i=y*w.width+x,owner=w.cells[i],structure=w.structures.find(a=>a.i===i)?.kind||"Unbuilt";
  const name=owner===-1?"Ocean":owner===""?"Unclaimed land":w.players.find(p=>p.id===owner)?.name||"Unknown empire";
  const lat=(90-(y+.5)*180/w.height).toFixed(1),lon=(-180+(x+.5)*360/w.width).toFixed(1);
  el.innerHTML='<b>'+E(name)+'</b><small>'+lat+'° N/S · '+lon+'° E/W<br>Structure: '+E(structure)+'<br>'+(owner===this.id?"Your territory":owner===-1?"Ships cannot land in open water.":"Attack any reachable landmass. Cross water from the coast.")+'</small>';
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
 draw(){
  const c=this.$("#hubWorldCanvas"),w=this.world;
  if(!c||!w||this.view!=="world")return;
  const r=c.getBoundingClientRect();if(!r.width||!r.height)return;
  const dpr=Math.min(window.devicePixelRatio||1,2),pw=Math.floor(r.width*dpr),ph=Math.floor(r.height*dpr);
  if(c.width!==pw||c.height!==ph){c.width=pw;c.height=ph}
  const ctx=c.getContext("2d",{alpha:false}),scale=this.mapFit()*this.camera.zoom;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  const ocean=ctx.createLinearGradient(0,0,0,r.height);ocean.addColorStop(0,"#142e43");ocean.addColorStop(.5,"#204c67");ocean.addColorStop(1,"#0f2b40");
  ctx.fillStyle=ocean;ctx.fillRect(0,0,r.width,r.height);
  this.clampCamera();
  ctx.translate(r.width/2+this.camera.x,r.height/2+this.camera.y);
  ctx.scale(scale,scale);ctx.translate(-720,-360);
  ctx.fillStyle="#21516b";ctx.fillRect(0,0,1440,720);
  const W=w.width||360,H=w.height||180,tw=1440/W,th=720/H,palette=new Map(w.players.map(p=>[p.id,p.color]));
  for(let y=0;y<H;y++){
   for(let x=0;x<W;){
    const owner=w.cells[y*W+x];if(owner===-1){x++;continue}
    let end=x+1;while(end<W&&w.cells[y*W+end]===owner)end++;
    ctx.fillStyle=palette.get(owner)||(["#9bb691","#b5c099","#c5c9a5","#9aaa7a"][(x*19+y*7)%4]);
    ctx.fillRect(x*tw,y*th,(end-x)*tw+.12,th+.15);x=end;
   }
  }
  // Country borders and coastlines are traced from real Natural Earth polygons.
  if(this.worldGeometry?.features){
   ctx.lineWidth=Math.max(.25,1.05/scale);ctx.strokeStyle="#173447a8";
   for(const feature of this.worldGeometry.features){
    const g=feature.geometry,polys=g.type==="Polygon"?[g.coordinates]:g.type==="MultiPolygon"?g.coordinates:[];
    ctx.beginPath();
    for(const poly of polys)for(const ring of poly){
     let prev=null;for(const p of ring){
      const px=(p[0]+180)*4,py=(90-p[1])*4;
      if(!prev||Math.abs(px-prev[0])>700)ctx.moveTo(px,py);
      else ctx.lineTo(px,py);
      prev=[px,py];
     }
    }
    ctx.stroke();
   }
  }
  if(this.camera.zoom>3){
   ctx.strokeStyle="#0a263780";ctx.lineWidth=.35;
   for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const i=y*W+x,o=w.cells[i];if(o===-1)continue;
    if(x<W-1&&w.cells[i+1]!==o){ctx.beginPath();ctx.moveTo((x+1)*tw,y*th);ctx.lineTo((x+1)*tw,(y+1)*th);ctx.stroke()}
    if(y<H-1&&w.cells[i+W]!==o){ctx.beginPath();ctx.moveTo(x*tw,(y+1)*th);ctx.lineTo((x+1)*tw,(y+1)*th);ctx.stroke()}
   }
  }
  if(this.camera.zoom>2)for(const s of w.structures.slice(0,500)){
   const x=s.i%W,y=Math.floor(s.i/W);
   ctx.fillStyle="#152b34";ctx.font="bold 8px sans-serif";ctx.textAlign="center";
   ctx.fillText(({city:"⌂",factory:"⚒",port:"⚓",fort:"◆"})[s.kind]||"·",(x+.5)*tw,(y+.7)*th);
  }
  const centroids=new Map(w.players.map(p=>[p.id,{x:0,y:0,n:0}]));
  for(let i=0;i<w.cells.length;i++){const a=centroids.get(w.cells[i]);if(a){a.x+=(i%W+.5)*tw;a.y+=(Math.floor(i/W)+.5)*th;a.n++}}
  for(const p of w.players){
   const o=centroids.get(p.id);if(!o?.n)continue;
   const x=o.x/o.n,y=o.y/o.n;
   ctx.textAlign="center";ctx.font="bold "+Math.max(9,11/Math.sqrt(scale))+"px system-ui";
   ctx.lineWidth=3;ctx.strokeStyle="#172b36";ctx.strokeText(p.name,x,y);
   ctx.fillStyle="#fff7df";ctx.fillText(p.name,x,y);
  }
  if(this.tile){const {x,y}=this.tile;ctx.strokeStyle="#fff3a1";ctx.lineWidth=Math.max(1,2/scale);ctx.strokeRect(x*tw+.1,y*th+.1,tw-.2,th-.2)}
  const indicator=this.$("#hubZoom");if(indicator)indicator.textContent=Math.round(this.camera.zoom*100)+"%";
 }
 act(action,button){
  if(action==="close")return this.close();
  if(action==="copyUser"){
    if(navigator.clipboard?.writeText)navigator.clipboard.writeText(button.dataset.id).then(()=>this.flash("Player ID copied")).catch(()=>this.flash("Copy isn't available"));
    else this.flash("Your browser doesn't allow copying here.");
    return;
  }
  if(action==="back")return this.show("games");
  if(action==="chessView"){this.chess=null;return this.show("chess")}
  if(action==="rpsView"){this.rps=null;return this.show("rps")}
  if(action==="worldView")return this.show("world");
  if(action==="chessBot"){this.chess=null;return this.send({type:"chessBot"})}
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
  if(action==="worldJoin")return this.send({type:"worldJoin"});
  if(["attack","build","nuke","ally"].includes(action)){
   if(!this.tile)return this.flash("Select a territory on the map first.");
   const {x,y}=this.tile;
   const owner=this.world?.cells[y*64+x];
   return this.send({type:"worldAction",action:action==="attack"?"attack":action==="nuke"?"nuke":action==="ally"?"alliance":"build",x,y,kind:button.dataset.kind,target:owner,ratio:Number(this.$("#hubRatio")?.value)||.25});
  }
 }
}
export function openHub(view="chat"){
 const root=document.getElementById("hubMount");if(!root)return;
 if(!document.getElementById("lightningHubCss")){
  const css=document.createElement("link");css.id="lightningHubCss";css.rel="stylesheet";css.href="/assets/hub.css?v=1";document.head.append(css);
 }
 if(!INSTANCE)INSTANCE=new Hub(root);
 INSTANCE.open(view);
}
