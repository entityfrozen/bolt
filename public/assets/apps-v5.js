import {icon} from "./ui-icons.js?v=2";

const clean=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const core=[
 {id:"world",name:"WorldPvP",type:"Games",tag:"Strategy",note:"Multiplayer strategy",icon:"compass"},
 {id:"chess",name:"Chess",type:"Games",tag:"Strategy",note:"Online and practice",icon:"chess-knight"},
 {id:"rps",name:"Rock Paper Scissors",type:"Games",tag:"Casual",note:"Quick matches",icon:"hand"},
 {id:"uma",name:"Uma Versus",type:"Games",tag:"Fighting",note:"Fighting game",icon:"swords"},
 {id:"2048",name:"2048",type:"Games",tag:"Puzzle",note:"Number puzzle",icon:"grid-2x2"},
 {id:"mines",name:"Minesweeper",type:"Games",tag:"Puzzle",note:"Minesweeper",icon:"bomb"},
 {id:"youtube",name:"YouTube",type:"Streaming",tag:"Streaming",note:"Videos and live streams",icon:"youtube",url:"https://www.youtube.com/"}
];
const account=()=>window.LightningAccount?.settings;
const save=(key,value)=>void account()?.set(key,value).catch(err=>console.warn("App settings:",err.message));
const customApps=items=>Array.isArray(items)?items.filter(a=>a&&typeof a.id==="string"&&/^user-[a-z0-9-]+$/.test(a.id)&&
  typeof a.name==="string"&&a.name.length<=48&&["Games","Music","Streaming"].includes(a.category)&&
  typeof a.url==="string"&&/^https?:\/\//.test(a.url)).slice(0,30):[];

export function installApps(Hub){
 const sync=Hub.prototype.v3Sync;
 Hub.prototype.v3Sync=function(){
  const result=sync.call(this);
  this.root.querySelectorAll('[data-v3="arcade"]').forEach(button=>{
   const label=button.querySelector("span");
   if(label&&label.textContent==="Games")label.textContent="Apps";
  });
  return result;
 };
 const setup=Hub.prototype.v2Setup;
 const launch=Hub.prototype.v3Launch;
 const show=Hub.prototype.show;
 Hub.prototype.show=function(view,channel){
  // Keep an embedded Uma match mounted when switching to another screen.
  if(this.view==="uma"&&view!=="uma"){
   const frame=this.root.querySelector("#umaGameFrame");
   if(frame){frame.id="umaSavedFrame";frame.hidden=true;this.root.append(frame);this.umaSavedFrame=frame;}
  }
  const result=show.call(this,view,channel);
  if(view==="uma"&&this.umaSavedFrame){
   const placeholder=this.root.querySelector("#umaGameFrame");
   if(placeholder){
    this.umaSavedFrame.id="umaGameFrame";this.umaSavedFrame.hidden=false;
    placeholder.replaceWith(this.umaSavedFrame);this.umaSavedFrame=null;
   }
  }
  return result;
 };
 Hub.prototype.v2Setup=function(){
  setup.call(this);
  if(this.appsReady)return;
  this.appsReady=true;
  this.v3Favorites=account()?.get("favorites",[])||[];
  this.userApps=customApps(account()?.get("customApps",[]));
  this.sharedApps=[];
  this.canShareApps=false;
  this.appsLastSync=0;
  void this.refreshSharedApps();
  this.appsSection="All";
  this.appsSearch="";
  const rename=()=>{
   this.root.querySelectorAll('[data-v3="arcade"] span').forEach(span=>span.textContent="Apps");
   this.root.querySelectorAll('[data-v3="arcade"]').forEach(button=>{if(button.title==="Games")button.title="Apps";});
  };
  rename();
  this.v3RenderDock();
  document.addEventListener("lightning:account-settings-loaded",()=>{
   this.v3Favorites=account()?.get("favorites",[])||[];
   this.userApps=customApps(account()?.get("customApps",[]));
   rename();this.v3RenderDock();
   if(this.view==="games")this.games(true);
  });
  this.root.addEventListener("click",e=>{
   const b=e.target.closest("[data-app]");
   if(!b||!this.root.contains(b))return;
   const action=b.dataset.app,id=b.dataset.id;
   if(action==="favorite"){
    const has=this.v3Favorites.includes(id);
    this.v3Favorites=has?this.v3Favorites.filter(x=>x!==id):[...this.v3Favorites,id];
    save("favorites",this.v3Favorites);
    b.textContent=has?"☆":"★";
    b.setAttribute("aria-pressed",String(!has));
    b.title=has?"Add to favorites":"Remove favorite";
    this.v3RenderDock();
    return;
   }
   if(action==="launch"){this.v3Launch(id);return;}
   if(action==="removeShared"){
    if(!this.canShareApps)return;
    const item=this.sharedApps.find(x=>x.id===id);
    if(!item||!confirm("Remove "+item.name+" for everyone?"))return;
    void (async()=>{
      try{
        const response=await fetch("/api/apps/"+encodeURIComponent(id),{method:"DELETE",credentials:"same-origin"});
        const data=await response.json().catch(()=>({}));
        if(!response.ok)throw Error(data.error||"Couldn't remove app.");
        this.sharedApps=this.sharedApps.filter(x=>x.id!==id);
        this.appsLastSync=Date.now();
        this.v3Favorites=this.v3Favorites.filter(x=>x!==id);
        save("favorites",this.v3Favorites);
        this.v3RenderDock();if(this.view==="games")this.games(true);
      }catch(error){this.flash(error.message);}
    })();
    return;
   }
   if(action==="remove"){
    const item=this.userApps.find(x=>x.id===id);
    if(!item||!confirm("Remove "+item.name+"?"))return;
    this.userApps=this.userApps.filter(x=>x.id!==id);
    this.v3Favorites=this.v3Favorites.filter(x=>x!==id);
    save("customApps",this.userApps);save("favorites",this.v3Favorites);
    this.games(true);this.v3RenderDock();return;
   }
   if(action==="section"){
    this.appsSection=b.dataset.section||"All";
    this.appsFilter();
   }
  });
  this.root.addEventListener("input",e=>{
   if(e.target.id==="appsSearch"){this.appsSearch=e.target.value.toLowerCase().trim();this.appsFilter();}
  });
  this.root.addEventListener("submit",async e=>{
   if(e.target.id!=="addAppForm")return;
   e.preventDefault();
   const form=e.target,fields=new FormData(form);
   const name=String(fields.get("name")||"").trim(),link=String(fields.get("url")||"").trim(),category=String(fields.get("category")||"Games");
   const status=this.root.querySelector("#appAddStatus");
   const isShared=String(fields.get("visibility")||"private")==="shared";
   const submit=form.querySelector('[type="submit"]');
   if(submit)submit.disabled=true;
   try{
    const target=new URL(link);
    if(!["http:","https:"].includes(target.protocol)||target.username||target.password||link.length>1800)throw Error("Enter a valid website link.");
    if(name.length<2||name.length>48)throw Error("Name must be 2–48 characters.");
    if(!["Games","Music","Streaming"].includes(category))throw Error("Pick a section.");
    if(isShared){
      if(!this.canShareApps)throw Error("Only admins can add an app for everyone.");
      const response=await fetch("/api/apps",{method:"POST",credentials:"same-origin",
        headers:{"Content-Type":"application/json"},body:JSON.stringify({name,url:target.href,category})});
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw Error(result.error||"Couldn't add shared app.");
      this.sharedApps=[...this.sharedApps,result.app];
      this.appsLastSync=Date.now();
    }else{
      if(this.userApps.length>=30)throw Error("You can add up to 30 personal links.");
      this.userApps.push({id:"user-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,8),name,url:target.href,category});
      save("customApps",this.userApps);
    }
    this.games(true);
    const after=this.root.querySelector("#appAddStatus");
    if(after)after.textContent="Added "+name+(isShared?" for everyone.":".");
   }catch(err){if(status)status.textContent=err.message;}
   finally{if(submit&&submit.isConnected)submit.disabled=false;}
  });
 };
 Hub.prototype.v3RenderDock=function(){
  const dock=this.root.querySelector("#v3DockGames");if(!dock)return;
  const available=[...core,...(this.sharedApps||[]).map(a=>({...a,icon:"link",type:a.category})),
    ...(this.userApps||[]).map(a=>({...a,icon:"link",type:a.category}))];
  const chosen=(this.v3Favorites||[]).map(id=>available.find(a=>a.id===id)).filter(Boolean).slice(0,5);
  dock.innerHTML=chosen.length?chosen.map(a=>
   '<button class="v3-dock-game" data-app="launch" data-id="'+clean(a.id)+'" title="Open '+clean(a.name)+'"><span class="v3-dock-icon">'+icon(a.icon)+'</span><span>'+clean(a.name)+'</span></button>').join(""):
   '<span class="v3-apps-dock-empty">No favorites yet</span>';
 };
 Hub.prototype.v3Launch=function(id){
  const external=core.find(a=>a.id===id&&a.url)||
    (this.sharedApps||[]).find(a=>a.id===id)||(this.userApps||[]).find(a=>a.id===id);
  if(external?.url){
    document.dispatchEvent(new CustomEvent("lightning:open-browser-tab",{detail:{url:external.url,title:external.name}}));
    return;
  }
  return launch.call(this,id);
 };
 Hub.prototype.refreshSharedApps=async function(){
  this.appsLastSync=Date.now();
  try{
    const response=await fetch("/api/apps",{credentials:"same-origin",cache:"no-store"});
    if(!response.ok)throw Error("Shared apps unavailable.");
    const data=await response.json();
    this.sharedApps=Array.isArray(data.apps)?data.apps:[];
    this.canShareApps=data.canManage===true;
    this.v3RenderDock();
    if(this.view==="games"&&this.root.querySelector(".v3-apps-page"))this.games(true);
  }catch(error){console.warn("Shared apps:",error.message);}
 };
 Hub.prototype.games=function(preserve=false){
  if(Date.now()-(this.appsLastSync||0)>30000)void this.refreshSharedApps();
  this.header("Apps","Games, music and streaming");
  const mount=this.root.querySelector("#hubContent");if(!mount)return;
  const scroll=preserve?(mount.querySelector(".v3-apps-page")?.scrollTop||mount.scrollTop):0;
  const custom=a=>({...a,type:a.category,tag:a.id.startsWith("shared-")?"Shared app":"Your link",
    note:(()=>{try{return new URL(a.url).hostname}catch{return "Saved link"}})(),icon:"link"});
  const items=[...core,...(this.sharedApps||[]).map(custom),...(this.userApps||[]).map(custom)];
  const card=a=>{
   const favorite=(this.v3Favorites||[]).includes(a.id);
   return '<article class="v3-app-tile" data-name="'+clean(a.name.toLowerCase())+'" data-section="'+clean(a.type)+'">'+
     '<div class="v3-app-icon">'+icon(a.icon)+'</div>'+
     '<div class="v3-app-info"><small>'+clean(a.tag||a.type)+'</small><strong>'+clean(a.name)+'</strong><span>'+clean(a.note||"")+'</span></div>'+
     '<div class="v3-app-actions"><button type="button" data-app="favorite" data-id="'+clean(a.id)+'" aria-label="Favorite '+clean(a.name)+'" aria-pressed="'+favorite+'" title="'+(favorite?"Remove favorite":"Add to favorites")+'" class="v3-app-star">'+(favorite?"★":"☆")+'</button>'+
     '<button type="button" data-app="launch" data-id="'+clean(a.id)+'">Open</button>'+
     (a.id.startsWith("user-")?'<button type="button" data-app="remove" data-id="'+clean(a.id)+'" class="v3-app-remove">Remove</button>':
      a.id.startsWith("shared-")&&this.canShareApps?'<button type="button" data-app="removeShared" data-id="'+clean(a.id)+'" class="v3-app-remove">Remove</button>':"")+
     '</div></article>';
  };
  mount.innerHTML='<section class="v3-apps-page"><header class="v3-apps-header"><span>APPS</span><h1>Apps</h1><p>Games, music and streaming.</p></header>'+
   '<nav class="v3-apps-tabs" aria-label="App categories">'+["All","Games","Music","Streaming"].map(section=>
    '<button type="button" data-app="section" data-section="'+section+'" class="'+(section===this.appsSection?"active":"")+'">'+section+'</button>').join("")+'</nav>'+
   '<label class="v3-apps-search">Find an app<input id="appsSearch" type="search" placeholder="Search apps" value="'+clean(this.appsSearch)+'"></label>'+
   ["Games","Music","Streaming"].map(section=>
    '<section class="v3-app-category" data-group="'+section+'"><header><h2>'+section+'</h2><small>'+items.filter(a=>a.type===section).length+' apps</small></header>'+
      '<div class="v3-app-grid">'+items.filter(a=>a.type===section).map(card).join("")+'</div>'+
      '<p class="v3-app-empty"'+(items.some(a=>a.type===section)?' hidden':"")+'>'+(section==="Music"?"No music apps yet.":"No apps here.")+'</p></section>').join("")+
   '<section class="v3-add-app"><h2>Add an app</h2><p>Personal apps are visible only to you. Admins can publish apps for everyone.</p>'+
     '<form id="addAppForm"><label>Name<input name="name" minlength="2" maxlength="48" required placeholder="App name"></label>'+
     '<label>Website<input type="url" name="url" required maxlength="1800" placeholder="https://example.com"></label>'+
     '<label>Section<select name="category"><option>Games</option><option>Music</option><option>Streaming</option></select></label>'+
     (this.canShareApps?'<label>Visible to<select name="visibility"><option value="private">Only me</option><option value="shared">Everyone</option></select></label>':
      '<input type="hidden" name="visibility" value="private">')+
     '<button type="submit">Add app</button></form><p id="appAddStatus" role="status"></p></section></section>';
  this.appsFilter();
  const scroller=mount.querySelector(".v3-apps-page");
  if(scroller&&preserve)scroller.scrollTop=scroll;
  this.v3Sync();
 };
 Hub.prototype.appsFilter=function(){
  const page=this.root.querySelector(".v3-apps-page");if(!page)return;
  const term=this.appsSearch||"";
  page.querySelectorAll("[data-app=section]").forEach(button=>{
   const active=button.dataset.section===this.appsSection;
   button.classList.toggle("active",active);button.setAttribute("aria-pressed",String(active));
  });
  page.querySelectorAll(".v3-app-category").forEach(group=>{
   const section=group.dataset.group;
   group.hidden=this.appsSection!=="All"&&section!==this.appsSection;
   let visible=0;
   group.querySelectorAll(".v3-app-tile").forEach(tile=>{
    const show=tile.dataset.name.includes(term);
    tile.hidden=!show;if(show)visible++;
   });
   const empty=group.querySelector(".v3-app-empty");
   if(empty){empty.hidden=visible>0;empty.textContent=section==="Music"&&!term?"No music apps yet.":"No matches.";}
  });
 };
}
