/* The conversation renderer. Messages are data from Lightning Live, not mock cards. */
import {icon} from "./ui-icons.js?v=2";
import {reactionChips} from "./chat-emojis.js?v=1";

const safe=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const clock=at=>new Date(at).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});
const sameDay=(a,b)=>new Date(a).toDateString()===new Date(b).toDateString();
const avatarHue=name=>[210,267,28,175,49,338][[...String(name||"")].reduce((n,c)=>n+c.charCodeAt(0),0)%6];
const formatMessage=value=>safe(value).replace(/(^|\s)(@[a-z0-9._-]{3,32})/gi,'$1<mark class="dc-mention">$2</mark>').replace(/\n/g,"<br>");
const nameLabel=(hub,m,server)=>{
 const username=m.username||server?.members?.find(x=>x.id===m.userId)?.username||hub.users?.find(x=>x.id===m.userId)?.username;
 return window.LightningNames?.label?.(m.by,username)||safe(m.by);
};
export function messageToolbar(hub,m,kind,moderator=false){
 const own=m.userId===hub.id,editable=own&&Date.now()-m.at<900000;
 return '<div class="dc-message-toolbar" role="group" aria-label="Message actions">'+
  '<button type="button" data-dc="picker" data-kind="'+kind+'" data-id="'+safe(m.id)+'" aria-label="Add reaction" title="Add reaction">'+icon("smile-plus")+'</button>'+
  '<button type="button" data-dc="reply" data-kind="'+kind+'" data-id="'+safe(m.id)+'" aria-label="Reply" title="Reply">'+icon("reply")+'</button>'+
  (editable?'<button type="button" data-dc="edit" data-kind="'+kind+'" data-id="'+safe(m.id)+'" aria-label="Edit" title="Edit">'+icon("edit-3")+'</button>':"")+
  '<button type="button" data-dc="menu" data-kind="'+kind+'" data-id="'+safe(m.id)+'" aria-label="More actions" title="More">'+icon("more-horizontal")+'</button></div>';
}
export function enhanceRoom(hub){
 const body=hub.$(".v2-room-body"),form=hub.$("#v2ChatForm");
 if(!body)return;
 const server=hub.v2Servers.find(s=>s.id===hub.v2ServerId);
 const channel=server?.channels.find(c=>c.id===hub.v2Channel);
 const room=body.closest(".v2-room");room?.classList.add("dc-room");
 const header=hub.$(".v2-room-intro");
 if(header){
  header.classList.add("dc-room-intro");
  header.innerHTML='<div class="dc-channel-heading"><span class="dc-channel-icon">'+icon("hash")+'</span>'+
   '<div><small>'+safe(server?.name||"Community")+' / '+safe(channel?.category?.toLowerCase()||"text")+'</small>'+
   '<h2># '+safe(channel?.name||hub.v2Channel)+'</h2><p>'+safe(server?.description||"Start a conversation.")+'</p></div></div>'+
   '<div class="dc-channel-actions"><button data-dc="members" type="button" aria-pressed="false" title="Toggle member list">'+icon("users")+' Members</button>'+
   (server?.canManage?'<button data-dc="manage" type="button" title="Manage server and channels">'+icon("settings")+' Manage</button>':"")+'</div>';
 }
 const pinned=document.createElement("div");pinned.id="dcPinned";pinned.className="dc-pinned";pinned.hidden=true;
 header?.after(pinned);
 if(form){
  form.classList.add("dc-composer");
  const input=hub.$("#v2ChatInput");
  input.placeholder="Message #"+(channel?.name||hub.v2Channel);
  const emoji=document.createElement("button");
  emoji.type="button";emoji.className="dc-compose-emoji";emoji.dataset.dc="composeEmoji";
  emoji.dataset.target="v2ChatInput";emoji.setAttribute("aria-label","Insert emoji");emoji.title="Emoji";
  emoji.innerHTML=icon("smile-plus");
  form.insertBefore(emoji,input);
  const send=form.querySelector(".v2-primary");
  if(send){send.innerHTML=icon("send")+'<span>Send</span>';send.setAttribute("aria-label","Send message");}
  const reply=document.createElement("div");reply.id="dcReplyPreview";reply.className="dc-reply-preview";reply.hidden=true;
  reply.innerHTML=icon("reply")+'<div><strong class="dc-reply-author"></strong><span class="dc-reply-message"></span></div>'+
   '<button type="button" data-dc="cancelReply" aria-label="Cancel reply">'+icon("x")+'</button>';
  form.before(reply);
  const typing=document.createElement("div");typing.id="dcTyping";typing.className="dc-typing";typing.setAttribute("aria-live","polite");
  form.after(typing);
  const hint=document.createElement("div");hint.className="dc-compose-hint";hint.textContent="Enter to send · Shift+Enter for a new line";
  typing.after(hint);
  input.addEventListener("input",()=>{
   if(Date.now()-(hub.dcLastTyping||0)>2800){
    hub.dcLastTyping=Date.now();
    hub.send({type:"v2Typing",serverId:hub.v2ServerId,channel:hub.v2Channel});
   }
  });
 }
 hub.dcShowReply();
 renderRoom(hub);
}
export function renderRoom(hub){
 const feed=hub.$("#v2RoomMessages"),server=hub.v2Servers.find(s=>s.id===hub.v2ServerId);
 if(!feed||!server)return;
 const channel=server.channels.find(c=>c.id===hub.v2Channel);
 const records=(server.messages?.[hub.v2Channel]||[]).filter(m=>m&&!m.deleted);
 const query=hub.v2Search||"";
 const rows=records.filter(m=>!query||(m.by+" "+(m.username||"")+" "+m.message).toLowerCase().includes(query));
 const stayBottom=feed.scrollHeight-feed.scrollTop-feed.clientHeight<110;
 const oldHeight=feed.scrollHeight,oldTop=feed.scrollTop;
 const byId=new Map(records.map(m=>[m.id,m]));
 let previous=null;
 feed.innerHTML=rows.length?rows.map(m=>{
  const grouped=previous&&previous.userId===m.userId&&m.at-previous.at<300000&&sameDay(m.at,previous.at);
  const day=previous&&!sameDay(m.at,previous.at)||!previous;
  previous=m;
  const member=server.members?.find(x=>x.id===m.userId);
  const admin=member?.admin,memberRole=member?.role;
  const role=admin?'<span class="dc-role admin">ADMIN</span>':
   memberRole&&memberRole!=="member"?'<span class="dc-role">'+safe(server.roles?.find(r=>r.id===memberRole)?.name||"Member")+'</span>':"";
  const quoted=byId.get(m.replyTo);
  const quotedUi=quoted?'<button type="button" data-dc="jump" data-id="'+safe(quoted.id)+'" class="dc-quoted">'+icon("reply")+
   '<strong>'+safe(quoted.by)+'</strong><span>'+safe(quoted.message.slice(0,100))+'</span></button>':"";
  return (day?'<div class="dc-day"><span>'+safe(new Date(m.at).toLocaleDateString([],{weekday:"long",month:"short",day:"numeric",year:"numeric"}))+'</span></div>':"")+
   '<article class="dc-message'+(grouped?" dc-grouped":"")+(m.pinnedAt?" dc-highlight-pin":"")+'" data-dc-id="'+safe(m.id)+'">'+
   '<div class="dc-avatar" style="--dc-hue:'+avatarHue(m.by)+'" aria-hidden="true">'+safe(m.by?.[0]?.toUpperCase()||"?")+'</div>'+
   '<div class="dc-message-main"><div class="dc-message-by"><strong>'+nameLabel(hub,m,server)+'</strong>'+role+
   '<time datetime="'+new Date(m.at).toISOString()+'" title="'+safe(new Date(m.at).toLocaleString())+'">'+clock(m.at)+'</time>'+
   (m.editedAt?'<small>edited</small>':"")+(m.pinnedAt?'<span class="dc-pin-tag">'+icon("pin")+' pinned</span>':"")+'</div>'+
   quotedUi+'<div class="dc-message-content">'+formatMessage(m.message)+'</div>'+
   reactionChips(m,hub.id,"v2")+'</div>'+messageToolbar(hub,m,"v2",server.canModerate)+'</article>';
 }).join(""):'<div class="dc-empty"><span>#</span><h3>'+(query?"Nothing found":"# "+safe(channel?.name||hub.v2Channel))+'</h3><p>'+
  (query?"Try another search.":"This channel is ready for its first message.")+'</p></div>';
 if(!query&&stayBottom)feed.scrollTop=feed.scrollHeight;
 else if(!query)feed.scrollTop=Math.max(0,oldTop+feed.scrollHeight-oldHeight);
 const pinned=hub.$("#dcPinned");
 if(pinned){
  const pins=records.filter(m=>m.pinnedAt).sort((a,b)=>b.pinnedAt-a.pinnedAt).slice(0,15);
  pinned.hidden=!pins.length;
  if(pins.length){
   const latest=pins[0];
   pinned.innerHTML=icon("pin")+'<button type="button" data-dc="jump" data-id="'+safe(latest.id)+'"><strong>Pinned</strong> '+safe(latest.by)+
    ': '+safe(latest.message.slice(0,100))+'</button><small>'+pins.length+' pinned</small>';
  }
 }
 hub.$(".v2-room")?.classList.toggle("dc-has-messages",records.length>0);
}
export function enhanceLegacy(hub){
 if(hub.view!=="chat")return;
 const feed=hub.$("#hubMessages");if(!feed)return;
 const rows=(hub.history?.[hub.channel]||[]).filter(m=>!m.deleted).slice(-120);
 [...feed.querySelectorAll(".social-msg")].forEach((row,index)=>{
  const msg=rows[index];if(!msg)return;
  row.dataset.dcId=msg.id;
  const actions=row.querySelector(".social-message-actions");
  if(actions)actions.innerHTML=messageToolbar(hub,msg,"legacy");
  const reacts=row.querySelector(".social-reactions");
  if(reacts)reacts.innerHTML=reactionChips(msg,hub.id,"legacy");
 });
}
