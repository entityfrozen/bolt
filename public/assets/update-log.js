// The changelog is public to signed-in members; authoring is administrator-only.
const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,char=>({
 "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
})[char]);

function prettyDate(value){
 const date=new Date(value);
 return Number.isFinite(date.getTime())
  ?date.toLocaleDateString([],{month:"long",day:"numeric",year:"numeric"})
  :"";
}
const entryMarkup=(entry,editable,index)=>
 '<article class="ul-entry">'+
  '<div class="ul-entry-rail"><div class="ul-entry-mark">'+(index===0?"✦":"•")+'</div></div>'+
  '<div class="ul-entry-main"><div class="ul-entry-meta"><time datetime="'+new Date(entry.createdAt).toISOString()+'">'+
    escapeHtml(prettyDate(entry.createdAt))+'</time><span class="ul-meta-divider">/</span>'+
    '<span>BY '+escapeHtml(entry.author||"LIGHTNING TEAM")+'</span>'+
    (entry.updatedAt?'<span class="ul-edited">EDITED</span>':"")+'</div>'+
   (entry.title?'<h3>'+escapeHtml(entry.title)+'</h3>':'')+
   '<div class="ul-body">'+escapeHtml(entry.body)+'</div>'+
   (editable?'<div class="ul-entry-actions">'+
    '<button type="button" data-ul-action="edit" data-id="'+escapeHtml(entry.id)+'">Edit post</button>'+
    '<button type="button" class="ul-danger" data-ul-action="delete" data-id="'+escapeHtml(entry.id)+'">Delete</button></div>':"")+
  '</div></article>';

export function installUpdateLog(Hub){
 Hub.prototype.updates=function(){
  this.header("Update log","Official Lightning changes");
  const host=this.$("#hubContent");
  host.innerHTML='<main id="lightningUpdateLog" class="ul-page"><div class="ul-wrap">'+
   '<header class="ul-hero"><div class="ul-kicker"><span class="ul-kicker-dot">✦</span> LIGHTNING / CHANGELOG</div>'+
   '<h1>Update log<span>.</span></h1>'+
   '<p>Official announcements, releases, and whatever else the team wants to share.</p></header>'+
   '<section class="ul-compose" data-ul-compose hidden>'+
    '<div class="ul-compose-heading"><div><span class="ul-kicker">ADMIN TOOLS</span><h2>Write an update</h2></div><span class="ul-admin-marker">ADMIN ONLY</span></div>'+
    '<form id="ulPostForm"><label for="ulTitle">Title <small>OPTIONAL</small></label>'+
    '<input id="ulTitle" name="title" maxlength="140" placeholder="What changed?">'+
    '<label for="ulBody">Post content</label>'+
    '<textarea id="ulBody" name="body" maxlength="30000" required rows="7" placeholder="Write anything you want the community to know. Keep line breaks, paste release notes, use emojis…"></textarea>'+
    '<p class="ul-hint">Published exactly as written, with line breaks preserved. Everyone can read it.</p>'+
    '<div class="ul-form-actions"><button type="button" class="ul-secondary" data-ul-action="cancel" hidden>Cancel edit</button>'+
     '<button class="ul-publish" type="submit">Publish update ↗</button></div></form></section>'+
   '<div class="ul-feed-head"><div><span class="ul-kicker">RELEASE HISTORY</span><h2>All updates</h2></div>'+
    '<button type="button" class="ul-refresh" data-ul-action="refresh">Refresh ↻</button></div>'+
   '<p class="ul-status" data-ul-status role="status">Loading updates…</p>'+
   '<div class="ul-feed" data-ul-feed aria-live="polite"></div>'+
   '</div></main>';
  const page=host.querySelector("#lightningUpdateLog");
  const form=page.querySelector("#ulPostForm");
  const section=page.querySelector("[data-ul-compose]");
  const status=page.querySelector("[data-ul-status]");
  const feed=page.querySelector("[data-ul-feed]");
  const publish=form.querySelector(".ul-publish");
  const cancel=form.querySelector('[data-ul-action="cancel"]');
  let posts=[],canEdit=false,busy=false,editing=null;
  const stillHere=()=>page.isConnected&&host.contains(page)&&this.view==="updates";
  const setStatus=message=>{if(stillHere()){status.textContent=message;status.hidden=!message;}};
  const resetForm=()=>{
   editing=null;form.reset();publish.textContent="Publish update ↗";
   cancel.hidden=true;form.querySelector("#ulBody").setCustomValidity("");
  };
  const api=async(path,options={})=>{
   const response=await fetch(path,{credentials:"same-origin",cache:"no-store",...options,
    headers:{"Content-Type":"application/json",...(options.headers||{})}});
   const result=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(result.error||"Could not update the changelog.");
   return result;
  };
  const refresh=async()=>{
   const data=await api("/api/updates");
   if(!stillHere())return;
   posts=Array.isArray(data.updates)?data.updates:[];
   canEdit=data.canEdit===true;section.hidden=!canEdit;
   if(!canEdit)resetForm();
   feed.innerHTML=posts.length
    ?posts.map((entry,index)=>entryMarkup(entry,canEdit,index)).join("")
    :'<div class="ul-empty"><span>✳</span><h3>No updates yet.</h3><p>Check back for news from the Lightning team.</p></div>';
   setStatus("");
  };
  const withBusy=async(action)=>{
   if(busy)return;busy=true;publish.disabled=true;
   try{await action();}catch(error){setStatus(error.message||"Something went wrong.");}
   finally{busy=false;if(stillHere())publish.disabled=false;}
  };
  form.addEventListener("submit",event=>{
   event.preventDefault();if(!canEdit||busy)return;
   const title=form.elements.title.value,body=form.elements.body.value;
   if(!body.trim()){setStatus("Write something before publishing.");return;}
   void withBusy(async()=>{
    const path=editing?"/api/updates/"+encodeURIComponent(editing):"/api/updates";
    await api(path,{method:editing?"PATCH":"POST",body:JSON.stringify({title,body})});
    resetForm();await refresh();
    if(stillHere())page.querySelector(".ul-feed-head")?.scrollIntoView({behavior:"smooth",block:"nearest"});
   });
  });
  page.addEventListener("click",event=>{
   const button=event.target.closest("[data-ul-action]");
   if(!button||busy)return;
   const action=button.dataset.ulAction;
   if(action==="cancel"){resetForm();setStatus("");return;}
   if(action==="refresh"){setStatus("Refreshing…");void withBusy(refresh);return;}
   if(!canEdit)return;
   const post=posts.find(item=>item.id===button.dataset.id);
   if(!post)return;
   if(action==="edit"){
    editing=post.id;form.elements.title.value=post.title||"";
    form.elements.body.value=post.body;publish.textContent="Save changes ↗";
    cancel.hidden=false;setStatus("");
    section.scrollIntoView({behavior:"smooth",block:"start"});
    form.elements.body.focus();
   }else if(action==="delete"){
    if(!confirm("Delete this update from the public log? This cannot be undone."))return;
    void withBusy(async()=>{
     await api("/api/updates/"+encodeURIComponent(post.id),{method:"DELETE"});
     if(editing===post.id)resetForm();
     await refresh();
    });
   }
  });
  void withBusy(refresh);
 };
}
