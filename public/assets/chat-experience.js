/* Message actions, composing and moderation for Lightning's existing live rooms. */
import {icon} from "./ui-icons.js?v=2";
import {ChatEmojiPicker,EMOJI_SET} from "./chat-emojis.js?v=1";
import {renderRoom,enhanceRoom,enhanceLegacy,messageToolbar} from "./chat-renderer.js?v=1";

const escapeText=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const moderated=(hub,kind)=>kind==="v2"?
 !!hub.v2Servers.find(s=>s.id===hub.v2ServerId)?.canModerate:
 ["admin","moderator","community_manager"].includes(hub.role);

export function installChatExperience(Hub){
 const oldSetup=Hub.prototype.v2Setup;
 const oldRoom=Hub.prototype.v2Room;
 const oldChat=Hub.prototype.chat;
 const oldMessages=Hub.prototype.messages;
 const oldMembers=Hub.prototype.v2Members;
 const oldReceive=Hub.prototype.onMessage;
 Hub.prototype.v2Setup=function(){
  oldSetup.call(this);
  if(this.dcReady)return;
  this.dcReady=true;
  this.dcReply=null;this.dcTyping=new Map();
  this.dcPicker=new ChatEmojiPicker();
  const menu=document.createElement("div");
  menu.id="lightningChatMenu";menu.className="dc-action-menu";
  menu.setAttribute("popover","auto");menu.setAttribute("role","menu");
  document.body.append(menu);this.dcMenu=menu;
  menu.addEventListener("click",event=>{
   const button=event.target.closest("[data-menu]");
   if(!button)return;
   this.dcHide(menu);
   const context=this.dcMenuContext;if(!context)return;
   const {kind,id}=context;
   if(button.dataset.menu==="reply")this.dcReplyTo(kind,id);
   else if(button.dataset.menu==="picker")this.dcOpenPicker(context.anchor,kind,id);
   else if(button.dataset.menu==="edit")this.dcEdit(kind,id);
   else if(button.dataset.menu==="copy")this.dcCopy(kind,id);
   else if(button.dataset.menu==="pin")this.dcPin(id);
   else if(button.dataset.menu==="clear")this.dcClearReactions(id);
   else if(button.dataset.menu==="delete")this.dcDelete(kind,id);
   else if(button.dataset.menu==="dm"){
    const msg=this.dcFind(kind,id);
    if(msg?.userId&&msg.userId!==this.id)window.LightningAccount?.open("messages",msg.userId);
   }
  });
  this.root.addEventListener("click",event=>{
   const button=event.target.closest("[data-dc]");
   if(!button)return;
   const action=button.dataset.dc,id=button.dataset.id,kind=button.dataset.kind||"v2";
   if(action==="picker")this.dcOpenPicker(button,kind,id);
   else if(action==="react")this.dcReact(kind,id,button.dataset.emoji);
   else if(action==="composeEmoji")this.dcOpenPicker(button,"compose",button.dataset.target);
   else if(action==="reply")this.dcReplyTo(kind,id);
   else if(action==="cancelReply"){this.dcReply=null;this.dcShowReply();}
   else if(action==="menu")this.dcOpenMenu(button,kind,id);
   else if(action==="edit")this.dcEdit(kind,id);
   else if(action==="cancelEdit")this.dcCancelEdit();
   else if(action==="saveEdit")this.dcSaveEdit();
   else if(action==="jump")this.dcJump(id);
   else if(action==="members"){
    const room=this.$(".dc-room");const visible=room?.classList.toggle("dc-show-members");
    button.setAttribute("aria-pressed",String(visible));
   }else if(action==="manage")this.$('[data-cm="manage"]')?.click();
  });
  this.root.addEventListener("contextmenu",event=>{
   const row=event.target.closest(".dc-message,.social-msg");
   if(!row?.dataset.dcId)return;
   event.preventDefault();
   const anchor={getBoundingClientRect:()=>({top:event.clientY,left:event.clientX,bottom:event.clientY,right:event.clientX})};
   this.dcOpenMenu(anchor,row.classList.contains("dc-message")?"v2":"legacy",row.dataset.dcId);
  });
  this.root.addEventListener("keydown",event=>{
   if(event.key==="Escape"&&this.dcEditing){event.preventDefault();this.dcCancelEdit();}
   else if(event.key==="Escape"&&this.dcReply){this.dcReply=null;this.dcShowReply();}
   else if(event.key==="Enter"&&(event.ctrlKey||event.metaKey)&&event.target.id==="dcInlineEditor"){
    event.preventDefault();this.dcSaveEdit();
   }
  });
 };
 Hub.prototype.dcFind=function(kind,id){
  if(kind==="legacy")return (this.history?.[this.channel]||[]).find(m=>m.id===id)||null;
  return (this.v2Servers.find(s=>s.id===this.v2ServerId)?.messages?.[this.v2Channel]||[]).find(m=>m.id===id)||null;
 };
 Hub.prototype.dcHide=function(element){
  if(element.matches(":popover-open"))element.hidePopover();
  else element.hidden=true;
 };
 Hub.prototype.dcShow=function(element,anchor,width,height){
  if(element.matches(":popover-open"))element.hidePopover();
  if(typeof element.showPopover==="function")element.showPopover();
  else element.hidden=false;
  const rect=anchor.getBoundingClientRect();
  const left=Math.min(Math.max(12,window.innerWidth-width-12),Math.max(12,rect.right-width));
  const top=rect.bottom+height+8<window.innerHeight?rect.bottom+8:Math.max(12,rect.top-height-8);
  Object.assign(element.style,{left:left+"px",top:top+"px",bottom:"auto",right:"auto"});
 };
 Hub.prototype.dcOpenPicker=function(anchor,kind,id){
  if(kind!=="compose"&&!this.dcFind(kind,id))return;
  this.dcPicker.open(anchor,emoji=>{
   if(kind==="compose"){
    const input=this.$("#"+id);
    if(!input||input.disabled)return;
    const start=input.selectionStart||0,end=input.selectionEnd||start;
    input.setRangeText(emoji,start,end,"end");
    input.focus();input.dispatchEvent(new Event("input",{bubbles:true}));
   }else this.dcReact(kind,id,emoji);
  });
 };
 Hub.prototype.dcReact=function(kind,id,emoji){
  if(!EMOJI_SET.has(emoji)||!this.dcFind(kind,id))return;
  if(kind==="legacy")this.send({type:"chatReact",channel:this.channel,id,emoji});
  else this.send({type:"v2React",serverId:this.v2ServerId,channel:this.v2Channel,messageId:id,emoji});
 };
 Hub.prototype.dcReplyTo=function(kind,id){
  const msg=this.dcFind(kind,id);if(!msg)return;
  if(kind==="legacy"){this.reply=msg;this.replyUi?.();this.$("#hubChatInput")?.focus();return;}
  this.dcReply={id,serverId:this.v2ServerId,channel:this.v2Channel};
  this.dcShowReply();this.$("#v2ChatInput")?.focus();
 };
 Hub.prototype.dcShowReply=function(){
  const box=this.$("#dcReplyPreview");if(!box)return;
  const reply=this.dcReply?.serverId===this.v2ServerId&&this.dcReply?.channel===this.v2Channel?
   this.dcFind("v2",this.dcReply.id):null;
  box.hidden=!reply;
  if(reply){
   box.querySelector(".dc-reply-author").textContent="Replying to "+reply.by;
   box.querySelector(".dc-reply-message").textContent=reply.message.slice(0,130);
  }
 };
 Hub.prototype.dcOpenMenu=function(anchor,kind,id){
  const msg=this.dcFind(kind,id);if(!msg)return;
  const own=msg.userId===this.id,canModerate=moderated(this,kind);
  const editable=own&&Date.now()-msg.at<900000;
  const item=(key,label,glyph,danger=false)=>
   '<button type="button" role="menuitem" data-menu="'+key+'"'+(danger?' class="dc-danger"':"")+'>'+
   icon(glyph)+'<span>'+label+'</span></button>';
  this.dcMenu.innerHTML='<small>MESSAGE ACTIONS</small>'+
   item("reply","Reply","reply")+item("picker","Add reaction","smile-plus")+
   item("copy","Copy text","copy")+
   (msg.userId!==this.id?item("dm","Message user","message-circle"):"")+
   (editable?item("edit","Edit message","edit-3"):"")+
   (canModerate&&kind==="v2"?'<hr>'+item("pin",msg.pinnedAt?"Unpin":"Pin message","pin")+
      (Object.keys(msg.reactions||{}).length?item("clear","Clear reactions","x"):""):"")+
   (own||canModerate?'<hr>'+item("delete","Delete message","trash-2",true):"");
  this.dcMenuContext={anchor,kind,id};
  this.dcShow(this.dcMenu,anchor,226,Math.min(440,105+this.dcMenu.querySelectorAll("button").length*38));
  this.dcMenu.querySelector("button")?.focus();
 };
 Hub.prototype.dcEdit=function(kind,id){
  const msg=this.dcFind(kind,id);
  if(!msg||msg.userId!==this.id||Date.now()-msg.at>900000)return;
  this.dcCancelEdit();
  const feed=this.$(kind==="legacy"?"#hubMessages":"#v2RoomMessages");
  const row=[...feed?.querySelectorAll("[data-dc-id]")||[]].find(el=>el.dataset.dcId===id);
  const content=row?.querySelector(kind==="legacy"?".social-text":".dc-message-content");
  if(!content)return;
  const editor=document.createElement("div");editor.className="dc-editor";
  const input=document.createElement("textarea");
  input.id="dcInlineEditor";input.rows=3;input.maxLength=kind==="legacy"?1000:1500;
  input.value=msg.message;input.setAttribute("aria-label","Edit message");
  const tools=document.createElement("div");tools.className="dc-editor-tools";
  tools.innerHTML='<small>Esc to cancel · Ctrl+Enter to save</small><button data-dc="cancelEdit" type="button">Cancel</button>'+
   '<button type="button" data-dc="saveEdit" class="dc-edit-save">Save</button>';
  editor.append(input,tools);
  content.hidden=true;content.after(editor);
  this.dcEditing={kind,id,original:content,editor};
  input.focus();input.setSelectionRange(input.value.length,input.value.length);
 };
 Hub.prototype.dcCancelEdit=function(){
  if(!this.dcEditing)return;
  this.dcEditing.original.hidden=false;
  this.dcEditing.editor.remove();this.dcEditing=null;
 };
 Hub.prototype.dcSaveEdit=function(){
  const edit=this.dcEditing;if(!edit)return;
  const next=edit.editor.querySelector("textarea").value.trim();
  if(!next)return this.flash("Enter a message before saving.");
  const message=this.dcFind(edit.kind,edit.id);
  if(!message)return this.dcCancelEdit();
  const payload=edit.kind==="legacy"?
   {type:"chatEdit",channel:this.channel,id:edit.id,message:next}:
   {type:"v2EditMessage",serverId:this.v2ServerId,channel:this.v2Channel,messageId:edit.id,message:next};
  if(this.send(payload))this.dcCancelEdit();
 };
 Hub.prototype.dcCopy=function(kind,id){
  const message=this.dcFind(kind,id);if(!message)return;
  if(!navigator.clipboard?.writeText)return this.flash("Clipboard is unavailable.");
  navigator.clipboard.writeText(message.message).then(()=>this.flash("Copied.")).catch(()=>this.flash("Couldn't copy."));
 };
 Hub.prototype.dcPin=function(id){
  if(!moderated(this,"v2"))return;
  this.send({type:"v2PinMessage",serverId:this.v2ServerId,channel:this.v2Channel,messageId:id});
 };
 Hub.prototype.dcClearReactions=function(id){
  if(!moderated(this,"v2")||!confirm("Clear every reaction on this message?"))return;
  this.send({type:"v2ClearReactions",serverId:this.v2ServerId,channel:this.v2Channel,messageId:id});
 };
 Hub.prototype.dcDelete=function(kind,id){
  if(!this.dcFind(kind,id)||!confirm("Delete this message for everyone?"))return;
  if(kind==="legacy")this.send({type:"chatDelete",channel:this.channel,id});
  else this.send({type:"v2DeleteMessage",serverId:this.v2ServerId,channel:this.v2Channel,messageId:id});
 };
 Hub.prototype.dcJump=function(id){
  const list=this.$("#v2RoomMessages");
  const target=[...list?.querySelectorAll(".dc-message")||[]].find(el=>el.dataset.dcId===id);
  if(!target)return this.flash("Message is outside the recent history.");
  target.scrollIntoView({block:"center",behavior:window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches?"instant":"smooth"});
  target.classList.add("dc-jump");
  setTimeout(()=>target.classList.remove("dc-jump"),1600);
 };
 Hub.prototype.v2Room=function(){
  oldRoom.call(this);
  this.dcEditing=null;
  enhanceRoom(this);
  this.v2Members();
 };
 Hub.prototype.v2Messages=function(){renderRoom(this);};
 Hub.prototype.v2Members=function(){
  oldMembers.call(this);
  const panel=this.$(".v2-online-panel"),server=this.v2Servers.find(s=>s.id===this.v2ServerId);
  if(!panel||!server)return;
  const active=new Set(this.users.map(u=>u.id));
  const people=[...(server.members||[])].sort((a,b)=>{
   const diff=Number(active.has(b.id))-Number(active.has(a.id));
   return diff||String(a.name).localeCompare(String(b.name));
  });
  const online=people.filter(u=>active.has(u.id));
  const offline=people.filter(u=>!active.has(u.id));
  const heading=panel.querySelector("h3");if(heading)heading.textContent="MEMBERS · "+people.length;
  const content=panel.querySelector("div");if(!content)return;
  const section=(title,rows)=>'<div class="dc-member-heading">'+title+' — '+rows.length+'</div>'+
   rows.slice(0,45).map(u=>'<button type="button" class="dc-member'+(active.has(u.id)?" online":"")+
    '" data-cm="dm" data-member="'+escapeText(u.id)+'" title="Message '+escapeText(u.name)+'">'+
    '<span class="dc-member-avatar">'+escapeText(u.name?.[0]?.toUpperCase()||"?")+'</span>'+
    '<span class="dc-member-name"><strong>'+escapeText(u.name)+'</strong><small>'+
    escapeText(u.admin?"Admin":server.roles?.find(r=>r.id===u.role)?.name||"Member")+'</small></span>'+
    '<span class="dc-member-dot"></span></button>').join("");
  content.innerHTML=section("ONLINE",online)+section("OFFLINE",offline);
 };
 Hub.prototype.chat=function(){
  oldChat.call(this);
  const form=this.$("#hubChatForm"),input=this.$("#hubChatInput");
  if(!form||!input)return;
  const button=form.querySelector('button[type="submit"]');
  if(button)button.innerHTML=icon("send")+'<span>Send</span>';
  if(!form.querySelector(".dc-compose-emoji")){
   const emoji=document.createElement("button");emoji.type="button";emoji.className="dc-compose-emoji";
   emoji.dataset.dc="composeEmoji";emoji.dataset.target="hubChatInput";emoji.setAttribute("aria-label","Insert emoji");
   emoji.innerHTML=icon("smile-plus");form.insertBefore(emoji,input);
  }
  enhanceLegacy(this);
 };
 Hub.prototype.messages=function(){
  oldMessages.call(this);enhanceLegacy(this);
 };
 Hub.prototype.onMessage=function(event){
  oldReceive.call(this,event);
  if(!this.dcReady)return;
  if(event.type==="v2Typing"&&this.view==="room"&&event.serverId===this.v2ServerId&&event.channel===this.v2Channel){
   this.dcTyping.set(event.userId,{name:event.name,until:Date.now()+4000});this.dcDrawTyping();
  }
 };
 Hub.prototype.dcDrawTyping=function(){
  const box=this.$("#dcTyping");if(!box)return;
  const now=Date.now();
  for(const [id,record] of this.dcTyping)if(record.until<now)this.dcTyping.delete(id);
  const names=[...this.dcTyping.values()].map(item=>item.name);
  box.textContent=names.length===1?names[0]+" is typing…":names.length>1?names.slice(0,2).join(" and ")+" are typing…":"";
  clearTimeout(this.dcTypingTimer);
  if(names.length)this.dcTypingTimer=setTimeout(()=>this.dcDrawTyping(),1100);
 };
}
