/* Lightning Glass House: a proper help guide and tab identity studio.
   This is deliberately separate from the browser engine and account backend. */
(function () {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const presets = [
    {id:"lightning", name:"Lightning", title:"Lightning", icon:"/favicon.svg", tint:"#698be2"},
    {id:"dcss", name:"DCSS Portal", title:"DCSS Portal", icon:"https://portal.dcssga.org/favicon.ico", tint:"#376ab1"},
    {id:"iready", name:"i-Ready", title:"i-Ready", icon:"https://login.i-ready.com/favicon.ico", tint:"#25a9bd"},
    {id:"classroom", name:"Google Classroom", title:"Google Classroom", icon:"https://classroom.google.com/favicon.ico", tint:"#35a971"},
    {id:"clever", name:"Clever", title:"Clever | Portal", icon:"https://clever.com/favicon.ico", tint:"#28a66c"},
    {id:"canvas", name:"Canvas", title:"Dashboard", icon:"https://canvas.instructure.com/favicon.ico", tint:"#b54a3f"},
    {id:"schoology", name:"Schoology", title:"Schoology", icon:"https://app.schoology.com/favicon.ico", tint:"#3286b3"},
    {id:"powerschool", name:"PowerSchool", title:"PowerSchool", icon:"https://www.powerschool.com/favicon.ico", tint:"#4775bd"},
    {id:"google", name:"Google", title:"Google", icon:"https://www.google.com/favicon.ico", tint:"#4d83d6"},
    {id:"docs", name:"Google Docs", title:"Google Docs", icon:"https://ssl.gstatic.com/docs/documents/images/kix-favicon7.ico", tint:"#4474cf"},
    {id:"youtube", name:"YouTube", title:"YouTube", icon:"https://www.youtube.com/favicon.ico", tint:"#d34c5c"},
    {id:"chatgpt", name:"ChatGPT", title:"ChatGPT", icon:"https://chatgpt.com/favicon.ico", tint:"#258973"}
  ];
  const lessons = [
    {name:"Welcome", tag:"01 / YOUR SPACE", title:"Meet your workspace", art:"A browser that feels like yours.",
      text:"Lightning puts your tabs, community, games, AI, and tools in one place. Nothing here needs a mascot or a complicated setup.",
      bullets:["Use the left rail to switch spaces.","The top bar keeps your open browser tabs.","All the important controls are reachable by keyboard."], action:"Start the guided tour", kind:"tour"},
    {name:"Browse", tag:"02 / BROWSER", title:"Find something, open anything", art:"The address bar is your starting point.",
      text:"Type a web address or a search into the top address bar. Tabs stay open when you visit other parts of Lightning.",
      bullets:["Ctrl / Cmd + L focuses the address bar.","Ctrl / Cmd + T creates a new tab.","Your bookmarks and recent pages live on the new tab screen."], action:"Show me where", kind:"tour", step:1},
    {name:"Community", tag:"03 / YOUR PEOPLE", title:"Find your community", art:"Chat, play, come back later.",
      text:"Use the rail for community chat, your library, updates, and other shared spaces. Switching away does not have to close your browser tabs.",
      bullets:["Choose Community for chat channels.","The Library holds your saved activities.","Your account menu has profile and direct messages."], action:"Show me where", kind:"tour", step:3},
    {name:"Glass", tag:"04 / APPEARANCE", title:"Make the glass yours", art:"A material, not a background image.",
      text:"Change the wallpaper, accent, blur strength, transparency, and layout in Appearance settings. Glass uses backdrop filtering over the scene behind each panel.",
      bullets:["Try Frost or Lavender for a new accent.","Raise transparency to show more wallpaper.","Use the low-effects option if blur affects performance."], action:"Open appearance settings", kind:"appearance"},
    {name:"Privacy", tag:"05 / TAB APPEARANCE", title:"Choose your tab identity", art:"Different tab. Same Lightning workspace.",
      text:"Tab cloaking changes the tab title and icon. Applying a preset opens a new about:blank tab containing the Lightning app. The website still loads normally inside it; this does not hide network activity or browsing history.",
      bullets:["Pick DCSS Portal, i-Ready, Google Classroom, or another preset.","Use Custom for your own name and icon URL.","Return to Lightning at any time with one click."], action:"Open tab cloaking", kind:"cloak"}
  ];

  let selected="lightning";
  let customTitle="";
  let customIcon="";
  let tourIndex=-1;
  let tourElements=null;
  const steps=[
    {selector:"#homeMark",title:"Your home button",copy:"Click the Lightning logo to open a fresh browser tab. It is always here when you need a reset."},
    {selector:"#addressForm",title:"Search or enter an address",copy:"Type a search or website here and press Enter. Ctrl or Cmd + L jumps to this field."},
    {selector:"#newTabBtn",title:"Keep a few tabs open",copy:"The plus button starts a new tab. Switch between tabs along the top without closing your other work."},
    {selector:'.rail-button[data-hub="chat"]',title:"Your community",copy:"Open chat from the left rail. Find channels, friends and community activity here."},
    {selector:'.rail-button[data-hub="games"]',title:"Games and library",copy:"This library button takes you to the games and activities area."},
    {selector:'.rail-button[data-glass-settings]',title:"Shape the interface",copy:"Open Appearance settings to change color, background, layout, blur, contrast and movement."},
    {selector:"#gxCloakLaunch",title:"Tab identity controls",copy:"Open Cloaking to select a preset or set a custom tab name and icon. The real Lightning page still loads inside the about:blank wrapper."}
  ];

  function safeIcon(value) {
    const v=String(value || "").trim();
    if (v.startsWith("/") && !v.startsWith("//")) return v;
    try { const url=new URL(v); if(url.protocol==="https:" || url.protocol==="http:") return url.href; }
    catch (_) {}
    return "/favicon.svg";
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }
  function iconNode(p) {
    const span=document.createElement("span");
    span.className="gx-icon";
    span.style.setProperty("--ico",p.tint || "#506bb2");
    span.textContent=(p.name || "L").slice(0,1);
    const img=document.createElement("img");
    img.alt="";
    img.loading="lazy";
    img.src=safeIcon(p.icon);
    img.addEventListener("error",()=>img.remove(),{once:true});
    span.append(img);
    return span;
  }
  function dialogTemplate(id, klass, title, eyebrow) {
    const dlg=document.createElement("dialog");
    dlg.id=id;
    dlg.className="gx-dialog "+klass;
    dlg.setAttribute("aria-labelledby",id+"Title");
    dlg.innerHTML='<header class="gx-dialog-head"><div><span class="gx-eyebrow">'+eyebrow+
      '</span><h2 id="'+id+'Title">'+title+'</h2></div><button type="button" class="gx-x" data-gx-close aria-label="Close">×</button></header>';
    dlg.addEventListener("click",event=>{
      if(event.target===dlg || event.target.closest("[data-gx-close]")) dlg.close();
    });
    document.body.append(dlg);
    return dlg;
  }

  function createGuide() {
    if($("#gxGuide"))return $("#gxGuide");
    const dialog=dialogTemplate("gxGuide","gx-guide-dialog","The Lightning guide","GETTING STARTED");
    const body=document.createElement("div");
    body.className="gx-guide-body";
    body.innerHTML='<nav class="gx-guide-aside" aria-label="Guide chapters"></nav><article class="gx-guide-main"></article>';
    dialog.append(body);
    const nav=$(".gx-guide-aside",dialog);
    lessons.forEach((lesson,index)=>{
      const button=document.createElement("button");
      button.type="button";
      button.innerHTML=escapeHtml(lesson.name)+'<span>'+escapeHtml(lesson.tag)+'</span>';
      button.addEventListener("click",()=>drawLesson(index));
      nav.append(button);
    });
    return dialog;
  }
  function drawLesson(index) {
    const dialog=createGuide();
    const lesson=lessons[index] || lessons[0];
    $$(".gx-guide-aside button",dialog).forEach((btn,i)=>{btn.classList.toggle("active",i===index);btn.setAttribute("aria-current",i===index?"page":"false");});
    const content=$(".gx-guide-main",dialog);
    content.innerHTML='<div class="gx-guide-graphic"><span>'+escapeHtml(lesson.art)+'</span></div>'+
      '<span class="gx-eyebrow">'+escapeHtml(lesson.tag)+'</span>'+
      '<h3>'+escapeHtml(lesson.title)+'</h3><p>'+escapeHtml(lesson.text)+'</p>'+
      '<ul>'+lesson.bullets.map(item=>'<li>'+escapeHtml(item)+'</li>').join("")+'</ul>'+
      '<div class="gx-guide-actions"><button type="button" class="gx-primary" data-gx-lesson-action>'+escapeHtml(lesson.action)+
      '</button><button type="button" class="gx-secondary" data-gx-tour-start>Take the full tour</button></div>'+
      '<div class="gx-guide-shortcuts"><span><kbd>Ctrl</kbd> + <kbd>L</kbd> Address</span><span><kbd>Ctrl</kbd> + <kbd>T</kbd> New tab</span><span><kbd>Ctrl</kbd> + <kbd>,</kbd> Appearance</span></div>';
    $("[data-gx-lesson-action]",content).addEventListener("click",()=>{
      dialog.close();
      if(lesson.kind==="tour")startTour(lesson.step || 0);
      else if(lesson.kind==="appearance")window.LightningGlass?.open("appearance");
      else openCloak();
    });
    $("[data-gx-tour-start]",content).addEventListener("click",()=>{dialog.close();startTour(0);});
  }
  function openGuide(index=0) {
    const dialog=createGuide();
    if($("#gxCloak")?.open)$("#gxCloak").close();
    if($("#lgSettings")?.open)$("#lgSettings").close();
    drawLesson(index);
    if(!dialog.open)dialog.showModal();
  }

  function presetById(id) {return presets.find(p=>p.id===id);}
  function currentCloak() {return window.LightningPrefs?.cloak || {preset:"lightning",title:"",icon:""};}
  function createCloak() {
    if($("#gxCloak"))return $("#gxCloak");
    const dialog=dialogTemplate("gxCloak","gx-cloak-dialog","Tab appearance","PRIVACY & IDENTITY");
    const layout=document.createElement("div");
    layout.className="gx-cloak-layout";
    layout.innerHTML='<div class="gx-cloak-main"><p class="gx-cloak-explain">Choose the tab title and icon, then open Lightning in an about:blank tab. The actual website still loads inside the tab.</p>'+
      '<div class="gx-cloak-grid" role="group" aria-label="Tab appearance presets"></div>'+
      '<section class="gx-cloak-custom"><h3>Your own title and icon</h3><div class="gx-cloak-fields">'+
      '<label>Tab title<input id="gxCustomTitle" type="text" maxlength="80" placeholder="My dashboard"></label>'+
      '<label>Icon URL<input id="gxCustomIcon" type="url" maxlength="400" placeholder="https://example.com/favicon.ico"></label>'+
      '</div><small>Typing here switches to Custom. Icon URLs must use HTTPS or HTTP; Lightning never loads custom scripts.</small></section>'+
      '<div class="gx-cloak-controls"><button class="gx-secondary" data-gx-reset>Reset to Lightning</button><button class="gx-secondary" data-gx-guide>How this works</button></div>'+
      '</div><aside class="gx-cloak-preview"><strong>LIVE TAB PREVIEW</strong><div class="gx-tab-demo"><span class="gx-tab-icon-slot"></span><span class="gx-tab-title"></span><i>×</i></div>'+
      '<div class="gx-preview-note">Opens a new about:blank tab with Lightning inside it. The real site, network requests and browsing records are not hidden. Your browser may block the new tab.</div>'+
      '<button class="gx-primary" data-gx-apply>Apply & open about:blank</button></aside>';
    dialog.append(layout);
    const grid=$(".gx-cloak-grid",dialog);
    presets.forEach(p=>{
      const btn=document.createElement("button");
      btn.type="button";btn.className="gx-cloak-preset";btn.dataset.gxPreset=p.id;
      btn.setAttribute("aria-pressed","false");
      btn.append(iconNode(p));
      const label=document.createElement("b");
      label.textContent=p.name;btn.append(label);
      btn.addEventListener("click",()=>{
        selected=p.id;
        previewCloak();
      });
      grid.append(btn);
    });
    const title=$("#gxCustomTitle",dialog),icon=$("#gxCustomIcon",dialog);
    title.addEventListener("input",()=>{customTitle=title.value;selected="custom";previewCloak();});
    icon.addEventListener("input",()=>{customIcon=icon.value;selected="custom";previewCloak();});
    $("[data-gx-apply]",dialog).addEventListener("click",()=>{
      const detail={preset:selected,title:customTitle.trim().slice(0,80),icon:safeIcon(customIcon)};
      document.dispatchEvent(new CustomEvent("lightning:set-cloak",{detail}));
      dialog.close();
      const opened=window.LightningBlankCloak?.open();
      if(!opened?.ok)notice("New tab blocked. Allow popups, then apply again.");
      else if(opened.alreadyOpen)notice("Tab appearance updated");
      else notice("Opened in about:blank. Close this original tab when ready.");
    });
    $("[data-gx-reset]",dialog).addEventListener("click",()=>{
      selected="lightning";customTitle="";customIcon="";
      title.value="";icon.value="";previewCloak();
      document.dispatchEvent(new CustomEvent("lightning:set-cloak",{detail:{preset:"lightning",title:"",icon:""}}));
      dialog.close();notice("Lightning tab restored");
    });
    $("[data-gx-guide]",dialog).addEventListener("click",()=>{dialog.close();openGuide(4);});
    return dialog;
  }
  function previewCloak() {
    const dialog=createCloak();
    $$(".gx-cloak-preset",dialog).forEach(btn=>btn.setAttribute("aria-pressed",String(btn.dataset.gxPreset===selected)));
    const preset=presetById(selected) || {name:"Custom",title:customTitle.trim() || "Custom tab",icon:customIcon,tint:"#7786bd"};
    const name=selected==="custom"?(customTitle.trim() || "Custom tab"):preset.title;
    $(".gx-tab-title",dialog).textContent=name;
    const slot=$(".gx-tab-icon-slot",dialog);
    slot.replaceChildren(iconNode(selected==="custom"?{name:"Custom",icon:safeIcon(customIcon),tint:"#7786bd"}:preset));
  }
  function openCloak() {
    const dialog=createCloak();
    if($("#gxGuide")?.open)$("#gxGuide").close();
    if($("#lgSettings")?.open)$("#lgSettings").close();
    const saved=currentCloak();
    selected=presetById(saved.preset)?saved.preset:"custom";
    customTitle=String(saved.title || "");
    customIcon=String(saved.icon || "");
    $("#gxCustomTitle",dialog).value=customTitle;
    $("#gxCustomIcon",dialog).value=customIcon;
    previewCloak();
    if(!dialog.open)dialog.showModal();
  }

  function notice(message) {
    const toast=$("#toast");
    if(!toast)return;
    toast.textContent=message;
    toast.classList.add("show");
    setTimeout(()=>toast.classList.remove("show"),2000);
  }

  function createTour() {
    if(tourElements)return tourElements;
    const shades=Array.from({length:4},()=>{const div=document.createElement("div");div.className="gx-tour-shade";document.body.append(div);return div;});
    const focus=document.createElement("div");focus.className="gx-tour-focus";document.body.append(focus);
    const card=document.createElement("section");card.className="gx-tour-card";card.setAttribute("role","dialog");card.setAttribute("aria-modal","true");card.setAttribute("aria-labelledby","gxTourTitle");document.body.append(card);
    tourElements={shades,focus,card};
    return tourElements;
  }
  function closeTour(completed=false) {
    if(tourElements){
      tourElements.shades.forEach(el=>el.remove());tourElements.focus.remove();tourElements.card.remove();
      tourElements=null;
    }
    tourIndex=-1;
    document.removeEventListener("keydown",onTourKeys,true);
    window.removeEventListener("resize",positionTour);
    if(completed){
      const result=window.LightningAccount?.settings.set("glass.guide.completed",true);
      if(result && typeof result.catch==="function")void result.catch(()=>{});
      $("#gxGuideHint")?.remove();
      notice("Tour completed");
    }
  }
  function updateTourCard(){
    if(tourIndex<0||!tourElements)return;
    const current=steps[tourIndex];
    tourElements.card.innerHTML='<span class="gx-eyebrow">GUIDED TOUR / '+(tourIndex+1)+' OF '+steps.length+'</span>'+
      '<h2 id="gxTourTitle">'+escapeHtml(current.title)+'</h2><p>'+escapeHtml(current.copy)+'</p>'+
      '<div class="gx-tour-progress">'+steps.map((_,i)=>'<i class="'+(i<=tourIndex?"done":"")+'"></i>').join("")+'</div>'+
      '<div class="gx-tour-footer"><button class="gx-secondary" data-gx-skip>Exit</button>'+
      (tourIndex?'<button class="gx-secondary" data-gx-back>Back</button>':'')+
      '<button class="gx-primary" data-gx-next>'+(tourIndex===steps.length-1?"Finish tour":"Next")+'</button></div>'+
      '<div class="gx-tour-note">Try the highlighted control, or choose Next. Use ← and → to move between steps.</div>';
    $("[data-gx-skip]",tourElements.card).addEventListener("click",()=>closeTour());
    $("[data-gx-back]",tourElements.card)?.addEventListener("click",()=>showTour(tourIndex-1));
    $("[data-gx-next]",tourElements.card).addEventListener("click",()=>tourIndex===steps.length-1?closeTour(true):showTour(tourIndex+1));
  }
  function positionTour(){
    if(tourIndex<0||!tourElements)return;
    const found=$(steps[tourIndex].selector);
    const rect=found?.getBoundingClientRect();
    const vw=window.innerWidth,vh=window.innerHeight;
    const visible=rect && rect.width>0 && rect.height>0 && rect.bottom>0 && rect.top<vh;
    const left=visible?Math.max(0,rect.left-7):vw/2-45;
    const top=visible?Math.max(0,rect.top-7):Math.max(40,vh/2-30);
    const right=visible?Math.min(vw,rect.right+7):left+90;
    const bottom=visible?Math.min(vh,rect.bottom+7):top+60;
    const put=(el,x,y,w,h)=>Object.assign(el.style,{left:x+"px",top:y+"px",width:Math.max(0,w)+"px",height:Math.max(0,h)+"px"});
    const t=tourElements;
    put(t.shades[0],0,0,vw,top);
    put(t.shades[1],0,top,left,bottom-top);
    put(t.shades[2],right,top,vw-right,bottom-top);
    put(t.shades[3],0,bottom,vw,vh-bottom);
    put(t.focus,left,top,right-left,bottom-top);
    const card=t.card;
    if(vw<=760){
      card.style.left="15px";card.style.top="auto";card.style.bottom="15px";
      return;
    }
    const width=Math.min(390,vw-30);
    const x=Math.max(15,Math.min(vw-width-15,left));
    card.style.left=x+"px";card.style.bottom="auto";
    card.style.top=(bottom+290<vh?bottom+16:Math.max(15,top-285))+"px";
  }
  function showTour(index){
    if(index<0){closeTour();return;}
    if(index>=steps.length){closeTour(true);return;}
    tourIndex=index;
    // Keep navigation visible even after clicking a Community or Library tour target.
    const hub=$("#hubMount");
    if(hub && !hub.hidden)hub.hidden=true;
    createTour();
    updateTourCard();
    positionTour();
    $("[data-gx-next]",tourElements.card)?.focus();
  }
  function onTourKeys(event){
    if(tourIndex<0)return;
    if(event.key==="Escape"){event.preventDefault();closeTour();return;}
    if(event.key==="ArrowRight"){event.preventDefault();showTour(tourIndex+1);return;}
    if(event.key==="ArrowLeft"){event.preventDefault();showTour(Math.max(0,tourIndex-1));return;}
    if(event.key==="Tab"){
      const controls=$$("button",tourElements.card);
      const current=controls.indexOf(document.activeElement);
      if(!controls.length)return;
      if(event.shiftKey && (current<=0)){event.preventDefault();controls[controls.length-1].focus();}
      else if(!event.shiftKey && current===controls.length-1){event.preventDefault();controls[0].focus();}
    }
  }
  function startTour(step=0){
    if($("#gxGuide")?.open)$("#gxGuide").close();
    if($("#gxCloak")?.open)$("#gxCloak").close();
    // Tour starts in browser mode so its controls are visible even when Community is open.
    const hub=$("#hubMount");
    if(hub && !hub.hidden)hub.hidden=true;
    if(step===0)$("#newTabBtn")?.click();
    document.addEventListener("keydown",onTourKeys,true);
    window.addEventListener("resize",positionTour);
    showTour(step);
  }

  function installLaunchers(){
    const toolbar=$(".toolbar");
    const menu=$("#menuBtn");
    if(!toolbar||!menu||$("#gxGuideLaunch"))return;
    const guide=document.createElement("button");
    guide.id="gxGuideLaunch";guide.type="button";guide.className="gx-launch";guide.title="Guide and tutorial";guide.setAttribute("aria-label","Open Lightning guide");guide.textContent="?";
    guide.addEventListener("click",()=>openGuide());
    const cloak=document.createElement("button");
    cloak.id="gxCloakLaunch";cloak.type="button";cloak.className="gx-launch";cloak.title="Tab cloaking";cloak.setAttribute("aria-label","Open tab appearance presets");cloak.textContent="◧";
    cloak.addEventListener("click",openCloak);
    toolbar.insertBefore(guide,menu);
    toolbar.insertBefore(cloak,menu);
    const guideList=$(".v3-browser-guide");
    if(guideList){
      const button=document.createElement("button");button.type="button";button.className="gx-guide-link";
      button.innerHTML="<span>?</span> Guided tour & help";
      button.addEventListener("click",()=>openGuide());
      guideList.append(button);
    }
    const welcome=$(".v3-browser-feature");
    if(welcome){
      const button=document.createElement("button");button.type="button";button.className="gx-tour-start";
      button.textContent="Take the tour";
      button.addEventListener("click",()=>startTour(0));
      welcome.append(button);
    }
    const accountHint=()=>{
      const complete=window.LightningAccount?.settings.get("glass.guide.completed",false);
      if(complete || $("#gxGuideHint") || !guideList)return;
      const hint=document.createElement("button");hint.type="button";hint.id="gxGuideHint";hint.className="gx-guide-link";
      hint.innerHTML="<span>↗</span> New here? Start with the guide";
      hint.addEventListener("click",()=>openGuide(0));
      guideList.append(hint);
    };
    document.addEventListener("lightning:account-settings-loaded",accountHint);
    document.addEventListener("lightning:glass-open-guide",()=>openGuide());
    document.addEventListener("lightning:glass-open-cloak",openCloak);
  }
  window.LightningGuide={open:openGuide,tour:startTour};
  window.LightningTabStudio={open:openCloak,presets:presets.map(({id,name,title})=>({id,name,title}))};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",installLaunchers,{once:true});
  else installLaunchers();
})();