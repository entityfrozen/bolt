const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];

const dom={
  shell:$("#boltShell"),
  tabs:$("#tabs"),
  newTabBtn:$("#newTabBtn"),
  homeMark:$("#homeMark"),
  addressForm:$("#addressForm"),
  address:$("#addressInput"),
  back:$("#backBtn"),
  forward:$("#forwardBtn"),
  reload:$("#reloadBtn"),
  bookmark:$("#bookmarkBtn"),
  menu:$("#menuBtn"),
  workarea:$(".workarea"),
  stage:$("#browserStage"),
  frameStack:$("#frameStack"),
  newtab:$("#newtabView"),
  newtabForm:$("#newtabForm"),
  newtabInput:$("#newtabInput"),
  recents:$("#recentList"),
  bookmarks:$("#bookmarkList"),
  status:$("#stageStatus"),
  panel:$("#sidePanel"),
  panelClose:$("#panelClose"),
  panelKicker:$("#panelKicker"),
  panelTitle:$("#panelTitle"),
  panelBody:$("#panelBody"),
  accountButton:$("#accountButton"),
  accountInitial:$("#accountInitial"),
  roleChip:$("#roleChip"),
  accountPopover:$("#accountPopover"),
  toast:$("#toast")
};

const store={
  get(key,fallback){
    try{
      const value=localStorage.getItem(key);
      return value===null?fallback:JSON.parse(value);
    }catch{return fallback}
  },
  set(key,value){
    try{localStorage.setItem(key,JSON.stringify(value))}catch{}
  }
};

const engineUrls={
  google:q=>`https://www.google.com/search?q=${encodeURIComponent(q)}`,
  duckduckgo:q=>`https://duckduckgo.com/?q=${encodeURIComponent(q)}`,
  bing:q=>`https://www.bing.com/search?q=${encodeURIComponent(q)}`
};

const accents={
  amber:["#f2c861","242,200,97"],
  ice:["#9ec8df","158,200,223"],
  rose:["#e69aa6","230,154,166"],
  silver:["#c6c8cb","198,200,203"]
};

let prefs={
  engine:"google",
  restore:true,
  compact:false,
  accent:"amber",
  ...store.get("bolt.prefs",{})
};

let config=null;
let me=null;
let controller=null;
let controllerPromise=null;
let tabs=[];
let activeId="";
let panelName="";
let tabCounter=0;
let localTracks=[];
let localAudio=null;
let soundcloudWidget=null;
let lyricLines=[];
let lyricIndex=-1;
let currentTrackMeta=null;

function svg(id){
  return `<svg><use href="#${id}"/></svg>`;
}

function escapeHtml(value){
  return String(value??"").replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[char]);
}

function savePrefs(){
  store.set("bolt.prefs",prefs);
}

function applyPrefs(){
  document.body.classList.toggle("compact",!!prefs.compact);
  const [color,rgb]=accents[prefs.accent]||accents.amber;
  document.documentElement.style.setProperty("--accent",color);
  document.documentElement.style.setProperty("--accent-rgb",rgb);
}

function toast(message){
  dom.toast.textContent=message;
  dom.toast.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer=setTimeout(()=>dom.toast.classList.remove("show"),1500);
}

function showStatus(message,hold=1600){
  dom.status.textContent=message;
  dom.status.classList.add("show");
  clearTimeout(showStatus.timer);
  showStatus.timer=setTimeout(()=>dom.status.classList.remove("show"),hold);
}

async function api(url,options={}){
  const response=await fetch(url,{
    ...options,
    headers:{"Content-Type":"application/json",...(options.headers||{})}
  });
  const data=await response.json().catch(()=>({}));
  if(response.status===401){
    location.replace("/login");
    throw new Error("Signed out");
  }
  if(!response.ok)throw new Error(data.error||`Request failed (${response.status})`);
  return data;
}

async function loadConfig(){
  const data=await api("/api/config");
  me=data.user;
  config=data.settings;
  document.body.classList.toggle("admin-mode",me.role==="admin");
  dom.accountInitial.textContent=(me.username||"B").slice(0,1).toUpperCase();
  dom.roleChip.textContent=me.role;
  dom.roleChip.style.display=me.role==="admin"?"inline-flex":"none";
}

function newTab(options={}){
  const tab={
    id:`tab_${++tabCounter}_${Date.now().toString(36)}`,
    title:options.title||"New tab",
    url:options.url||"bolt://newtab",
    type:options.url&&options.url!=="bolt://newtab"?"pending":"newtab",
    frame:null,
    iframe:null,
    loading:false
  };
  tabs.push(tab);
  renderTabs();
  activateTab(tab.id);
  persistTabs();
  if(options.url&&options.url!=="bolt://newtab")navigateTab(tab,options.url);
  return tab;
}

function activeTab(){
  return tabs.find(tab=>tab.id===activeId)||null;
}

function renderTabs(){
  dom.tabs.replaceChildren();
  tabs.forEach(tab=>{
    const button=document.createElement("button");
    button.type="button";
    button.className=`tab${tab.id===activeId?" active":""}`;
    button.dataset.tabId=tab.id;

    const favicon=document.createElement("span");
    favicon.className="tab-favicon";
    if(tab.favicon){
      const image=document.createElement("img");
      image.src=tab.favicon;
      image.referrerPolicy="no-referrer";
      image.onerror=()=>{favicon.textContent="↯"};
      favicon.append(image);
    }else{
      favicon.textContent=tab.type==="newtab"?"↯":"·";
    }

    const title=document.createElement("span");
    title.className="tab-title";
    title.textContent=tab.title||"New tab";

    const close=document.createElement("button");
    close.type="button";
    close.className="tab-close";
    close.innerHTML=svg("i-x");
    close.addEventListener("click",event=>{
      event.stopPropagation();
      closeTab(tab.id);
    });

    button.append(favicon,title,close);
    button.addEventListener("click",()=>activateTab(tab.id));
    dom.tabs.append(button);
  });
}

