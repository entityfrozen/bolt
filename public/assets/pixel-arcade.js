import {createSoccer} from "./pixel-soccer.js?v=4";
import {createBasketball} from "./pixel-basketball.js?v=5";

const sports=new Set(["pixelSoccer","pixelBasketball"]);
const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const games=[
  {id:"pixelBasketball",type:"pixel",title:"Pixel Basketball",tag:"Solo · CPU",kind:"basketball",description:"Time your release, find space and beat the shot clock.",action:"sportsOpen"},
  {id:"pixelSoccer",type:"pixel",title:"Pixel Soccer",tag:"Solo · CPU",kind:"soccer",description:"Beat your marker with a fake, bend a strike, or chip the keeper.",action:"sportsOpen"},
  {id:"world",type:"strategy",title:"WorldPvP",tag:"Online · Strategy",kind:"world",description:"Choose a starting position. Expand your territory. Take the map.",action:"worldView"},
  {id:"chess",type:"strategy",title:"Chess",tag:"Online · Practice",kind:"chess",description:"Play a match or try your openings against the computer.",action:"chessView"},
  {id:"rps",type:"party",title:"Rock Paper Scissors",tag:"Online · Quick",kind:"rps",description:"A quick match or a tournament against other members.",action:"rpsView"}
];

const art=kind=>{
  if(kind==="basketball"||kind==="soccer")
    return '<canvas class="arc-game-preview" width="480" height="270" data-preview="'+kind+'" aria-hidden="true"></canvas>';
  if(kind==="world")return '<div class="arc-visual arc-visual-world"><span class="arc-globe">◉</span><em>GLOBAL CONQUEST</em></div>';
  if(kind==="chess")return '<div class="arc-visual arc-visual-chess"><span>♞</span><span>♔</span></div>';
  return '<div class="arc-visual arc-visual-rps"><span>✊</span><span>✋</span><span>✌</span></div>';
};

