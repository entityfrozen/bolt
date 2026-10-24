import {createSoccer} from "./pixel-soccer.js?v=1";
import {createBasketball} from "./pixel-basketball.js?v=1";

const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const sports=new Set(["pixelSoccer","pixelBasketball"]);
const catalog=[
 {id:"pixelBasketball",category:"pixel",title:"PIXEL BASKETBALL",tag:"NEW · SOLO VS CPU",kind:"basketball",desc:"Buzzer beaters. Crossovers. Perfect arcs. One tiny court, major competition.",call:"sportsOpen"},
 {id:"pixelSoccer",category:"pixel",title:"PIXEL SOCCER",tag:"NEW · SOLO VS CPU",kind:"soccer",desc:"Own the pitch. Break past defenders, tackle, and bury the winning goal.",call:"sportsOpen"},
 {id:"world",category:"strategy",title:"WORLD PVP",tag:"ONLINE · OPENFRONT",kind:"world",desc:"Claim a starting point, command your armies and conquer the entire world.",call:"worldView"},
 {id:"chess",category:"strategy",title:"CHESS CLUB",tag:"ONLINE · BOT PRACTICE",kind:"chess",desc:"Find a rival, challenge a friend, or outplay the built-in chess AI.",call:"chessView"},
 {id:"rps",category:"party",title:"ROCK PAPER SCISSORS",tag:"ONLINE · TOURNAMENTS",kind:"rps",desc:"Fast rounds, sneaky reads and a bracket ready for your next rival.",call:"rpsView"}
];
function art(kind){
 if(kind==="basketball")return '<div class="arc-visual arc-visual-basket"><span class="arc-hoop">▤</span><span class="arc-player arc-jersey-orange">▟</span><span class="arc-ball">●</span><span class="arc-lines"></span><em>02 · 03</em></div>';
 if(kind==="soccer")return '<div class="arc-visual arc-visual-soccer"><span class="arc-pitch"></span><span class="arc-player arc-jersey-orange">▟</span><span class="arc-player arc-jersey-blue">▟</span><span class="arc-ball">●</span><em>90:00</em></div>';
 if(kind==="world")return '<div class="arc-visual arc-visual-world"><span class="arc-globe">◉</span><span class="arc-grid-world"></span><em>THE WHOLE PLANET</em></div>';
 if(kind==="chess")return '<div class="arc-visual arc-visual-chess"><span>♞</span><span>♔</span><em>YOUR MOVE</em></div>';
 return '<div class="arc-visual arc-visual-rps"><span>✊</span><span>✋</span><span>✌</span><em>BEST OF THREE</em></div>';
}
export function installPixelArcade(Hub){
 const previousRender=Hub.prototype.render,previousShow=Hub.prototype.show,previousClose=Hub.prototype.close,previousAct=Hub.prototype.act;
 Hub.prototype.games=function(){
   this.header("Arcade","Lightning Network · 5 games and counting");
   if(!this.arenaFilter)this.arenaFilter="all";
   const filtered=catalog.filter(g=>this.arenaFilter==="all"||g.category===this.arenaFilter);
   const cards=filtered.map((game,i)=>
     '<article class="arc-game arc-'+game.kind+'" style="--order:'+i+'">'+
       '<div class="arc-game-media">'+art(game.kind)+
       '<div class="arc-game-label">'+esc(game.tag)+'</div></div>'+
       '<div class="arc-game-info"><h3>'+esc(game.title)+'</h3><p>'+esc(game.desc)+'</p>'+
       '<button class="arc-play" data-act="'+game.call+'" '+(game.call==="sportsOpen"?'data-game="'+game.id+'"':'')+' type="button">'+
       (game.category==="pixel"?"PLAY VS CPU":"ENTER GAME")+' <span>↗</span></button></div>'+
     '</article>').join("");
   const filters=[["all","ALL GAMES"],["pixel","PIXEL SPORTS"],["strategy","STRATEGY"],["party","QUICK MATCHES"]];
   this.$("#hubContent").innerHTML=
     '<section class="arc-page"><div class="arc-page-inner">'+
       '<section class="arc-intro"><div class="arc-intro-top"><span><i class="arc-pulse"></i> THE LIGHTNING ARCADE</span><span>SEASON 01 / 2026</span></div>'+
         '<div class="arc-intro-bottom"><div><h1>Pick a game<span>.</span></h1>'+
         '<p>Five ways to compete. Find a real opponent, conquer a world or take on an arcade CPU.</p></div>'+
         '<div class="arc-online-stat"><b>'+(this.summary?.users||0)+'</b><span>CONNECTED<br>PLAYERS</span></div></div></section>'+
       '<nav class="arc-tabs" aria-label="Filter games">'+filters.map(([k,n])=>'<button type="button" data-act="arcFilter" data-filter="'+k+'" class="'+(k===this.arenaFilter?"active":"")+'">'+n+'</button>').join("")+'</nav>'+
       '<div class="arc-grid">'+cards+'</div>'+
       '<footer class="arc-page-footer"><span>LIGHTNING ARCADE / ALL SYSTEMS READY</span><span>PIXEL SPORTS ARE LOCAL CPU MATCHES</span></footer>'+
     '</div></section>';
 };
 Hub.prototype.stopPixel=function(){
   if(this.pixelFrame){cancelAnimationFrame(this.pixelFrame);this.pixelFrame=null}
   if(this.pixelKeyboard){window.removeEventListener("keydown",this.pixelKeyboard.down);window.removeEventListener("keyup",this.pixelKeyboard.up);window.removeEventListener("blur",this.pixelKeyboard.blur);this.pixelKeyboard=null}
   this.pixelKeys?.clear();
   this.pixelInstance=null;
 };
 Hub.prototype.pixelScreen=function(kind){
   if(!sports.has(kind))return;
   this.stopPixel();
   const soccer=kind==="pixelSoccer";
   const mode=soccer?"SOCCER":"BASKETBALL";
   this.header("Pixel "+(soccer?"Soccer":"Basketball"),"Lightning Arcade · Offline vs CPU");
   const difficulty=this.pixelDifficulty||"normal";
   this.$("#hubContent").innerHTML=
     '<div class="px-page '+(soccer?"px-soccer":"px-basketball")+'"><div class="px-wrap">'+
       '<header class="px-head"><div><span class="px-kicker">LIGHTNING / PIXEL SPORTS</span><h2>PIXEL <em>'+mode+'</em></h2>'+
         '<p>Made for the arcade. Quick rounds, instant rematches.</p></div>'+
       '<button type="button" class="px-back" data-act="pixelBack">← ALL GAMES</button></header>'+
       '<div class="px-board"><div class="px-scoreboard"><div class="px-score-team"><span>HOME · '+esc(this.name||"YOU")+'</span><strong id="pixelHome">0</strong></div>'+
       '<div class="px-center-clock"><span>VS CPU</span><strong id="pixelClock">01:40</strong><small id="pixelStatus">TIP OFF</small></div>'+
       '<div class="px-score-team away"><span>CPU · AWAY</span><strong id="pixelAway">0</strong></div></div>'+
       '<div class="px-canvas-shell"><canvas id="pixelCanvas" width="480" height="270" role="img" aria-label="Playable pixel '+mode+' court. Use the directional controls and shoot button."></canvas>'+
       '<div class="px-pause-overlay" id="pixelPaused" hidden><strong>PAUSED</strong><span>Take your time. The clock is stopped.</span></div></div>'+
       '<div class="px-controls"><div class="px-controls-label"><span class="px-dot"></span> '+(soccer?"PITCH":"COURT")+' READY <b>·</b> VS CPU</div>'+
       '<div class="px-controls-buttons"><button type="button" data-act="pixelPause" id="pixelPause">Ⅱ PAUSE</button>'+
       '<button type="button" data-act="pixelRestart">↻ REMATCH</button><label>DIFFICULTY <select id="pixelDifficulty">'+
       ['easy','normal','hard'].map(d=>'<option value="'+d+'"'+(d===difficulty?" selected":"")+'>'+d.toUpperCase()+'</option>').join("")+
       '</select></label></div></div></div>'+
       '<section class="px-instructions"><div><span>01 / MOVEMENT</span><strong>'+(soccer?"WASD / ARROWS":"A & D / ARROWS")+'</strong>'+
       '<p>'+(soccer?"Move around the pitch. Hold Shift to sprint.":"Run up and down the court. W / Up to jump.")+'</p></div>'+
       '<div><span>02 / SHOOT</span><strong>SPACE</strong><p>'+(soccer?"Shoot at the opposite goal.":"Release the basketball toward the far hoop.")+'</p></div>'+
       '<div><span>03 / DEFENSE</span><strong>X</strong><p>'+(soccer?"Tackle the CPU and win the ball back.":"Steal possession or grab a loose rebound.")+'</p></div></section>'+
       '<div class="px-touch" aria-label="Touch game controls"><div class="px-pad">'+
       '<button type="button" data-pixel-key="arrowup">▲</button><div><button type="button" data-pixel-key="arrowleft">◀</button><button type="button" data-pixel-key="arrowdown">▼</button><button type="button" data-pixel-key="arrowright">▶</button></div></div>'+
       '<div class="px-touch-actions"><button type="button" data-pixel-key="x">STEAL<br>TACKLE</button>'+
       '<button type="button" data-pixel-key="space">SHOOT<br>SPACE</button></div></div>'+
       '</div></div>';
   const canvas=this.$("#pixelCanvas"),ctx=canvas.getContext("2d",{alpha:false});
   if(!ctx){this.flash("Canvas is not supported in your browser.");return}
   ctx.imageSmoothingEnabled=false;
   this.pixelInstance=soccer?createSoccer({difficulty}):createBasketball({difficulty});
   this.pixelKeys=new Set();this.pixelPaused=false;
   const keyboard={
     down:event=>{
       if(this.view!==kind)return;
       if(event.target?.closest?.("input,textarea,select,[contenteditable]"))return;
       const key=event.code.toLowerCase().replace(/^key/,"");
       if(!["arrowleft","arrowright","arrowup","arrowdown","w","a","s","d","shiftleft","shiftright","space","x"].includes(key))return;
       event.preventDefault();
       const normalized=key.startsWith("shift")?"shift":key;
       if(!this.pixelKeys.has(normalized)&&["space","x"].includes(normalized))this.pixelInstance?.action(normalized);
       this.pixelKeys.add(normalized);
     },
     up:event=>{
       const key=event.code.toLowerCase().replace(/^key/,"");this.pixelKeys?.delete(key.startsWith("shift")?"shift":key);
     },
     blur:()=>{this.pixelKeys?.clear();this.pixelPaused=true;this.pixelPauseUi()}
   };
   this.pixelKeyboard=keyboard;
   window.addEventListener("keydown",keyboard.down);window.addEventListener("keyup",keyboard.up);window.addEventListener("blur",keyboard.blur);
   this.$$(".px-touch button[data-pixel-key]").forEach(button=>{
     const key=button.dataset.pixelKey;
     const release=event=>{this.pixelKeys?.delete(key);button.classList.remove("held");if(button.hasPointerCapture?.(event.pointerId))button.releasePointerCapture(event.pointerId)};
     button.addEventListener("pointerdown",event=>{
       event.preventDefault();button.setPointerCapture?.(event.pointerId);
       this.pixelKeys.add(key);button.classList.add("held");
       if(key==="space"||key==="x")this.pixelInstance?.action(key);
     });
     button.addEventListener("pointerup",release);
     button.addEventListener("pointercancel",release);
     button.addEventListener("lostpointercapture",()=>{this.pixelKeys?.delete(key);button.classList.remove("held")});
   });
   this.$("#pixelDifficulty").addEventListener("change",event=>{
     this.pixelDifficulty=event.target.value;this.pixelScreen(kind);
   });
   let previous=performance.now(),accum=0,nextHud=0;
   const frame=now=>{
     if(this.view!==kind||!this.pixelInstance){this.pixelFrame=null;return}
     const delta=Math.min(.1,(now-previous)/1000);previous=now;
     if(!this.pixelPaused){
       accum+=delta;
       for(let i=0;i<7&&accum>=1/120;i++){this.pixelInstance.tick(1/120,this.pixelKeys);accum-=1/120}
     }else accum=0;
     this.pixelInstance.draw(ctx);
     if(now>=nextHud){
       nextHud=now+125;
       const engine=this.pixelInstance;
       this.$("#pixelHome").textContent=engine.score[0];
       this.$("#pixelAway").textContent=engine.score[1];
       const secs=Math.ceil(engine.time);
       this.$("#pixelClock").textContent=String(Math.floor(secs/60)).padStart(2,"0")+":"+String(secs%60).padStart(2,"0");
       this.$("#pixelStatus").textContent=engine.over?"FULL TIME":this.pixelPaused?"PAUSED":engine.phase==="play"?"LIVE MATCH":engine.notice;
     }
     this.pixelFrame=requestAnimationFrame(frame);
   };
   this.pixelFrame=requestAnimationFrame(frame);
 };
 Hub.prototype.pixelPauseUi=function(){
   const el=this.$("#pixelPaused"),button=this.$("#pixelPause");
   if(el)el.hidden=!this.pixelPaused;
   if(button)button.textContent=this.pixelPaused?"▶ RESUME":"Ⅱ PAUSE";
 };
 Hub.prototype.render=function(){
   if(sports.has(this.view))return this.pixelScreen(this.view);
   return previousRender.call(this);
 };
 Hub.prototype.show=function(view,channel){
   if(sports.has(this.view)&&this.view!==view)this.stopPixel();
   previousShow.call(this,view,channel);
 };
 Hub.prototype.close=function(){this.stopPixel();return previousClose.call(this)};
 Hub.prototype.act=function(action,button){
   if(action==="arcFilter"){this.arenaFilter=button.dataset.filter||"all";this.games();return}
   if(action==="sportsOpen"){this.show(button.dataset.game);return}
   if(action==="pixelBack"){this.show("games");return}
   if(action==="pixelRestart"){this.pixelScreen(this.view);return}
   if(action==="pixelPause"){this.pixelPaused=!this.pixelPaused;this.pixelPauseUi();return}
   return previousAct.call(this,action,button);
 };
}