function activateTab(id){
  const tab=tabs.find(item=>item.id===id);
  if(!tab)return;
  activeId=id;
  tabs.forEach(item=>item.iframe?.classList.toggle("active",item.id===id));
  dom.newtab.classList.toggle("hidden",tab.type!=="newtab");
  dom.address.value=tab.type==="newtab"?"":tab.url;
  dom.back.disabled=tab.type==="newtab";
  dom.forward.disabled=tab.type==="newtab";
  dom.reload.disabled=tab.type==="newtab";
  renderTabs();
  updateBookmarkState();
  renderNewtabLists();
  persistTabs();
  if(tab.type==="pending"&&!tab.frame)navigateTab(tab,tab.url);
}

function closeTab(id){
  const index=tabs.findIndex(tab=>tab.id===id);
  if(index<0)return;
  const tab=tabs[index];
  tab.iframe?.remove();
  tabs.splice(index,1);
  if(!tabs.length){
    newTab();
    return;
  }
  if(activeId===id){
    activateTab(tabs[Math.min(index,tabs.length-1)].id);
  }else{
    renderTabs();
    persistTabs();
  }
}

function persistTabs(){
  if(!prefs.restore)return;
  const saved=tabs.slice(0,12).map(tab=>({
    title:tab.title,
    url:tab.type==="newtab"?"bolt://newtab":tab.url
  }));
  store.set("bolt.tabs",{tabs:saved,active:Math.max(0,tabs.findIndex(tab=>tab.id===activeId))});
}

function restoreTabs(){
  if(!prefs.restore){newTab();return}
  const saved=store.get("bolt.tabs",null);
  if(!saved?.tabs?.length){newTab();return}
  saved.tabs.slice(0,12).forEach(entry=>{
    const tab={
      id:`tab_${++tabCounter}_${Date.now().toString(36)}`,
      title:entry.title||"New tab",
      url:entry.url||"bolt://newtab",
      type:entry.url&&entry.url!=="bolt://newtab"?"pending":"newtab",
      frame:null,
      iframe:null,
      loading:false
    };
    tabs.push(tab);
  });
  const index=Math.max(0,Math.min(saved.active||0,tabs.length-1));
  activateTab(tabs[index].id);
}