export function installPixelArcade(Hub){
  const originalRender=Hub.prototype.render;
  const originalShow=Hub.prototype.show;
  const originalClose=Hub.prototype.close;
  const originalAct=Hub.prototype.act;

  Hub.prototype.games=function(){
    this.header("Arcade","Five games");
    const filter=this.arenaFilter||"all";
    const visible=games.filter(game=>filter==="all"||game.type===filter);
    const tabs=[["all","All"],["pixel","Pixel sports"],["strategy","Strategy"],["party","Quick matches"]];
    this.$("#hubContent").innerHTML=
      '<section class="arc-page"><div class="arc-page-inner">'+
        '<section class="arc-intro"><div class="arc-intro-top"><span>LIGHTNING / ARCADE</span><span>FIVE GAMES</span></div>'+
        '<div class="arc-intro-bottom"><div><h1>Find a game<span>.</span></h1><p>Play online or against the computer.</p></div>'+
        '<div class="arc-online-stat"><b>'+(this.summary?.users||0)+'</b><span>CONNECTED<br>PLAYERS</span></div></div></section>'+
        '<nav class="arc-tabs" aria-label="Filter games">'+tabs.map(([key,title])=>
          '<button type="button" data-act="arcFilter" data-filter="'+key+'" class="'+(key===filter?"active":"")+'">'+title+'</button>').join("")+'</nav>'+
        '<div class="arc-grid">'+visible.map((game,index)=>
          '<article class="arc-game arc-'+game.kind+'" style="--order:'+index+'">'+
            '<div class="arc-game-media">'+art(game.kind)+'<span class="arc-game-label">'+escapeHtml(game.tag)+'</span></div>'+
            '<div class="arc-game-info"><h3>'+escapeHtml(game.title)+'</h3><p>'+escapeHtml(game.description)+'</p>'+
              '<button type="button" class="arc-play" data-act="'+game.action+'"'+(game.action==="sportsOpen"?' data-game="'+game.id+'"':'')+'>'+(game.type==="pixel"?"Play solo":"Play")+' <span>↗</span></button>'+
            '</div></article>').join("")+'</div>'+
        '<footer class="arc-page-footer"><span>LIGHTNING / ARCADE</span><span>Pixel sports are local matches</span></footer>'+
      '</div></section>';
    for(const canvas of this.$$(".arc-game-preview")){
      const game=canvas.dataset.preview==="soccer"?createSoccer():createBasketball();
      const context=canvas.getContext("2d",{alpha:false});
      if(!context)continue;
      game.phase="play";
      game.draw(context);
    }
  };

  Hub.prototype.stopPixel=function(){
    if(this.pixelFrame!==undefined&&this.pixelFrame!==null)cancelAnimationFrame(this.pixelFrame);
    this.pixelFrame=null;
    if(this.pixelKeyboard){
      window.removeEventListener("keydown",this.pixelKeyboard.down);
      window.removeEventListener("keyup",this.pixelKeyboard.up);
      window.removeEventListener("blur",this.pixelKeyboard.blur);
      this.pixelKeyboard=null;
    }
    this.pixelResize?.disconnect();
    this.pixelResize=null;
    this.pixelKeys?.clear();
    this.pixelInstance=null;
  };

  Hub.prototype.pixelScreen=function(kind){
    if(!sports.has(kind))return;
    this.stopPixel();
    const soccer=kind==="pixelSoccer",title=soccer?"SOCCER":"BASKETBALL";
    const difficulty=this.pixelDifficulty||"normal";
    this.header("Pixel "+(soccer?"Soccer":"Basketball"),"Local match vs CPU");
    this.$("#hubContent").innerHTML=
      '<section class="px-page '+(soccer?"px-soccer":"px-basketball")+'"><div class="px-wrap">'+
        '<header class="px-head"><div><span class="px-kicker">LIGHTNING / PIXEL SPORTS</span><h2>PIXEL <em>'+title+'</em></h2>'+
          '<p>Hold X, time your release, then play defense.</p></div><button type="button" class="px-back" data-act="pixelBack">← Arcade</button></header>'+
        '<div class="px-board"><div class="px-scoreboard">'+
          '<div class="px-score-team"><span>YOU · '+escapeHtml(this.name||"HOME")+'</span><strong id="pixelHome">0</strong></div>'+
          '<div class="px-center-clock"><span>VS CPU</span><strong id="pixelClock">'+(soccer?"01:40":"01:50")+'</strong><small id="pixelStatus">READY</small></div>'+
          '<div class="px-score-team away"><span>CPU</span><strong id="pixelAway">0</strong></div>'+
        '</div><div class="px-canvas-shell"><div class="px-canvas-stage">'+
          '<canvas id="pixelCanvas" width="480" height="270" aria-label="Pixel '+title+' game, use X to charge and release a shot"></canvas>'+
          '<div class="px-shot-overlay" id="pixelShotOverlay" hidden>'+
            '<div class="px-shot-label"><strong id="pixelShotTitle">SHOT TIMING</strong><span id="pixelShotQuality">0%</span></div>'+
            '<div class="px-shot-track"><div class="px-shot-green" id="pixelShotGreen"></div><div class="px-shot-needle" id="pixelShotNeedle"></div></div>'+
            '<div class="px-shot-caption" id="pixelShotTip">Release in the green</div>'+
          '</div><div class="px-feedback" id="pixelFeedback" hidden></div>'+
        '</div><div class="px-pause-overlay" id="pixelPaused" hidden><strong>PAUSED</strong><span>Press resume to keep playing</span></div></div>'+
        '<div class="px-controls"><div class="px-controls-label"><span class="px-dot"></span> '+(soccer?"PITCH":"COURT")+' / CPU'+
          (soccer?' <span class="px-stamina">SPRINT <i><b id="pixelStaminaFill"></b></i></span>':'')+
          '</div><div class="px-controls-buttons"><button type="button" data-act="pixelPause" id="pixelPause">Ⅱ PAUSE</button>'+
          '<button type="button" data-act="pixelRestart">↻ REMATCH</button>'+
          '<label>DIFFICULTY <select id="pixelDifficulty">'+["easy","normal","hard"].map(d=>
            '<option value="'+d+'"'+(d===difficulty?" selected":"")+'>'+d.toUpperCase()+'</option>').join("")+
          '</select></label></div></div></div>'+
        '<section class="px-instructions">'+
          '<div><span>01 / MOVE</span><strong>'+ (soccer?"WASD / ARROWS":"A · D / ARROWS")+'</strong><p>'+(soccer?"Shift to sprint; stamina regenerates.":"W / Up jumps. Shift runs faster.")+'</p></div>'+
          '<div><span>02 / SHOOT</span><strong>HOLD X · RELEASE</strong><p>'+(soccer?"C changes the kick to a lob. A/D adds curve. Space fakes.":"Green goes in unless blocked. Outside green, the percentage is the make chance.")+'</p></div>'+
          '<div><span>03 / DEFEND</span><strong>'+(soccer?"Z · C":"Z / C")+'</strong><p>'+(soccer?"Z tackles. C jumps or heads a lob.":"Steal with Z or C; a miss leaves you exposed.")+'</p></div>'+
        '</section>'+
        '<section class="px-touch" aria-label="Touch controls">'+
          '<div class="px-pad"><button type="button" data-pixel-key="arrowup">▲</button><div>'+
            '<button type="button" data-pixel-key="arrowleft">◀</button>'+
            '<button type="button" data-pixel-key="arrowdown">▼</button>'+
            '<button type="button" data-pixel-key="arrowright">▶</button></div></div>'+
          '<div class="px-touch-actions">'+
            '<button type="button" data-pixel-key="shift">SPRINT</button>'+
            '<button type="button" data-pixel-key="z">STEAL</button>'+
            '<button type="button" data-pixel-key="c">'+(soccer?"CHIP / JUMP":"STEAL")+'</button>'+
            (soccer?'<button type="button" data-pixel-key="space">FAKE</button>':'<button type="button" data-pixel-key="w">JUMP</button>')+
            '<button type="button" class="px-touch-shoot" data-pixel-key="x">HOLD X<br>SHOOT</button>'+
          '</div></section>'+
      '</div></section>';
    const canvas=this.$("#pixelCanvas");
    const ctx=canvas.getContext("2d",{alpha:false});
    if(!ctx){this.flash("This browser does not support canvas.");return;}
    ctx.imageSmoothingEnabled=false;
    this.pixelInstance=soccer?createSoccer({difficulty}):createBasketball({difficulty});
    this.pixelKeys=new Set();
    this.pixelPaused=false;
    const applyPress=key=>{
      if(this.pixelKeys.has(key))return;
      this.pixelKeys.add(key);
      if(key==="x")this.pixelInstance?.press("x");
      else if(key==="space"&&soccer)this.pixelInstance?.fake();
      else if(["z","c","v","f"].includes(key))this.pixelInstance?.action(key);
    };
    const applyRelease=key=>{
      if(key==="x"&&this.pixelKeys.has(key))this.pixelInstance?.release("x");
      this.pixelKeys.delete(key);
    };
    const normalize=code=>{
      const key=code.toLowerCase().replace(/^key/,"");
      return key.startsWith("shift")?"shift":key;
    };
    const allowed=new Set(["arrowleft","arrowright","arrowup","arrowdown","w","a","s","d","shift","space","x","z","c","v","f"]);
    const keyboard={
      down:event=>{
        if(this.view!==kind||event.target?.closest?.("input,textarea,select,[contenteditable]"))return;
        const key=normalize(event.code);
        if(!allowed.has(key))return;
        event.preventDefault();applyPress(key);
      },
      up:event=>{
        const key=normalize(event.code);
        if(allowed.has(key)){event.preventDefault();applyRelease(key);}
      },
      blur:()=>{applyRelease("x");this.pixelKeys.clear();this.pixelPaused=true;this.pixelPauseUi();}
    };
    this.pixelKeyboard=keyboard;
    window.addEventListener("keydown",keyboard.down);
    window.addEventListener("keyup",keyboard.up);
    window.addEventListener("blur",keyboard.blur);
    for(const button of this.$$(".px-touch [data-pixel-key]")){
      const key=button.dataset.pixelKey;
      const press=event=>{
        event.preventDefault();
        button.setPointerCapture?.(event.pointerId);
        applyPress(key);button.classList.add("held");
      };
      const release=event=>{
        applyRelease(key);button.classList.remove("held");
        if(button.hasPointerCapture?.(event.pointerId))button.releasePointerCapture(event.pointerId);
      };
      button.addEventListener("pointerdown",press);
      button.addEventListener("pointerup",release);
      button.addEventListener("pointercancel",release);
      button.addEventListener("lostpointercapture",()=>{applyRelease(key);button.classList.remove("held")});
    }
    this.$("#pixelDifficulty").addEventListener("change",event=>{
      this.pixelDifficulty=event.target.value;
      this.pixelScreen(kind);
    });
    const shell=this.$(".px-canvas-shell"),stage=this.$(".px-canvas-stage");
    const fit=()=>{
      const available=shell.clientWidth;
      const scale=available>=960?2:available>=480?1:available/480;
      stage.style.width=Math.floor(480*scale)+"px";
      stage.style.height=Math.floor(270*scale)+"px";
    };
    fit();
    if(typeof ResizeObserver!=="undefined"){
      this.pixelResize=new ResizeObserver(fit);
      this.pixelResize.observe(shell);
    }else window.addEventListener("resize",fit,{once:true});
    const meter=this.$("#pixelShotOverlay"),green=this.$("#pixelShotGreen"),needle=this.$("#pixelShotNeedle");
    const feedback=this.$("#pixelFeedback");
    let previous=performance.now(),accumulator=0,nextHud=0;
    const render=now=>{
      if(this.view!==kind||!this.pixelInstance){this.pixelFrame=null;return;}
      const elapsed=Math.min(.07,(now-previous)/1000);previous=now;
      if(!this.pixelPaused){
        accumulator+=elapsed;
        for(let i=0;i<9&&accumulator>=1/120;i++){
          this.pixelInstance.tick(1/120,this.pixelKeys);
          accumulator-=1/120;
        }
      }else accumulator=0;
      const game=this.pixelInstance;
      game.draw(ctx);
      meter.hidden=!game.shot?.active;
      if(game.shot?.active){
        green.style.left=(game.shot.greenStart*100)+"%";
        green.style.width=((game.shot.greenEnd-game.shot.greenStart)*100)+"%";
        needle.style.left=(Math.min(1,game.shot.progress)*100)+"%";
        this.$("#pixelShotTitle").textContent=soccer?(game.shot.lob?"CHIP SHOT":"SHOT POWER"):"SHOT TIMING";
        this.$("#pixelShotQuality").textContent=Math.round(game.shot.quality*100)+"%";
        this.$("#pixelShotTip").textContent=soccer?"SPACE fake · C chip · A/D curve":"Green makes it · otherwise quality matters";
      }
      feedback.hidden=!(game.feedbackTime>0);
      if(game.feedbackTime>0)feedback.textContent=game.feedback;
      const stamina=this.$("#pixelStaminaFill");
      if(stamina)stamina.style.width=(game.user.sprint||0)+"%";
      if(now>=nextHud){
        nextHud=now+120;
        this.$("#pixelHome").textContent=game.score[0];
        this.$("#pixelAway").textContent=game.score[1];
        const seconds=Math.ceil(game.time);
        this.$("#pixelClock").textContent=String(Math.floor(seconds/60)).padStart(2,"0")+":"+String(seconds%60).padStart(2,"0");
        this.$("#pixelStatus").textContent=game.over?"FULL TIME":this.pixelPaused?"PAUSED":game.phase==="play"?"IN PLAY":game.notice;
      }
      this.pixelFrame=requestAnimationFrame(render);
    };
    this.pixelFrame=requestAnimationFrame(render);
  };
  Hub.prototype.pixelPauseUi=function(){
    const box=this.$("#pixelPaused"),button=this.$("#pixelPause");
    if(box)box.hidden=!this.pixelPaused;
    if(button)button.textContent=this.pixelPaused?"▶ RESUME":"Ⅱ PAUSE";
  };
  Hub.prototype.render=function(){
    if(sports.has(this.view))return this.pixelScreen(this.view);
    return originalRender.call(this);
  };
  Hub.prototype.show=function(view,channel){
    if(sports.has(this.view)&&this.view!==view)this.stopPixel();
    return originalShow.call(this,view,channel);
  };
  Hub.prototype.close=function(){this.stopPixel();return originalClose.call(this);};
  Hub.prototype.act=function(action,button){
    if(action==="arcFilter"){this.arenaFilter=button.dataset.filter||"all";this.games();return;}
    if(action==="sportsOpen"){this.show(button.dataset.game);return;}
    if(action==="pixelBack"){this.show("games");return;}
    if(action==="pixelRestart"){this.pixelScreen(this.view);return;}
    if(action==="pixelPause"){this.pixelPaused=!this.pixelPaused;this.pixelPauseUi();return;}
    return originalAct.call(this,action,button);
  };
}
