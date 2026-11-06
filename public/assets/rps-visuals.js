// RPS Arena. The server decides every throw, score and match result.
const escRps=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const RPS_MOVES={
 rock:{name:"Rock",icon:"✊",beats:"Scissors"},
 paper:{name:"Paper",icon:"✋",beats:"Rock"},
 scissors:{name:"Scissors",icon:"✌️",beats:"Paper"}
};
const rpsIcon=choice=>RPS_MOVES[choice]?.icon||"?";
const rpsLabel=choice=>RPS_MOVES[choice]?.name||"Hidden";
const scorePips=(count,goal)=>Array.from({length:goal},(_,i)=>'<i class="'+(i<count?"filled":"")+'"></i>').join("");
export function installRpsVisuals(Hub){
 Hub.prototype.rpsScreen=function(){
  this.header("Rock Paper Scissors","First to three wins");
  const host=this.$("#hubContent"),g=this.rps;
  // State changes rebuild the visual stage, but must not reset its scroll.
  const previous=host.querySelector(".rps-rewrite");
  const oldScroll=previous?.scrollTop||0;
  const oldHostScroll=host.scrollTop;
  if(!this.rpsKeyboardBound){
   this.rpsKeyboardBound=true;
   document.addEventListener("keydown",event=>{
    if(event.repeat||event.altKey||event.ctrlKey||event.metaKey||
       !this.active||this.view!=="rps"||
       event.target?.closest?.("input,textarea,select,[contenteditable]"))return;
    const move={"1":"rock","2":"paper","3":"scissors"}[event.key];
    if(!move)return;
    const button=this.$('[data-act="rpsPick"][data-choice="'+move+'"]');
    if(button&&!button.disabled){event.preventDefault();this.act("rpsPick",button);}
   });
  }
  if(!g){
   host.innerHTML=
    '<section class="rps-fresh rps-rewrite rps-fresh-lobby"><div class="rps-lobby-inner">'+
    '<div class="rps-lobby-top"><span class="rps-tag">THE ARCADE</span><span>ROCK / PAPER / SCISSORS</span></div>'+
    '<div class="rps-lobby-hero"><div class="rps-hero-copy">'+
    '<div class="rps-label">A FAST GAME OF MIND GAMES</div>'+
    '<h1>Rock.<br><em>Paper.</em><br>Scissors<span>.</span></h1>'+
    '<p>Read your opponent. Lock your move. Win three rounds before they do.</p>'+
    '<div class="rps-lobby-actions">'+
    (this.rpsQueueing?
      '<button type="button" class="rps-btn rps-btn-primary" disabled>Finding an opponent…</button>'+
      '<button type="button" class="rps-btn rps-btn-secondary" data-act="rpsCancelQueue">Cancel search</button>':
      '<button type="button" class="rps-btn rps-btn-primary" data-act="rpsQueue"'+
       (this.rpsTournamentWaiting?" disabled":"")+' >Find a player ↗</button>')+
    '<button type="button" class="rps-btn rps-btn-secondary" data-act="rpsBot"'+
      (this.rpsTournamentWaiting?" disabled":"")+' >Play the bot</button>'+
    (this.rpsTournamentWaiting?
     '<button type="button" class="rps-btn rps-btn-quiet" disabled>Waiting for players ('+
       Math.max(1,Math.min(4,this.rpsTournamentWaiting.players))+'/4)</button>'+
     '<button type="button" class="rps-btn rps-btn-secondary" data-act="tournamentLeave">Leave tournament</button>':
     '<button type="button" class="rps-btn rps-btn-quiet" data-act="tournament">4-player tournament ↗</button>')+
    '</div></div><div class="rps-hero-deck" aria-hidden="true">'+
    '<div class="rps-deck-card rps-deck-rock"><small>01</small><strong>✊</strong><span>ROCK</span></div>'+
    '<div class="rps-deck-card rps-deck-paper"><small>02</small><strong>✋</strong><span>PAPER</span></div>'+
    '<div class="rps-deck-card rps-deck-scissors"><small>03</small><strong>✌️</strong><span>SCISSORS</span></div>'+
    '</div></div><div class="rps-lobby-footer"><div><b>3</b><span>WINS TO TAKE<br>THE MATCH</span></div>'+
    '<div><b>45<small>s</small></b><span>TO PICK YOUR<br>MOVE</span></div>'+
    '<div><b>∞</b><span>ANOTHER MATCH?<br>REMATCH.</span></div></div>'+
    '<div class="rps-invite-box"><label for="hubDuelId">Invite someone by player ID</label>'+
    '<div><input id="hubDuelId" placeholder="Paste a player ID" autocomplete="off">'+
    '<button type="button" class="rps-btn rps-btn-secondary" data-act="rpsDuel">Invite</button></div></div>'+
    '<button type="button" class="rps-back-link" data-act="back">← Back to Arcade</button>'+
    '</div></section>';
   host.scrollTop=oldHostScroll;
   return;
  }
  const ids=Array.isArray(g.ids)?g.ids:[];
  const seat=ids.indexOf(this.id),me=ids[seat]||this.id,other=ids[seat===0?1:0]||"opponent";
  const ownName=g.players?.[seat]||this.name||"You";
  const oppName=g.players?.[seat===0?1:0]||"Opponent";
  const score=g.score||{},goal=Math.max(1,Math.min(3,Number(g.winsTo)||3));
  const ours=Math.max(0,Number(score[me])||0),theirs=Math.max(0,Number(score[other])||0);
  const result=g.result||null,over=!!g.over;
  const revealed=!!result&&(g.phase==="reveal"||over||g.phase==="finished");
  const mine=revealed?result.choices?.[me]:g.myChoice;
  const rival=revealed?result.choices?.[other]:null;
  const winner=revealed?result.winner:null;
  const winRound=winner===me,loseRound=winner===other,tie=!!result?.tie&&revealed;
  const victory=over&&winner===me,defeat=over&&winner===other;
  const advancing=victory&&!!g.tournament&&g.stage==="semifinal";
  const champion=victory&&!!g.tournament&&g.stage==="final";
  const phase=over?"finished":revealed?"reveal":g.waiting?"waiting":"choosing";
  const title=over?champion?"Tournament champion":advancing?"You're in the final":victory?"Match won":defeat?"Match lost":"Match ended":
   revealed?tie?"It's a tie":winRound?"You take the round":"They take the round":
   g.waiting?"Move locked":g.opponentReady?"They're ready":"Make your move";
  const help=over?result?.reason==="timeout"?"The round ran out of time.":
   advancing?"Waiting for the other semifinal to finish.":"First to "+goal+" takes the match.":
   revealed?"Next round starts in a moment.":g.waiting?"Waiting for "+oppName+" to pick.":
   g.opponentReady?oppName+" has picked. Your turn.":"Rock beats scissors. Scissors beats paper. Paper beats rock.";
  const state=over?"MATCH COMPLETE":revealed?"ROUND COMPLETE":g.waiting?"MOVE SUBMITTED":"YOUR TURN";
  const choiceButtons=Object.entries(RPS_MOVES).map(([id,entry],index)=>
   '<button class="rps-hand-choice rps-hand-'+id+'" type="button" data-act="rpsPick" data-choice="'+id+'"'+
   (phase!=="choosing"?" disabled":"")+' aria-label="Choose '+entry.name+'">'+
   '<small>0'+(index+1)+'</small><span class="rps-hand-emoji">'+entry.icon+'</span>'+
   '<strong>'+entry.name+'</strong><em>BEATS '+entry.beats.toUpperCase()+'</em></button>').join("");
  const rematch=over&&!g.tournament?
   '<div class="rps-play-again">'+
   (g.rematchOffered?'<p>'+escRps(oppName)+' wants a rematch.</p>':"")+
   (g.rematchPending?'<p>Waiting for '+escRps(oppName)+' to accept.</p>':"")+
   '<button class="rps-btn rps-btn-primary" type="button" data-act="rpsRematch"'+(g.rematchPending?" disabled":"")+'>'+
   (g.bot?"Play again":g.rematchOffered?"Accept rematch":"Request rematch")+' ↗</button>'+
   (g.rematchOffered?'<button class="rps-btn rps-btn-secondary" type="button" data-act="rpsRematchDecline">Decline</button>':"")+
   '<button class="rps-btn rps-btn-quiet" type="button" data-act="rpsExit">Back to Arcade</button></div>':
   over?'<div class="rps-play-again">'+
    (advancing?'<p>Final match starting when the other semifinal is done.</p>':"")+
    '<button class="rps-btn rps-btn-primary" type="button" data-act="rpsExit">Back to Arcade ↗</button></div>':
   revealed?'<div class="rps-next-round"><i></i> Next round is loading</div>':
   g.waiting?'<div class="rps-next-round"><i></i> Waiting for '+escRps(oppName)+'…</div>':
   '<div class="rps-select-wrap"><span>CHOOSE YOUR MOVE</span><div class="rps-select-grid">'+choiceButtons+'</div>'+
   '<p>Press <kbd>1</kbd>, <kbd>2</kbd> or <kbd>3</kbd> to pick.</p></div>';
  const tone=over?victory?"win":defeat?"loss":"draw":revealed?tie?"draw":winRound?"win":"loss":"playing";
  host.innerHTML=
   '<section class="rps-fresh rps-rewrite rps-fresh-match rps-phase-'+phase+' '+tone+'"><div class="rps-arena-inner">'+
   '<header class="rps-match-top"><strong>RPS <i>·</i> ARENA</strong><span>ROUND '+Math.max(1,Number(g.round)||1)+
   ' <i>/</i> FIRST TO '+goal+'</span><button type="button" class="rps-exit" data-act="rpsExit" aria-label="Leave match">×</button></header>'+
   '<div class="rps-scoreboard"><div class="rps-score-person"><span>YOU</span><strong>'+escRps(ownName)+'</strong>'+
   '<div class="rps-pips" aria-label="'+ours+' wins">'+scorePips(ours,goal)+'</div></div>'+
   '<div class="rps-score-total" aria-label="Score '+ours+' to '+theirs+'">'+ours+'<span>:</span>'+theirs+'</div>'+
   '<div class="rps-score-person opponent"><span>OPPONENT</span><strong>'+escRps(oppName)+'</strong>'+
   '<div class="rps-pips" aria-label="'+theirs+' wins">'+scorePips(theirs,goal)+'</div></div></div>'+
   '<div class="rps-round-heading"><span class="rps-kicker">'+state+'</span><h1>'+escRps(title)+'</h1>'+
   '<p>'+escRps(help)+'</p></div>'+
   '<div class="rps-duel-stage" aria-label="Your move versus opponent move">'+
   '<div class="rps-duel-hand us"><small>YOUR HAND</small><div class="rps-duel-symbol">'+
   (mine?rpsIcon(mine):g.waiting?"✓":"✊")+'</div><strong>'+escRps(mine?rpsLabel(mine):g.waiting?"Locked":"Not picked")+'</strong></div>'+
   '<div class="rps-duel-versus">VS</div>'+
   '<div class="rps-duel-hand them"><small>'+escRps(oppName.toUpperCase())+'</small>'+
   '<div class="rps-duel-symbol">'+(rival?rpsIcon(rival):g.opponentReady?"✓":"?")+'</div>'+
   '<strong>'+escRps(rival?rpsLabel(rival):g.opponentReady?"Ready":"Hidden")+'</strong></div></div>'+
   '<div class="rps-round-actions">'+rematch+'</div>'+
   '<footer class="rps-arena-footer"><span>'+escRps(g.tournament?"Tournament match":"Best of five")+'</span>'+
   '<span>Hands stay hidden until both players pick.</span></footer>'+
   '</div></section>';
  const current=host.querySelector(".rps-rewrite");
  if(current&&previous?.classList.contains("rps-fresh-match"))current.scrollTop=oldScroll;
  host.scrollTop=oldHostScroll;
 };
}