function resolveInput(value){
  const raw=String(value||"").trim();
  if(!raw)return null;
  if(/^https?:\/\//i.test(raw))return raw;
  if(/^(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i.test(raw))return `http://${raw}`;
  if(/^(?:[\w-]+\.)+[a-z]{2,}(?::\d+)?(?:[/?#].*)?$/i.test(raw))return `https://${raw}`;
  const search=engineUrls[prefs.engine]||engineUrls.google;
  return search(raw);
}

async function embeddedStorage(){
  if(window.top===window)return;
  if(!document.requestStorageAccess)return;
  try{
    if(document.hasStorageAccess&&await document.hasStorageAccess())return;
    await document.requestStorageAccess();
  }catch{}
}

async function ensureProxy(){
  if(controller)return controller;
  if(controllerPromise)return controllerPromise;
  controllerPromise=(async()=>{
    if(!config?.features?.proxy&&me?.role!=="admin")throw new Error("Browsing is disabled");
    await embeddedStorage();
    const created=await initBootstrap();
    controller=created;
    return controller;
  })();
  try{return await controllerPromise}
  catch(error){controllerPromise=null;throw error}
}

async function makeFrame(tab){
  if(tab.frame)return tab.frame;
  const proxy=await ensureProxy();
  const iframe=document.createElement("iframe");
  iframe.className="proxy-frame";
  iframe.dataset.tabId=tab.id;
  iframe.setAttribute("allow","fullscreen; clipboard-read; clipboard-write; autoplay; picture-in-picture");
  dom.frameStack.append(iframe);

  const cache=new $scramjetUtils.HttpCachePlugin();
  const watcher=new $scramjetUtils.UrlWatcherPlugin(url=>{
    tab.url=String(url);
    if(tab.id===activeId)dom.address.value=tab.url;
    rememberVisit(tab);
    persistTabs();
  });
  const escaped=new $scramjetUtils.CatchEscapedLinksPlugin(url=>new URL(`/?goto=${encodeURIComponent(url.href)}`,location.origin));
  tab.iframe=iframe;
  tab.frame=proxy.createFrame(iframe,{plugins:[cache,watcher,escaped]});
  iframe.addEventListener("load",()=>{
    setTimeout(()=>refreshTabMeta(tab),60);
  });
  return tab.frame;
}

function refreshTabMeta(tab){
  if(!tab.iframe)return;
  try{
    const doc=tab.iframe.contentDocument;
    const title=(doc?.title||"").trim();
    if(title)tab.title=title.slice(0,80);
    const icon=doc?.querySelector('link[rel~="icon"]')?.href;
    if(icon)tab.favicon=icon;
  }catch{}
  renderTabs();
  rememberVisit(tab);
}

async function navigateTab(tab,value){
  const destination=resolveInput(value);
  if(!destination)return;
  tab.url=destination;
  tab.type="web";
  tab.title=tab.title==="New tab"?"Loading…":tab.title;
  dom.newtab.classList.add("hidden");
  dom.address.value=destination;
  renderTabs();
  showStatus("Connecting…",3000);
  try{
    const frame=await makeFrame(tab);
    tabs.forEach(item=>item.iframe?.classList.toggle("active",item.id===tab.id));
    await frame.go(destination);
    showStatus("",0);
    setTimeout(()=>dom.status.classList.remove("show"),80);
    rememberVisit(tab);
  }catch(error){
    tab.type="newtab";
    tab.title="New tab";
    tab.frame=null;
    tab.iframe?.remove();
    tab.iframe=null;
    activateTab(tab.id);
    const framed=window.top!==window;
    showStatus(framed?"Embedded browsing was blocked. Open Bolt directly once, then try again.":error.message,5200);
  }
  persistTabs();
}

function navigate(value){
  let tab=activeTab();
  if(!tab)tab=newTab();
  navigateTab(tab,value);
}

function rememberVisit(tab){
  if(!/^https?:\/\//i.test(tab.url||""))return;
  const list=store.get("bolt.history",[]).filter(item=>item.url!==tab.url);
  list.unshift({url:tab.url,title:tab.title||tab.url,at:Date.now()});
  store.set("bolt.history",list.slice(0,80));
  renderNewtabLists();
}

function renderList(container,items,empty){
  container.replaceChildren();
  if(!items.length){
    const row=document.createElement("div");
    row.className="empty-row";
    row.textContent=empty;
    container.append(row);
    return;
  }
  items.slice(0,6).forEach(item=>{
    const row=document.createElement("button");
    row.type="button";
    row.className="recent-row";
    const left=document.createElement("span");
    left.textContent=item.title||item.url;
    const right=document.createElement("small");
    try{right.textContent=new URL(item.url).hostname.replace(/^www\./,"")}catch{right.textContent=""}
    row.append(left,right);
    row.addEventListener("click",()=>navigate(item.url));
    container.append(row);
  });
}

function renderNewtabLists(){
  renderList(dom.recents,store.get("bolt.history",[]),"Nothing here yet.");
  renderList(dom.bookmarks,store.get("bolt.bookmarks",[]),"No saved pages.");
}

function updateBookmarkState(){
  const tab=activeTab();
  const saved=store.get("bolt.bookmarks",[]);
  dom.bookmark.style.color=tab&&saved.some(item=>item.url===tab.url)?"var(--accent)":"";
}

function toggleBookmark(){
  const tab=activeTab();
  if(!tab||tab.type!=="web")return toast("Open a page first");
  const saved=store.get("bolt.bookmarks",[]);
  const index=saved.findIndex(item=>item.url===tab.url);
  if(index>=0){
    saved.splice(index,1);
    toast("Removed from saved");
  }else{
    saved.unshift({url:tab.url,title:tab.title||tab.url,at:Date.now()});
    toast("Saved");
  }
  store.set("bolt.bookmarks",saved.slice(0,50));
  updateBookmarkState();
  renderNewtabLists();
}

function openPanel(name){
  panelName=name;
  dom.workarea.classList.add("panel-open");
  dom.workarea.classList.toggle("panel-wide",name==="admin");
  dom.panel.setAttribute("aria-hidden","false");
  $$(".rail-button[data-panel]").forEach(button=>button.classList.toggle("active",button.dataset.panel===name));
  if(name==="history")renderHistoryPanel();
  if(name==="video")renderVideoPanel();
  if(name==="music")renderMusicPanel();
  if(name==="settings")renderSettingsPanel();
  if(name==="admin")renderAdminPanel();
}

function closePanel(){
  panelName="";
  dom.workarea.classList.remove("panel-open","panel-wide");
  dom.panel.setAttribute("aria-hidden","true");
  $$(".rail-button[data-panel]").forEach(button=>button.classList.remove("active"));
}

function panelHead(kicker,title){
  dom.panelKicker.textContent=kicker;
  dom.panelTitle.textContent=title;
  dom.panelBody.replaceChildren();
}

function renderHistoryPanel(){
  panelHead("BROWSING","History");
  const history=store.get("bolt.history",[]);
  const section=document.createElement("section");
  section.className="panel-section";
  const row=document.createElement("div");
  row.className="button-row";
  row.innerHTML='<button class="button ghost" type="button" id="clearHistory">Clear history</button>';
  section.append(row);
  const list=document.createElement("div");
  if(!history.length){
    list.innerHTML='<div class="empty-row">No history.</div>';
  }else{
    history.forEach(item=>{
      const entry=document.createElement("div");
      entry.className="history-item";
      entry.innerHTML=`<div><strong>${escapeHtml(item.title||item.url)}</strong><span>${escapeHtml(item.url)}</span></div><time>${relativeTime(item.at)}</time>`;
      entry.addEventListener("click",()=>{navigate(item.url);closePanel()});
      list.append(entry);
    });
  }
  dom.panelBody.append(section,list);
  $("#clearHistory")?.addEventListener("click",()=>{
    store.set("bolt.history",[]);
    renderHistoryPanel();
    renderNewtabLists();
  });
}

function youtubeId(value){
  try{
    const url=new URL(/^https?:\/\//i.test(value)?value:`https://${value}`);
    const host=url.hostname.replace(/^www\./,"");
    if(host==="youtu.be")return url.pathname.split("/").filter(Boolean)[0]||"";
    if(host.endsWith("youtube.com")){
      if(url.pathname==="/watch")return url.searchParams.get("v")||"";
      const parts=url.pathname.split("/").filter(Boolean);
      if(["shorts","live","embed"].includes(parts[0]))return parts[1]||"";
    }
  }catch{}
  return "";
}

function renderVideoPanel(){
  panelHead("PLAYER","Video");
  if(!config.features.video&&me.role!=="admin"){
    dom.panelBody.innerHTML='<div class="empty-row">Video is disabled.</div>';
    return;
  }
  dom.panelBody.innerHTML=`
    <section class="panel-section">
      <h3>Quick player</h3>
      <p class="panel-copy">Paste a YouTube link. Bolt only shows the player.</p>
      <div class="field"><span>Video URL</span><input class="input" id="videoUrl" placeholder="youtube.com/watch?v=..."></div>
      <div class="button-row"><button class="button primary" id="videoPlay" type="button">Play</button><button class="button ghost" id="videoBrowse" type="button">Open on web</button></div>
    </section>
    <section class="panel-section">
      <div class="video-stage" id="videoStage"><div class="video-empty">${svg("i-video")}Paste a video link above.</div></div>
    </section>`;
  const input=$("#videoUrl");
  const last=store.get("bolt.lastVideo","");
  if(last)input.value=last;
  $("#videoPlay").addEventListener("click",()=>{
    const value=input.value.trim();
    const id=youtubeId(value);
    if(!id)return toast("That doesn't look like a YouTube video");
    store.set("bolt.lastVideo",value);
    $("#videoStage").innerHTML=`<iframe src="https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
  });
  $("#videoBrowse").addEventListener("click",()=>{
    const value=input.value.trim();
    if(!value)return;
    navigate(value);
    closePanel();
  });
}

function parseTrackName(name){
  const clean=String(name||"").replace(/\.[a-z0-9]{2,5}$/i,"").replace(/_/g," ").trim();
  const parts=clean.split(/\s+-\s+/);
  if(parts.length>1)return{artist:parts.shift().trim(),title:parts.join(" - ").trim()};
  return{artist:"",title:clean};
}

function renderMusicPanel(){
  panelHead("AUDIO","Music");
  if(!config.features.music&&me.role!=="admin"){
    dom.panelBody.innerHTML='<div class="empty-row">Music is disabled.</div>';
    return;
  }
  dom.panelBody.innerHTML=`
    <div class="music-tabs"><button class="music-tab active" data-music-view="soundcloud" type="button">SoundCloud</button><button class="music-tab" data-music-view="local" type="button">Local</button><button class="music-tab" data-music-view="lyrics" type="button">Lyrics</button></div>
    <div id="musicView"></div>`;
  $$(".music-tab").forEach(button=>button.addEventListener("click",()=>{
    $$(".music-tab").forEach(item=>item.classList.toggle("active",item===button));
    renderMusicView(button.dataset.musicView);
  }));
  renderMusicView("soundcloud");
}

function renderMusicView(name){
  const view=$("#musicView");
  if(!view)return;
  if(name==="soundcloud")renderSoundcloud(view);
  if(name==="local")renderLocalMusic(view);
  if(name==="lyrics")renderLyrics(view);
}

function renderSoundcloud(view){
  const last=store.get("bolt.soundcloud","");
  view.innerHTML=`
    <section class="panel-section">
      <h3>SoundCloud</h3>
      <p class="panel-copy">Paste a playable track URL.</p>
      <div class="field"><span>Track URL</span><input class="input" id="soundcloudUrl" value="${escapeHtml(last)}" placeholder="soundcloud.com/artist/track"></div>
      <div class="button-row"><button class="button primary" id="soundcloudLoad" type="button">Load track</button></div>
    </section>
    <section class="panel-section" id="soundcloudPlayer"><div class="empty-row">No track loaded.</div></section>`;
  $("#soundcloudLoad").addEventListener("click",()=>loadSoundcloud($("#soundcloudUrl").value));
  if(last)loadSoundcloud(last,false);
}

function loadSoundcloud(value,autoplay=true){
  const url=String(value||"").trim();
  if(!/^https?:\/\/(www\.)?soundcloud\.com\//i.test(url))return toast("Paste a SoundCloud track link");
  store.set("bolt.soundcloud",url);
  const target=$("#soundcloudPlayer");
  if(!target)return;
  const frame=document.createElement("iframe");
  frame.className="soundcloud-frame";
  frame.allow="autoplay";
  frame.src=`https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23${getComputedStyle(document.documentElement).getPropertyValue("--accent").trim().slice(1)}&auto_play=${autoplay?"true":"false"}&hide_related=true&show_comments=false&show_reposts=false&visual=false`;
  target.replaceChildren(frame);
  if(!window.SC?.Widget)return;
  soundcloudWidget=SC.Widget(frame);
  soundcloudWidget.bind(SC.Widget.Events.READY,()=>{
    soundcloudWidget.getCurrentSound(sound=>{
      if(!sound)return;
      currentTrackMeta={
        title:sound.title||"",
        artist:sound.user?.username||"",
        artwork:sound.artwork_url||""
      };
      fetchLyrics(currentTrackMeta);
    });
  });
  soundcloudWidget.bind(SC.Widget.Events.PLAY_PROGRESS,event=>updateLyric((event.currentPosition||0)/1000));
}

function renderLocalMusic(view){
  view.innerHTML=`
    <section class="panel-section">
      <h3>Local library</h3>
      <p class="panel-copy">Files stay on this device. Add a few or a whole folder.</p>
      <div class="button-row"><label class="button" for="localFiles">Add files</label><label class="button ghost" for="localFolder">Add folder</label></div>
      <input id="localFiles" type="file" accept="audio/*" multiple hidden>
      <input id="localFolder" type="file" accept="audio/*" multiple webkitdirectory hidden>
      <audio class="local-player" id="localAudio" controls></audio>
      <div class="track-list" id="localTrackList"></div>
    </section>`;
  localAudio=$("#localAudio");
  $("#localFiles").addEventListener("change",event=>addLocalFiles(event.target.files));
  $("#localFolder").addEventListener("change",event=>addLocalFiles(event.target.files));
  localAudio.addEventListener("timeupdate",()=>updateLyric(localAudio.currentTime));
  localAudio.addEventListener("ended",()=>playNextLocal());
  renderLocalTrackList();
}

function addLocalFiles(fileList){
  const audioFiles=[...fileList].filter(file=>file.type.startsWith("audio/")||/\.(mp3|m4a|wav|ogg|flac|aac)$/i.test(file.name));
  audioFiles.forEach(file=>{
    const meta=parseTrackName(file.name);
    localTracks.push({id:`local_${Date.now()}_${Math.random().toString(36).slice(2)}`,file,url:URL.createObjectURL(file),...meta});
  });
  renderLocalTrackList();
  toast(`${audioFiles.length} track${audioFiles.length===1?"":"s"} added`);
}

function renderLocalTrackList(){
  const list=$("#localTrackList");
  if(!list)return;
  list.replaceChildren();
  if(!localTracks.length){
    list.innerHTML='<div class="empty-row">No local tracks loaded.</div>';
    return;
  }
  localTracks.forEach(track=>{
    const row=document.createElement("div");
    row.className="track-row";
    row.innerHTML=`<div><strong>${escapeHtml(track.title)}</strong><span>${escapeHtml(track.artist||track.file.name)}</span></div><span class="track-time">LOCAL</span>`;
    row.addEventListener("click",()=>playLocal(track));
    list.append(row);
  });
}

function playLocal(track){
  if(!localAudio)return;
  localAudio.src=track.url;
  localAudio.play().catch(()=>{});
  currentTrackMeta={title:track.title,artist:track.artist,artwork:""};
  fetchLyrics(currentTrackMeta);
}

function playNextLocal(){
  if(!localAudio?.src||!localTracks.length)return;
  const index=localTracks.findIndex(track=>track.url===localAudio.src);
  const next=localTracks[(index+1)%localTracks.length];
  if(next)playLocal(next);
}

async function fetchLyrics(meta){
  lyricLines=[];
  lyricIndex=-1;
  if(!meta?.title)return;
  try{
    const params=new URLSearchParams({track_name:meta.title});
    if(meta.artist)params.set("artist_name",meta.artist);
    const response=await fetch(`https://lrclib.net/api/search?${params}`);
    if(!response.ok)return;
    const data=await response.json();
    const item=data.find(entry=>entry.syncedLyrics)||data[0];
    if(!item?.syncedLyrics)return;
    lyricLines=parseLrc(item.syncedLyrics);
    if(panelName==="music"&&$(".music-tab.active")?.dataset.musicView==="lyrics")renderLyrics($("#musicView"));
  }catch{}
}

function parseLrc(text){
  const lines=[];
  String(text||"").split(/\r?\n/).forEach(line=>{
    const match=line.match(/^\[(\d{1,2}):(\d{2}(?:\.\d+)?)\](.*)$/);
    if(!match)return;
    lines.push({time:Number(match[1])*60+Number(match[2]),text:match[3].trim()});
  });
  return lines.sort((a,b)=>a.time-b.time);
}

function renderLyrics(view){
  if(!lyricLines.length){
    view.innerHTML=`<div class="lyrics-empty">${currentTrackMeta?"No synced lyrics found for this track.":"Play something first."}</div>`;
    return;
  }
  view.innerHTML='<div class="lyrics" id="lyricsList"></div>';
  const list=$("#lyricsList");
  lyricLines.forEach((line,index)=>{
    const p=document.createElement("p");
    p.className="lyrics-line";
    p.textContent=line.text||"·";
    p.dataset.index=index;
    p.addEventListener("click",()=>seekLyric(line.time));
    list.append(p);
  });
  updateLyricClass();
}

function seekLyric(seconds){
  if(localAudio?.src){
    localAudio.currentTime=seconds;
    return;
  }
  if(soundcloudWidget)soundcloudWidget.seekTo(seconds*1000);
}

function updateLyric(seconds){
  if(!lyricLines.length)return;
  let index=-1;
  for(let i=0;i<lyricLines.length;i++){
    if(lyricLines[i].time<=seconds)index=i;else break;
  }
  if(index===lyricIndex)return;
  lyricIndex=index;
  updateLyricClass();
}

function updateLyricClass(){
  const list=$("#lyricsList");
  if(!list)return;
  $$("#lyricsList .lyrics-line").forEach((node,index)=>{
    node.classList.toggle("active",index===lyricIndex);
    node.classList.toggle("past",index<lyricIndex);
  });
  const active=list.querySelector(".active");
  active?.scrollIntoView({block:"center",behavior:"smooth"});
}

function renderSettingsPanel(){
  panelHead("BOLT","Settings");
  dom.panelBody.innerHTML=`
    <section class="panel-section">
      <h3>Browsing</h3>
      <div class="field"><span>Search engine</span><select class="select" id="settingEngine"><option value="google">Google</option><option value="duckduckgo">DuckDuckGo</option><option value="bing">Bing</option></select></div>
      ${settingSwitch("restore","Restore tabs","Open the last session when Bolt starts",prefs.restore)}
    </section>
    <section class="panel-section">
      <h3>Interface</h3>
      ${settingSwitch("compact","Compact chrome","Tighter tabs, rail and toolbar",prefs.compact)}
      <div class="field"><span>Accent</span><div class="button-row" id="accentRow"><button class="button" data-accent="amber">Amber</button><button class="button" data-accent="ice">Ice</button><button class="button" data-accent="rose">Rose</button><button class="button" data-accent="silver">Silver</button></div></div>
    </section>
    <section class="panel-section">
      <h3>Session</h3>
      <p class="panel-copy">Signed in as <strong>${escapeHtml(me.username)}</strong>${me.temporary?" · temporary access":""}.</p>
      <div class="button-row"><button class="button" id="openDirect" type="button">Open direct</button><button class="button danger" id="logoutSettings" type="button">Sign out</button></div>
    </section>`;
  $("#settingEngine").value=prefs.engine;
  $("#settingEngine").addEventListener("change",event=>{
    prefs.engine=event.target.value;
    savePrefs();
  });
  $$("[data-setting-switch]").forEach(button=>button.addEventListener("click",()=>{
    const key=button.dataset.settingSwitch;
    prefs[key]=!prefs[key];
    button.classList.toggle("on",prefs[key]);
    savePrefs();
    applyPrefs();
  }));
  $$("[data-accent]").forEach(button=>button.addEventListener("click",()=>{
    prefs.accent=button.dataset.accent;
    savePrefs();
    applyPrefs();
  }));
  $("#openDirect").addEventListener("click",()=>window.open(location.origin,"_blank","noopener"));
  $("#logoutSettings").addEventListener("click",logout);
}

function settingSwitch(key,title,copy,on){
  return `<div class="setting-row"><div class="setting-copy"><strong>${title}</strong><span>${copy}</span></div><button class="switch${on?" on":""}" type="button" data-setting-switch="${key}"><i></i></button></div>`;
}

async function renderAdminPanel(){
  panelHead("CONTROL","Admin");
  dom.panelBody.innerHTML='<div class="empty-row">Loading control panel…</div>';
  try{
    const data=await api("/api/admin/state");
    config=data.settings;
    dom.panelBody.innerHTML=`
      <div class="admin-tabs">
        <button class="admin-tab active" data-admin-tab="users">Users</button>
        <button class="admin-tab" data-admin-tab="passes">Temp access</button>
        <button class="admin-tab" data-admin-tab="controls">Controls</button>
        <button class="admin-tab" data-admin-tab="sessions">Sessions</button>
        <button class="admin-tab" data-admin-tab="audit">Audit</button>
      </div>
      <div class="admin-view active" data-admin-view="users"></div>
      <div class="admin-view" data-admin-view="passes"></div>
      <div class="admin-view" data-admin-view="controls"></div>
      <div class="admin-view" data-admin-view="sessions"></div>
      <div class="admin-view" data-admin-view="audit"></div>`;
    $$(".admin-tab").forEach(button=>button.addEventListener("click",()=>{
      $$(".admin-tab").forEach(item=>item.classList.toggle("active",item===button));
      $$(".admin-view").forEach(view=>view.classList.toggle("active",view.dataset.adminView===button.dataset.adminTab));
    }));
    renderAdminUsers(data);
    renderAdminPasses(data);
    renderAdminControls(data);
    renderAdminSessions(data);
    renderAdminAudit(data);
  }catch(error){
    dom.panelBody.innerHTML=`<div class="empty-row">${escapeHtml(error.message)}</div>`;
  }
}

function renderAdminUsers(data){
  const view=$('[data-admin-view="users"]');
  view.innerHTML=`
    <section class="panel-section">
      <h3>Create account</h3>
      <div class="field"><span>Username</span><input class="input" id="newUserName"></div>
      <div class="field"><span>Password</span><input class="input" id="newUserPass" type="password"></div>
      <div class="field"><span>Role</span><select class="select" id="newUserRole"><option value="user">User</option><option value="admin">Admin</option></select></div>
      <div class="field"><span>Access length</span><select class="select" id="newUserExpiry"><option value="0">No expiry</option><option value="60">1 hour</option><option value="1440">1 day</option><option value="10080">7 days</option><option value="43200">30 days</option></select></div>
      <div class="button-row"><button class="button primary" id="createUser" type="button">Create account</button></div>
    </section>
    <section class="panel-section"><h3>Accounts</h3><div id="adminUserTable"></div></section>`;
  $("#createUser").addEventListener("click",async()=>{
    const minutes=Number($("#newUserExpiry").value);
    const expiresAt=minutes?Date.now()+minutes*60000:null;
    try{
      await api("/api/admin/users",{method:"POST",body:JSON.stringify({
        username:$("#newUserName").value,
        password:$("#newUserPass").value,
        role:$("#newUserRole").value,
        expiresAt
      })});
      toast("Account created");
      renderAdminPanel();
    }catch(error){toast(error.message)}
  });
  const holder=$("#adminUserTable");
  const table=document.createElement("table");
  table.className="admin-table";
  table.innerHTML="<thead><tr><th>User</th><th>Access</th><th>Role</th><th></th></tr></thead>";
  const body=document.createElement("tbody");
  data.users.forEach(user=>{
    const row=document.createElement("tr");
    row.innerHTML=`
      <td><span class="admin-user">${escapeHtml(user.username)}</span></td>
      <td>${user.enabled?(user.expiresAt?formatDate(user.expiresAt):"active"):"disabled"}</td>
      <td><span class="admin-badge ${user.role==="admin"?"admin":""} ${!user.enabled?"off":""}">${escapeHtml(user.role)}</span></td>
      <td><div class="row-actions"></div></td>`;
    const actions=row.querySelector(".row-actions");
    actions.append(
      actionButton(user.enabled?"off":"on",()=>adminPatchUser(user.id,{enabled:!user.enabled})),
      actionButton(user.role==="admin"?"user":"admin",()=>adminPatchUser(user.id,{role:user.role==="admin"?"user":"admin"})),
      actionButton("time",()=>adminSetExpiry(user)),
      actionButton("pass",()=>adminResetPassword(user)),
      actionButton("kick",()=>adminRevokeUser(user.id)),
      actionButton("del",()=>adminDeleteUser(user),true)
    );
    body.append(row);
  });
  table.append(body);
  holder.append(table);
}

function actionButton(label,handler,danger=false){
  const button=document.createElement("button");
  button.type="button";
  button.className=`button ghost${danger?" danger":""}`;
  button.style.height="26px";
  button.style.padding="0 6px";
  button.textContent=label;
  button.addEventListener("click",handler);
  return button;
}

async function adminPatchUser(id,patch){
  try{
    await api(`/api/admin/users/${id}`,{method:"PATCH",body:JSON.stringify(patch)});
    renderAdminPanel();
  }catch(error){toast(error.message)}
}

function adminResetPassword(user){
  const password=prompt(`New password for ${user.username}.`);
  if(password===null)return;
  if(password.length<8)return toast("Use at least 8 characters");
  adminPatchUser(user.id,{password});
}

function adminSetExpiry(user){
  const raw=prompt(`Hours from now for ${user.username}. Use 0 for no expiry.`,user.expiresAt?String(Math.max(1,Math.round((user.expiresAt-Date.now())/3600000))):"0");
  if(raw===null)return;
  const hours=Number(raw);
  if(!Number.isFinite(hours)||hours<0)return toast("Use a number of hours");
  adminPatchUser(user.id,{expiresAt:hours?Date.now()+hours*3600000:null});
}

async function adminRevokeUser(id){
  try{
    await api(`/api/admin/users/${id}/revoke`,{method:"POST",body:"{}"});
    toast("Sessions revoked");
    renderAdminPanel();
  }catch(error){toast(error.message)}
}

async function adminDeleteUser(user){
  if(!confirm(`Delete ${user.username}?`))return;
  try{
    await api(`/api/admin/users/${user.id}`,{method:"DELETE"});
    toast("Account deleted");
    renderAdminPanel();
  }catch(error){toast(error.message)}
}

function renderAdminPasses(data){
  const view=$('[data-admin-view="passes"]');
  view.innerHTML=`
    <section class="panel-section">
      <h3>Issue temporary access</h3>
      <div class="field"><span>Label</span><input class="input" id="passLabel" placeholder="friend, tester, guest"></div>
      <div class="field"><span>Length</span><select class="select" id="passMinutes"><option value="30">30 minutes</option><option value="60" selected>1 hour</option><option value="360">6 hours</option><option value="1440">1 day</option><option value="10080">7 days</option></select></div>
      <div class="field"><span>Uses</span><input class="input" id="passUses" type="number" min="1" max="100" value="1"></div>
      <div class="button-row"><button class="button primary" id="createPass" type="button">Create code</button></div>
      <div id="newPassCode"></div>
    </section>
    <section class="panel-section"><h3>Active codes</h3><div id="passList"></div></section>`;
  $("#createPass").addEventListener("click",async()=>{
    try{
      const result=await api("/api/admin/passes",{method:"POST",body:JSON.stringify({
        label:$("#passLabel").value,
        minutes:Number($("#passMinutes").value),
        maxUses:Number($("#passUses").value)
      })});
      const box=$("#newPassCode");
      box.innerHTML=`<div class="pass-code"><span>${escapeHtml(result.pass.code)}</span><button class="icon-mini" type="button">${svg("i-copy")}</button></div>`;
      box.querySelector("button").addEventListener("click",()=>navigator.clipboard.writeText(result.pass.code).then(()=>toast("Code copied")));
      setTimeout(()=>refreshAdminPassList(),100);
    }catch(error){toast(error.message)}
  });
  renderPassList(data.passes);
}

async function refreshAdminPassList(){
  try{
    const data=await api("/api/admin/state");
    renderPassList(data.passes);
  }catch{}
}

function renderPassList(passes){
  const list=$("#passList");
  if(!list)return;
  list.replaceChildren();
  if(!passes.length){list.innerHTML='<div class="empty-row">No active codes.</div>';return}
  passes.forEach(pass=>{
    const row=document.createElement("div");
    row.className="history-item";
    row.innerHTML=`<div><strong>${escapeHtml(pass.label)}</strong><span>${pass.uses}/${pass.maxUses} uses · expires ${formatDate(pass.expiresAt)}</span></div>`;
    const remove=actionButton("revoke",async()=>{
      try{await api(`/api/admin/passes/${pass.id}`,{method:"DELETE"});renderAdminPanel()}catch(error){toast(error.message)}
    },true);
    row.append(remove);
    list.append(row);
  });
}

function renderAdminControls(data){
  const view=$('[data-admin-view="controls"]');
  view.innerHTML=`
    <section class="panel-section">
      <h3>Global controls</h3>
      ${adminSwitch("maintenance","Maintenance mode","Blocks regular users from Bolt",data.settings.maintenance)}
      ${adminSwitch("proxy","Web browsing","Scramjet + Wisp access",data.settings.features.proxy)}
      ${adminSwitch("music","Music","SoundCloud and local player",data.settings.features.music)}
      ${adminSwitch("video","Video","Quick YouTube player",data.settings.features.video)}
    </section>
    <section class="panel-section"><h3>Sessions</h3><p class="panel-copy">Sign every regular user out immediately. Admin sessions stay alive.</p><button class="button danger" id="revokeUsers" type="button">Revoke all user sessions</button></section>`;
  $$('[data-admin-switch]').forEach(button=>button.addEventListener("click",()=>toggleAdminControl(button.dataset.adminSwitch,button)));
  $("#revokeUsers").addEventListener("click",async()=>{
    if(!confirm("Sign out every regular user and guest?"))return;
    try{await api("/api/admin/sessions/revoke-users",{method:"POST",body:"{}"});toast("User sessions revoked");renderAdminPanel()}catch(error){toast(error.message)}
  });
}

function adminSwitch(key,title,copy,on){
  return `<div class="setting-row"><div class="setting-copy"><strong>${title}</strong><span>${copy}</span></div><button class="switch${on?" on":""}" type="button" data-admin-switch="${key}"><i></i></button></div>`;
}

async function toggleAdminControl(key,button){
  const next=!button.classList.contains("on");
  const payload=key==="maintenance"?{maintenance:next}:{features:{[key]:next}};
  try{
    const result=await api("/api/admin/settings",{method:"PATCH",body:JSON.stringify(payload)});
    config=result.settings;
    button.classList.toggle("on",next);
    toast(`${key} ${next?"on":"off"}`);
  }catch(error){toast(error.message)}
}

function renderAdminSessions(data){
  const view=$('[data-admin-view="sessions"]');
  if(!data.sessions.length){view.innerHTML='<div class="empty-row">No sessions.</div>';return}
  const list=document.createElement("div");
  data.sessions.forEach(session=>{
    const row=document.createElement("div");
    row.className="history-item";
    row.innerHTML=`<div><strong>${escapeHtml(session.username)}${session.temporary?" · temp":""}</strong><span>${escapeHtml(session.ip||"unknown ip")} · ${escapeHtml((session.userAgent||"").slice(0,70))}</span></div><time>${relativeTime(session.lastSeenAt)}</time>`;
    if(session.id!==me.sessionId){
      const kill=actionButton("kill",async()=>{
        try{await api(`/api/admin/sessions/${session.id}`,{method:"DELETE"});renderAdminPanel()}catch(error){toast(error.message)}
      },true);
      row.append(kill);
    }
    list.append(row);
  });
  view.append(list);
}

function renderAdminAudit(data){
  const view=$('[data-admin-view="audit"]');
  if(!data.audit.length){view.innerHTML='<div class="empty-row">No audit events.</div>';return}
  data.audit.forEach(event=>{
    const row=document.createElement("div");
    row.className="audit-row";
    row.innerHTML=`<time>${new Date(event.at).toLocaleString()}</time><div><strong>${escapeHtml(event.actor)} · ${escapeHtml(event.action)}</strong><span>${escapeHtml([event.target,event.detail].filter(Boolean).join(" · "))}</span></div>`;
    view.append(row);
  });
}

function relativeTime(value){
  const delta=Math.max(0,Date.now()-Number(value||0));
  if(delta<60000)return"now";
  if(delta<3600000)return`${Math.floor(delta/60000)}m`;
  if(delta<86400000)return`${Math.floor(delta/3600000)}h`;
  return`${Math.floor(delta/86400000)}d`;
}

function formatDate(value){
  if(!value)return"never";
  return new Date(value).toLocaleString([],{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});
}

function accountPopover(){
  dom.accountPopover.hidden=false;
  dom.accountPopover.innerHTML=`<div class="popover-head"><strong>${escapeHtml(me.username)}</strong><span>${escapeHtml(me.role)}${me.temporary?" · temporary":""}</span></div><button type="button" id="popoverSettings">Settings</button>${me.role==="admin"?'<button type="button" id="popoverAdmin">Admin</button>':""}<button type="button" id="popoverLogout">Sign out</button>`;
  $("#popoverSettings").addEventListener("click",()=>{dom.accountPopover.hidden=true;openPanel("settings")});
  $("#popoverAdmin")?.addEventListener("click",()=>{dom.accountPopover.hidden=true;openPanel("admin")});
  $("#popoverLogout").addEventListener("click",logout);
}

async function logout(){
  try{await api("/api/logout",{method:"POST",body:"{}"})}catch{}
  location.replace("/login");
}

function bindUi(){
  dom.newTabBtn.addEventListener("click",()=>newTab());
  dom.homeMark.addEventListener("click",()=>newTab());
  dom.addressForm.addEventListener("submit",event=>{event.preventDefault();navigate(dom.address.value)});
  dom.newtabForm.addEventListener("submit",event=>{event.preventDefault();navigate(dom.newtabInput.value);dom.newtabInput.value=""});
  dom.back.addEventListener("click",()=>{
    const tab=activeTab();
    try{tab?.iframe?.contentWindow?.history.back()}catch{}
  });
  dom.forward.addEventListener("click",()=>{
    const tab=activeTab();
    try{tab?.iframe?.contentWindow?.history.forward()}catch{}
  });
  dom.reload.addEventListener("click",()=>{
    const tab=activeTab();
    try{tab?.frame?.reload?.()}catch{navigateTab(tab,tab?.url||"")}
  });
  dom.bookmark.addEventListener("click",toggleBookmark);
  dom.menu.addEventListener("click",()=>openPanel("settings"));
  dom.panelClose.addEventListener("click",closePanel);
  $$(".rail-button[data-panel]").forEach(button=>button.addEventListener("click",()=>{
    if(panelName===button.dataset.panel)closePanel();else openPanel(button.dataset.panel);
  }));
  $(".rail-button[data-action='newtab']").addEventListener("click",()=>newTab());
  dom.accountButton.addEventListener("click",()=>dom.accountPopover.hidden?accountPopover():dom.accountPopover.hidden=true);
  document.addEventListener("pointerdown",event=>{
    if(dom.accountPopover.hidden)return;
    if(dom.accountPopover.contains(event.target)||dom.accountButton.contains(event.target))return;
    dom.accountPopover.hidden=true;
  });
  document.addEventListener("keydown",event=>{
    const meta=event.ctrlKey||event.metaKey;
    if(meta&&event.key.toLowerCase()==="l"){
      event.preventDefault();dom.address.focus();dom.address.select();
    }
    if(meta&&event.key.toLowerCase()==="t"){
      event.preventDefault();newTab();setTimeout(()=>dom.newtabInput.focus(),20);
    }
    if(meta&&event.key.toLowerCase()==="w"){
      event.preventDefault();if(activeId)closeTab(activeId);
    }
    if(meta&&/^[1-9]$/.test(event.key)){
      const tab=tabs[Math.min(Number(event.key)-1,tabs.length-1)];
      if(tab){event.preventDefault();activateTab(tab.id)}
    }
    if(event.key==="Escape"&&panelName)closePanel();
  });
}

async function start(){
  applyPrefs();
  bindUi();
  renderNewtabLists();
  try{
    await loadConfig();
  }catch{return}
  restoreTabs();
  const goto=new URL(location.href).searchParams.get("goto");
  if(goto){
    history.replaceState(null,"",location.pathname);
    navigate(goto);
  }
}

start();
