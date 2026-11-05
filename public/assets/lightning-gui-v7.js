/* Lightning v7: three independently composed interfaces over the original browser engine.
   The actual input, tab list, history and account controls are moved, never cloned. */
(function () {
  "use strict";
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const KEY="lightning.gui.mode";
  const MODES=[
    {id:"aura",name:"AURA",tag:"Liquid workspace",description:"A wide desktop, an open navigation rail and a translucent control center."},
    {id:"nova",name:"NOVA",tag:"Floating command deck",description:"A cinematic launch screen, floating header and a bottom application dock."},
    {id:"noir",name:"NOIR",tag:"Minimal workbench",description:"A high-contrast split workspace, compact typography and structured panels."}
  ];
  const valid=id=>MODES.some(x=>x.id===id);
  let mode="aura",ready=false,controls=null;
  function node(tag,cls,text){
    const n=document.createElement(tag);
    n.className=cls||"";
    if(text!==undefined)n.textContent=text;
    return n;
  }
  function decorateNav(){
    const rail=$(".workarea > .rail");
    if(!rail||$(".ln7-rail-brand",rail))return;
    const main=node("div","ln7-main-nav"),tools=node("div","ln7-tools-nav");
    const buttons=$$(".rail-button",rail);
    buttons.forEach(b=>{
      const name=(b.getAttribute("title")||"Open").replace(/Lightning /g,"").replace(/Community chat/i,"Community");
      b.setAttribute("aria-label",name);
      b.append(node("span","ln7-nav-label",name));
      if(b.hasAttribute("data-glass-settings")||b.dataset.panel==="admin")tools.append(b);
      else main.append(b);
    });
    const brand=node("div","ln7-rail-brand");
    brand.innerHTML='<img src="/assets/lightning-mark.svg?v=1" alt="" aria-hidden="true"><span><strong>Lightning</strong><small>WORKSPACE / REBORN</small></span>';
    const group1=node("section","ln7-nav-group");
    group1.append(node("span","ln7-nav-kicker","YOUR SPACE"),main);
    const group2=node("section","ln7-nav-group ln7-nav-group-tools");
    group2.append(node("span","ln7-nav-kicker","TOOLS"),tools);
    const bottom=node("div","ln7-rail-end");
    bottom.innerHTML='<span class="ln7-rail-orbit">◈</span><span>Three worlds.<small>One workspace.</small></span>';
    const switcher=makeSwitch("ln7-rail-switch","Change interface");
    rail.replaceChildren(brand,group1,group2,bottom,switcher);
    rail.classList.add("ln7-navigation");
    const topbar=$(".tabbar"),toolbar=$(".toolbar");
    topbar.insertBefore(makeSwitch("ln7-tab-switch","Layouts"),$(".account-zone",topbar));
    toolbar.insertBefore(makeSwitch("ln7-toolbar-switch","Layouts"),$("#menuBtn"));
  }
  function makeSwitch(cls,text){
    const button=node("button","ln7-switch "+cls);
    button.type="button";
    button.setAttribute("aria-label","Choose Lightning GUI");
    button.innerHTML='<span aria-hidden="true">◫</span><b>'+text+'</b>';
    button.addEventListener("click",openGallery);
    return button;
  }
  function captureControls(){
    if(controls)return;
    controls={
      form:$("#newtabForm"),recent:$("#recentList"),saved:$("#bookmarkList"),
      suggestion:$("#lightningSuggestionButton"),shortcuts:$$(".lightning-quick")
    };
    if(!controls.form||!controls.recent||!controls.saved||!controls.suggestion||!controls.shortcuts.length)
      throw Error("Lightning GUI: missing native browser controls");
  }
  const screens={
    aura:function(){return [
      '<div class="ln7-aura"><div class="ln7-aura-center">',
      '<div class="ln7-aura-top"><span>YOUR DESKTOP <i> / </i> LIGHTNING</span><span>AURA — 01/03</span></div>',
      '<div class="ln7-aura-hero"><div class="ln7-aura-heading">',
      '<span class="ln7-status"><i></i> YOUR SPACE IS READY</span>',
      '<h1>Everything, <em>in its element.</em></h1>',
      '<p>A quieter place to explore, create, and connect. Make yourself comfortable.</p>',
      '</div><div class="ln7-aura-visual" aria-hidden="true"><div class="ln7-aura-sphere"></div><span>SPACE TO EXPLORE</span></div></div>',
      '<section class="ln7-aura-search"><header><span>01 — GO SOMEWHERE</span><small>SEARCH OR ENTER AN ADDRESS</small></header><div data-ln7="form"></div></section>',
      '<section class="ln7-aura-access"><header><span>IN REACH</span><small>YOUR DESTINATIONS</small></header><div data-ln7="quick"></div></section>',
      '<div class="ln7-aura-bottom"><section class="ln7-aura-list"><header>Recent places <small>HISTORY</small></header><div data-ln7="recent"></div></section>',
      '<section class="ln7-aura-list"><header>Saved for later <small>BOOKMARKS</small></header><div data-ln7="saved"></div></section></div>',
      '</div><aside class="ln7-aura-aside"><div class="ln7-side-top"><b>◈</b> THE LIGHTNING DESK <span>01</span></div>',
      '<div class="ln7-aura-art" aria-hidden="true"><i></i><strong>L</strong><small>YOUR NEXT CHAPTER</small></div>',
      '<span class="ln7-aside-label">YOUR NEXT MOVE</span><h2>Good things start here.</h2>',
      '<p>Pick up a conversation, discover something new, or explore the workspace.</p>',
      '<button type="button" data-ln7-route="chat" class="ln7-aside-cta">Open community <b>↗</b></button>',
      '<button type="button" data-ln7-action="guide" class="ln7-aside-alt">Explore the guide <b>→</b></button>',
      '<div class="ln7-aside-tip"><small>QUICK TIP</small><p>Press Ctrl + L to focus the browser address bar.</p><div data-ln7="suggestion"></div></div>',
      '</aside></div>'
    ].join("");},
    nova:function(){return [
      '<div class="ln7-nova"><header class="ln7-nova-head"><span>NOVA / PERSONAL COMMAND DECK</span><span>ALL SYSTEMS OPEN <b>●</b></span></header>',
      '<div class="ln7-nova-hero"><div class="ln7-nova-orbit" aria-hidden="true"><i></i><i></i><i></i><span>✳</span></div>',
      '<div class="ln7-nova-content"><span class="ln7-nova-label">THE NEXT CHAPTER / 02</span>',
      '<h1>Go beyond <em>the ordinary.</em></h1><p>The web, your people, your playground. One launch point.</p>',
      '<div class="ln7-nova-query" data-ln7="form"></div>',
      '<div class="ln7-nova-actions" data-ln7="quick"></div></div>',
      '<div class="ln7-nova-floating"><span>YOUR UNIVERSE</span><b>LIGHTNING</b><p>Make the most of your space.</p>',
      '<button data-ln7-route="overview" type="button">Open workspace ↗</button></div></div>',
      '<div class="ln7-nova-panels"><section><header>01 <span>RECENT SIGNALS</span></header><div data-ln7="recent"></div></section>',
      '<section><header>02 <span>PINNED DESTINATIONS</span></header><div data-ln7="saved"></div></section>',
      '<section class="ln7-nova-intro"><header>03 <span>CONTROL ROOM</span></header><strong>Get to know Lightning.</strong>',
      '<p>An actual walkthrough of the controls, features and layout.</p><button type="button" data-ln7-action="guide">Start guide ↗</button>',
      '<div data-ln7="suggestion"></div></section></div></div>'
    ].join("");},
    noir:function(){return [
      '<div class="ln7-noir"><div class="ln7-noir-top"><span>LIGHTNING SYSTEM <b> / </b> 03</span><span>SESSION ACTIVE ●</span></div>',
      '<div class="ln7-noir-columns"><aside class="ln7-noir-statement"><div class="ln7-noir-number">03<span>/03</span></div>',
      '<span class="ln7-noir-eyebrow">MINIMAL WORKBENCH</span><h1>Less noise. <em>More space.</em></h1>',
      '<p>Everything you need. Exactly where it belongs. Nothing between you and the work.</p>',
      '<div class="ln7-noir-illustration" aria-hidden="true"><i></i><i></i><i></i><i></i></div>',
      '<button type="button" data-ln7-action="guide">READ THE FIELD GUIDE <b>↗</b></button></aside>',
      '<div class="ln7-noir-content"><section class="ln7-noir-command"><span>COMMAND / 01</span><h2>Where to next?</h2>',
      '<div data-ln7="form"></div><small>SEARCH THE WEB OR ENTER A URL</small></section>',
      '<section class="ln7-noir-directory"><header>DIRECTORY <span>FREQUENT PLACES</span></header><div data-ln7="quick"></div></section>',
      '<div class="ln7-noir-tables"><section><header>RECENT ACTIVITY <small>01</small></header><div data-ln7="recent"></div></section>',
      '<section><header>YOUR COLLECTION <small>02</small></header><div data-ln7="saved"></div></section></div>',
      '<footer>NOTHING EXTRA. EVERYTHING READY. <div data-ln7="suggestion"></div></footer></div></div></div>'
    ].join("");}
  };
  function renderHome(next){
    captureControls();
    const home=$("#newtabView");
    if(!home)return;
    const wasHidden=home.classList.contains("hidden");
    const searchFocused=document.activeElement===controls.form.querySelector("input");
    const original=[controls.form,controls.recent,controls.saved,controls.suggestion,...controls.shortcuts];
    original.forEach(el=>el.remove());
    home.innerHTML=screens[next]();
    home.className="newtab v3-browser-home ln7-home ln7-home-"+next+(wasHidden?" hidden":"");
    const target=(name)=>$('[data-ln7="'+name+'"]',home);
    target("form")?.append(controls.form);
    target("recent")?.append(controls.recent);
    target("saved")?.append(controls.saved);
    target("suggestion")?.append(controls.suggestion);
    for(const item of controls.shortcuts)target("quick")?.append(item);
    controls.form.classList.add("ln7-search-form");
    controls.form.querySelector("input")?.setAttribute("placeholder","Search or enter a website");
    if(searchFocused)controls.form.querySelector("input")?.focus();
  }
  function setMode(next,options={}){
    if(!valid(next))return false;
    const change=()=>{
      mode=next;
      document.documentElement.dataset.ln7Gui=next;
      document.body.dataset.ln7Gui=next;
      renderHome(next);
      $$(".ln7-layout-choice").forEach(b=>{
        const active=b.dataset.gui===next;
        b.setAttribute("aria-pressed",String(active));
        b.classList.toggle("active",active);
      });
      document.dispatchEvent(new CustomEvent("lightning:gui-change",{detail:{mode:next}}));
    };
    if(!ready)return false;
    if(options.animated!==false && next!==mode && !window.matchMedia("(prefers-reduced-motion: reduce)").matches && typeof document.startViewTransition==="function"){
      try{document.startViewTransition(change);}catch(_){change();}
    }else change();
    if(options.save!==false){
      const result=window.LightningAccount?.settings.set(KEY,next);
      if(result&&typeof result.catch==="function")void result.catch(err=>console.warn("GUI preference:",err.message));
    }
    return true;
  }
  function gallery(){
    let dlg=$("#ln7Gallery");
    if(dlg)return dlg;
    dlg=document.createElement("dialog");
    dlg.id="ln7Gallery";dlg.className="ln7-gallery";
    dlg.setAttribute("aria-labelledby","ln7GalleryTitle");
    const head=document.createElement("div");head.className="ln7-gallery-head";
    head.innerHTML='<div><span>LIGHTNING / INTERFACE SYSTEM</span><h2 id="ln7GalleryTitle">Choose your world.</h2>'+
      '<p>Three complete layouts. Your tabs and account stay with you.</p></div><button type="button" data-ln7-close aria-label="Close gallery">×</button>';
    dlg.append(head);
    const cards=node("div","ln7-gallery-cards");
    MODES.forEach((item,i)=>{
      const card=node("button","ln7-layout-choice ln7-choice-"+item.id);
      card.type="button";card.dataset.gui=item.id;card.setAttribute("aria-pressed","false");
      const n=String(i+1).padStart(2,"0");
      card.innerHTML='<span class="ln7-gallery-num">'+n+' / 03 <b>↗</b></span>'+
        '<span class="ln7-gallery-mini"><i class="ln7-mini-side"></i><i class="ln7-mini-top"></i><i class="ln7-mini-center"><i></i><i></i><i></i></i><i class="ln7-mini-extra"></i></span>'+
        '<span class="ln7-gallery-tag">'+item.tag+'</span><strong>'+item.name+'</strong><small>'+item.description+'</small>'+
        '<span class="ln7-gallery-use">Use '+item.name+' <b>↗</b></span>';
      card.addEventListener("click",()=>setMode(item.id,{save:true,animated:true}));
      cards.append(card);
    });
    dlg.append(cards);
    const foot=node("div","ln7-gallery-footer");
    foot.innerHTML='<span>Switch whenever you like. No tab data is discarded.</span>'+
      '<button type="button" data-ln7-close>Done</button>';
    dlg.append(foot);
    dlg.addEventListener("click",e=>{
      if(e.target===dlg||e.target.closest("[data-ln7-close]"))dlg.close();
    });
    document.body.append(dlg);
    return dlg;
  }
  function openGallery(){
    const dlg=gallery();
    $$(".ln7-layout-choice",dlg).forEach(btn=>{
      const active=btn.dataset.gui===mode;
      btn.setAttribute("aria-pressed",String(active));
      btn.classList.toggle("active",active);
    });
    if(!dlg.open)dlg.showModal();
  }
  function hubSwitcher(){
    const hub=$("#hubMount");
    if(!hub)return;
    const sync=()=>{
      if(hub.hidden||!$(".v3-shell",hub))return;
      if($(".ln7-hub-switcher",hub))return;
      const btn=makeSwitch("ln7-hub-switcher","Switch GUI");
      hub.append(btn);
    };
    const observer=new MutationObserver(sync);
    observer.observe(hub,{childList:true,attributes:true,attributeFilter:["hidden"]});
    sync();
  }
  function init(){
    if(!$("#boltShell")||!$("#newtabView"))return;
    decorateNav();captureControls();
    ready=true;
    setMode("aura",{save:false,animated:false});
    hubSwitcher();
    document.addEventListener("click",e=>{
      const action=e.target.closest("[data-ln7-action]");
      if(action){
        if(action.dataset.ln7Action==="guide")window.LightningGuide?.open();
        if(action.dataset.ln7Action==="gallery")openGallery();
      }
      const route=e.target.closest("[data-ln7-route]");
      if(route){
        const val=route.dataset.ln7Route;
        const btn=$('.rail-button[data-hub="'+val+'"]')||$('.lightning-quick[data-hub="'+val+'"]');
        btn?.click();
      }
    });
    const load=()=>{
      const saved=window.LightningAccount?.settings.get(KEY,null);
      if(valid(saved))setMode(saved,{save:false,animated:false});
    };
    document.addEventListener("lightning:account-settings-loaded",load);
    document.addEventListener("lightning:gui-open-picker",openGallery);
    document.addEventListener("keydown",e=>{
      if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==="g"){
        e.preventDefault();openGallery();
      }
    });
    load();
  }
  window.LightningGUI={modes:MODES.map(x=>({...x})),get:()=>mode,set:id=>setMode(id),open:openGallery};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
  else init();
})();
