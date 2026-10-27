// Presentation only: scores, choices and wins all come from the multiplayer server.
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const symbols={rock:"✊",paper:"✋",scissors:"✌️"};
const cap=value=>value?value[0].toUpperCase()+value.slice(1):"Hidden";
export function installRpsVisuals(Hub){
  Hub.prototype.rpsScreen=function(){
    this.header("Rock Paper Scissors","Quick duels");
    const host=this.$("#hubContent"),g=this.rps;
    if(!g){
      host.innerHTML=
        '<section class="rps-fresh rps-fresh-lobby">'+
          '<div class="rps-kicker"><i></i> ROCK PAPER SCISSORS</div>'+
          '<div class="rps-hero-icons" aria-hidden="true"><span>✊</span><span>✋</span><span>✌️</span></div>'+
          '<h1>Rock Paper Scissors</h1>'+
          '<p>Play another member, try the bot, or join a tournament.</p>'+
          '<div class="rps-lobby-actions"><button class="hub-btn primary" data-act="rpsQueue">Find an opponent ↗</button>'+
          '<button class="hub-btn" data-act="rpsBot">Play against bot</button>'+
          '<button class="hub-btn" data-act="tournament">4-player tournament</button></div>'+
          '<div class="rps-invite-box"><label for="hubDuelId">HAVE A PLAYER ID?</label><div><input id="hubDuelId" placeholder="Enter player ID" autocomplete="off"><button class="hub-btn" data-act="rpsDuel">Challenge</button></div></div>'+
          '<button class="rps-back-link" data-act="back">← Arcade</button></section>';
      return;
    }
    const result=g.result,mine=result?.choices?.[this.id];
    const other=result?Object.entries(result.choices||{}).find(([id])=>id!==this.id)?.[1]:null;
    const opp=g.players?.[g.ids?.indexOf(this.id)===1?0:1]||"Opponent";
    const state=result?(result.tie?"DRAW":result.winner===this.id?"VICTORY":"DEFEAT"):g.waiting?"LOCKED IN":"YOUR MOVE";
    const subtitle=result?(result.tie?"Same move. Try another round.":result.winner===this.id?"You read the opponent perfectly.":"You can turn it around next round."):g.waiting?"Your choice is locked. Waiting for the reveal.":"Your move stays secret until your opponent chooses.";
    const theme=result?(result.tie?"draw":result.winner===this.id?"win":"loss"):"playing";
    const picks=["rock","paper","scissors"].map((v,i)=>
      '<button class="rps-select rps-'+v+'" type="button" data-act="rpsPick" data-choice="'+v+'" '+(g.waiting?"disabled":"")+' aria-label="Choose '+cap(v)+'">'+
        '<small>0'+(i+1)+'</small><span>'+symbols[v]+'</span><strong>'+cap(v)+'</strong><em>'+(g.waiting?"LOCKED":"SELECT ↗")+'</em></button>'
    ).join("");
    host.innerHTML=
      '<section class="rps-fresh rps-fresh-match '+theme+'">'+
        '<div class="rps-match-top"><span>ROUND · '+esc(g.id?.slice(0,7).toUpperCase()||"LIVE")+'</span><span>'+(result?"RESULT":"LIVE MATCH")+'</span></div>'+
        '<h1>'+esc(state)+'</h1><p class="rps-match-desc">'+esc(subtitle)+'</p>'+
        '<div class="rps-fighters"><div class="rps-fighter-card"><small>YOU</small>'+
          '<div class="rps-fighter-symbol">'+(mine?symbols[mine]:g.waiting?"✓":"?")+'</div><strong>'+esc(mine?cap(mine):g.waiting?"Locked":"Waiting")+'</strong></div>'+
          '<span class="rps-vs">VS</span>'+
          '<div class="rps-fighter-card opponent"><small>'+esc(opp)+'</small>'+
            '<div class="rps-fighter-symbol">'+(other?symbols[other]:"?")+'</div><strong>'+esc(other?cap(other):"Hidden")+'</strong></div></div>'+
        (result?'<div class="rps-rematch"><button class="hub-btn primary" data-act="'+(g.bot?"rpsBot":"rpsQueue")+'">Play another round ↗</button></div>':
          '<div class="rps-select-wrap"><span>'+(g.waiting?"WAITING FOR OPPONENT":"MAKE YOUR PICK")+'</span><div class="rps-select-grid">'+picks+'</div></div>')+
        '<button class="rps-back-link" data-act="back">← Arcade</button></section>';
  };
}
