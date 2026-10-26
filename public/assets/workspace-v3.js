// A desktop-first workspace on top of the existing, server-backed Lightning features.
// The underlying browser, account system, rooms and multiplayer rules are unchanged.
const safe=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const relative=stamp=>{const delta=Date.now()-Number(stamp||0);return delta<60000?"just now":delta<3600000?Math.floor(delta/60000)+"m ago":delta<86400000?Math.floor(delta/3600000)+"h ago":new Date(stamp).toLocaleDateString([],{month:"short",day:"numeric"});};
const catalog=[
  {id:"world",name:"WorldPvP",kind:"Strategy",icon:"◉",note:"Conquer the world in real time.",action:"worldView",className:"territory"},
  {id:"chess",name:"Chess",kind:"Strategy",icon:"♞",note:"Live chess with verified moves.",action:"chessView",className:"chess"},
  {id:"rps",name:"Rock Paper Scissors",kind:"Casual",icon:"✊",note:"Quick rounds and tournaments.",action:"rpsView",className:"rps"},
  {id:"uma",name:"Uma Versus",kind:"Fighting",icon:"⚡",note:"Character battles, solo and online.",action:"umaView",className:"uma"},
  {id:"2048",name:"2048",kind:"Puzzle",icon:"²",note:"Merge tiles and reach 2048.",action:"v3Play2048",className:"puzzle"},
  {id:"mines",name:"Minesweeper",kind:"Puzzle",icon:"✱",note:"Clear the field without hitting a mine.",action:"v3PlayMines",className:"mines"}
];
const themeColors={forest:"#44eda7",violet:"#b69af6",ocean:"#72c9ff"};
const themeNames={forest:"Emerald",violet:"Amethyst",ocean:"Ice"};
const preference=(key,fallback)=>{try{return JSON.parse(localStorage.getItem("lightning.v3."+key))??fallback}catch{return fallback}};
const setPreference=(key,value)=>{try{localStorage.setItem("lightning.v3."+key,JSON.stringify(value))}catch{}};
const gameCard=(game,featured=false)=>
  '<article class="v3-game-card v3-game-'+game.className+(featured?" v3-featured-game":"")+'">'+
    '<div class="v3-game-picture" aria-hidden="true"><span>'+game.icon+'</span><i>'+safe(game.kind.toUpperCase())+'</i></div>'+
    '<div class="v3-game-bottom"><div><strong>'+safe(game.name)+'</strong><small>'+safe(game.note)+'</small></div>'+
    '<button type="button" data-act="'+game.action+'" aria-label="Play '+safe(game.name)+'">Play <b>↗</b></button></div></article>';
const sectionHeading=(kicker,title,button)=>
  '<div class="v3-section-heading"><div><small>'+kicker+'</small><h2>'+title+'</h2></div>'+(button||"")+'</div>';
