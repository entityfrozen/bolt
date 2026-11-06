/* Multiplayer invites and channel alerts use Lightning's existing /live socket. */
const escapeText=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const games={chess:"Chess",rps:"Rock Paper Scissors"};
const emit=(name,detail)=>document.dispatchEvent(new CustomEvent(name,{detail}));
function isMentioned(message,username){
 const name=String(username||"").toLowerCase();
 return name.length>=3&&[...String(message||"").matchAll(/(?:^|[^a-z0-9._-])@([a-z0-9._-]{3,32})(?![a-z0-9._-])/gi)]
  .some(match=>match[1].toLowerCase()===name);
}
export function installGameInvites(Hub){
 const originalMessage=Hub.prototype.onMessage;
 const originalChess=Hub.prototype.chessScreen;
 const originalRps=Hub.prototype.rpsScreen;
 const originalGames=Hub.prototype.games;
 Hub.prototype.initInvites=function(){
  if(this.inviteButtonsReady)return;
  this.inviteButtonsReady=true;
  this.root.addEventListener("click",event=>{
   const button=event.target.closest("[data-gi-target]");
   if(!button)return;
   const game=button.dataset.giGame==="choose"?
    this.$(".gi-game-select")?.value:button.dataset.giGame;
   if(!games[game])return;
   if(this.send({type:"gameInvite",game,target:button.dataset.giTarget})){
    button.disabled=true;
    setTimeout(()=>{if(button.isConnected)button.disabled=false;},900);
   }
  });
 };
 Hub.prototype.inviteRoster=function(kind){
  const host=kind==="chess"?this.$(".new-chess-lobby .new-chess-copy"):
   kind==="rps"?this.$(".rps-fresh-lobby"):this.$(".arc-page-inner");
  if(!host)return;
  const people=(this.users||[]).filter(user=>user.id&&user.id!==this.id).slice(0,24);
  const panel=document.createElement("section");panel.className="gi-roster gi-roster-"+kind;
  panel.setAttribute("aria-label","Invite an online player");
  const picker=kind==="choose"?'<label class="gi-pick-game">GAME <select class="gi-game-select" aria-label="Game to invite to"><option value="chess">Chess</option><option value="rps">Rock Paper Scissors</option></select></label>':"";
  panel.innerHTML='<header><div><span>PLAY TOGETHER</span><strong>Invite a player</strong></div><small><i aria-hidden="true"></i>'+people.length+' online</small></header>'+picker+
   (people.length?'<div class="gi-roster-list">'+people.map(user=>
    '<div class="gi-roster-person"><span class="gi-roster-avatar">'+escapeText((user.name||user.username||"?")[0].toUpperCase())+'</span>'+
    '<span class="gi-roster-name"><strong>'+escapeText(user.name||user.username||"Member")+'</strong>'+
    '<small>@'+escapeText(user.username||"player")+'</small></span>'+
    '<button type="button" data-gi-target="'+escapeText(user.id)+'" data-gi-game="'+kind+
    '" aria-label="Invite '+escapeText(user.name||user.username||"player")+' to a game">Invite ↗</button></div>'
   ).join("")+'</div>':
   '<p class="gi-roster-empty">No other players online. More will appear as they join Lightning.</p>');
  const before=kind==="chess"?host.querySelector(".chess-link-back"):
   kind==="rps"?host.querySelector(".rps-back-link"):host.querySelector(".arc-page-footer");
  host.insertBefore(panel,before||null);
 };
 Hub.prototype.chessScreen=function(){originalChess.call(this);this.initInvites();if(!this.chess)this.inviteRoster("chess");};
 Hub.prototype.rpsScreen=function(){originalRps.call(this);this.initInvites();if(!this.rps)this.inviteRoster("rps");};
 Hub.prototype.games=function(){originalGames.call(this);this.initInvites();this.inviteRoster("choose");};
 Hub.prototype.onMessage=function(packet){
  this.initInvites();
  const type=packet?.type;
  if((type==="chessStart"||type==="rpsStart")&&!this.v2Ready)this.v2Setup();
  const previousServer=type==="v2Message"?this.v2Servers?.find(server=>server.id===packet.serverId):null;
  const previousMessages=previousServer?.messages?.[packet?.entry?.channel]||[];
  const reply=packet?.entry?.replyTo?previousMessages.find(row=>row.id===packet.entry.replyTo):null;
  originalMessage.call(this,packet);
  window.LightningGames={
   invite:(target,game)=>this.send({type:"gameInvite",target,game}),
   respond:(id,action)=>this.send({type:"gameInviteRespond",id,action})
  };
  if(type==="accountNotification"&&packet.entry){
   emit("lightning:account-alert",packet.entry);
  }else if(type==="gameInvite"&&packet.id){
   emit("lightning:toast",{key:"invite:"+packet.id,kind:"game",inviteId:packet.id,
    expiresAt:packet.expiresAt,label:"CHALLENGE RECEIVED",
    title:(packet.from?.name||"A player")+" invited you",
    body:"Play "+(games[packet.game]||"a game")+" together? Accept to start."});
  }else if(type==="gameInviteSent"){
   emit("lightning:toast",{key:"sent:"+packet.id,kind:"system",title:"Invite sent",
    body:"Waiting for "+(packet.name||"the player")+" to accept your "+
     (games[packet.game]||"game")+" challenge."});
  }else if(type==="gameInviteResult"&&packet.id){
   emit("lightning:invite-result",{id:packet.id,status:packet.status});
   if(packet.from===this.id&&["accepted","declined","expired","busy","unavailable"].includes(packet.status)){
    emit("lightning:toast",{key:"result:"+packet.id,kind:"system",label:"CHALLENGE UPDATE",
     title:packet.toName||"Player",
     body:packet.status==="accepted"?"Accepted! Starting your match…":
      packet.status==="declined"?"Declined the challenge.":
      packet.status==="expired"?"The invitation expired.":
      "Could not join this match. Try again later."});
   }
  }else if(type==="chat"&&packet.entry&&packet.entry.userId!==this.id){
   const m=packet.entry;
   const visible=this.active&&this.view==="chat"&&this.channel===m.channel&&!document.hidden;
   const mode=this.notifyMode||"all";
   if(!visible&&mode!=="off"&&mode!=="mentions"&&!isMentioned(m.message,this.username)){
    emit("lightning:toast",{key:"chat:"+m.id,kind:"chat",label:"CHANNEL · #"+m.channel,
     title:m.by||"New message",body:m.message,
     onOpen:()=>{this.open("chat");this.show("chat",m.channel);}});
   }
  }else if(type==="v2Message"&&packet.entry&&packet.entry.userId!==this.id){
   const m=packet.entry;
   const visible=this.active&&this.view==="room"&&this.v2ServerId===packet.serverId&&
    this.v2Channel===m.channel&&!document.hidden;
   if(!visible&&!isMentioned(m.message,this.username)&&reply?.userId!==this.id&&this.notifyMode!=="off"){
    emit("lightning:toast",{key:"room:"+m.id,kind:"chat",label:"CHANNEL · #"+m.channel,
     title:m.by||"New message",body:m.message,onOpen:()=>{
      window.LightningNotificationDestination={serverId:packet.serverId,channel:m.channel};
      this.open("room");emit("lightning:notification-channel");
     }});
   }
  }
  if(type==="chessStart"||type==="rpsStart"){
   this.root.hidden=false;this.active=true;
   this.view=type==="chessStart"?"chess":"rps";this.render();this.v2Nav?.();
  }
  if((type==="hello"||type==="presence")&&this.active&&
   ((this.view==="chess"&&!this.chess)||(this.view==="rps"&&!this.rps)||this.view==="games")){
   const roster=(this.users||[]).map(user=>user.id).sort().join(",");
   if(roster!==this.giRosterSignature){this.giRosterSignature=roster;this.render();}
  }
 };
}
