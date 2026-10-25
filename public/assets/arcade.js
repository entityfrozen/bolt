// The games that are currently available to Lightning members.
const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const games=[
  {type:"strategy",title:"WorldPvP",tag:"Online · Strategy",kind:"world",description:"Choose a starting position. Expand your territory. Take the map.",action:"worldView"},
  {type:"strategy",title:"Chess",tag:"Online · Practice",kind:"chess",description:"Play a match or try your openings against the computer.",action:"chessView"},
  {type:"party",title:"Rock Paper Scissors",tag:"Online · Quick",kind:"rps",description:"A quick match or a tournament against other members.",action:"rpsView"},
  {type:"fighting",title:"Uma Versus",tag:"Fighting · Browser",kind:"uma",description:"A 2D fighter with a character roster, solo modes and online battles.",action:"umaView"}
];
function gameArt(kind){
  if(kind==="world")return '<div class="arc-visual arc-visual-world"><span class="arc-globe">◉</span><em>GLOBAL CONQUEST</em></div>';
  if(kind==="chess")return '<div class="arc-visual arc-visual-chess"><span>♞</span><span>♔</span></div>';
  if(kind==="uma")return '<div class="arc-visual arc-visual-uma"><i>✦</i><strong>VS</strong><b>✦</b></div>';
  return '<div class="arc-visual arc-visual-rps"><span>✊</span><span>✋</span><span>✌</span></div>';
}
export function installArcade(Hub){
  const originalAct=Hub.prototype.act;
  const originalClose=Hub.prototype.close;
  const originalShow=Hub.prototype.show;
  const originalRender=Hub.prototype.render;
  Hub.prototype.games=function(){
    this.header("Arcade","");
    const filters=[["all","All"],["strategy","Strategy"],["party","Quick matches"],["fighting","Fighting"]];
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
  Hub.prototype.umaScreen=function(){
    this.header("Uma Versus","Fighting game");
    this.$("#hubContent").innerHTML=
      '<section class="uma-stage">'+
        '<header class="uma-stage-bar"><div class="uma-stage-identity"><i>FIGHTING</i><strong>Uma Versus</strong></div>'+
        '<div class="uma-stage-actions"><a href="https://tiramisuzu701.github.io/uma-versus/" target="_blank" rel="noopener noreferrer">Open in new tab ↗</a>'+
        '<button type="button" data-act="umaBack">← Arcade</button></div></header>'+
        '<div class="uma-stage-frame"><iframe id="umaGameFrame" title="Uma Versus fighting game" src="https://tiramisuzu701.github.io/uma-versus/" allow="fullscreen; gamepad" allowfullscreen loading="eager" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>'+
        '<p class="uma-stage-footer">Game by tiramisuzu701 · If the embedded version or online sign-in is blocked, use Open in new tab.</p>'+
      '</section>';
  };
  Hub.prototype.render=function(){
    if(this.view==="uma")return this.umaScreen();
    return originalRender.call(this);
  };
  Hub.prototype.show=function(page,channel){
    if(this.view==="uma"&&page!=="uma"){
      const frame=this.$("#umaGameFrame");
      if(frame)frame.src="about:blank";
    }
    return originalShow.call(this,page,channel);
  };
  Hub.prototype.close=function(){
    const frame=this.$("#umaGameFrame");
    if(frame)frame.src="about:blank";
    const world=this.$("#hubWorld");
    if(world){world.replaceChildren();world.classList.remove("hub-openfront-port");}
    this.worldStarted=false;
    return originalClose.call(this);
  };
  Hub.prototype.act=function(action,button){
    if(action==="arcFilter"){this.arenaFilter=button.dataset.filter||"all";this.games();return;}
    if(action==="umaView"){this.show("uma");return;}
    if(action==="umaBack"){this.show("games");return;}
    return originalAct.call(this,action,button);
  };
}