function make2048(){
  return {cells:Array(16).fill(0),score:0,over:false};
}
function spawn2048(game){
  const empty=game.cells.flatMap((n,i)=>n?[]:[i]);if(!empty.length)return;
  game.cells[empty[Math.floor(Math.random()*empty.length)]]=Math.random()<.9?2:4;
}
function slide2048(game,direction){
  const before=game.cells.join(",");
  for(let line=0;line<4;line++){
    const indexes=Array.from({length:4},(_,p)=>direction==="left"?line*4+p:direction==="right"?line*4+3-p:direction==="up"?p*4+line:(3-p)*4+line);
    let nums=indexes.map(i=>game.cells[i]).filter(Boolean);
    const merged=[];
    for(let i=0;i<nums.length;i++){
      if(i+1<nums.length&&nums[i]===nums[i+1]){const n=nums[i]*2;merged.push(n);game.score+=n;i++;}
      else merged.push(nums[i]);
    }
    indexes.forEach((idx,p)=>game.cells[idx]=merged[p]||0);
  }
  if(game.cells.join(",")===before)return false;
  spawn2048(game);
  game.over=!game.cells.includes(0)&&!game.cells.some((n,i)=>i%4<3&&n===game.cells[i+1]||i<12&&n===game.cells[i+4]);
  return true;
}
function makeMines(){
  return {cells:Array.from({length:64},()=>({mine:false,open:false,flag:false,count:0})),remaining:10,over:false,won:false,started:false};
}
function placeMines(game,safeIndex){
  const pool=Array.from({length:64},(_,i)=>i).filter(i=>Math.abs((i%8)-(safeIndex%8))>1||Math.abs(Math.floor(i/8)-Math.floor(safeIndex/8))>1);
  for(let i=0;i<10;i++){const pick=Math.floor(Math.random()*pool.length);game.cells[pool.splice(pick,1)[0]].mine=true;}
  game.cells.forEach((cell,i)=>{
    if(cell.mine)return;
    cell.count=neighbors(i).filter(j=>game.cells[j].mine).length;
  });
  game.started=true;
}
function neighbors(i){
  const x=i%8,y=Math.floor(i/8),out=[];
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    if(!dx&&!dy)continue;
    const nx=x+dx,ny=y+dy;if(nx>=0&&nx<8&&ny>=0&&ny<8)out.push(ny*8+nx);
  }
  return out;
}
function openMine(game,i){
  if(game.over||game.cells[i].open||game.cells[i].flag)return;
  if(!game.started)placeMines(game,i);
  const stack=[i],visited=new Set();
  while(stack.length){
    const index=stack.pop(),cell=game.cells[index];
    if(visited.has(index)||cell.open||cell.flag)continue;
    visited.add(index);cell.open=true;
    if(cell.mine){game.over=true;game.won=false;game.cells.forEach(c=>{if(c.mine)c.open=true});return;}
    if(cell.count===0)neighbors(index).forEach(j=>{if(!visited.has(j))stack.push(j);});
  }
  if(game.cells.filter(c=>!c.mine&&c.open).length===54){game.over=true;game.won=true;}
}
export function installWorkspaceV3(Hub){
  const setup=Hub.prototype.v2Setup;
  const open=Hub.prototype.open,show=Hub.prototype.show,render=Hub.prototype.render;
  const onMessage=Hub.prototype.onMessage,nav=Hub.prototype.v2Nav;
  const close=Hub.prototype.close;
  Hub.prototype.v2Setup=function(){
    setup.call(this);
    if(this.v3Ready)return;
    this.v3Ready=true;
    this.v3Theme=preference("theme","forest");
    this.v3Favorites=preference("favorites",["chess","world","uma"]);
    this.v3InspectorVisible=preference("inspector",true);
    this.v3DockVisible=preference("dock",true);
    this.v3QuickSearch="";
    const shell=this.$(".v2-shell");shell.classList.add("v3-shell");
    shell.insertAdjacentHTML("beforeend",
      '<header class="v3-global-bar">'+
        '<div class="v3-global-brand"><span class="v3-brand-flash">ϟ</span><div><strong>Lightning</strong><small>V2 WORKSPACE</small></div></div>'+
        '<nav class="v3-primary-tabs" aria-label="Workspace">'+
          '<button data-v3="overview" class="active">⌂ <span>Overview</span></button>'+
          '<button data-v3="channel"># <span>Community</span></button>'+
          '<button data-v3="arcade">▣ <span>Games</span></button>'+
          '<button data-v3="browser">◎ <span>Browser</span></button></nav>'+
        '<button class="v3-command-trigger" data-v3="command" title="Command menu (Ctrl or Cmd + K)"><span>⌕</span> Find anything <kbd>⌘ K</kbd></button>'+
        '<div class="v3-bar-end"><button class="v3-top-icon" data-v3="theme" title="Change theme" aria-label="Change theme">◐</button>'+
          '<button class="v3-top-icon" data-v3="toggleInspector" title="Toggle activity panel" aria-label="Toggle activity panel">◫</button>'+
          '<button class="v3-top-ai" data-v3="ai">✧ Ask AI <span>↗</span></button></div>'+
      '</header>'+
      '<aside class="v3-inspector" aria-label="Activity and members">'+
        '<div class="v3-inspector-header"><span>ACTIVITY</span><button data-v3="toggleInspector" aria-label="Hide activity panel">×</button></div>'+
        '<div id="v3InspectorContent"></div></aside>'+
      '<footer class="v3-dock" aria-label="Quick launch">'+
        '<div class="v3-dock-label"><span>▣</span><div><strong>Quick launch</strong><small>Jump back into a game</small></div></div>'+
        '<div id="v3DockGames" class="v3-dock-games"></div>'+
        '<button class="v3-dock-toggle" data-v3="toggleDock" aria-label="Collapse or expand launcher">⌄</button>'+
      '</footer>'+
      '<dialog id="v3CommandDialog" class="v3-command" aria-labelledby="v3CommandLabel">'+
        '<div class="v3-command-top"><span>⌕</span><label id="v3CommandLabel" for="v3CommandInput">Jump to…</label>'+
          '<input id="v3CommandInput" placeholder="Search apps, games, channels, servers…" autocomplete="off" spellcheck="false">'+
          '<button data-v3="closeCommand" aria-label="Close command search">×</button></div>'+
        '<div id="v3CommandResults" class="v3-command-results"></div>'+
        '<footer>↑↓ to navigate · Enter to open · Esc to close</footer></dialog>'+
      '<dialog class="v3-theme-dialog" id="v3ThemeDialog" aria-label="Appearance">'+
        '<header><strong>Appearance</strong><button data-v3="closeTheme" aria-label="Close">×</button></header>'+
        '<p>Choose the accent that feels right.</p><div class="v3-theme-grid">'+
        Object.entries(themeColors).map(([key,color])=>'<button type="button" data-v3="setTheme" data-theme="'+key+'"><i style="--swatch:'+color+'"></i><span>'+themeNames[key]+'</span></button>').join("")+
        '</div><small>Your theme is saved on this device.</small></dialog>');
    this.v3ApplyPreferences();
    this.v3RenderDock();
    this.v3RenderInspector();
    this.root.addEventListener("click",event=>{
      const button=event.target.closest("[data-v3]");
      if(!button)return;
      const action=button.dataset.v3;
      if(action==="overview")this.show("overview");
      else if(action==="channel"){this.v2ServerId=null;this.show("chat","general");}
      else if(action==="arcade")this.show("games");
      else if(action==="browser"){this.close();document.querySelector("#newtabInput")?.focus();}
      else if(action==="ai")document.getElementById("boltBubble")?.click();
      else if(action==="command")this.v3OpenCommand();
      else if(action==="closeCommand")this.$("#v3CommandDialog").close();
      else if(action==="theme")this.$("#v3ThemeDialog").showModal();
      else if(action==="closeTheme")this.$("#v3ThemeDialog").close();
      else if(action==="setTheme"){this.v3Theme=button.dataset.theme;setPreference("theme",this.v3Theme);this.v3ApplyPreferences();this.$("#v3ThemeDialog").close();}
      else if(action==="toggleInspector"){this.v3InspectorVisible=!this.v3InspectorVisible;setPreference("inspector",this.v3InspectorVisible);this.v3ApplyPreferences();}
      else if(action==="toggleDock"){this.v3DockVisible=!this.v3DockVisible;setPreference("dock",this.v3DockVisible);this.v3ApplyPreferences();}
      else if(action==="favorite"){
        const game=button.dataset.game;
        this.v3Favorites=this.v3Favorites.includes(game)?this.v3Favorites.filter(x=>x!==game):[...this.v3Favorites,game];
        setPreference("favorites",this.v3Favorites);this.v3RenderDock();
        if(this.view==="games")this.games();
      }else if(action==="play"){this.v3Launch(button.dataset.game);}
      else if(action==="goChannel"){this.v2ServerId=null;this.show("chat",button.dataset.channel);}
      else if(action==="goServer"){
        const s=this.v2Servers.find(x=>x.id===button.dataset.id);
        if(s){this.v2ServerId=s.id;this.v2Channel=s.channels[0]?.id||"general";this.show("room");}
      }else if(action==="goDirectory")this.v2Discover();
      else if(action==="goUpdates")this.show("updates");
      else if(action==="commandResult"){this.v3ExecuteCommand(button.dataset.key);this.$("#v3CommandDialog").close();}
      else if(action==="2048restart"){this.v3Start2048();}
      else if(action==="2048move"){this.v3Move2048(button.dataset.direction);}
      else if(action==="minesRestart"){this.v3StartMines();}
      else if(action==="minesFlag"){this.v3FlagMode=!this.v3FlagMode;this.v3MinesScreen();}
      else if(action==="minesCell"){
        const index=Number(button.dataset.index);
        if(this.v3FlagMode){this.v3ToggleMineFlag(index);}else{openMine(this.v3Mines,index);this.v3MinesScreen();}
      }
    });
    this.$("#v3CommandInput").addEventListener("input",()=>this.v3DrawCommands());
    this.$("#v3CommandInput").addEventListener("keydown",event=>{
      const list=[...this.$("#v3CommandResults").querySelectorAll("button")];
      if(event.key==="ArrowDown"||event.key==="ArrowUp"){
        event.preventDefault();if(!list.length)return;
        const index=list.indexOf(document.activeElement),next=event.key==="ArrowDown"?(index+1)%list.length:(index-1+list.length)%list.length;
        list[next].focus();
      }else if(event.key==="Enter"&&list.length){event.preventDefault();list[0].click();}
    });
    this.$("#v3CommandResults").addEventListener("keydown",event=>{
      if(event.key!=="ArrowDown"&&event.key!=="ArrowUp")return;
      event.preventDefault();const buttons=[...event.currentTarget.querySelectorAll("button")];
      const i=buttons.indexOf(document.activeElement);
      if(event.key==="ArrowDown"){(buttons[i+1]||this.$("#v3CommandInput")).focus();}
      else (buttons[i-1]||this.$("#v3CommandInput")).focus();
    });
    this.v3Keydown=event=>{
      if(!this.active||this.$("#v3CommandDialog")?.open&&event.key!=="Escape")return;
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="k"){
        event.preventDefault();this.v3OpenCommand();return;
      }
      if(this.view==="2048"&&!event.altKey&&!event.ctrlKey&&!event.metaKey&&
         !["INPUT","TEXTAREA"].includes(document.activeElement?.tagName)){
        const direction={ArrowUp:"up",ArrowDown:"down",ArrowLeft:"left",ArrowRight:"right"}[event.key];
        if(direction){event.preventDefault();this.v3Move2048(direction);}
      }
    };
    document.addEventListener("keydown",this.v3Keydown);
  };
  Hub.prototype.v3ApplyPreferences=function(){
    const color=themeColors[this.v3Theme]||themeColors.forest;
    this.root.style.setProperty("--v3-accent",color);
    this.root.dataset.theme=this.v3Theme;
    const shell=this.$(".v3-shell");if(!shell)return;
    shell.classList.toggle("v3-no-inspector",!this.v3InspectorVisible);
    shell.classList.toggle("v3-no-dock",!this.v3DockVisible);
    const collapse=this.$(".v3-dock-toggle");
    if(collapse){collapse.textContent=this.v3DockVisible?"⌄":"⌃";collapse.title=this.v3DockVisible?"Collapse launcher":"Expand launcher";}
  };
  Hub.prototype.v3RenderDock=function(){
    const el=this.$("#v3DockGames");if(!el)return;
    const selected=this.v3Favorites.map(id=>catalog.find(g=>g.id===id)).filter(Boolean);
    el.innerHTML=(selected.length?selected:catalog.slice(0,4)).slice(0,5).map(g=>
      '<button class="v3-dock-game" data-v3="play" data-game="'+g.id+'" title="Play '+safe(g.name)+'"><span class="v3-dock-icon v3-'+g.className+'">'+g.icon+'</span><span>'+safe(g.name)+'</span></button>').join("");
  };
  Hub.prototype.v3RenderInspector=function(){
    const el=this.$("#v3InspectorContent");if(!el)return;
    const channels=["general","games","suggestions","support"];
    const recent=channels.flatMap(c=>(this.history?.[c]||[]).filter(m=>!m.deleted).slice(-12))
      .sort((a,b)=>b.at-a.at).slice(0,4);
    el.innerHTML=
      '<section class="v3-inspector-group"><div class="v3-inspector-title">LIVE NOW <span>'+this.users.length+'</span></div>'+
      (this.users.length?this.users.slice(0,8).map(u=>
        '<button class="v3-inspector-user" data-v3="channel"><span class="v3-user-avatar">'+safe(u.name?.[0]?.toUpperCase()||"?")+'</span>'+
        '<span><strong>'+safe(u.name)+'</strong><small>Online</small></span><i></i></button>').join(""):
        '<p class="v3-muted">People online will show up here.</p>')+'</section>'+
      '<section class="v3-inspector-group"><div class="v3-inspector-title">LATEST MESSAGES</div>'+
      (recent.length?recent.map(m=>
        '<button class="v3-inspector-message" data-v3="goChannel" data-channel="'+safe(m.channel)+'"><strong>'+safe(m.by)+'</strong><span>#'+safe(m.channel)+' · '+relative(m.at)+'</span><p>'+safe(m.message.slice(0,85))+'</p></button>').join(""):
        '<p class="v3-muted">No messages yet. Start the conversation.</p>')+'</section>'+
      '<section class="v3-inspector-group"><div class="v3-inspector-title">QUICK ACTIONS</div>'+
      '<button class="v3-side-action" data-v3="command">⌕ <span>Find anything</span><kbd>⌘ K</kbd></button>'+
      '<button class="v3-side-action" data-v3="ai">✧ <span>Open AI assistant</span><b>↗</b></button>'+
      '<button class="v3-side-action" data-v3="goDirectory">＋ <span>Join a community</span><b>↗</b></button></section>';
  };
  Hub.prototype.v3Sync=function(){
    const current=this.view;
    this.$$(".v3-primary-tabs button").forEach(button=>{
      const view=button.dataset.v3;
      button.classList.toggle("active",view==="overview"&&current==="overview"||
       view==="channel"&&["chat","room","directory"].includes(current)||
       view==="arcade"&&["games","chess","rps","world","uma","2048","mines"].includes(current));
    });
    this.$(".v3-global-brand small").textContent=this.v2ServerId?"COMMUNITY SERVER":"V2 WORKSPACE";
    this.v3RenderInspector();
  };
  Hub.prototype.v2Nav=function(){
    nav.call(this);
    if(!this.v3Ready)return;
    const navRoot=this.$("#v2Channels");if(!navRoot)return;
    if(!this.v2ServerId){
      this.$("#v2ServerTitle").textContent="Your space";
      this.$("#v2ServerAbout").textContent="Servers, chat and shortcuts.";
    }
    navRoot.insertAdjacentHTML("afterbegin",
      '<div class="v3-nav-kicker">WORKSPACE</div>'+
      '<button class="v3-nav-destination'+(this.view==="overview"?" active":"")+'" data-v3="overview"><i>⌂</i><span>Overview</span></button>'+
      '<button class="v3-nav-destination'+(this.view==="games"?" active":"")+'" data-v3="arcade"><i>▣</i><span>Game library</span></button>'+
      '<button class="v3-nav-destination" data-v3="browser"><i>◎</i><span>Web browser</span></button>');
    this.v3Sync();
  };
  Hub.prototype.open=function(view="overview"){
    open.call(this,view==="overview"?"chat":view);
    if(view==="overview")this.show("overview");
    this.v3Sync();
  };
  Hub.prototype.show=function(view,channel){
    if(["overview","2048","mines"].includes(view)){
      this.view=view;this.v2ServerId=null;
      this.$(".v3-shell")?.classList.remove("v2-nav-open");
      this.$(".v2-menu-button")?.setAttribute("aria-expanded","false");
      this.render();this.v2Nav();this.v3Sync();return;
    }
    show.call(this,view,channel);
    this.v3Sync();
  };
  Hub.prototype.render=function(){
    if(this.view==="overview")return this.v3Overview();
    if(this.view==="2048")return this.v3Screen2048();
    if(this.view==="mines")return this.v3MinesScreen();
    return render.call(this);
  };
  Hub.prototype.close=function(){if(this.$("#v3CommandDialog")?.open)this.$("#v3CommandDialog").close();close.call(this);};
  Hub.prototype.onMessage=function(m){
    onMessage.call(this,m);
    if(!this.v3Ready)return;
    if(["presence","chat","hello","v2State","v2Directory","v2Message","v2Server"].includes(m.type)){
      this.v3RenderInspector();
      if(this.view==="overview")this.v3Overview();
    }
  };
  Hub.prototype.v3Overview=function(){
    this.header("Overview","Your home base");
    const recent=["general","games","suggestions","support"].flatMap(c=>(this.history?.[c]||[])
      .filter(m=>!m.deleted).slice(-10)).sort((a,b)=>b.at-a.at).slice(0,5);
    const members=this.summary?.users??this.users.length;
    const rooms=this.v2Servers?.length||0;
    this.$("#hubContent").innerHTML=
      '<div class="v3-overview"><div class="v3-overview-inner">'+
        '<section class="v3-landing-hero"><div class="v3-landing-atmosphere" aria-hidden="true"><div class="v3-art-orb"></div><div class="v3-art-grid"></div><span class="v3-art-mark">ϟ</span></div>'+
          '<div class="v3-landing-content"><span class="v3-hero-kicker"><i></i> YOUR WORKSPACE · VERSION 2</span>'+
          '<h1>One place for<br><em>everything.</em></h1>'+
          '<p>Your friends, favorite games, communities and AI tools—connected in a single workspace.</p>'+
          '<div class="v3-hero-ctas"><button class="v3-main-button" data-v3="arcade">Explore games <span>↗</span></button>'+
          '<button class="v3-secondary-button" data-v3="ai">✧ Open AI</button></div></div>'+
          '<div class="v3-landing-index"><span>LIGHTNING / NEW EXPERIENCE</span><strong>02</strong><small>MAKE IT YOURS.</small></div>'+
        '</section>'+
        '<div class="v3-stat-strip">'+
          '<div><span class="v3-stat-symbol">●</span><strong>'+members+'</strong><small>PEOPLE ONLINE</small></div>'+
          '<div><span class="v3-stat-symbol">◈</span><strong>'+rooms+'</strong><small>YOUR SERVERS</small></div>'+
          '<div><span class="v3-stat-symbol">▣</span><strong>'+catalog.length+'</strong><small>GAMES AVAILABLE</small></div>'+
          '<div><span class="v3-stat-symbol">✧</span><strong>AI</strong><small>READY TO ASSIST</small></div>'+
        '</div>'+
        sectionHeading("DISCOVER & PLAY","Jump into something",
          '<button class="v3-inline-link" data-v3="arcade">Full library ↗</button>')+
        '<div class="v3-featured-row">'+catalog.slice(0,4).map(g=>gameCard(g,true)).join("")+'</div>'+
        '<div class="v3-lower-grid"><section class="v3-overview-panel">'+
          sectionHeading("LATEST FROM THE COMMUNITY","The conversation",
            '<button class="v3-inline-link" data-v3="channel">Open chat ↗</button>')+
          (recent.length?recent.map(m=>'<button class="v3-feed-row" data-v3="goChannel" data-channel="'+safe(m.channel)+'">'+
            '<span class="v3-feed-avatar">'+safe(m.by?.[0]?.toUpperCase()||"?")+'</span>'+
            '<span><strong>'+safe(m.by)+'</strong><small>#'+safe(m.channel)+' · '+relative(m.at)+'</small><p>'+safe(m.message.slice(0,150))+'</p></span></button>').join(""):
            '<div class="v3-empty-feed">It is quiet here. Start something in #general.<button data-v3="channel">Go to chat →</button></div>')+
          '</section><section class="v3-overview-panel">'+
          sectionHeading("YOUR SPACES","Community servers",'<button class="v3-inline-link" data-v3="goDirectory">Discover ↗</button>')+
          (this.v2Servers.length?this.v2Servers.slice(0,6).map(s=>
            '<button class="v3-space-row" data-v3="goServer" data-id="'+safe(s.id)+'"><span>'+safe(s.icon||"✦")+'</span>'+
              '<div><strong>'+safe(s.name)+'</strong><small>'+s.memberCount+' members · '+s.channels.length+' channels</small></div><b>↗</b></button>').join(""):
            '<div class="v3-new-server"><span>◈</span><h3>Find your crowd.</h3><p>Discover or create a server for your community.</p>'+
            '<button class="v3-secondary-button" data-v3="goDirectory">Browse servers ↗</button></div>')+
          '</section></div>'+
        '<div class="v3-update-ribbon"><div><small>VERSION TWO</small><strong>Rebuilt for you.</strong><p>Cleaner navigation, richer chat, a smarter workspace and more games.</p></div>'+
          '<button data-v3="goUpdates">See what changed ↗</button></div>'+
      '</div></div>';
    this.v3Sync();
  };
  Hub.prototype.games=function(){
    this.header("Game library","Six games. One place to play.");
    const categories=["All","Strategy","Casual","Fighting","Puzzle"];
    const filter=categories.includes(this.v3Filter)?this.v3Filter:"All";
    const games=catalog.filter(g=>filter==="All"||g.kind===filter).filter(g=>
      !this.v3GameQuery||g.name.toLowerCase().includes(this.v3GameQuery));
    this.$("#hubContent").innerHTML=
      '<div class="v3-library"><div class="v3-library-top"><div>'+
        '<span class="v3-eyebrow">EXPLORE / ARCADE</span><h1>Pick your next<br><em>obsession.</em></h1>'+
        '<p>Multiplayer favorites, quick matches and new single-player challenges.</p></div>'+
        '<div class="v3-library-ornament" aria-hidden="true">◈</div></div>'+
        '<div class="v3-library-controls"><div class="v3-category-tabs">'+categories.map(c=>
          '<button type="button" data-v3filter="'+c+'" class="'+(filter===c?"active":"")+'">'+c+'</button>').join("")+'</div>'+
          '<label class="v3-library-search">⌕ <input id="v3GameSearch" placeholder="Find a game" aria-label="Find a game" value="'+safe(this.v3GameQuery||"")+'"></label></div>'+
        '<div class="v3-game-library-grid">'+games.map(g=>
          '<article class="v3-game-card v3-game-'+g.className+'"><div class="v3-game-picture"><span>'+g.icon+'</span><i>'+g.kind.toUpperCase()+'</i></div>'+
            '<div class="v3-game-bottom"><div><strong>'+safe(g.name)+'</strong><small>'+safe(g.note)+'</small></div>'+
            '<div class="v3-card-actions"><button data-v3="favorite" data-game="'+g.id+'" class="v3-star-button" title="'+(this.v3Favorites.includes(g.id)?"Remove from quick launch":"Add to quick launch")+'">'+(this.v3Favorites.includes(g.id)?"★":"☆")+'</button>'+
            '<button data-v3="play" data-game="'+g.id+'">Play ↗</button></div></div></article>').join("")+
        (!games.length?'<div class="v3-library-empty">No games match that search.</div>':"")+'</div>'+
        '<div class="v3-library-end">Your favorites show up in the quick launcher below. Pick ★ to customize it.</div></div>';
    this.$$("#hubContent [data-v3filter]").forEach(b=>b.addEventListener("click",()=>{this.v3Filter=b.dataset.v3filter;this.games();}));
    this.$("#v3GameSearch").addEventListener("input",event=>{
      this.v3GameQuery=event.target.value.toLowerCase().trim();
      const start=event.target.selectionStart;
      this.games();
      const input=this.$("#v3GameSearch");input.focus();input.setSelectionRange(start,start);
    });
    this.v3Sync();
  };
  Hub.prototype.v3Launch=function(id){
    if(id==="2048")return this.v3Start2048();
    if(id==="mines")return this.v3StartMines();
    const game=catalog.find(g=>g.id===id);if(!game)return;
    const fakeButton=document.createElement("button");
    fakeButton.dataset.act=game.action;
    this.act(game.action,fakeButton);
  };
  Hub.prototype.v3OpenCommand=function(){
    this.$("#v3CommandDialog").showModal();
    this.$("#v3CommandInput").value="";
    this.v3DrawCommands();this.$("#v3CommandInput").focus();
  };
  Hub.prototype.v3Commands=function(){
    const basics=[
      ["overview","⌂","Overview","Open home dashboard","Workspace"],
      ["chat","＃","Community chat","Open #general","Workspace"],
      ["directory","◈","Discover servers","Find or create communities","Community"],
      ["browser","◎","Browser","Switch to browser tabs","Workspace"],
      ["ai","✧","AI assistant","Open floating AI workspace","Tools"],
      ["theme","◐","Appearance","Change accent theme","Tools"]
    ];
    const channels=["general","games","suggestions","support"].map(c=>
      ["channel:"+c,"#","#"+c,"Go to community channel","Channels"]);
    return [...basics,...channels,...catalog.map(g=>["game:"+g.id,g.icon,g.name,g.kind+" game","Games"]),
      ...this.v2Servers.map(s=>["server:"+s.id,s.icon||"◆",s.name,"Open your server","Servers"])];
  };
  Hub.prototype.v3DrawCommands=function(){
    const query=this.$("#v3CommandInput").value.toLowerCase().trim();
    const commands=this.v3Commands().filter(c=>!query||[c[2],c[3],c[4]].join(" ").toLowerCase().includes(query)).slice(0,18);
    this.$("#v3CommandResults").innerHTML=commands.length?commands.map(([key,icon,name,desc,group])=>
      '<button data-v3="commandResult" data-key="'+safe(key)+'"><span class="v3-command-icon">'+safe(icon)+'</span><span><strong>'+safe(name)+'</strong><small>'+safe(desc)+'</small></span><em>'+safe(group)+'</em></button>').join(""):
      '<p>No matches. Try a channel, game or tool.</p>';
  };
  Hub.prototype.v3ExecuteCommand= function(key){
    if(key==="overview")this.show("overview");
    else if(key==="chat")this.show("chat","general");
    else if(key==="directory")this.v2Discover();
    else if(key==="browser")this.close();
    else if(key==="ai")document.getElementById("boltBubble")?.click();
    else if(key==="theme")this.$("#v3ThemeDialog").showModal();
    else if(key.startsWith("channel:"))this.show("chat",key.slice(8));
    else if(key.startsWith("game:"))this.v3Launch(key.slice(5));
    else if(key.startsWith("server:")){
      const s=this.v2Servers.find(s=>s.id===key.slice(7));
      if(s){this.v2ServerId=s.id;this.v2Channel=s.channels[0]?.id||"general";this.show("room");}
    }
  };
  Hub.prototype.v3Start2048=function(){
    this.v3Game2048=make2048();spawn2048(this.v3Game2048);spawn2048(this.v3Game2048);
    this.show("2048");
  };
  Hub.prototype.v3Move2048=function(direction){
    const game=this.v3Game2048;
    if(game&&!game.over&&slide2048(game,direction)){
      try{
        const best=Number(localStorage.getItem("lightning.v3.best2048")||0);
        if(game.score>best)localStorage.setItem("lightning.v3.best2048",String(game.score));
      }catch{}
      this.v3Screen2048();
    }
  };
  Hub.prototype.v3Screen2048=function(){
    this.header("2048","A numbers puzzle");
    const g=this.v3Game2048||(this.v3Game2048=make2048()),best=preference("best2048",0);
    this.$("#hubContent").innerHTML='<section class="v3-play-screen v3-playing-2048"><div class="v3-play-heading">'+
      '<button data-v3="arcade">← All games</button><span>PUZZLE · SOLO</span></div>'+
      '<div class="v3-play-content"><div class="v3-play-intro"><span>YOUR NEXT CHALLENGE</span><h1>2048<span>.</span></h1>'+
      '<p>Swipe or use your arrow keys to combine matching numbers. Reach 2048 to claim a win.</p>'+
      '<div class="v3-play-stats"><div><small>SCORE</small><strong>'+g.score+'</strong></div><div><small>BEST</small><strong>'+best+'</strong></div></div>'+
      '<button class="v3-main-button" data-v3="2048restart">↻ New game</button>'+
      (g.over?'<div class="v3-game-result">No more moves. Try again!</div>':"")+'</div>'+
      '<div class="v3-board-frame"><div class="v3-2048-board" aria-label="2048 game board">'+g.cells.map((n,i)=>
        '<div class="v3-tile v3-tile-'+(n?Math.min(n,2048):0)+'" aria-label="'+(n?n:"empty")+'">'+(n||"")+'</div>').join("")+'</div>'+
      '<div class="v3-direction-buttons"><button data-v3="2048move" data-direction="left" aria-label="Move left">←</button>'+
      '<button data-v3="2048move" data-direction="up" aria-label="Move up">↑</button>'+
      '<button data-v3="2048move" data-direction="down" aria-label="Move down">↓</button>'+
      '<button data-v3="2048move" data-direction="right" aria-label="Move right">→</button></div></div></div></section>';
    this.v3Sync();
  };
  Hub.prototype.v3StartMines=function(){
    this.v3Mines=makeMines();this.v3FlagMode=false;this.show("mines");
  };
  Hub.prototype.v3ToggleMineFlag=function(i){
    const g=this.v3Mines;if(!g||g.over||g.cells[i].open)return;
    const c=g.cells[i];if(!c.flag&&g.remaining<=0)return;
    c.flag=!c.flag;g.remaining+=c.flag?-1:1;
    this.v3MinesScreen();
  };
  Hub.prototype.v3MinesScreen=function(){
    this.header("Minesweeper","A classic logic game");
    const g=this.v3Mines||(this.v3Mines=makeMines());
    this.$("#hubContent").innerHTML='<section class="v3-play-screen v3-playing-mines"><div class="v3-play-heading">'+
      '<button data-v3="arcade">← All games</button><span>PUZZLE · SOLO</span></div>'+
      '<div class="v3-play-content"><div class="v3-play-intro"><span>THINK BEFORE YOU CLICK</span><h1>Mine<span>s.</span></h1>'+
      '<p>Reveal all safe squares. Right-click a square, or switch to flag mode, to mark suspected mines.</p>'+
      '<div class="v3-play-stats"><div><small>FLAGS LEFT</small><strong>'+g.remaining+'</strong></div><div><small>SAFE CELLS</small><strong>'+g.cells.filter(c=>c.open&&!c.mine).length+'/54</strong></div></div>'+
      '<div class="v3-mines-tools"><button class="v3-main-button" data-v3="minesRestart">↻ New field</button>'+
      '<button class="v3-secondary-button'+(this.v3FlagMode?" v3-active-flag":"")+'" data-v3="minesFlag">'+(this.v3FlagMode?"⚑ Flag mode on":"⚑ Flag mode off")+'</button></div>'+
      (g.over?'<div class="v3-game-result">'+(g.won?"Field cleared. You win!":"Boom. Try a new field.")+'</div>':"")+'</div>'+
      '<div class="v3-board-frame"><div id="v3MineGrid" class="v3-mines-grid" role="grid" aria-label="Minesweeper">'+g.cells.map((c,i)=>
        '<button type="button" role="gridcell" data-v3="minesCell" data-index="'+i+'" class="v3-mine-cell'+(c.open?" open":"")+(c.flag?" flagged":"")+(c.mine?" is-mine":"")+'" '+
        (g.over||c.open?"disabled":"")+' aria-label="Square '+(i+1)+(c.flag?" flagged":c.open?" revealed":" hidden")+'">'+
        (c.open?(c.mine?"✹":c.count||""):c.flag?"⚑":"")+'</button>').join("")+'</div>'+
      '<small>First click is always safe.</small></div></div></section>';
    const grid=this.$("#v3MineGrid");
    grid.addEventListener("contextmenu",event=>{
      const cell=event.target.closest("[data-index]");if(!cell)return;
      event.preventDefault();this.v3ToggleMineFlag(Number(cell.dataset.index));
    });
    this.v3Sync();
  };
}

export {slide2048,make2048,makeMines,openMine};
