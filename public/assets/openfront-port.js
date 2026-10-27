// WorldPvP runs on Lightning's standalone strategy-game service.
// The upstream project's copyright and source notices remain visible below.
import {icon} from "./ui-icons.js?v=1";
const GAME_URL="https://lightning-openfront-production.up.railway.app/";
const GAME_ORIGIN=new URL(GAME_URL).origin;
const CREDITS='<div class="openfront-port-credit">© OpenFront and Contributors · '+
  '<a href="https://github.com/openfrontio/OpenFrontIO" target="_blank" rel="noopener noreferrer">Source (AGPL-3.0)</a> · '+
  '<a href="https://github.com/openfrontio/OpenFrontIO/blob/main/LICENSE-ASSETS" target="_blank" rel="noopener noreferrer">Asset terms</a></div>';

export function installWorldPort(Hub){
  const previousShow=Hub.prototype.show;
  const previousAct=Hub.prototype.act;
  const previousClose=Hub.prototype.close;
  const previousMessage=Hub.prototype.onMessage;

  Hub.prototype.sendWorldName=function(){
    const frame=this.$(".openfront-port-frame");
    if(!frame?.contentWindow)return;
    const profile=window.LightningAccount?.profile;
    if(!profile&&!this.worldProfileRequest&&window.LightningAccount?.refreshProfile){
      this.worldProfileRequest=window.LightningAccount.refreshProfile()
        .then(()=>this.sendWorldName()).catch(()=>{}).finally(()=>{this.worldProfileRequest=null;});
    }
    const name=profile?.displayName||this.name;
    if(!name)return;
    frame.contentWindow.postMessage({type:"lightning:setPlayerName",name,username:profile?.username||this.name},GAME_ORIGIN);
    const label=this.$("#worldAccountName");
    if(label&&label.dataset.ready!==name)label.textContent="Connecting "+name+"…";
  };
  Hub.prototype.onMessage=function(message){
    previousMessage.call(this,message);
    if(message.type==="hello")this.sendWorldName();
  };
  document.addEventListener("lightning:profile-updated",()=>{if(document.querySelector("#hubMount .openfront-port-frame"))this.sendWorldName();});
  window.addEventListener("message",event=>{
    if(event.origin!==GAME_ORIGIN)return;
    const frame=document.querySelector("#hubMount .openfront-port-frame");
    if(!frame||event.source!==frame.contentWindow)return;
    const status=document.querySelector("#worldAccountName");
    if(!status)return;
    if(event.data?.type==="lightning:toggleChat"){
      const toggle=document.querySelector("#hubMount .openfront-port-chat");
      toggle?.click();
      return;
    }
    if(event.data?.type==="lightning:nameReady"){
      status.dataset.ready=event.data.name;
      status.textContent="Playing as "+event.data.name;
    }else if(event.data?.type==="lightning:nameBridgeError"){
      status.textContent="Set your name in-game";
    }
  });

  Hub.prototype.worldScreen=function(){
    this.header("WorldPvP","Global strategy");
    this.$("#hubContent").replaceChildren();
    const mount=this.$("#hubWorld");
    mount.classList.add("hub-openfront-port");
    const ready=!!this.worldStarted;
    if(!ready){
      mount.innerHTML=
        '<div class="wp-welcome"><div class="wp-welcome-inner">'+
          '<div class="wp-welcome-top"><span>WORLD PVP</span><span>GLOBAL STRATEGY</span></div>'+
          '<div class="wp-hero"><div class="wp-eyebrow">STRATEGY</div><h1>WorldPvP</h1>'+
          '<p>Start with a small piece of the map. Grow your territory, train troops, and outlast the other nations.</p>'+
          '<div class="wp-launch"><button type="button" data-act="worldStart">Play WorldPvP <b>↗</b></button>'+
          '<button type="button" data-act="worldHow">HOW TO PLAY <b>?</b></button></div></div>'+
          '<div class="wp-beginner"><h2>Your first five minutes</h2><div class="wp-beginner-grid">'+
          '<section><span>01</span><strong>Choose your start</strong><p>Pick an open spot on the map when the match begins.</p></section>'+
          '<section><span>02</span><strong>Grow slowly</strong><p>Expand into empty land first. Keep troops in reserve.</p></section>'+
          '<section><span>03</span><strong>Watch the borders</strong><p>Enemies can attack while you expand. Protect the frontline.</p></section>'+
          '<section><span>04</span><strong>Make alliances</strong><p>Team up when a larger neighbor threatens you.</p></section>'+
          '</div></div><div class="wp-welcome-bottom"><span>Choose a map, game mode, and starting region</span><button data-act="back" type="button">← Back to arcade</button></div>'+
        '</div></div>'+CREDITS;
      return;
    }
    // Reopening the game must not reload its iframe or abandon the match.
    if(mount.querySelector(".openfront-port-frame")){
      this.sendWorldName();
      this.splitToggle?.(this.root.classList.contains("split-chat-open"));
      return;
    }
    mount.innerHTML=
      '<div class="openfront-port-bar">'+
        '<div class="openfront-port-identity"><span class="openfront-port-icon">'+icon("compass")+'</span><div><strong>WORLD<span>PVP</span></strong>'+
        '<small>Strategy · Live match</small></div></div>'+
        '<span class="openfront-port-grow"></span>'+
        '<span id="worldAccountName" class="openfront-port-account">Connecting player…</span>'+
        '<button type="button" class="openfront-port-action openfront-port-chat" data-split="toggle" aria-controls="lightningSideChat" aria-label="Toggle community chat">'+icon("message-circle")+' <span>Chat</span></button>'+
        '<button type="button" class="openfront-port-action" data-act="worldHow">'+icon("book-open")+' Guide</button>'+
        '<a class="openfront-port-action" href="'+GAME_URL+'" target="_blank" rel="noopener noreferrer" title="Open game in a separate tab (without your Lightning session)">'+icon("arrow-up-right")+' Full screen</a>'+
        '<button type="button" class="openfront-port-action" data-act="worldExit">'+icon("log-out")+' Exit</button>'+
      '</div><div class="wp-frame-wrap"><iframe class="openfront-port-frame" title="WorldPvP strategy match" allow="fullscreen; gamepad" referrerpolicy="strict-origin-when-cross-origin" src="'+GAME_URL+'"></iframe>'+
      '<div id="worldGuide" class="wp-guide" hidden><div class="wp-guide-panel" role="dialog" aria-label="How to play WorldPvP">'+
        '<div class="wp-guide-head"><strong>HOW TO PLAY</strong><button data-act="worldHow" type="button" aria-label="Close guide">×</button></div>'+
        '<h2>First match? Start here.</h2>'+
        '<p><b>1.</b> Choose a map, game mode, and starting position in the game lobby.</p>'+
        '<p><b>2.</b> Expand toward unclaimed territory before attacking stronger nations.</p>'+
        '<p><b>3.</b> Use the game\'s troop controls to decide how much of your army to send. Don\'t send everything.</p>'+
        '<p><b>4.</b> Zoom or drag the map to inspect borders. Watch your troop income.</p>'+
        '<p><b>5.</b> Try alliances and defensive positioning before joining big wars.</p>'+
        '<div class="wp-guide-note">Tip: a small safe start is often better than attacking immediately.</div>'+
        '<button type="button" data-act="worldHow" class="wp-guide-done">GOT IT</button>'+
      '</div></div></div>'+CREDITS;
    mount.querySelector("iframe")?.addEventListener("load",()=>this.sendWorldName());
    this.sendWorldName();
  };
  Hub.prototype.act=function(action,button){
    if(action==="worldView"){return this.show("world");}
    if(action==="worldStart"){this.worldStarted=true;return this.worldScreen();}
    if(action==="worldExit"){
      if(!confirm("Exit WorldPvP? Your match will close."))return;
      this.worldStarted=false;
      this.$("#hubWorld")?.replaceChildren();
      this.splitToggle?.(false);
      return this.show("games");
    }
    if(action==="worldHow"){
      const guide=this.$("#worldGuide");
      if(guide){guide.hidden=!guide.hidden;return;}
      const mount=this.$("#hubWorld");
      mount.insertAdjacentHTML("beforeend",'<div id="worldGuide" class="wp-guide"><div class="wp-guide-panel" role="dialog" aria-label="WorldPvP guide">'+
        '<div class="wp-guide-head"><strong>HOW TO PLAY</strong><button data-act="worldHow" type="button">×</button></div>'+
        '<h2>Before you start</h2><p><b>1.</b> Pick a map and a game mode from the lobby.</p>'+
        '<p><b>2.</b> Choose a starting location with plenty of open land.</p>'+
        '<p><b>3.</b> Grow your territory while saving troops for defense.</p>'+
        '<p><b>4.</b> Select enemy territory to attack, then choose troop commitment.</p>'+
        '<p><b>5.</b> Watch the leaderboard and make allies as you expand.</p>'+
        '<button type="button" data-act="worldStart" class="wp-guide-done">START PLAYING →</button>'+
        '</div></div>');
      return;
    }
    return previousAct.call(this,action,button);
  };
  Hub.prototype.show=function(view,channel){
    // Hide, don't unload, the external game when navigating the workspace.
    return previousShow.call(this,view,channel);
  };
  Hub.prototype.close=function(){
    // The player explicitly closed the workspace; keep game state mounted for return.
    return previousClose.call(this);
  };
}
