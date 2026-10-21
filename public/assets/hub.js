
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
  this.root=root;this.view="chat";this.channel="general";this.name="";this.id="";this.users=[];this.history={};this.summary={users:0};this.socket=null;this.active=false;this.chess=null;this.rps=null;this.world=null;this.tile=null;this.selectedSquare=null;
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
  ws.addEventListener("open",()=>{this.$("#hubConnection").textContent="Connected";});
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
  else if(m.type==="chessStart"){this.chess={...m,turn:"w",over:false};this.selectedSquare=null;this.view="chess";this.render()}
  else if(m.type==="chessState"){if(this.chess?.id===m.id){Object.assign(this.chess,m);this.selectedSquare=null;if(this.view==="chess")this.chessScreen();if(m.over)this.flash(m.result||"Game over")}}
  else if(m.type==="rpsStart"){this.rps={...m,waiting:false,result:null};this.view="rps";this.render()}
  else if(m.type==="rpsWaiting"){if(this.rps?.id===m.id){this.rps.waiting=true;if(this.view==="rps")this.rpsScreen()}}
  else if(m.type==="rpsResult"){if(this.rps?.id===m.id){this.rps.result=m;if(this.view==="rps")this.rpsScreen()}}
  else if(m.type==="tournamentJoined")this.flash("Tournament: "+m.players+"/4 players joined");
  else if(m.type==="tournamentStarted")this.flash("Tournament has started!");
  else if(m.type==="tournamentWinner")this.flash("Tournament won by "+m.winner);
  else if(m.type==="world"){this.world=m;if(this.view==="world")this.worldUpdate()}
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
  el.innerHTML=this.users.map(u=>'<div class="hub-member" title="Player ID: '+E(u.id)+'"><span class="hub-statusdot"></span>'+E(u.name)+'</div>').join("")||'<p class="hub-footer">Connecting…</p>';
 }
 games(){
  this.header("Games","Live multiplayer arcade");
  this.$("#hubContent").innerHTML='<section class="hub-games"><div class="hub-games-head"><span class="hub-label">PLAY WITH LIGHTNING</span><h2>Pick your arena.</h2><p>Queue for a live match or challenge another member. No downloads required.</p></div><div class="hub-game-grid">'+[
    ["♞","Chess","Real-time chess. Legal moves and turns are verified by the server.","chessView","Queue • Duel"],
    ["✊","Rock Paper Scissors","Fast 1v1 duels, hidden choices and four-player tournaments.","rpsView","Queue • Tournaments"],
    ["◈","WorldPvP","Grow your nation, build, defend and take control of the world.","worldView","Realtime • Alpha"]
  ].map(x=>'<article class="hub-game-card"><div><div class="hub-game-icon">'+x[0]+'</div><h3>'+x[1]+'</h3><p>'+x[2]+'</p></div><div><small>'+x[4]+'</small><br><button class="hub-btn primary" data-act="'+x[3]+'">Play now ↗</button></div></article>').join("")+'</div></section>';
 }
 updates(){
  this.header("Update log","Lightning 2.0 — Alpha");
  this.$("#hubContent").innerHTML='<section class="hub-games"><div class="hub-news"><span class="hub-label">PATCH NOTES</span><h1>What changed.</h1>'+UPDATES.map(u=>'<article><h3>'+E(u[0])+'</h3><p>'+E(u[1])+'</p></article>').join("")+'</div></section>';
 }
 chessScreen(){
  this.header("Chess","Server-validated multiplayer");
  const host=this.$("#hubContent"),g=this.chess;
  if(!g){
   host.innerHTML='<div class="hub-game-area"><span class="hub-label">STRATEGY / CLASSIC</span><h2>Chess</h2><p>Queue for a player or paste an online player ID to challenge them.</p><div class="hub-actions"><button class="hub-btn primary" data-act="chessQueue">Find match</button><input id="hubDuelId" placeholder="Opponent user ID"><button class="hub-btn" data-act="chessDuel">Duel player</button></div><button class="hub-btn" data-act="back">← All games</button></div>';return
  }
  const board=g.fen.split(" ")[0].split("/").map(row=>{
   const cells=[];for(const ch of row)if(/[1-8]/.test(ch))for(let i=0;i<Number(ch);i++)cells.push("");else cells.push(ch);
   return cells;
  });
  const order=g.color==="b"?[7,6,5,4,3,2,1,0]:[0,1,2,3,4,5,6,7];
  let squares="";
  for(const y of order)for(const x of order){
   const sq="abcdefgh"[x]+(8-y),p=board[y]?.[x]||"";
   squares+='<button class="hub-square '+((x+y)%2?"dark":"light")+(this.selectedSquare===sq?" selected":"")+'" data-act="square" data-square="'+sq+'" title="'+sq+'">'+(PIECES[p]||"")+'</button>';
  }
  host.innerHTML='<section class="hub-game-area"><span class="hub-label">MATCH · '+E(g.id)+'</span><h2>Chess</h2><p>You are '+(g.color==="w"?"White":"Black")+'. '+(g.over?E(g.result||"Game over"):g.turn===g.color?"Your turn":"Opponent’s turn")+'</p><div class="hub-chess">'+squares+'</div><div class="hub-actions"><button class="hub-btn" data-act="back">← All games</button><span class="hub-pill">'+E(g.last||"Opening")+'</span></div></section>';
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
  this.header("WorldPvP","Realtime territory conquest · Alpha");
  this.$("#hubContent").innerHTML="";
  this.$("#hubWorld").innerHTML='<div class="hub-world-top"><div class="hub-world-stat"><span>LAND</span><b id="hubLand">0%</b></div><div class="hub-world-stat"><span>TROOPS</span><b id="hubTroops">0</b></div><div class="hub-world-stat"><span>GOLD</span><b id="hubGold">0</b></div><div class="hub-world-stat"><span>NATIONS</span><b id="hubNations">0</b></div><span class="hub-spacer"></span><button class="hub-btn" data-act="worldJoin">Join</button><button class="hub-btn" data-act="back">← Arcade</button></div><div class="hub-world-stage"><canvas id="hubWorldCanvas"></canvas><div id="hubWorldInfo" class="hub-world-tooltip"><b>WorldPvP</b><small>Choose a territory to scout.</small></div><div id="hubWorldLegend" class="hub-world-legend">NATIONS</div><div class="hub-tip">Claim connected land. Build up troops and use the action bar to expand.</div><div class="hub-world-bottom"><span class="hub-label">COMMIT</span><select id="hubRatio" aria-label="Army commitment"><option value=".1">10%</option><option value=".25" selected>25%</option><option value=".5">50%</option><option value=".75">75%</option></select><button class="hub-btn primary" data-act="attack">⚔ Attack</button><button class="hub-btn" data-act="build" data-kind="city">⌂ City</button><button class="hub-btn" data-act="build" data-kind="factory">⚒ Factory</button><button class="hub-btn" data-act="build" data-kind="port">⚓ Port</button><button class="hub-btn" data-act="build" data-kind="fort">⬟ Fort</button><button class="hub-btn" data-act="nuke">☢ Nuke</button></div></div>';
  const canvas=this.$("#hubWorldCanvas");
  canvas.addEventListener("click",e=>{
   const r=canvas.getBoundingClientRect();
   this.tile={x:Math.max(0,Math.min(63,Math.floor((e.clientX-r.left)/r.width*64))),y:Math.max(0,Math.min(31,Math.floor((e.clientY-r.top)/r.height*32)))};
   this.worldInfo();this.draw();
  });
  this.send({type:"worldJoin"});this.worldUpdate();
 }
 worldInfo(){
  const el=this.$("#hubWorldInfo");if(!el)return;
  if(!this.tile||!this.world){el.innerHTML="<b>WorldPvP</b><small>Click a region to inspect it.</small>";return}
  const {x,y}=this.tile,i=y*64+x,owner=this.world.cells[i],kind=this.world.structures.find(a=>a.i===i)?.kind||"None";
  const name=owner===-1?"Ocean":owner===""?"Neutral territory":this.world.players.find(p=>p.id===owner)?.name||"Tribe";
  el.innerHTML='<b>'+E(name)+'</b><small>Region '+x+', '+y+'<br>Building: '+E(kind)+'</small>';
 }
 worldUpdate(){
  if(!this.world||this.view!=="world")return;
  const w=this.world,me=w.players.find(p=>p.id===this.id);
  const set=(q,t)=>{const el=this.$(q);if(el)el.textContent=t};
  set("#hubLand",((me?.land||0)*100/(w.landTotal||1)).toFixed(1)+"%");
  set("#hubTroops",(me?.troops||0).toLocaleString());
  set("#hubGold",(me?.gold||0).toLocaleString());
  set("#hubNations",w.players.length);
  const legend=this.$("#hubWorldLegend");
  if(legend)legend.innerHTML='<strong>NATIONS</strong>'+w.players.slice(0,10).map(p=>'<div><span style="background:'+E(p.color)+'"></span>'+E(p.name)+' — '+p.land+'</div>').join("");
  this.worldInfo();this.draw();
 }
 draw(){
  const c=this.$("#hubWorldCanvas"),w=this.world;
  if(!c||!w||this.view!=="world")return;
  const rect=c.getBoundingClientRect();if(!rect.width||!rect.height)return;
  const ratio=Math.min(window.devicePixelRatio||1,2),width=Math.floor(rect.width*ratio),height=Math.floor(rect.height*ratio);
  if(c.width!==width||c.height!==height){c.width=width;c.height=height}
  const ctx=c.getContext("2d",{alpha:false}),tw=width/64,th=height/32;
  ctx.fillStyle="#417ba0";ctx.fillRect(0,0,width,height);
  const palette=new Map(w.players.map(p=>[p.id,p.color]));
  for(let y=0;y<32;y++)for(let x=0;x<64;x++){
   const id=y*64+x,owner=w.cells[id];if(owner===-1)continue;
   ctx.fillStyle=palette.get(owner)||(["#bcd19a","#d4d5a7","#ebdfb1","#d6bd84"][(x*19+y*7)%4]);
   ctx.fillRect(x*tw,y*th,tw+.25,th+.25);
  }
  ctx.lineWidth=Math.max(.7,Math.min(tw,th)*.12);
  for(let y=0;y<32;y++)for(let x=0;x<64;x++){
   const id=y*64+x,o=w.cells[id];if(o===-1)continue;
   ctx.strokeStyle=o?"#303137ae":"#78734d50";
   if(x<63&&w.cells[id+1]!==o){ctx.beginPath();ctx.moveTo((x+1)*tw,y*th);ctx.lineTo((x+1)*tw,(y+1)*th);ctx.stroke()}
   if(y<31&&w.cells[id+64]!==o){ctx.beginPath();ctx.moveTo(x*tw,(y+1)*th);ctx.lineTo((x+1)*tw,(y+1)*th);ctx.stroke()}
  }
  for(const s of w.structures){
   const x=s.i%64,y=Math.floor(s.i/64);
   ctx.fillStyle="#11283b";ctx.font="bold "+Math.max(8,Math.floor(th*.75))+"px system-ui";ctx.textAlign="center";
   ctx.fillText(({city:"⌂",factory:"⚒",port:"⚓",fort:"⬟"})[s.kind]||"•",(x+.5)*tw,(y+.8)*th);
  }
  for(const p of w.players){
   let x=0,y=0,n=0;
   for(let i=0;i<w.cells.length;i++)if(w.cells[i]===p.id){x+=(i%64+.5)*tw;y+=(Math.floor(i/64)+.5)*th;n++}
   if(n){ctx.textAlign="center";ctx.font="bold "+Math.max(9,Math.min(14,Math.floor(th*.9)))+"px system-ui";
    ctx.lineWidth=3;ctx.strokeStyle="#183144";ctx.strokeText(p.name,x/n,y/n);ctx.fillStyle="#fff6d3";ctx.fillText(p.name,x/n,y/n)}
  }
  if(this.tile){const {x,y}=this.tile;ctx.strokeStyle="#ffeb97";ctx.lineWidth=3;ctx.strokeRect(x*tw+1,y*th+1,tw-2,th-2)}
 }
 act(action,button){
  if(action==="close")return this.close();
  if(action==="back")return this.show("games");
  if(action==="chessView"){this.chess=null;return this.show("chess")}
  if(action==="rpsView"){this.rps=null;return this.show("rps")}
  if(action==="worldView")return this.show("world");
  if(action==="chessQueue"||action==="rpsQueue")return this.send({type:"queue",game:action==="chessQueue"?"chess":"rps"});
  if(action==="tournament")return this.send({type:"tournamentJoin"});
  if(action==="chessDuel"||action==="rpsDuel"){const target=this.$("#hubDuelId")?.value.trim();if(!target)return this.flash("Enter an opponent user ID.");return this.send({type:"duel",game:action==="chessDuel"?"chess":"rps",target})}
  if(action==="square"){
   if(!this.chess||this.chess.over)return;
   const square=button.dataset.square;
   if(!this.selectedSquare){this.selectedSquare=square;return this.chessScreen()}
   if(this.selectedSquare!==square)this.send({type:"chessMove",id:this.chess.id,from:this.selectedSquare,to:square});
   this.selectedSquare=null;return this.chessScreen();
  }
  if(action==="rpsPick")return this.send({type:"rpsChoice",id:this.rps?.id,choice:button.dataset.choice});
  if(action==="worldJoin")return this.send({type:"worldJoin"});
  if(["attack","build","nuke"].includes(action)){
   if(!this.tile)return this.flash("Select a territory on the map first.");
   const {x,y}=this.tile;
   return this.send({type:"worldAction",action:action==="attack"?"attack":action==="nuke"?"nuke":"build",x,y,kind:button.dataset.kind,ratio:Number(this.$("#hubRatio")?.value)||.25});
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
