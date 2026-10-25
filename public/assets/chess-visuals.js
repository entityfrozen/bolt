// Visuals only. The server remains authoritative for chess moves and outcomes.
const pieces={K:"♔",Q:"♕",R:"♖",B:"♗",N:"♘",P:"♙",k:"♚",q:"♛",r:"♜",b:"♝",n:"♞",p:"♟︎"};
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function ranks(fen){
  return String(fen).split(" ")[0].split("/").map(row=>{
    const out=[];
    for(const p of row)if(/[1-8]/.test(p))for(let i=0;i<Number(p);i++)out.push("");
    else out.push(p);
    return out;
  });
}
export function installChessVisuals(Hub){
  Hub.prototype.chessScreen=function(){
    this.header("Chess","Live matches");
    const host=this.$("#hubContent"),game=this.chess;
    if(!game){
      const queue=this.chessQueueing
        ? '<button class="hub-btn primary" disabled>Finding a player…</button><button class="hub-btn" data-act="chessCancelQueue">Cancel search</button>'
        : '<button class="hub-btn primary" data-act="chessQueue">Find a player ↗</button>';
      host.innerHTML=
        '<section class="new-chess-lobby"><div class="new-chess-copy">'+
          '<span class="chess-eyebrow">CHESS / LIVE</span><h1>Your next<br><em>move.</em></h1>'+
          '<p>Challenge the community or sharpen your openings against the computer.</p>'+
          '<div class="chess-lobby-actions">'+queue+'<button class="hub-btn" data-act="chessBot">Play against bot</button></div>'+
          '<div class="chess-invite"><label for="hubDuelId">CHALLENGE A PLAYER</label><div><input id="hubDuelId" placeholder="Enter player ID" autocomplete="off"><button class="hub-btn" data-act="chessDuel">Invite ↗</button></div></div>'+
          '<button class="chess-link-back" data-act="back">← Arcade</button></div>'+
          '<div class="new-chess-art" aria-hidden="true"><div class="new-chess-artboard"><span>♜</span><span>♞</span><span>♚</span><span>♝</span><span>♙</span><span>♕</span></div><small>A GAME OF DECISIONS</small></div></section>';
      return;
    }
    const board=ranks(game.fen),order=game.color==="b"?[7,6,5,4,3,2,1,0]:[0,1,2,3,4,5,6,7];
    const myTurn=!game.over&&game.turn===game.color;
    const legal=myTurn?(game.legal||[]):[];
    const destinations=new Set(legal.filter(m=>m.from===this.selectedSquare).map(m=>m.to));
    const fromSquares=new Set(legal.map(m=>m.from));
    const lastSquare=String(game.last||"").match(/([a-h][1-8])(?:=[QRBN])?[+#]?$/)?.[1]||"";
    let squares="";
    for(const y of order)for(const x of order){
      const square="abcdefgh"[x]+(8-y),piece=board[y]?.[x]||"";
      const classes=["hub-square",(x+y)%2?"dark":"light",
        this.selectedSquare===square?"selected":"",
        destinations.has(square)?"target":"",
        destinations.has(square)&&piece?"is-capture":"",
        fromSquares.has(square)?"available":"",
        lastSquare===square?"last-destination":"",
        piece?(piece===piece.toUpperCase()?"piece-white":"piece-black"):""].filter(Boolean).join(" ");
      squares+='<button type="button" class="'+classes+'" data-act="square" data-square="'+square+'" title="'+square+'" aria-label="'+square+' '+(piece||"empty")+'" '+(myTurn?"":"disabled")+'>'+
        '<span class="chess-piece" draggable="'+(fromSquares.has(square)?"true":"false")+'">'+(pieces[piece]||"")+'</span>'+
        (x===order[0]?'<small class="chess-rank">'+(8-y)+'</small>':"")+
        (y===order[7]?'<small class="chess-file">'+square[0]+'</small>':"")+'</button>';
    }
    const opp=game.players?.[game.color==="w"?1:0]||"Opponent";
    const own=game.players?.[game.color==="w"?0:1]||"You";
    const hint=game.over?(game.result||"Game finished"):this.chessPending?"Submitting your move…":this.chessError||
      (!myTurn?"Waiting for "+opp+"…":!legal.length?"Moves unavailable. Refresh the board.":this.selectedSquare?"Choose a highlighted destination.":"Select one of your pieces.");
    const badge=game.over?"MATCH OVER":myTurn?"YOUR TURN":"OPPONENT'S TURN";
    host.innerHTML=
      '<section class="hub-chess-layout arena-chess new-chess-match"><div class="hub-chess-panel new-chess-board-panel">'+
        '<div class="new-chess-player"><span class="new-chess-avatar dark">♚</span><div><small>OPPONENT</small><strong>'+esc(opp)+'</strong></div><span class="chess-online">● LIVE</span></div>'+
        '<div class="hub-chess-board"><div class="hub-chess" id="hubChessBoard" role="grid" aria-label="Chess board">'+squares+'</div></div>'+
        '<div class="new-chess-player"><span class="new-chess-avatar light">♔</span><div><small>YOU · '+(game.color==="w"?"WHITE":"BLACK")+'</small><strong>'+esc(own)+'</strong></div><span class="chess-turn-dot'+(myTurn?" active":"")+'"></span></div></div>'+
        '<aside class="hub-chess-sidebar new-chess-side"><span class="chess-eyebrow">LIVE MATCH</span>'+
          '<div class="new-chess-side-title"><h2>Chess</h2><span>'+esc(badge)+'</span></div><p>Every move counts. Take your time.</p>'+
          '<div class="new-chess-hint'+(myTurn?" active":"")+'"><span>✦</span>'+esc(hint)+'</div>'+
          '<div class="new-chess-stats"><div><small>LAST MOVE</small><strong>'+esc(game.last||"—")+'</strong></div>'+
          '<div><small>LEGAL MOVES</small><strong>'+legal.length+'</strong></div></div>'+
          '<div class="new-chess-controls"><button class="hub-btn primary" data-act="chessRefresh">↻ Sync board</button>'+
          (game.over?'<button class="hub-btn" data-act="chessExit">Leave match</button><button class="hub-btn" data-act="chessBot">New bot game</button>':
            '<button class="hub-btn chess-resign" data-act="chessResign">Resign & leave</button>')+
          '<button class="hub-btn" data-act="back">← Arcade</button></div>'+
          '<p class="chess-instructions">Tap or drag a piece. Available moves appear on the board.</p></aside></section>';
    const el=this.$("#hubChessBoard");
    el.addEventListener("dragstart",event=>{
      const button=event.target.closest("[data-square]");
      if(!button||!fromSquares.has(button.dataset.square))return event.preventDefault();
      event.dataTransfer.setData("text/plain",button.dataset.square);
      event.dataTransfer.effectAllowed="move";
    });
    el.addEventListener("dragover",event=>{if(event.target.closest("[data-square]"))event.preventDefault()});
    el.addEventListener("drop",event=>{
      event.preventDefault();
      const button=event.target.closest("[data-square]");
      if(!button)return;
      const from=event.dataTransfer.getData("text/plain");
      if(from)this.moveChess(from,button.dataset.square);
    });
  };
}
