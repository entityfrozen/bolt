/* Lightning notifications: server-backed inbox, opt-in desktop notices.
 * No permission prompt on page load. Inbox works even without OS support. */
(()=>{
 "use strict";
 const html=value=>String(value??"").replace(/[&<>"']/g,ch=>({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
 }[ch]));
 const kinds={dm:"Direct message",mention:"Mention",announcement:"Announcement"};
 const icon='<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 9h18c0-1-3-2-3-9ZM10 21h4"/></svg>';
 const time=at=>{
  const age=Date.now()-Number(at||0);
  if(age<60000)return "Just now";
  if(age<3600000)return Math.floor(age/60000)+"m";
  if(age<86400000)return Math.floor(age/3600000)+"h";
  return new Date(at).toLocaleDateString([],{month:"short",day:"numeric"});
 };
 async function api(url,method="GET",body=null){
  const response=await fetch(url,{method,credentials:"same-origin",cache:"no-store",
   headers:{"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.error||"Notifications are unavailable.");
  return data;
 }
 function start(){
  const toolbar=document.querySelector(".toolbar"),menu=document.querySelector("#menuBtn");
  if(!toolbar||!menu||document.querySelector("#lnNotificationsButton"))return;
  let items=[],unread=0,initialized=false,loading=false;
  let desktop=false;
  try{desktop=localStorage.getItem("lightning:notice-desktop")==="yes";}catch{}
  const button=document.createElement("button");
  button.id="lnNotificationsButton";button.type="button";
  button.className="ln-bell";button.title="Notifications";button.setAttribute("aria-label","Notifications");
  button.setAttribute("aria-haspopup","dialog");
  button.innerHTML=icon+'<span class="ln-bell-count" hidden></span>';
  toolbar.insertBefore(button,menu);
  const panel=document.createElement("div");
  panel.id="lnNotificationPanel";panel.className="ln-notices";
  panel.setAttribute("popover","auto");
  panel.setAttribute("role","dialog");panel.setAttribute("aria-label","Your notifications");
  panel.innerHTML='<div class="ln-notices-head"><div><strong>Notifications</strong><small id="lnNoticeSummary">You’re all caught up</small></div>'+
    '<button type="button" data-ln-notice="close" aria-label="Close notifications">×</button></div>'+
    '<div class="ln-notice-toolbar"><button type="button" data-ln-notice="readAll">Mark all read</button>'+
    '<button type="button" data-ln-notice="desktop" id="lnDesktopAlerts">Enable desktop alerts</button></div>'+
    '<div class="ln-notice-list" id="lnNoticeList" role="list"></div>'+
    '<footer><span>DMs, mentions, replies and staff updates</span>'+
    '<button type="button" data-ln-notice="clear">Clear inbox</button></footer>';
  document.body.append(panel);
  const count=button.querySelector(".ln-bell-count"),list=panel.querySelector("#lnNoticeList");
  const summary=panel.querySelector("#lnNoticeSummary"),desktopButton=panel.querySelector("#lnDesktopAlerts");
  function render(){
   count.hidden=unread===0;
   count.textContent=unread>99?"99+":String(unread);
   button.setAttribute("aria-label",unread?"Notifications, "+unread+" unread":"Notifications");
   summary.textContent=unread?unread+" unread":items.length?"You’re all caught up":"No notifications yet";
   const available=typeof Notification!=="undefined"&&window.isSecureContext;
   desktopButton.textContent=desktop&&available&&Notification.permission==="granted"?"Desktop alerts on":"Enable desktop alerts";
   desktopButton.disabled=!available||Notification.permission==="denied";
   desktopButton.title=!available?"Requires supported HTTPS browser":Notification.permission==="denied"?"Blocked in browser settings":"";
   list.innerHTML=items.length?items.map(item=>
    '<button class="ln-notice-item'+(!item.readAt?" unread":"")+'" type="button" data-ln-notice="open" data-id="'+html(item.id)+'" role="listitem">'+
    '<span class="ln-notice-avatar">'+(item.kind==="dm"?"✉":item.kind==="mention"?"@":"✦")+'</span>'+
    '<span class="ln-notice-copy"><span class="ln-notice-meta">'+html(kinds[item.kind]||"Update")+' · '+html(time(item.at))+'</span>'+
    '<strong>'+html(item.title)+'</strong><span>'+html(item.body)+'</span></span>'+
    (!item.readAt?'<i class="ln-notice-dot" aria-label="Unread"></i>':"")+'</button>'
   ).join(""):'<div class="ln-notice-empty"><span>✓</span><strong>All clear</strong><p>New messages and updates appear here.</p></div>';
  }
  function notifyDesktop(item){
   if(!desktop||document.visibilityState!=="hidden"||
      typeof Notification==="undefined"||Notification.permission!=="granted")return;
   try{
    const n=new Notification(item.title,{body:item.body.slice(0,140),icon:"/favicon.svg",tag:"lightning-alert-"+item.id});
    n.onclick=()=>{window.focus();openNotification(item);n.close();};
   }catch{}
  }
  async function refresh(){
   if(loading)return;
   loading=true;
   try{
    const data=await api("/api/account/notifications");
    const next=Array.isArray(data.items)?data.items:[];
    if(initialized){
     const seen=new Set(items.map(x=>x.id));
     for(const item of next.slice().reverse())if(!seen.has(item.id))notifyDesktop(item);
    }
    items=next;unread=Number(data.unread)||0;initialized=true;render();
   }catch(error){
    if(!initialized){summary.textContent="Notifications are unavailable";list.textContent=error.message;}
   }finally{loading=false;}
  }
  function close(){
   if(panel.matches(":popover-open"))panel.hidePopover();else panel.hidden=true;
  }
  async function openNotification(item){
   close();
   if(!item.readAt){
    item.readAt=Date.now();unread=Math.max(0,unread-1);render();
    try{await api("/api/account/notifications/read","PATCH",{ids:[item.id]});}catch{}
   }
   if(item.kind==="dm"&&item.fromId){
    window.LightningAccount?.open("messages",item.fromId);
   }else if(item.kind==="mention"){
    try{
     window.LightningNotificationDestination={
      serverId:item.serverId||"lightning-main",channel:item.channel||"general"
     };
     const hub=await import("/assets/hub.js?v=45");
     hub.openHub("room");
     document.dispatchEvent(new CustomEvent("lightning:notification-channel"));
    }catch{}
   }
  }
  button.addEventListener("click",()=>{
   if(panel.matches(":popover-open")){close();return;}
   if(typeof panel.showPopover==="function")panel.showPopover();else panel.hidden=false;
   const box=button.getBoundingClientRect(),width=Math.min(390,window.innerWidth-20);
   Object.assign(panel.style,{
    right:"auto",bottom:"auto",
    left:Math.max(10,Math.min(window.innerWidth-width-10,box.right-width))+"px",
    top:Math.min(window.innerHeight-80,box.bottom+10)+"px"
   });
   void refresh();
  });
  panel.addEventListener("click",async event=>{
   const action=event.target.closest("[data-ln-notice]");
   if(!action)return;
   const kind=action.dataset.lnNotice;
   if(kind==="close"){close();return;}
   if(kind==="open"){
    const item=items.find(entry=>entry.id===action.dataset.id);
    if(item)void openNotification(item);
   }
   if(kind==="readAll"){
    try{await api("/api/account/notifications/read","PATCH",{});await refresh();}
    catch(error){summary.textContent=error.message;}
   }
   if(kind==="clear"){
    if(!items.length)return;
    if(!confirm("Clear all notifications from your inbox?"))return;
    try{await api("/api/account/notifications","DELETE");items=[];unread=0;render();}
    catch(error){summary.textContent=error.message;}
   }
   if(kind==="desktop"){
    if(typeof Notification==="undefined"||!window.isSecureContext)return;
    // Permission must only be requested in response to this explicit click.
    try{
     const permission=Notification.permission==="default"?
      await Notification.requestPermission():Notification.permission;
     desktop=permission==="granted"?!desktop:false;
     try{localStorage.setItem("lightning:notice-desktop",desktop?"yes":"no");}catch{}
     render();
    }catch{desktop=false;render();}
   }
  });
  document.addEventListener("lightning:dm-refresh",()=>void refresh());
  window.addEventListener("focus",()=>void refresh());
  window.addEventListener("pageshow",()=>void refresh());
  setInterval(()=>void refresh(),12000);
  void refresh();
  window.LightningNotifications={refresh,open:()=>button.click()};
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});
 else start();
})();
