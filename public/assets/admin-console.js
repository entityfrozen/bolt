import {icon} from "./ui-icons.js?v=2";

const escape=value=>String(value??"").replace(/[&<>"']/g,char=>({
 "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[char]));
const formatTime=value=>value?new Date(value).toLocaleString([],{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}):"Never";
const timeAgo=value=>{
 const age=Math.max(0,Date.now()-Number(value||0));
 if(age<60000)return"Just now";
 if(age<3600000)return Math.floor(age/60000)+"m ago";
 if(age<86400000)return Math.floor(age/3600000)+"h ago";
 return Math.floor(age/86400000)+"d ago";
};
const roleNames={admin:"Administrator",user:"Member",account_manager:"Account Manager",
 community_manager:"Community Manager",moderator:"Moderator",support_agent:"Support Agent"};
const sections=[
 ["overview","Overview","layout-dashboard",null],
 ["accounts","Accounts","users","accounts.read"],
 ["community","Community","messages-square","community.moderate"],
 ["platform","Platform","sliders-horizontal","settings.manage"],
 ["providers","Provider Keys","lock-keyhole",null],
 ["announcements","Announcements","bell",null],
 ["sessions","Sessions","monitor","sessions.read"],
 ["activity","Activity log","scroll-text","audit.read"]
];
let activeConsole;

export async function openAdminConsole(services){
 if(!activeConsole)activeConsole=new AdminConsole(services);
 activeConsole.services=services;
 await activeConsole.open();
}

class AdminConsole{
 constructor(services){
  this.services=services;
  this.page="overview";
  this.search="";
  this.filter="all";
  this.data=null;
  this.providers={};
  this.rights=new Set();
  this.loading=false;
  this.dialog=document.createElement("dialog");
  this.dialog.id="lightningAdminConsole";
  this.dialog.className="ac-console";
  this.dialog.setAttribute("aria-labelledby","acMainTitle");
  this.dialog.innerHTML='<div class="ac-app" id="acApp"><div class="ac-loading">Opening staff workspace…</div></div>';
  document.body.append(this.dialog);
  this.dialog.addEventListener("click",event=>this.click(event));
  this.dialog.addEventListener("input",event=>{
   if(event.target.matches("[data-ac-search]")){
    this.search=event.target.value;
    this.updateAccountRows();
   }
  });
  this.dialog.addEventListener("change",event=>this.change(event));
  this.dialog.addEventListener("submit",event=>this.submit(event));
  this.dialog.addEventListener("close",()=>{this.search="";this.filter="all";});
 }
 async open(){
  if(!this.dialog.open)this.dialog.showModal();
  this.page="overview";
  await this.refresh();
 }
 async refresh(){
  if(this.loading)return;
  this.loading=true;
  this.dialog.setAttribute("aria-busy","true");
  try{
   const result=await this.services.api("/api/admin/state");
   this.data=result;
   this.rights=new Set(result.permissions||[]);
   const allowed=this.available();
   if(!allowed.some(tab=>tab[0]===this.page))this.page="overview";
   if(this.page==="providers")await this.loadProviderStatus();
   this.render();
  }catch(error){
   const host=this.dialog.querySelector("#acApp");
   host.innerHTML='<div class="ac-error"><h2>Unable to open the console</h2><p>'+
    escape(error.message)+'</p><button type="button" data-ac-action="refresh">Try again</button>'+
    '<button type="button" data-ac-action="close">Back to Lightning</button></div>';
  }finally{
   this.loading=false;
   this.dialog.removeAttribute("aria-busy");
  }
 }
 available(){return sections.filter(([key,,,permission])=>
   (!["providers","announcements"].includes(key)||this.services.me?.role==="admin")&&
   (!permission||this.rights.has(permission)));}
 stats(){
  const users=this.data?.users||[];
  return {users:users.length,pending:users.filter(u=>u.approved===false).length,
   enabled:users.filter(u=>u.approved!==false&&u.enabled).length,
   sessions:(this.data?.sessions||[]).length,
   events:(this.data?.audit||[]).length};
 }
 nav(){
  return this.available().map(([key,label,iconName])=>
   '<button type="button" class="ac-nav-button'+(key===this.page?" active":"")+
   '" data-ac-page="'+key+'"'+(key===this.page?' aria-current="page"':"")+'>'+
   icon(iconName)+'<span>'+label+'</span>'+
   (key==="accounts"&&this.stats().pending?'<i class="ac-count">'+this.stats().pending+'</i>':"")+'</button>'
  ).join("");
 }
 render(){
  const data=this.data,stats=this.stats();
  const location=sections.find(tab=>tab[0]===this.page);
  const app=this.dialog.querySelector("#acApp");
  app.innerHTML=
   '<aside class="ac-sidebar"><div class="ac-brand">'+
     '<span class="ac-brand-emblem">L<span>•</span></span>'+
     '<span><strong>LIGHTNING</strong><small>CONTROL CENTER</small></span></div>'+
    '<div class="ac-nav-label">WORKSPACE</div><nav class="ac-navigation" aria-label="Staff console sections">'+this.nav()+'</nav>'+
    '<div class="ac-side-foot"><div class="ac-operator"><span class="ac-avatar">'+
      escape((this.services.me?.displayName||this.services.me?.username||"A").charAt(0).toUpperCase())+
      '</span><span><strong>'+escape(this.services.me?.username||"Staff")+'</strong><small>'+
      escape(roleNames[this.services.me?.role]||"Staff")+'</small></span></div>'+
     '<button type="button" class="ac-exit" data-ac-action="close">'+icon("arrow-left")+' Return to workspace</button></div></aside>'+
   '<div class="ac-main"><header class="ac-topbar"><div class="ac-crumb"><span>Staff workspace</span><b>/</b>'+
      escape(location?.[1]||"Overview")+'</div>'+
      '<div class="ac-top-actions"><span class="ac-live"><i></i> Secure console</span>'+
      '<button type="button" class="ac-top-btn" data-ac-action="refresh" aria-label="Refresh console" title="Refresh">'+icon("refresh-cw")+'</button>'+
      '<button type="button" class="ac-top-btn ac-top-close" data-ac-action="close" aria-label="Close console">'+icon("x")+'</button></div></header>'+
    '<main class="ac-content" id="acContent">'+this.pageContent(stats)+'</main>'+
    '<div class="ac-feedback" id="acFeedback" role="status" aria-live="polite"></div></div>';
 }
 pageHeading(eyebrow,title,description,aside=""){
  return '<div class="ac-heading"><div><span class="ac-eyebrow">'+escape(eyebrow)+'</span>'+
   '<h1 id="acMainTitle">'+escape(title)+'</h1><p>'+escape(description)+'</p></div>'+aside+'</div>';
 }
 pageContent(stats){
  switch(this.page){
   case "accounts":return this.accounts(stats);
   case "community":return this.community();
   case "platform":return this.platform();
   case "providers":return this.providerKeys();
   case "announcements":return this.announcements();
   case "sessions":return this.sessions();
   case "activity":return this.activity();
   default:return this.overview(stats);
  }
 }
 metric(iconName,value,label,description,skin=""){
  return '<div class="ac-metric '+skin+'"><div class="ac-metric-icon">'+icon(iconName)+'</div>'+
   '<strong>'+escape(value)+'</strong><span>'+escape(label)+'</span><small>'+escape(description)+'</small></div>';
 }
 overview(stats){
  const rights=this.rights;
  const title=roleNames[this.services.me?.role]||"Staff";
  const metrics=[
   rights.has("accounts.read")?this.metric("users",stats.users,"Total accounts","All accessible profiles"):"",
   rights.has("accounts.read")?this.metric("user-check",stats.enabled,"Enabled members","Approved & active accounts"):"",
   rights.has("accounts.read")?this.metric("clock-3",stats.pending,"Awaiting approval","Accounts needing attention",stats.pending?"attention":""):"",
   rights.has("sessions.read")?this.metric("monitor",stats.sessions,"Active sessions","Across signed-in devices"):""
  ].filter(Boolean);
  const tiles=this.available().filter(tab=>tab[0]!=="overview").map(([key,label,ico])=>
   '<button class="ac-destination" type="button" data-ac-page="'+key+'">'+
   '<span class="ac-destination-icon">'+icon(ico)+'</span><span><b>'+escape(label)+'</b><small>'+
   escape(({accounts:"Users, access & approvals",community:"Channels and moderation",
     platform:"Platform-wide switches",providers:"NVIDIA, Tavily and Brave keys",announcements:"Send notices to every member",sessions:"Connected devices",activity:"Security activity"}[key]))+
    '</small></span>'+icon("arrow-up-right")+'</button>').join("");
  const recent=rights.has("audit.read")?(this.data.audit||[]).slice(0,5).map(evt=>
   '<div class="ac-event"><span class="ac-event-dot"></span><div><strong>'+
   escape(evt.action)+'</strong><span>'+escape(evt.actor)+' · '+escape(evt.target||"Platform")+
   '</span></div><time>'+escape(timeAgo(evt.at))+'</time></div>').join(""):"";
  return '<section class="ac-hero"><span class="ac-eyebrow">OPERATIONS / '+new Date().getFullYear()+'</span>'+
   '<h1 id="acMainTitle">Your command center<span>.</span></h1>'+
   '<p>'+escape(title)+' access is active. Everything you need to run Lightning, in one place.</p>'+
   '<div class="ac-hero-bottom"><span><i></i> Permissions verified by server</span><span>STAFF CONTROL / V2</span></div></section>'+
   (metrics.length?'<section class="ac-metrics">'+metrics.join("")+'</section>':"")+
   '<div class="ac-two-col"><section class="ac-card"><div class="ac-card-head"><div><span class="ac-eyebrow">QUICK ACCESS</span>'+
   '<h2>Manage your workspace</h2></div></div><div class="ac-destinations">'+tiles+'</div></section>'+
   '<section class="ac-card"><div class="ac-card-head"><div><span class="ac-eyebrow">'+
   (rights.has("audit.read")?"LATEST ACTIVITY":"YOUR ACCESS")+'</span><h2>'+
   (rights.has("audit.read")?"Recent actions":"Assigned permissions")+'</h2></div></div>'+
   (rights.has("audit.read")?'<div class="ac-events">'+(recent||this.empty("No activity to show."))+'</div>':
    '<div class="ac-access-list">'+[...rights].slice(0,8).map(p=>'<span>'+icon("check")+
    escape(p.replaceAll("."," / "))+'</span>').join("")+'</div>')+'</section></div>';
 }
 accounts(stats){
  const write=this.rights.has("accounts.manage"),assign=this.rights.has("roles.assign");
  const roleChoices=assign?(this.data.roles||[]).map(role=>
   '<option value="'+escape(role.id)+'">'+escape(role.label)+'</option>').join(""):"";
  const form=write?'<details class="ac-create"><summary>'+icon("plus-circle")+
   '<span><strong>Create a new account</strong><small>Add an approved member or staff account</small></span>'+
   icon("chevron-down")+'</summary><form id="acCreateForm" class="ac-create-form">'+
   '<label>Username<input required name="username" autocomplete="off" minlength="3" maxlength="32" placeholder="e.g. new-member"></label>'+
   '<label>Temporary password<input required name="password" type="password" autocomplete="new-password" minlength="8" placeholder="At least 8 characters"></label>'+
   (assign?'<label>Account role<select name="role">'+roleChoices+'</select></label>':"")+
   '<label>Access duration<select name="expiry"><option value="0">No expiry</option><option value="60">1 hour</option>'+
   '<option value="1440">1 day</option><option value="10080">7 days</option><option value="43200">30 days</option></select></label>'+
   '<button type="submit" class="ac-primary">'+icon("user-plus")+' Create account</button></form></details>':"";
  return this.pageHeading("IDENTITY MANAGEMENT","Accounts & access",
   "Approve new members, assign roles, and manage account security.",
   '<span class="ac-heading-chip">'+stats.users+' accounts</span>')+
   '<section class="ac-compact-metrics">'+
    this.metric("users",stats.users,"Accounts","In your scope")+
    this.metric("clock-3",stats.pending,"Pending","Need approval",stats.pending?"attention":"")+
    this.metric("check-circle",stats.enabled,"Enabled","Approved profiles")+'</section>'+
   form+
   '<section class="ac-card ac-account-card"><div class="ac-card-head ac-wrap"><div>'+
   '<span class="ac-eyebrow">DIRECTORY</span><h2>All accounts</h2></div>'+
   '<div class="ac-account-tools"><label class="ac-search">'+icon("search")+
   '<input type="search" data-ac-search placeholder="Search username or role" value="'+escape(this.search)+'" aria-label="Search accounts"></label>'+
   '<select data-ac-filter aria-label="Filter accounts">'+
   [["all","All accounts"],["pending","Pending"],["enabled","Enabled"],["disabled","Disabled"]].map(([value,label])=>
    '<option value="'+value+'"'+(this.filter===value?" selected":"")+'>'+label+'</option>').join("")+
   '</select></div></div><div class="ac-table-wrap" id="acAccountRows">'+this.accountRows()+'</div></section>';
 }
 accountRows(){
  const write=this.rights.has("accounts.manage"),assign=this.rights.has("roles.assign");
  const query=this.search.trim().toLowerCase();
  const users=(this.data.users||[]).filter(user=>{
   if(query&&!(user.username+" "+(roleNames[user.role]||user.role)).toLowerCase().includes(query))return false;
   if(this.filter==="pending")return user.approved===false;
   if(this.filter==="enabled")return user.approved!==false&&user.enabled;
   if(this.filter==="disabled")return user.approved!==false&&!user.enabled;
   return true;
  }).sort((a,b)=>Number(a.approved!==false)-Number(b.approved!==false)||a.username.localeCompare(b.username));
  if(!users.length)return this.empty("No accounts match these filters.");
  const roleOptions=user=>(this.data.roles||[]).map(r=>
   '<option value="'+escape(r.id)+'"'+(user.role===r.id?" selected":"")+'>'+escape(r.label)+'</option>').join("");
  return '<table class="ac-table"><thead><tr><th>ACCOUNT</th><th>STATUS</th><th>ROLE</th><th>EXPIRES</th>'+
   (write?'<th>ACTIONS</th>':"")+'</tr></thead><tbody>'+users.map(user=>{
    const status=user.approved===false?"Pending":!user.enabled?"Disabled":"Active";
    const canChange=write&&(assign||(user.role==="user"&&user.id!==this.services.me.id));
    const actions=canChange?'<div class="ac-row-actions">'+
     (user.approved===false?this.action("approve",user.id,"Approve","accent"):"")+
     this.action(user.enabled?"disable":"enable",user.id,user.enabled?"Disable":"Enable")+
     this.action("expiry",user.id,"Expiry")+
     this.action("password",user.id,"Reset pass")+
     this.action("revoke",user.id,"Sign out")+
     (user.id!==this.services.me.id?this.action("delete",user.id,"Delete","danger"):"")+'</div>':
     '<span class="ac-muted">Read only</span>';
    return '<tr><td><div class="ac-user"><span class="ac-initial">'+escape(user.username.charAt(0).toUpperCase())+
     '</span><span><strong>'+escape(user.username)+'</strong><small>Joined '+escape(formatTime(user.createdAt))+
     '</small></span></div></td><td><span class="ac-state '+status.toLowerCase()+'"><i></i>'+status+'</span></td>'+
     '<td>'+(assign&&canChange?'<select class="ac-role" data-ac-role data-id="'+escape(user.id)+
      '" aria-label="Role for '+escape(user.username)+'">'+roleOptions(user)+'</select>':
      '<span class="ac-role-name">'+escape(roleNames[user.role]||user.role)+'</span>')+'</td>'+
     '<td class="ac-muted">'+(user.expiresAt?escape(formatTime(user.expiresAt)):"No expiry")+'</td>'+
     (write?'<td>'+actions+'</td>':"")+'</tr>';
   }).join("")+'</tbody></table>';
 }
 action(name,id,title,style=""){
  return '<button class="ac-tiny '+style+'" type="button" data-ac-action="'+name+
   '" data-id="'+escape(id)+'">'+title+'</button>';
 }
 updateAccountRows(){
  const target=this.dialog.querySelector("#acAccountRows");
  if(target)target.innerHTML=this.accountRows();
 }
 community(){
  const manager=this.rights.has("community.manage");
  return this.pageHeading("COMMUNITY OPERATIONS","Community tools",
   "Moderation and community management are controlled by your staff role.")+
   '<div class="ac-community-banner">'+icon("messages-square")+
   '<div><span class="ac-eyebrow">'+(manager?"COMMUNITY MANAGER":"MODERATION")+'</span>'+
   '<h2>Keep the conversation moving.</h2><p>'+
   (manager?"Manage channels, roles, and messages in communities you belong to.":
   "Review and remove messages in communities you belong to. Server settings remain restricted.")+
   '</p><button type="button" class="ac-primary" data-ac-action="community">'+icon("arrow-up-right")+
   ' Open community workspace</button></div></div>';
 }
 platform(){
  const settings=this.data.settings||{},features=settings.features||{};
  const controls=[
   ["maintenance","Maintenance mode","Pause access for regular members while keeping administrators online.",!!settings.maintenance,"shield-alert"],
   ["proxy","Web browsing","Allow members to use the integrated browsing workspace.",!!features.proxy,"globe"],
   ["music","Audio player","Enable audio playback features for members.",!!features.music,"headphones"],
   ["ai","Assistant","Enable the built-in AI assistant.",!!features.ai,"sparkles"]
  ];
  return this.pageHeading("SYSTEM CONFIGURATION","Platform controls",
   "Change global features. Updates apply to all users of this deployment.")+
   '<section class="ac-card"><div class="ac-card-head"><div><span class="ac-eyebrow">FEATURE FLAGS</span>'+
   '<h2>Workspace availability</h2></div><span class="ac-heading-chip">ADMIN ONLY</span></div>'+
   '<div class="ac-switch-list">'+controls.map(([key,title,desc,on,ico])=>
    '<div class="ac-switch-row"><span class="ac-switch-icon">'+icon(ico)+'</span><div><strong>'+
    escape(title)+'</strong><small>'+escape(desc)+'</small></div>'+
    '<button type="button" class="ac-toggle'+(on?" on":"")+'" role="switch" aria-checked="'+on+
    '" data-ac-setting="'+key+'" aria-label="Toggle '+escape(title)+'"><span></span></button></div>').join("")+
    '</div></section>'+
    '<section class="ac-danger-zone"><div><span class="ac-eyebrow">SECURITY ACTION</span>'+
    '<h2>End all member sessions</h2><p>Signs out regular users immediately. Staff sessions remain active.</p></div>'+
    '<button type="button" class="ac-danger-button" data-ac-action="revokeAll">'+icon("shield-off")+
    ' Sign out members</button></section>';
 }
 async loadProviderStatus(){
  try{this.providers=await this.services.api("/api/ai/search-settings");}
  catch(error){this.providers={error:error.message};}
 }
 providerKeys(){
  const providers=[
   ["nvidia","NVIDIA AI","Powers Lightning AI responses","NVIDIA_API_KEY"],
   ["tavily","Tavily Search","Provides current web results","TAVILY_API_KEY"],
   ["brave","Brave Search","Optional alternative search provider","BRAVE_SEARCH_API_KEY"]
  ];
  return this.pageHeading("INTEGRATIONS","Provider Keys",
   "Add or replace server API keys directly from the website. Only administrators can manage them.")+
   '<div class="ac-secret-notice">'+icon("shield-check")+
   '<div><strong>Encrypted server-side storage</strong><p>Keys are saved on Lightning’s persistent data volume. Saved values are never displayed or sent back to the browser. The Railway environment still works as a fallback.</p></div></div>'+
   (this.providers.error?'<p class="ac-error-inline">'+escape(this.providers.error)+'</p>':"")+
   '<div class="ac-provider-list">'+providers.map(([key,name,description,env])=>{
    const source=this.providers.source?.[key]||"missing",ready=!!this.providers[key];
    const status=ready?(source==="shared"?"Saved on website":"Configured in Railway"):"Not configured";
    return '<section class="ac-provider-card"><div class="ac-provider-heading"><div><span class="ac-eyebrow">'+escape(env)+'</span>'+
     '<h2>'+escape(name)+'</h2><p>'+escape(description)+'</p></div>'+
     '<span class="ac-provider-status'+(ready?" ready":"")+'">'+escape(status)+'</span></div>'+
     '<form class="ac-provider-form" data-ac-provider="'+key+'" autocomplete="off">'+
     '<label for="acKey-'+key+'">API key</label><div class="ac-provider-input"><input id="acKey-'+key+
     '" name="key" type="password" autocomplete="new-password" autocapitalize="off" spellcheck="false" required minlength="10" maxlength="300" placeholder="Paste a new key to save">'+
     '<button type="submit" class="ac-primary">Save key</button></div>'+
     '<div class="ac-provider-actions"><button type="button" data-ac-action="testProvider" data-provider="'+key+'"'+(!ready?" disabled":"")+'>Test connection</button>'+
     '<button type="button" data-ac-action="removeProvider" data-provider="'+key+'"'+(source!=="shared"?" disabled":"")+'>Remove saved key</button></div></form></section>';
   }).join("")+'</div>';
 }
 announcements(){
  return this.pageHeading("COMMUNICATIONS","Announcements",
   "Send a notification to every active Lightning member.")+
   '<section class="ac-card ac-announcement"><div class="ac-card-head"><div><span class="ac-eyebrow">NEW ANNOUNCEMENT</span><h2>Notify everyone</h2></div></div>'+
   '<form data-ac-announcement><label>Title<input name="title" maxlength="90" minlength="3" required placeholder="What’s new on Lightning?"></label>'+
   '<label>Message<textarea name="body" maxlength="240" minlength="3" rows="4" required placeholder="Tell members what changed…"></textarea></label>'+
   '<p>Appears in each member’s notification inbox, including when they next sign in. Limited to one announcement every 30 seconds.</p>'+
   '<button type="submit" class="ac-primary">'+icon("send")+' Send announcement</button></form></section>';
 }
 sessions(){
  const list=this.data.sessions||[];
  return this.pageHeading("SECURITY CENTER","Active sessions","View connected accounts and end individual sessions.",
   '<span class="ac-heading-chip">'+list.length+' total</span>')+
   '<section class="ac-card"><div class="ac-card-head"><div><span class="ac-eyebrow">SESSION DIRECTORY</span>'+
   '<h2>Signed-in devices</h2></div></div>'+
   (list.length?'<div class="ac-session-list">'+list.map(session=>{
    const self=session.id===this.services.me.sessionId;
    return '<div class="ac-session"><span class="ac-session-icon">'+icon("monitor")+'</span>'+
     '<div class="ac-session-detail"><strong>'+escape(session.username)+(self?' <em>YOU</em>':"")+
     '</strong><small>'+escape(session.ip||"Unknown IP")+' · '+
     escape((session.userAgent||"Unknown browser").slice(0,110))+'</small></div>'+
     '<span class="ac-session-time">'+escape(timeAgo(session.lastSeenAt))+'</span>'+
     (!self?'<button type="button" class="ac-tiny danger" data-ac-action="killSession" data-id="'+
      escape(session.id)+'">Revoke</button>':"")+'</div>';
   }).join("")+'</div>':this.empty("No active sessions were found."))+'</section>';
 }
 activity(){
  const events=this.data.audit||[];
  return this.pageHeading("SECURITY AUDIT","Activity log","The most recent recorded administrative and account events.",
   '<span class="ac-heading-chip">'+events.length+' events</span>')+
   '<section class="ac-card"><div class="ac-card-head"><div><span class="ac-eyebrow">AUDIT TRAIL</span>'+
   '<h2>Recent actions</h2></div></div>'+
   (events.length?'<div class="ac-audit-list">'+events.map(evt=>
    '<div class="ac-audit-item"><span class="ac-event-dot"></span><time>'+escape(formatTime(evt.at))+
    '</time><div><strong>'+escape(evt.action)+'</strong><span>'+escape(evt.actor)+
    (evt.target?" · "+escape(evt.target):"")+'</span>'+
    (evt.detail?'<small>'+escape(evt.detail)+'</small>':"")+'</div></div>').join("")+
    '</div>':this.empty("No recent actions to show."))+'</section>';
 }
 empty(message){return '<div class="ac-empty">'+icon("inbox")+'<span>'+escape(message)+'</span></div>';}
 message(value){
  const target=this.dialog.querySelector("#acFeedback");
  if(target){target.textContent=value;target.classList.add("visible");}
  this.services.notify?.(value);
 }
 async run(task,message){
  if(this.loading)return;
  this.loading=true;
  try{
   await task();
   this.loading=false;
   await this.refresh();
   if(message)this.message(message);
  }catch(error){
   this.loading=false;
   this.message(error.message||"That action could not be completed.");
  }
 }
 async click(event){
  const button=event.target.closest("button");
  if(!button||!this.dialog.contains(button)||button.disabled)return;
  const page=button.dataset.acPage;
  if(page&&this.available().some(item=>item[0]===page)){
   this.page=page;
   if(page==="providers")await this.loadProviderStatus();
   this.render();return;
  }
  const setting=button.dataset.acSetting;
  if(setting&&this.rights.has("settings.manage")){
   if(setting==="maintenance"&&!button.classList.contains("on")&&
      !confirm("Enable maintenance mode and temporarily block members?"))return;
   const next=!button.classList.contains("on");
   await this.run(async()=>{
    const value=setting==="maintenance"?{maintenance:next}:{features:{[setting]:next}};
    const result=await this.services.api("/api/admin/settings",
      {method:"PATCH",body:JSON.stringify(value)});
    this.services.onSettings?.(result.settings);
   },setting+" updated");
   return;
  }
  const action=button.dataset.acAction;
  if(!action)return;
  if(action==="testProvider"&&this.services.me?.role==="admin"){
   const provider=button.dataset.provider;
   if(!["nvidia","tavily","brave"].includes(provider))return;
   button.disabled=true;
   try{
    const data=await this.services.api(provider==="nvidia"?"/api/ai/provider-test":"/api/ai/search-test",{
     method:"POST",body:JSON.stringify({provider})});
    this.message(data.ok?(provider==="nvidia"?"NVIDIA key accepted for model listing. Chat-model access may vary.":"Search connection successful."):(data.error||"The provider did not respond."));
   }catch(error){this.message(error.message);}
   finally{button.disabled=false;}
   return;
  }
  if(action==="removeProvider"&&this.services.me?.role==="admin"){
   const provider=button.dataset.provider;
   if(!["nvidia","tavily","brave"].includes(provider))return;
   if(!confirm("Remove the saved "+provider+" key? The Railway key, if any, will remain available."))return;
   await this.run(()=>this.services.api("/api/ai/search-settings/"+provider,{method:"DELETE"}),"Saved key removed.");
   return;
  }
  if(action==="close"){this.dialog.close();return;}
  if(action==="refresh"){await this.refresh();return;}
  if(action==="community"&&this.rights.has("community.moderate")){
   this.dialog.close();this.services.onCommunity?.();return;
  }
  const user=(this.data?.users||[]).find(item=>item.id===button.dataset.id);
  if(action==="killSession"&&this.rights.has("sessions.read")){
   if(!confirm("Revoke this session immediately?"))return;
   await this.run(()=>this.services.api("/api/admin/sessions/"+encodeURIComponent(button.dataset.id),
     {method:"DELETE"}),"Session revoked");return;
  }
  if(action==="revokeAll"&&this.rights.has("settings.manage")){
   if(!confirm("Sign out every regular member? This cannot be undone."))return;
   await this.run(()=>this.services.api("/api/admin/sessions/revoke-users",
    {method:"POST",body:"{}"}),"Member sessions revoked");return;
  }
  if(!user||!this.rights.has("accounts.manage"))return;
  const manageable=this.rights.has("roles.assign")||
   (user.role==="user"&&user.id!==this.services.me.id);
  if(!manageable)return;
  if(action==="approve"||action==="disable"||action==="enable"){
   const patch=action==="approve"?{approved:true}:{enabled:action==="enable"};
   await this.patchUser(user.id,patch);return;
  }
  if(action==="revoke"){
   if(!confirm("Sign out every session for "+user.username+"?"))return;
   await this.run(()=>this.services.api("/api/admin/users/"+encodeURIComponent(user.id)+"/revoke",
    {method:"POST",body:"{}"}),"Account sessions revoked");return;
  }
  if(action==="delete"){
   if(!confirm("Permanently delete "+user.username+" and their account access?"))return;
   await this.run(()=>this.services.api("/api/admin/users/"+encodeURIComponent(user.id),
    {method:"DELETE"}),"Account deleted");return;
  }
  if(action==="password"){
   const value=await this.ask("Reset password","Enter a new password for "+user.username,
    "New password","password","");
   if(value===null)return;
   if(value.length<8){this.message("Passwords must contain at least 8 characters.");return;}
   await this.patchUser(user.id,{password:value});return;
  }
  if(action==="expiry"){
   const value=await this.ask("Change access expiry","Hours of access from now. Use 0 for no expiry.",
    "Hours","number",user.expiresAt?String(Math.max(1,Math.ceil((user.expiresAt-Date.now())/3600000))):"0");
   if(value===null)return;
   const hours=Number(value);
   if(!Number.isFinite(hours)||hours<0||hours>87600){this.message("Enter a number between 0 and 87600 hours.");return;}
   await this.patchUser(user.id,{expiresAt:hours?Date.now()+hours*3600000:null});return;
  }
 }
 async patchUser(id,patch){
  await this.run(()=>this.services.api("/api/admin/users/"+encodeURIComponent(id),
   {method:"PATCH",body:JSON.stringify(patch)}),"Account updated");
 }
 async change(event){
  if(event.target.matches("[data-ac-filter]")){
   this.filter=event.target.value;this.updateAccountRows();return;
  }
  if(event.target.matches("[data-ac-role]")&&this.rights.has("roles.assign")){
   const id=event.target.dataset.id,role=event.target.value;
   await this.patchUser(id,{role});
  }
 }
 async submit(event){
  if(event.target.matches("[data-ac-provider]")){
   event.preventDefault();
   if(this.services.me?.role!=="admin")return;
   const provider=event.target.dataset.acProvider;
   if(!["nvidia","tavily","brave"].includes(provider))return;
   const input=event.target.elements.key,key=input?.value?.trim()||"";
   if(!key)return;
   input.value="";
   await this.run(()=>this.services.api("/api/ai/search-settings",{
    method:"POST",body:JSON.stringify({provider,key})
   }),"Provider key saved securely.");
   return;
  }
  if(event.target.matches("[data-ac-announcement]")){
   event.preventDefault();
   if(this.services.me?.role!=="admin")return;
   const values=new FormData(event.target);
   const title=String(values.get("title")||"").trim(),body=String(values.get("body")||"").trim();
   if(!confirm("Notify every Lightning member?"))return;
   await this.run(async()=>{
    const response=await this.services.api("/api/admin/notifications/announce",{
     method:"POST",body:JSON.stringify({title,body})});
    this.announcementRecipients=response.recipients;
   },"Announcement sent to members.");
   return;
  }
  if(event.target.id!=="acCreateForm"||!this.rights.has("accounts.manage"))return;
  event.preventDefault();
  const values=new FormData(event.target),minutes=Number(values.get("expiry"))||0;
  const body={username:String(values.get("username")||"").trim(),
   password:String(values.get("password")||""),
   role:this.rights.has("roles.assign")?String(values.get("role")||"user"):"user",
   expiresAt:minutes?Date.now()+minutes*60000:null};
  await this.run(()=>this.services.api("/api/admin/users",{method:"POST",
   body:JSON.stringify(body)}),"Account created");
 }
 ask(heading,description,label,type,value){
  return new Promise(resolve=>{
   const dialog=document.createElement("dialog");
   dialog.className="ac-prompt";
   dialog.setAttribute("aria-label",heading);
   dialog.innerHTML='<form class="ac-prompt-content"><span class="ac-eyebrow">ACCOUNT MANAGEMENT</span>'+
    '<h2>'+escape(heading)+'</h2><p>'+escape(description)+'</p>'+
    '<label>'+escape(label)+'<input required name="value" type="'+escape(type)+'" value="'+escape(value)+
    '" autocomplete="off"'+(type==="number"?' min="0" max="87600" step="any"':"")+'></label>'+
    '<div class="ac-prompt-actions"><button type="button" class="ac-cancel">Cancel</button>'+
    '<button type="submit" class="ac-primary">Save changes</button></div></form>';
   document.body.append(dialog);
   const input=dialog.querySelector("input");
   dialog.querySelector(".ac-cancel").addEventListener("click",()=>dialog.close("cancel"));
   dialog.querySelector("form").addEventListener("submit",e=>{
    e.preventDefault();dialog.close("save");
   });
   dialog.addEventListener("close",()=>{
    const result=dialog.returnValue==="save"?input.value:null;
    dialog.remove();resolve(result);
   },{once:true});
   dialog.showModal();input.focus();
  });
 }
}
