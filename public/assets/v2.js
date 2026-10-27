// Community screens retain the existing server-backed messaging protocol.
import {serverIcon} from "./ui-icons.js?v=1";
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const time=t=>new Date(t).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});
export function installV2(Hub){
  const baseOpen=Hub.prototype.open,baseClose=Hub.prototype.close,baseShow=Hub.prototype.show;
  const baseRender=Hub.prototype.render,baseChat=Hub.prototype.chat,baseMessage=Hub.prototype.onMessage,baseHeader=Hub.prototype.header;
  Hub.prototype.v2Setup=function(){
    if(this.v2Ready)return;
    this.v2Ready=true;this.v2Servers=[];this.v2Directory=[];this.v2ServerId=null;this.v2Channel="general";this.v2Search="";
    this.root.innerHTML=
      '<div class="hub-shell v2-shell"><nav class="v2-servers" aria-label="Community servers">'+
      '<button class="v2-home active" data-v2="home" aria-label="Community home" title="Home">ϟ</button><div class="v2-rail-divider"></div><div id="v2ServerIcons"></div>'+
      '<button class="v2-add" data-v2="discover" aria-label="Discover servers" title="Discover servers">+</button><div class="v2-rail-spacer"></div>'+
      '<button class="v2-ai-mini" data-v2="ai" title="AI workspace">✧</button></nav>'+
      '<aside class="hub-rail v2-sidebar"><div class="hub-logo"><span class="v2-mini-label">COMMUNITY</span><strong id="v2ServerTitle">Lightning</strong><small id="v2ServerAbout">Your space to connect.</small></div>'+
      '<nav class="hub-nav" id="v2Channels" aria-label="Community channels"></nav>'+
      '<div class="hub-user"><div class="hub-avatar" id="hubAvatar">L</div><div><strong id="hubUsername">Account</strong><span id="hubConnection">Connecting…</span></div><button data-v2="ai" class="v2-account-ai" title="AI workspace">✧</button></div></aside>'+
      '<main class="hub-main v2-main"><header class="hub-head v2-topbar"><button type="button" class="v2-menu-button" data-v2="toggleNav" aria-label="Toggle channel list" aria-expanded="false">☰</button><div class="v2-topbar-name"><h2 id="hubTitle"># general</h2><p id="hubSubtitle">Community</p></div><span class="hub-spacer"></span>'+
      '<label class="v2-search"><span>⌕</span><input type="search" id="v2Search" placeholder="Search messages or servers" aria-label="Search messages or servers" maxlength="120"></label>'+
      '<button class="v2-ai-button" data-v2="ai">✧ AI</button><span class="hub-pill" id="hubOnline">0 online</span>'+
      '<button class="hub-x" data-act="close" title="Return to browser" aria-label="Return to browser">×</button></header>'+
      '<div class="hub-content" id="hubContent"></div></main>'+
      '<div id="hubWorld" class="hub-world" hidden></div><div id="hubToast" class="hub-toast" hidden></div>'+
      '<dialog id="v2CreateDialog" class="v2-modal" aria-labelledby="v2DialogTitle"><form id="v2CreateForm"><header><div><small>COMMUNITY</small><h2 id="v2DialogTitle">Create a server</h2></div><button type="button" data-v2="closeModal" aria-label="Close">×</button></header>'+
      '<label>Server name<input required id="v2Name" minlength="2" maxlength="40" placeholder="My community"></label>'+
      '<label>Description<input id="v2Description" maxlength="140" placeholder="What brings everyone together?"></label>'+
      '<label>Icon<input id="v2Icon" maxlength="4" placeholder="✦"></label><footer><button type="button" data-v2="closeModal">Cancel</button><button class="v2-primary">Create server →</button></footer></form></dialog>'+
      '</div>';
    this.root.addEventListener("click",event=>{
      const b=event.target.closest("[data-v2]");if(!b)return;
      const act=b.dataset.v2;
      if(act==="toggleNav"){
        const open=this.$(".v2-shell").classList.toggle("v2-nav-open");
        b.setAttribute("aria-expanded",String(open));
      }
      else if(act==="home"){this.v2ServerId="lightning-main";this.v2Channel="announcements";this.show("room");}
      else if(act==="ai")document.getElementById("boltBubble")?.click();
      else if(act==="discover")this.v2Discover();
      else if(act==="create"){this.$("#v2CreateDialog").showModal();this.$("#v2Name").focus();}
      else if(act==="closeModal")this.$("#v2CreateDialog").close();
      else if(act==="server"){
        const s=this.v2Servers.find(s=>s.id===b.dataset.id);
        if(!s)return;this.v2ServerId=s.id;this.v2Channel=s.channels[0]?.id||"general";this.show("room");
      }else if(act==="channel"){this.v2Channel=b.dataset.channel;this.show("room");}
      else if(act==="join"){if(this.send({type:"v2Join",serverId:b.dataset.id}))b.disabled=true;}
      else if(act==="addChannel"){
        const name=prompt("New channel name");
        if(name?.trim())this.send({type:"v2AddChannel",serverId:this.v2ServerId,name:name.trim(),category:"TEXT"});
      }else if(act==="leave"){if(confirm("Leave this community?"))this.send({type:"v2Leave",serverId:this.v2ServerId});}
      else if(act==="delete"&&confirm("Delete this message?"))this.send({type:"v2DeleteMessage",serverId:this.v2ServerId,channel:this.v2Channel,messageId:b.dataset.id});
      else if(act==="mention"){
        const field=this.$("#v2ChatInput")||this.$("#hubChatInput");
        if(field){field.value+=(field.value?" ":"")+"@"+b.dataset.name+" ";field.focus();}
      }
    });
    this.$("#v2CreateForm").addEventListener("submit",event=>{
      event.preventDefault();
      if(this.send({type:"v2Create",name:this.$("#v2Name").value,description:this.$("#v2Description").value,icon:this.$("#v2Icon").value})){
        this.$("#v2CreateDialog").close();this.$("#v2CreateForm").reset();
      }
    });
    this.$("#v2Search").addEventListener("input",event=>{
      this.v2Search=event.target.value.toLowerCase().trim();
      if(this.view==="directory")this.v2Discover(true);
      if(this.view==="room")this.v2Messages();
      if(this.view==="chat"){
        const field=this.$("#chatSearchInput"),toggle=this.$("#chatSearchToggle");
        if(field){if(this.$(".chat-searchbar")?.hidden)toggle?.click();field.value=event.target.value;field.dispatchEvent(new Event("input",{bubbles:true}));}
      }
    });
    this.v2Nav();
  };
  Hub.prototype.v2Nav=function(){
    if(!this.v2Ready)return;
    const current=this.v2Servers.find(s=>s.id===this.v2ServerId);
    this.$("#v2ServerTitle").textContent=current?.name||"Lightning";
    this.$("#v2ServerAbout").textContent=current?current.memberCount+" members · "+current.channels.length+" channels":"A place to make your own.";
    this.$(".v2-home").classList.toggle("active",!current);
    this.$("#v2ServerIcons").innerHTML=this.v2Servers.map((s,i)=>'<button class="v2-server-icon'+(s.id===this.v2ServerId?" active":"")+'" data-v2="server" data-id="'+esc(s.id)+'" title="'+esc(s.name)+'" aria-label="'+esc(s.name)+'">'+esc(s.icon||["✦","◈","◆"][i%3])+'</button>').join("");
    if(current){
      const sections=[...new Set(current.channels.map(c=>c.category))];
      this.$("#v2Channels").innerHTML='<button class="v2-discover-link" data-v2="discover">⌕ <span>Discover servers</span></button>'+
        sections.map(category=>'<div class="hub-nav-title">'+esc(category)+'</div>'+
          current.channels.filter(c=>c.category===category).map(c=>'<button class="hub-link'+(this.view==="room"&&this.v2Channel===c.id?" active":"")+'" data-v2="channel" data-channel="'+esc(c.id)+'"><i>#</i><span>'+esc(c.name)+'</span></button>').join("")).join("")+
        (current.owner===this.id?'<button class="v2-nav-aux" data-v2="addChannel">＋ Add channel</button>':'<button class="v2-nav-aux" data-v2="leave">↖ Leave server</button>')+
        '<div class="hub-nav-title">EXPLORE</div><button class="hub-link" data-view="games"><i>▣</i><span>Arcade</span></button><button class="hub-link" data-v2="home"><i>⌂</i><span>Community home</span></button>';
    }else{
      this.$("#v2Channels").innerHTML='<button class="v2-discover-link" data-v2="discover">⌕ <span>Discover servers</span></button>'+
        '<div class="hub-nav-title">TEXT CHANNELS</div>'+
        ["general","games","suggestions","support"].map(c=>'<button class="hub-link'+(this.view==="chat"&&this.channel===c?" active":"")+'" data-view="chat" data-channel="'+c+'"><i>#</i><span>'+c+'</span></button>').join("")+
        '<div class="hub-nav-title">DISCOVER</div><button class="hub-link'+(this.view==="games"?" active":"")+'" data-view="games"><i>▣</i><span>Arcade</span></button>'+
        '<button class="hub-link'+(this.view==="updates"?" active":"")+'" data-view="updates"><i>✳</i><span>What is new</span></button>'+
        '<button class="v2-nav-aux" data-v2="create">＋ Create a server</button>';
    }
  };
  Hub.prototype.open=function(view="chat"){
    this.v2Setup();
    baseOpen.call(this,view);
    if(this.socket?.readyState===WebSocket.OPEN)this.send({type:"v2Snapshot"});
    this.v2Nav();
  };
  Hub.prototype.close=function(){
    if(this.$("#v2CreateDialog")?.open)this.$("#v2CreateDialog").close();
    baseClose.call(this);this.active=false;this.root.hidden=true;
  };
  Hub.prototype.show=function(view,channel){
    if(view==="room"){
      this.$(".v2-shell")?.classList.remove("v2-nav-open");
      this.$(".v2-menu-button")?.setAttribute("aria-expanded","false");
      this.view="room";this.v2Room();this.v2Nav();return;
    }
    if(view==="directory"){this.view="directory";this.v2Discover(true);return;}
    if(view==="chat")this.v2ServerId=null;
    this.$(".v2-shell")?.classList.remove("v2-nav-open");
    this.$(".v2-menu-button")?.setAttribute("aria-expanded","false");
    baseShow.call(this,view,channel);this.v2Nav();
  };
  Hub.prototype.render=function(){
    if(this.view==="room")return this.v2Room();
    if(this.view==="directory")return this.v2Discover(true);
    return baseRender.call(this);
  };
  Hub.prototype.header=function(title,subtitle){baseHeader.call(this,title,subtitle);this.v2Nav();};
  Hub.prototype.chat=function(){baseChat.call(this);this.v2Nav();};
  Hub.prototype.updates=function(){
    this.header("Updates","News from the team");
    this.$("#hubContent").innerHTML='<section class="v4-updates"><h2>News & changes</h2>'+
      '<p>Find the latest official posts in the announcements channel.</p>'+
      '<button data-cm="main">Open announcements</button></section>';
  };
  Hub.prototype.v2Discover=function(refresh=false){
    if(!refresh)this.v2Search="";
    this.$(".v2-shell")?.classList.remove("v2-nav-open");
    this.$(".v2-menu-button")?.setAttribute("aria-expanded","false");
    this.view="directory";this.header("Discover","Find your community");
    const owned=new Set(this.v2Servers.map(s=>s.id)),q=this.v2Search||"";
    const found=this.v2Directory.filter(s=>!q||(s.name+" "+s.description).toLowerCase().includes(q));
    this.$("#hubContent").innerHTML='<section class="v2-directory"><div class="v2-dir-top"><span class="v2-eyebrow">COMMUNITY DIRECTORY</span><h1>Find your people.</h1><p>Join a server, create channels, and talk with real people.</p><button class="v2-primary" data-v2="create">＋ Create a server</button></div><div class="v2-dir-grid">'+
      found.map((s,i)=>'<article class="v2-dir-card"><div class="v2-dir-icon">'+serverIcon(s.icon||"users")+'</div><h3>'+esc(s.name)+'</h3><p>'+esc(s.description)+'</p><small>'+Number(s.memberCount||0)+' members · '+Number(s.channelCount||0)+' channels</small>'+
        (owned.has(s.id)?'<button data-v2="server" data-id="'+esc(s.id)+'">Open server ↗</button>':'<button class="v2-primary" data-v2="join" data-id="'+esc(s.id)+'">Join server →</button>')+'</article>').join("")+
      (!found.length?'<p class="v2-nothing">No servers found yet. Create one to get started.</p>':"")+'</div></section>';
    this.v2Nav();
  };
  Hub.prototype.v2Room=function(){
    const s=this.v2Servers.find(s=>s.id===this.v2ServerId);
    if(!s){this.v2ServerId=null;this.show("chat","general");return;}
    const c=s.channels.find(c=>c.id===this.v2Channel)||s.channels[0];
    if(!c){this.v2Discover();return;}
    this.v2Channel=c.id;this.header("# "+c.name,s.name+" · "+c.category.toLowerCase());
    this.$("#hubContent").innerHTML='<div class="v2-room"><main class="v2-room-body"><div class="v2-room-intro"><span>#</span><h2>Welcome to #'+esc(c.name)+'</h2><p>This is the beginning of '+esc(s.name)+' / #'+esc(c.name)+'.</p></div>'+
      '<div id="v2RoomMessages" class="v2-room-feed" aria-live="polite"></div>'+
      '<form id="v2ChatForm" class="v2-room-compose"><button type="button" data-v2="ai" title="Ask AI">✧</button><textarea id="v2ChatInput" rows="1" maxlength="1500" placeholder="Message #'+esc(c.name)+'" aria-label="Message #'+esc(c.name)+'"></textarea><button class="v2-primary">Send ↗</button></form></main>'+
      '<aside class="v2-online-panel"><h3>ONLINE · '+this.users.length+'</h3><div>'+this.users.map(u=>'<button class="v2-online-user" data-v2="mention" data-name="'+esc(u.name)+'"><span class="v2-avatar">'+esc(u.name?.[0]?.toUpperCase()||"?")+'</span><strong>'+esc(u.name)+'</strong><i>●</i></button>').join("")+'</div><small>People online across Lightning</small></aside></div>';
    const form=this.$("#v2ChatForm"),input=this.$("#v2ChatInput");
    form.addEventListener("submit",event=>{event.preventDefault();const msg=input.value.trim();if(msg&&this.send({type:"v2Message",serverId:s.id,channel:c.id,message:msg})){input.value="";input.style.height="auto";}});
    input.addEventListener("keydown",event=>{if(event.key==="Enter"&&!event.shiftKey&&!event.isComposing){event.preventDefault();form.requestSubmit();}});
    input.addEventListener("input",()=>{input.style.height="auto";input.style.height=Math.min(140,input.scrollHeight)+"px";});
    this.v2Messages();
    this.v2Nav();
  };
  Hub.prototype.v2Members=function(){
    const panel=this.$(".v2-online-panel");
    if(!panel)return;
    panel.querySelector("h3").textContent="ONLINE · "+this.users.length;
    panel.querySelector("div").innerHTML=this.users.map(user=>
      '<button class="v2-online-user" data-v2="mention" data-name="'+esc(user.name)+'">'+
      '<span class="v2-avatar">'+esc(user.name?.[0]?.toUpperCase()||"?")+'</span>'+
      '<strong>'+esc(user.name)+'</strong><i>●</i></button>').join("");
  };
  Hub.prototype.v2Messages=function(){
    const el=this.$("#v2RoomMessages"),s=this.v2Servers.find(s=>s.id===this.v2ServerId);
    if(!el||!s)return;
    const q=this.v2Search||"",rows=(s.messages?.[this.v2Channel]||[]).filter(m=>!q||(m.by+" "+m.message).toLowerCase().includes(q));
    el.innerHTML=rows.length?rows.map(m=>'<article class="v2-row"><span class="v2-avatar">'+esc(m.by?.[0]?.toUpperCase()||"?")+'</span><div class="v2-row-body"><header><strong>'+esc(m.by)+'</strong><time>'+time(m.at)+'</time></header><p>'+(m.deleted?"<i>Message deleted</i>":esc(m.message).replace(/\\n/g,"<br>"))+'</p></div>'+
      (!m.deleted&&(m.userId===this.id||s.owner===this.id)?'<button class="v2-delete" data-v2="delete" data-id="'+esc(m.id)+'" aria-label="Delete message">×</button>':"")+'</article>').join(""):
      '<div class="v2-room-empty">'+(q?"No messages match that search.":"Be the first to say something.")+'</div>';
    el.scrollTop=el.scrollHeight;
  };
  Hub.prototype.onMessage=function(m){
    baseMessage.call(this,m);
    if(!this.v2Ready)return;
    if(m.type==="hello"&&this.socket?.readyState===WebSocket.OPEN)this.send({type:"v2Snapshot"});
    if(m.type==="v2State"){
      this.v2Servers=Array.isArray(m.servers)?m.servers:[];
      this.v2Directory=Array.isArray(m.directory)?m.directory:[];
      if(m.selected){this.v2ServerId=m.selected;this.v2Channel=this.v2Servers.find(s=>s.id===m.selected)?.channels[0]?.id||"general";this.show("room");}
      else if(this.v2ServerId&&!this.v2Servers.some(s=>s.id===this.v2ServerId)){this.v2ServerId=null;this.show("chat","general");}
      else if(this.view==="directory")this.v2Discover(true);
      this.v2Nav();
    }else if(m.type==="v2Directory"){this.v2Directory=m.directory||[];if(this.view==="directory")this.v2Discover(true);}
    else if(m.type==="v2Server"){
      const index=this.v2Servers.findIndex(s=>s.id===m.server?.id);
      if(index>=0){this.v2Servers[index]=m.server;if(this.view==="room")this.v2Room();}
      this.v2Nav();
    }else if(m.type==="v2MemberCount"){
      const s=this.v2Servers.find(s=>s.id===m.serverId);if(s)s.memberCount=m.count;this.v2Nav();
    }else if(m.type==="v2Message"&&m.entry){
      const s=this.v2Servers.find(s=>s.id===m.serverId);
      if(s){(s.messages[m.entry.channel]??=[]).push(m.entry);s.messages[m.entry.channel]=s.messages[m.entry.channel].slice(-150);}
      if(this.view==="room"&&this.v2ServerId===m.serverId&&this.v2Channel===m.entry.channel)this.v2Messages();
    }else if(m.type==="v2MessageUpdate"&&m.entry){
      const rows=this.v2Servers.find(s=>s.id===m.serverId)?.messages?.[m.entry.channel];
      if(rows){const index=rows.findIndex(entry=>entry.id===m.entry.id);if(index>=0)rows[index]=m.entry;}
      if(this.view==="room"&&this.v2ServerId===m.serverId)this.v2Messages();
    }else if(m.type==="presence"&&this.view==="room")this.v2Members();

  };
}
