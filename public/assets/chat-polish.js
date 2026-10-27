/* Additional social controls without replacing Lightning's existing live chat protocol. */
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export function installChatPolish(Hub){
 const originalChat=Hub.prototype.chat;
 const originalMessages=Hub.prototype.messages;
 const originalMembers=Hub.prototype.members;
 Hub.prototype.chat=function(){
   const beforeRead=this.readMarkers?.[this.channel]||0;
   originalChat.call(this);
   const content=this.$("#hubContent"),head=content?.querySelector(".social-channel-head");
   if(!head)return;
   this.chatWatermark=beforeRead;
   head.innerHTML=
     '<div class="chat-room-title"><div class="chat-room-glyph">#</div><div><strong>'+esc(this.channel)+'</strong><small>CHAT</small></div></div>'+
     '<div class="chat-room-tools"><div class="chat-live-pill"><i></i> Online</div>'+
       '<button id="chatSearchToggle" type="button" aria-label="Search messages" title="Search messages">⌕</button>'+
       '<button id="socialMode" data-social="mode" type="button" title="Toggle notifications">🔔 '+esc(this.notifyMode)+'</button>'+
       '<button id="socialDesktop" data-social="desktop" type="button" title="Desktop notifications">↗</button></div>';
   const search=document.createElement("div");
   search.className="chat-searchbar";
   search.innerHTML='<span>⌕</span><input id="chatSearchInput" placeholder="Search this channel by message or username…" aria-label="Search channel messages" autocomplete="off" maxlength="120"><button type="button" id="chatClearSearch">CLEAR</button><small id="chatMatchCount"></small>';
   head.after(search);
   this.$("#chatSearchInput").value=this.chatQuery||"";
   search.hidden=!this.chatQuery;
   const toggle=this.$("#chatSearchToggle");
   toggle.addEventListener("click",()=>{
     search.hidden=!search.hidden;
     if(!search.hidden)this.$("#chatSearchInput")?.focus();
   });
   this.$("#chatSearchInput").addEventListener("input",e=>{this.chatQuery=e.target.value.toLowerCase().trim();this.messages()});
   this.$("#chatClearSearch").addEventListener("click",()=>{
     this.chatQuery="";const input=this.$("#chatSearchInput");input.value="";
     this.messages();input.focus();
   });
   const textArea=this.$("#hubChatInput"),composer=this.$(".social-compose-outer");
   composer.querySelector("p")?.remove();
   const toolbar=document.createElement("div");
   toolbar.className="chat-compose-footer";
   toolbar.innerHTML='<div class="chat-composer-left"><span>↵ ENTER TO SEND</span><span>SHIFT + ↵ LINE BREAK</span></div><div class="chat-composer-right"><span id="chatCharCount">0 / 1000</span><button type="button" id="chatEmojiToggle" title="Quick reactions">☺</button></div>';
   const picker=document.createElement("div");picker.className="chat-emoji-picker";picker.hidden=true;
   picker.innerHTML=["🙂","🔥","💯","👀","⚡","😂","❤️","👍"].map(emoji=>'<button type="button" data-chat-emoji="'+emoji+'">'+emoji+'</button>').join("");
   composer.append(toolbar,picker);
   this.$("#chatEmojiToggle").addEventListener("click",()=>{picker.hidden=!picker.hidden});
   picker.addEventListener("click",event=>{
     const button=event.target.closest("[data-chat-emoji]");if(!button)return;
     const start=textArea.selectionStart,end=textArea.selectionEnd;
     textArea.setRangeText(button.dataset.chatEmoji,start,end,"end");
     textArea.focus();textArea.dispatchEvent(new Event("input",{bubbles:true}));picker.hidden=true;
   });
   const count=()=>{const el=this.$("#chatCharCount");if(el)el.textContent=textArea.value.length+" / 1000"};
   textArea.addEventListener("input",count);
   this.$("#hubChatForm").addEventListener("submit",()=>requestAnimationFrame(count));
   if(!this.chatPolishBound){
     this.chatPolishBound=true;
     this.root.addEventListener("click",event=>{
       const member=event.target.closest("[data-chat-mention]");
       if(!member)return;
       if(this.view!=="chat")this.show("chat","general");
       const input=this.$("#hubChatInput");if(!input)return;
       input.value+=(input.value?" ":"")+"@"+member.dataset.chatMention+" ";
       input.focus();input.dispatchEvent(new Event("input",{bubbles:true}));
     });
   }
   this.messages();this.members();
 };
 Hub.prototype.messages=function(){
   originalMessages.call(this);
   const stream=this.$("#hubMessages");
   if(!stream)return;
   const elements=[...stream.querySelectorAll(".social-msg")];
   const rows=(this.history[this.channel]||[]).slice(-120);
   if(elements.length!==rows.length)return;
   let previous=null,lastDate="",matches=0,unreadShown=false;
   const query=this.chatQuery||"";
   for(let i=0;i<elements.length;i++){
     const element=elements[i],msg=rows[i];
     const matchesQuery=!query||(msg.by+" "+msg.message).toLowerCase().includes(query);
     element.hidden=!matchesQuery;if(!matchesQuery)continue;
     matches++;
     const currentDate=new Date(msg.at).toDateString();
     if(currentDate!==lastDate){
       lastDate=currentDate;
       const date=document.createElement("div");date.className="chat-day";
       date.textContent=new Date(msg.at).toLocaleDateString([],{weekday:"short",month:"long",day:"numeric"});
       element.before(date);
     }
     if(!unreadShown&&this.chatWatermark&&msg.at>this.chatWatermark&&msg.userId!==this.id){
       const marker=document.createElement("div");marker.className="chat-new-divider";marker.textContent="NEW MESSAGES";
       element.before(marker);unreadShown=true;
     }
     if(previous&&previous.userId===msg.userId&&msg.at-previous.at<180000&&new Date(previous.at).toDateString()===currentDate){
       element.classList.add("chat-grouped");
     }
     previous=msg;
   }
   const counter=this.$("#chatMatchCount");if(counter)counter.textContent=query?matches+" results":"";
   if(query&&!matches){stream.innerHTML='<div class="chat-search-empty"><span>⌕</span><strong>No messages found</strong><small>Try another search term in #'+esc(this.channel)+'</small></div>'}
   if(!query)stream.scrollTop=stream.scrollHeight;
 };
 Hub.prototype.members=function(){
   originalMembers.call(this);
   const sidebar=this.$(".social-members");
   const users=this.$("#hubMembers");
   if(!sidebar||!users)return;
   // Keep the established live member list, wrapped in a clearer directory.
   const label=sidebar.querySelector(".hub-label");
   if(label)label.textContent="COMMUNITY";
   users.querySelectorAll(".social-member").forEach((row,i)=>{
     const user=this.users[i];if(!user)return;
     row.classList.add("chat-member");
     row.setAttribute("data-chat-mention",user.name);
     row.setAttribute("title","Mention @"+user.name);
     const online=row.querySelector(".social-dot");if(online)online.textContent="●";
   });
   const existing=sidebar.querySelector(".chat-side-info");
   if(existing)existing.remove();
   const box=document.createElement("section");box.className="chat-side-info";
   box.innerHTML='<div class="chat-side-header">SERVER STATUS</div>'+
     '<div class="chat-side-stats"><span><b>●</b> Online</span><strong>'+this.users.length+'</strong></div>'+
     '<div class="chat-side-header">CHANNEL GUIDE</div>'+
     '<p>#general for conversation<br>#games for matchmaking<br>#suggestions for ideas<br>#support for help</p>'+
     '<div class="chat-side-foot">Tip: click a member to @mention them.</div>';
   sidebar.append(box);
 };
}
