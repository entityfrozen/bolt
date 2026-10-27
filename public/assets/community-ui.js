import {icon,serverIcon} from "./ui-icons.js?v=1";

const MAIN="lightning-main";
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const channelIcon=c=>c.id==="announcements"?"megaphone":c.id==="welcome"?"book-open":c.id==="games"?"gamepad-2":c.id==="support"?"shield-check":"hash";
const cat=c=>({INFORMATION:"INFORMATION",COMMUNITY:"CONVERSATION",TEXT:"TEXT CHANNELS",GAMES:"GAMES",HELP:"HELP"})[c]||c;
const roleColor=color=>/^#[0-9a-f]{6}$/i.test(color||"")?color:"#c5bca9";

export function installCommunityUI(Hub){
 const setup=Hub.prototype.v2Setup,room=Hub.prototype.v2Room;
 const onMessage=Hub.prototype.onMessage;
 Hub.prototype.v2Setup=function(){
  setup.call(this);
  if(this.communityUiReady)return;
  this.communityUiReady=true;
  this.manageTab="channels";
  const dialog=document.createElement("dialog");
  dialog.id="communityManager";dialog.className="community-manager";
  dialog.setAttribute("aria-labelledby","communityManagerTitle");
  dialog.innerHTML='<div class="cm-shell"><header><div><small>SERVER SETTINGS</small><h2 id="communityManagerTitle">Manage server</h2></div><button type="button" data-cm="close" aria-label="Close settings">×</button></header>'+
    '<nav id="cmTabs" aria-label="Management sections"></nav><div id="cmContent" class="cm-content"></div></div>';
  this.root.append(dialog);
  this.root.addEventListener("click",event=>{
   const b=event.target.closest("[data-cm]");if(!b)return;
   const action=b.dataset.cm,s=this.currentCommunity?.();
   if(action==="close")return dialog.close();
   if(action==="main"){this.v2ServerId=MAIN;this.v2Channel="announcements";this.show("room");return;}
   if(action==="go"){this.v2ServerId=b.dataset.server||MAIN;this.v2Channel=b.dataset.channel;this.show("room");return;}
   if(action==="manage"){
    if(!s?.canManage)return this.flash("You do not have server management access.");
    this.manageTab="channels";this.drawCommunityManager();dialog.showModal();return;
   }
   if(action==="tab"){this.manageTab=b.dataset.tab;this.drawCommunityManager();return;}
   if(!s?.canManage)return;
   if(action==="readonly"||action==="private"){
    const c=s.channels.find(c=>c.id===b.dataset.channel);if(!c)return;
    this.send({type:"v2EditChannel",serverId:s.id,channel:c.id,[action==="readonly"?"readOnly":"staffOnly"]:!(action==="readonly"?c.readOnly:c.staffOnly)});
   }
   if(action==="rename-channel"){
    const c=s.channels.find(c=>c.id===b.dataset.channel),name=c&&prompt("Channel name",c.name);
    if(name?.trim())this.send({type:"v2EditChannel",serverId:s.id,channel:c.id,name:name.trim()});
   }
   if(action==="delete-channel"){
    const c=s.channels.find(c=>c.id===b.dataset.channel);
    if(c&&!c.protected&&confirm("Delete #"+c.name+" and all its messages?"))this.send({type:"v2DeleteChannel",serverId:s.id,channel:c.id});
   }
   if(action==="rename-role"){
    const r=s.roles.find(r=>r.id===b.dataset.role),name=r&&prompt("Role name",r.name);
    if(name?.trim())this.send({type:"v2EditRole",serverId:s.id,roleId:r.id,name:name.trim()});
   }
   if(action==="delete-role"){
    const r=s.roles.find(r=>r.id===b.dataset.role);
    if(r&&r.id!=="member"&&confirm("Delete the "+r.name+" role?"))this.send({type:"v2DeleteRole",serverId:s.id,roleId:r.id});
   }
  });
  this.root.addEventListener("submit",event=>{
   const form=event.target;
   if(!form.matches("[data-cm-form]"))return;
   event.preventDefault();
   const s=this.currentCommunity?.();if(!s?.canManage)return;
   const fields=new FormData(form);
   if(form.dataset.cmForm==="channel"){
    if(this.send({type:"v2AddChannel",serverId:s.id,name:fields.get("name"),category:fields.get("category"),
     readOnly:fields.has("readonly"),staffOnly:fields.has("private")}))form.reset();
   }else if(form.dataset.cmForm==="role"){
    if(this.send({type:"v2CreateRole",serverId:s.id,name:fields.get("name"),color:fields.get("color")}))form.reset();
   }else if(form.dataset.cmForm==="server"){
    this.send({type:"v2EditServer",serverId:s.id,description:fields.get("description"),...(s.permanent?{}:{name:fields.get("name")})});
   }
  });
  this.root.addEventListener("change",event=>{
   const el=event.target,s=this.currentCommunity?.();
   if(!s?.canManage)return;
   if(el.matches("[data-cm-role]"))this.send({type:"v2AssignRole",serverId:s.id,memberId:el.dataset.member,roleId:el.value});
   if(el.matches("[data-cm-color]"))this.send({type:"v2EditRole",serverId:s.id,roleId:el.dataset.roleId,color:el.value});
  });
 };
 Hub.prototype.currentCommunity=function(){
  return this.v2Servers.find(s=>s.id===this.v2ServerId)||this.v2Servers.find(s=>s.id===MAIN);
 };
 Hub.prototype.v2Nav=function(){
  if(!this.v2Ready)return;
  const current=this.currentCommunity(),main=!this.v2ServerId||this.v2ServerId===MAIN;
  const title=this.$("#v2ServerTitle"),sub=this.$("#v2ServerAbout");
  if(title)title.textContent=current?.name||"Community";
  if(sub)sub.textContent=current?(current.permanent?"Everyone belongs here":current.memberCount+" members"):"Your community";
  this.$(".v2-home")?.classList.toggle("active",main);
  const rail=this.$("#v2ServerIcons");
  if(rail)rail.innerHTML=this.v2Servers.filter(s=>s.id!==MAIN).map(s=>
    '<button type="button" data-v2="server" data-id="'+esc(s.id)+'" class="v2-server-icon'+(this.v2ServerId===s.id?" active":"")+'" aria-label="'+esc(s.name)+'" title="'+esc(s.name)+'">'+serverIcon(s.icon)+'</button>').join("");
  const nav=this.$("#v2Channels");if(!nav)return;
  const general='<div class="v3-nav-kicker">YOUR SPACE</div>'+
   '<button class="v3-nav-destination'+(this.view==="overview"?" active":"")+'" data-v3="overview">'+icon("home")+'<span>Overview</span></button>'+
   '<button class="v3-nav-destination'+(main&&this.view==="room"?" active":"")+'" data-cm="main">'+icon("message-circle")+'<span>Community</span></button>'+
   '<button class="v3-nav-destination'+(this.view==="games"?" active":"")+'" data-v3="arcade">'+icon("gamepad-2")+'<span>Games</span></button>'+
   '<button class="v3-nav-destination" data-v3="browser">'+icon("monitor")+'<span>Browser</span></button>'+
   '<button class="v3-nav-destination" data-v3="theme">'+icon("settings")+'<span>Settings</span></button>'+
   '<div class="cm-nav-divider"></div>';
  const categories=[...new Set((current?.channels||[]).map(c=>c.category))];
  const channelItems=categories.map(category=>
   '<div class="hub-nav-title cm-category">'+esc(cat(category))+'</div>'+
   current.channels.filter(c=>c.category===category).map(c=>
    '<button class="hub-link cm-channel'+(this.view==="room"&&this.v2ServerId===current.id&&this.v2Channel===c.id?" active":"")+
    '" data-cm="go" data-server="'+esc(current.id)+'" data-channel="'+esc(c.id)+'">'+icon(channelIcon(c))+
    '<span>'+esc(c.name)+'</span>'+(c.readOnly?icon("lock-keyhole","cm-lock"):"")+'</button>').join("")
  ).join("");
  const manager=current?.canManage?'<button class="cm-manage" data-cm="manage">'+icon("sliders-horizontal")+'<span>Manage server</span>'+icon("chevron-right")+'</button>':"";
  const leave=current&&!current.permanent&&!current.canManage?'<button class="v2-nav-aux" data-v2="leave">'+icon("log-out")+' Leave server</button>':"";
  nav.innerHTML=general+
   '<div class="cm-server-heading">'+icon("users")+'<strong>'+esc(current?.name||"Lightning")+'</strong>'+
   (current?.permanent?'<small>OFFICIAL</small>':"")+'</div>'+
   channelItems+manager+leave+
   '<div class="hub-nav-title cm-category">EXPLORE</div>'+
   '<button class="hub-link cm-channel" data-v2="discover">'+icon("compass")+'<span>Find servers</span></button>'+
   '<button class="hub-link cm-channel" data-v2="create">'+icon("plus")+'<span>Create server</span></button>';
  if(this.v3Ready)this.v3Sync();
 };
 Hub.prototype.v2Room=function(){
  room.call(this);
  const s=this.currentCommunity(),c=s?.channels.find(c=>c.id===this.v2Channel);
  if(!c)return;
  const description=this.$(".v2-room-intro p"),title=this.$(".v2-room-intro h2");
  if(title)title.textContent=c.id==="announcements"?"Official announcements":"#"+c.name;
  if(description)description.textContent=c.id==="announcements"?"Updates directly from the Lightning team.":"Talk with the members of "+s.name+".";
  const compose=this.$("#v2ChatForm");
  if(c.readOnly&&!s.canManage&&compose)compose.outerHTML='<div class="cm-readonly">'+icon("lock-keyhole")+
   '<div><strong>Announcement channel</strong><span>Only the team can post here.</span></div></div>';
  const memberPanel=this.$(".v2-online-panel");
  if(memberPanel){
   const heading=memberPanel.querySelector("h3"),body=memberPanel.querySelector("div");
   if(heading)heading.textContent="MEMBERS · "+(s.members?.length||0);
   if(body)body.innerHTML=(s.members||[]).slice(0,40).map(m=>'<div class="cm-member-preview"><span class="v2-avatar">'+esc(m.name?.[0]?.toUpperCase()||"?")+'</span><div><strong>'+esc(m.name)+'</strong><small>'+
    (m.admin?"Lightning admin":esc(s.roles?.find(r=>r.id===m.role)?.name||"Member"))+'</small></div></div>').join("");
  }
 };
 Hub.prototype.drawCommunityManager=function(){
  const s=this.currentCommunity(),dialog=this.$("#communityManager");if(!s?.canManage||!dialog)return;
  this.$("#communityManagerTitle").textContent=s.name+" settings";
  this.$("#cmTabs").innerHTML=[["channels","Channels"],["roles","Roles"],["members","Members"],["server","Server"]].map(([id,label])=>
    '<button type="button" data-cm="tab" data-tab="'+id+'" class="'+(this.manageTab===id?"active":"")+'">'+label+'</button>').join("");
  const row=(glyph,name,subtitle,actions)=>'<div class="cm-row"><span class="cm-row-icon">'+glyph+'</span><div class="cm-row-detail"><strong>'+esc(name)+'</strong><small>'+esc(subtitle)+'</small></div><div class="cm-row-actions">'+actions+'</div></div>';
  let html="";
  if(this.manageTab==="channels"){
   html='<section class="cm-card"><h3>Channel permissions</h3><p>Announcement posting is restricted to staff. Required channels cannot be deleted.</p>'+
    s.channels.map(c=>row(icon(channelIcon(c)),"#"+c.name,cat(c.category)+(c.protected?" · required":""),
     '<button data-cm="readonly" data-channel="'+esc(c.id)+'" class="'+(c.readOnly?"on":"")+'">'+(c.readOnly?"Staff post":"Everyone posts")+'</button>'+
     (!c.protected?'<button data-cm="private" data-channel="'+esc(c.id)+'">'+(c.staffOnly?"Private":"Public")+'</button>':"")+
     '<button data-cm="rename-channel" data-channel="'+esc(c.id)+'" title="Rename">'+icon("edit-3")+'</button>'+
     (!c.protected?'<button data-cm="delete-channel" data-channel="'+esc(c.id)+'" title="Delete">'+icon("trash-2")+'</button>':""))).join("")+
    '</section><section class="cm-card"><h3>Add a channel</h3><form class="cm-form" data-cm-form="channel">'+
    '<label>Name<input name="name" required minlength="2" maxlength="30" placeholder="community-news"></label>'+
    '<label>Category<select name="category"><option>COMMUNITY</option><option>INFORMATION</option><option>GAMES</option><option>HELP</option></select></label>'+
    '<label class="cm-check"><input type="checkbox" name="readonly"> Staff-only posting</label>'+
    '<label class="cm-check"><input type="checkbox" name="private"> Private channel</label>'+
    '<button class="cm-save" type="submit">'+icon("plus")+' Create channel</button></form></section>';
  }else if(this.manageTab==="roles"){
   html='<section class="cm-card"><h3>Roles</h3><p>Roles are member labels. Lightning administrator rights cannot be granted here.</p>'+
    s.roles.map(role=>row('<span class="cm-role-color" style="--role-color:'+roleColor(role.color)+'"></span>',role.name,
     role.id==="member"?"Default role":"Custom role",
     role.id!=="member"?'<label title="Role color"><input type="color" data-cm-color data-role-id="'+esc(role.id)+'" value="'+roleColor(role.color)+'"></label>'+
     '<button data-cm="rename-role" data-role="'+esc(role.id)+'" title="Rename">'+icon("edit-3")+'</button>'+
     '<button data-cm="delete-role" data-role="'+esc(role.id)+'" title="Delete">'+icon("trash-2")+'</button>':"")).join("")+
    '</section><section class="cm-card"><h3>New role</h3><form class="cm-form" data-cm-form="role">'+
    '<label>Name<input name="name" required minlength="2" maxlength="32" placeholder="Helper"></label>'+
    '<label>Color<input name="color" type="color" value="#c5bca9"></label>'+
    '<button class="cm-save" type="submit">'+icon("plus")+' Create role</button></form></section>';
  }else if(this.manageTab==="members"){
   html='<section class="cm-card"><h3>Members</h3><p>Assign roles to members without changing platform permissions.</p>'+
    (s.members||[]).map(m=>row('<span class="v2-avatar">'+esc(m.name?.[0]?.toUpperCase()||"?")+'</span>',m.name,
    m.admin?"Platform admin":"Member",'<select data-cm-role data-member="'+esc(m.id)+'" aria-label="Role for '+esc(m.name)+'">'+
    s.roles.map(r=>'<option value="'+esc(r.id)+'"'+(m.role===r.id?" selected":"")+'>'+esc(r.name)+'</option>').join("")+'</select>')).join("")+'</section>';
  }else{
   html='<section class="cm-card"><h3>Server profile</h3><p>'+ (s.permanent?"The main server stays available to every Lightning account.":"Edit the profile for your server.")+'</p>'+
    '<form class="cm-form" data-cm-form="server">'+
    (s.permanent?"":'<label>Server name<input name="name" maxlength="40" value="'+esc(s.name)+'"></label>')+
    '<label class="cm-full">Description<textarea name="description" maxlength="140">'+esc(s.description)+'</textarea></label>'+
    '<button class="cm-save" type="submit">'+icon("check")+' Save</button></form></section>';
  }
  this.$("#cmContent").innerHTML=html;
 };
 Hub.prototype.onMessage=function(event){
  onMessage.call(this,event);
  if(!this.communityUiReady)return;
  if(event.type==="v2State"||event.type==="v2Server"){
   this.v2Nav();
   if(this.$("#communityManager")?.open)this.drawCommunityManager();
  }
 };
}
