/* Compact Chess Arena. chess.js on the server owns legality and outcomes.
 * Keep the board mounted between clicks so neither focus nor scroll jumps.
 */
const glyphs={K:"♔",Q:"♕",R:"♖",B:"♗",N:"♘",P:"♙",k:"♚",q:"♛",r:"♜",b:"♝",n:"♞",p:"♟︎"};
const escapeChess=value=>String(value??"").replace(/[&<>"']/g,c=>({
 "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;'," ":" ","'":"&#39;"
}[c]));
function boardRows(fen){
 return String(fen||"").split(" ")[0].split("/").map(row=>{
  const result=[];
  for(const symbol of row){
   if(/^[1-8]$/.test(symbol))for(let i=0;i<Number(symbol);i++)result.push("");
   else result.push(symbol);
  }
  return result;
 });
}
const difficultyLabel={easy:"Easy",normal:"Normal",hard:"Hard",expert:"Expert"};
const viewName=game=>game.bot?"BOT / "+(difficultyLabel[game.difficulty]||"Normal").toUpperCase():"LIVE / MULTIPLAYER";
export function installChessVisuals(Hub){
 Hub.prototype.chessControlsReady=function(){
  if(this.chessControlsBound)return;
  this.chessControlsBound=true;
  this.root.addEventListener("change",event=>{
   if(event.target.matches("#chessDifficulty"))
    this.chessDifficulty=event.target.value;
  });
  this.root.addEventListener("keydown",event=>{
   if(!this.active||this.view!=="chess"||!this.chess||event.repeat)return;
   if(event.target.closest("input,textarea,select,[contenteditable]"))return;
   if(event.shiftKey&&event.key.toLowerCase()==="g"&&!event.ctrlKey&&!event.metaKey&&!event.altKey){
    event.preventDefault();
    this.chessGhostOpen=!this.chessGhostOpen;
    this.chessScreen();
   }
  });
 };
 Hub.prototype.chessScreen=function(){
  this.chessControlsReady();
  this.header("Chess","Multiplayer & practice");
  const host=this.$("#hubContent"),game=this.chess;
  if(!game){
   const current=this.chessDifficulty||"normal";
   const levels=Object.entries(difficultyLabel).map(([id,label])=>
    '<option value="'+id+'"'+(id===current?" selected":"")+'>'+label+'</option>').join("");
   const queue=this.chessQueueing?
    '<button class="chess-v2-btn primary" disabled>Finding an opponent…</button>'+
    '<button class="chess-v2-btn" data-act="chessCancelQueue">Cancel</button>':
    '<button class="chess-v2-btn primary" data-act="chessQueue">Play online ↗</button>';
   host.innerHTML=
    '<section class="new-chess-lobby chess-compact-lobby">'+
    '<div class="new-chess-copy"><span class="chess-eyebrow">CHESS / LIGHTNING</span>'+
    '<h1>Make your <em>move.</em></h1>'+
    '<p>Find an opponent, challenge a friend, or choose how hard the computer plays.</p>'+
    '<div class="chess-compact-matchmaking">'+
    '<div class="chess-compact-actions">'+queue+'</div>'+
    '<div class="chess-compact-bot-row"><label for="chessDifficulty">BOT DIFFICULTY</label>'+
    '<select id="chessDifficulty" aria-label="Chess bot difficulty">'+levels+'</select>'+
    '<button class="chess-v2-btn" data-act="chessBot">Play bot ↗</button></div></div>'+
    '<div class="chess-invite"><label for="hubDuelId">CHALLENGE BY PLAYER ID</label>'+
    '<div><input id="hubDuelId" autocomplete="off" placeholder="Paste player ID">'+
    '<button class="chess-v2-btn" data-act="chessDuel">Invite</button></div></div>'+
    '<button class="chess-link-back" data-act="back">← Arcade</button>'+
    '</div><div class="new-chess-art" aria-hidden="true">'+
    '<div class="chess-compact-emblem">♞</div><span>THINK AHEAD</span>'+
    '</div></section>';
   return;
  }
  const board=boardRows(game.fen);
  const order=game.color==="b"?[7,6,5,4,3,2,1,0]:[0,1,2,3,4,5,6,7];
  const canMove=!game.over&&!game.autoplay&&!this.chessPending&&game.turn===game.color;
  const legal=canMove?game.legal||[]:[];
  const from=new Set(legal.map(move=>move.from));
  const to=new Set(legal.filter(move=>move.from===this.selectedSquare).map(move=>move.to));
  const lastSquare=String(game.last||"").match(/([a-h][1-8])(?:=[QRBN])?[+#]?$/)?.[1]||"";
  let squares="";
  for(const rank of order)for(const file of order){
   const square="abcdefgh"[file]+(8-rank),piece=board[rank]?.[file]||"";
   const selected=this.selectedSquare===square;
   const classes=["hub-square",(rank+file)%2?"dark":"light",selected?"selected":"",
    to.has(square)?"target":"",to.has(square)&&piece?"is-capture":"",
    from.has(square)?"available":"",lastSquare===square?"last-destination":"",
    piece?(piece===piece.toUpperCase()?"piece-white":"piece-black"):""].filter(Boolean).join(" ");
   squares+='<button class="'+classes+'" type="button" data-act="square" data-square="'+square+
    '" aria-label="'+square+' '+(piece||"empty")+'" title="'+square+'"'+(!canMove?" disabled":"")+'>'+
    '<span class="chess-piece" draggable="'+(from.has(square)?"true":"false")+'">'+
    (glyphs[piece]||"")+'</span>'+
    (file===order[0]?'<small class="chess-rank">'+(8-rank)+'</small>':"")+
    (rank===order[7]?'<small class="chess-file">'+square[0]+'</small>':"")+'</button>';
  }
  const opp=game.players?.[game.color==="w"?1:0]||"Opponent";
  const own=game.players?.[game.color==="w"?0:1]||"You";
  const yourTurn=!game.over&&game.turn===game.color;
  const message=game.over?(game.result||"Match finished."):
   game.autoplay?"Ghost Pilot is playing your turns.":
   this.chessPending?"Sending move…":this.chessError||
   (yourTurn?this.selectedSquare?"Pick a highlighted square.":"Your turn — select a piece.":
    "Waiting for "+opp+"…");
  const status=game.over?"GAME OVER":game.autoplay?"GHOST PILOT ON":
   yourTurn?"YOUR MOVE":"OPPONENT'S MOVE";
  const history=(game.history||[]).slice(-8);
  const moves=history.length?history.map((san,index)=>{
   const number=Math.floor(((game.history||[]).length-history.length+index)/2)+1;
   return '<span class="chess-v2-move"><small>'+number+
    (index%2===0?".":"…")+'</small>'+escapeChess(san)+'</span>';
  }).join(""):'<span class="chess-v2-empty">No moves yet</span>';
  const secret=this.chessGhostOpen?
   '<div class="chess-v2-ghost-panel"><div><strong>Ghost Pilot</strong><span>Let the AI play your turns'+
   (game.bot?" against the bot.":" in this match.")+'</span></div>'+
   '<button class="chess-v2-btn'+(game.autoplay?" ghost-on":"")+
   '" data-act="chessAutoToggle"'+(game.over?" disabled":"")+'>'+
   (game.autoplay?"Disable":"Enable")+'</button></div>':"";
  const controls=game.over?
   '<button class="chess-v2-btn primary" data-act="chessExit">Finish</button>'+
   '<button class="chess-v2-btn" data-act="chessBot">New bot game</button>':
   '<button class="chess-v2-btn" data-act="chessRefresh">↻ Sync</button>'+
   '<button class="chess-v2-btn chess-resign" data-act="chessResign">Resign</button>';
  const markup=
   '<section class="hub-chess-layout arena-chess new-chess-match chess-compact-match" data-match-id="'+
   escapeChess(game.id)+'"><div class="hub-chess-panel new-chess-board-panel">'+
   '<div class="chess-v2-player"><span class="chess-v2-identity">♚</span>'+
   '<span><small>OPPONENT</small><strong>'+escapeChess(opp)+'</strong></span>'+
   '<em>'+escapeChess(game.turn!==game.color&&!game.over?"● TO MOVE":"")+'</em></div>'+
   '<div class="hub-chess-board"><div class="hub-chess" id="hubChessBoard" role="grid" aria-label="Chess board">'+
   squares+'</div></div>'+
   '<div class="chess-v2-player"><span class="chess-v2-identity me">♔</span>'+
   '<span><small>YOU · '+(game.color==="w"?"WHITE":"BLACK")+'</small>'+
   '<strong>'+escapeChess(own)+'</strong></span>'+
   '<em>'+escapeChess(yourTurn?"● TO MOVE":"")+'</em></div></div>'+
   '<aside class="hub-chess-sidebar new-chess-side chess-v2-side">'+
   '<div class="chess-v2-side-head"><span>'+viewName(game)+'</span>'+
   '<button class="chess-v2-secret" data-act="chessSecret" title="Secret features" aria-label="Secret chess features">✦</button></div>'+
   '<div class="chess-v2-overview"><h2>Chess</h2><span>'+status+'</span></div>'+
   '<p class="chess-v2-hint">'+escapeChess(message)+'</p>'+
   '<div class="chess-v2-info"><div><small>LAST MOVE</small><b>'+escapeChess(game.last||"—")+
   '</b></div><div><small>LEGAL MOVES</small><b>'+legal.length+'</b></div></div>'+
   '<div class="chess-v2-moves"><small>RECENT MOVES</small><div>'+moves+'</div></div>'+
   '<div class="chess-v2-controls">'+controls+
   '<button class="chess-v2-btn" data-act="back">← Arcade</button></div>'+
   secret+
   '<span class="chess-v2-help">Tap or drag to move · Shift + G for a secret</span>'+
   '</aside></section>';
  const existing=host.querySelector(".chess-compact-match");
  if(existing?.dataset.matchId===game.id){
   // Only patch the pieces and the side panel. Never replace the scrolling
   // match surface when someone taps a square or a server move arrives.
   const template=document.createElement("template");
   template.innerHTML=markup;
   const next=template.content.firstElementChild;
   const oldBoard=existing.querySelector("#hubChessBoard");
   const focusSquare=document.activeElement?.closest?.("#hubChessBoard [data-square]")?.dataset.square;
   oldBoard.innerHTML=next.querySelector("#hubChessBoard").innerHTML;
   existing.querySelectorAll(".chess-v2-player").forEach((el,i)=>{
    el.innerHTML=next.querySelectorAll(".chess-v2-player")[i].innerHTML;
   });
   existing.querySelector(".chess-v2-side").innerHTML=next.querySelector(".chess-v2-side").innerHTML;
   if(focusSquare&&canMove)
    oldBoard.querySelector('[data-square="'+focusSquare+'"]')?.focus({preventScroll:true});
   return;
  }
  host.innerHTML=markup;
  const grid=this.$("#hubChessBoard");
  grid.addEventListener("dragstart",event=>{
   const square=event.target.closest("[data-square]");
   if(!square||!from.has(square))return event.preventDefault();
   event.dataTransfer.setData("text/plain",square.dataset.square);
   event.dataTransfer.effectAllowed="move";
  });
  // The legal moves change every turn. Read the current state on drop instead
  // of capturing the old 'from' set from the first render.
  grid.addEventListener("dragover",event=>{
   if(event.target.closest("[data-square]"))event.preventDefault();
  });
  grid.addEventListener("drop",event=>{
   event.preventDefault();
   const button=event.target.closest("[data-square]");
   const start=event.dataTransfer.getData("text/plain");
   if(button&&start)this.moveChess(start,button.dataset.square);
  });
 };
}
