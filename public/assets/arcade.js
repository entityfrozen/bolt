// The games that are currently available to Lightning members.
const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const games=[
  {type:"strategy",title:"WorldPvP",tag:"Online · Strategy",kind:"world",description:"Choose a starting position. Expand your territory. Take the map.",action:"worldView"},
  {type:"strategy",title:"Chess",tag:"Online · Practice",kind:"chess",description:"Play a match or try your openings against the computer.",action:"chessView"},
  {type:"party",title:"Rock Paper Scissors",tag:"Online · Quick",kind:"rps",description:"A quick match or a tournament against other members.",action:"rpsView"}
];
function gameArt(kind){
  if(kind==="world")return '<div class="arc-visual arc-visual-world"><span class="arc-globe">◉</span><em>GLOBAL CONQUEST</em></div>';
  if(kind==="chess")return '<div class="arc-visual arc-visual-chess"><span>♞</span><span>♔</span></div>';
  return '<div class="arc-visual arc-visual-rps"><span>✊</span><span>✋</span><span>✌</span></div>';
}
export function installArcade(Hub){
  const originalAct=Hub.prototype.act;
  const originalClose=Hub.prototype.close;
  Hub.prototype.games=function(){
    this.header("Arcade","");
    const filters=[["all","All"],["strategy","Strategy"],["party","Quick matches"]];
    const filter=filters.some(([key])=>key===this.arenaFilter)?this.arenaFilter:"all";
    const visible=games.filter(game=>filter==="all"||game.type===filter);
    this.$("#hubContent").innerHTML=
      '<section class="arc-page"><div class="arc-page-inner">'+
      '<section class="arc-intro"><div class="arc-intro-top"><span>ARCADE</span></div>'+
      '<div class="arc-intro-bottom"><div><h1>Find a game<span>.</span></h1><p>Play online or against the computer.</p></div>'+
      '<div class="arc-online-stat"><b>'+(this.summary?.users||0)+'</b><span>CONNECTED<br>PLAYERS</span></div></div></section>'+
      '<nav class="arc-tabs" aria-label="Filter games">'+filters.map(([key,title])=>
        '<button type="button" data-act="arcFilter" data-filter="'+key+'" class="'+(key===filter?"active":"")+'">'+title+'</button>').join("")+'</nav>'+
      '<div class="arc-grid">'+visible.map((game,index)=>
        '<article class="arc-game arc-'+game.kind+'" style="--order:'+index+'">'+
        '<div class="arc-game-media">'+gameArt(game.kind)+'<span class="arc-game-label">'+escapeHtml(game.tag)+'</span></div>'+
        '<div class="arc-game-info"><h3>'+escapeHtml(game.title)+'</h3><p>'+escapeHtml(game.description)+'</p>'+
        '<button type="button" class="arc-play" data-act="'+game.action+'">Play <span>↗</span></button></div></article>').join("")+'</div>'+
      '<footer class="arc-page-footer"><span>Play with the community</span></footer>'+
      '</div></section>';
  };
  Hub.prototype.close=function(){
    const world=this.$("#hubWorld");
    if(world){world.replaceChildren();world.classList.remove("hub-openfront-port");}
    this.worldStarted=false;
    return originalClose.call(this);
  };
  Hub.prototype.act=function(action,button){
    if(action==="arcFilter"){this.arenaFilter=button.dataset.filter||"all";this.games();return;}
    return originalAct.call(this,action,button);
  };
}
