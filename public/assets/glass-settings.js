// One appearance engine shared by the browser, communities, games and AI.
(function(){
"use strict";
const KEY="lightning.glass.appearance";
const DEFAULTS={accent:"#a3cef8",preset:"ice",wallpaper:"arctic",opacity:72,blur:28,saturation:145,radius:22,scale:100,layout:"island",sidebar:"wide",inspector:true,dock:true,motion:true,shadows:true,contrast:false};
const COLORS=[["gold","Champagne","#e2bb75"],["rose","Rose","#f0acc7"],["ice","Frost","#a3cef8"],["lilac","Lavender","#bca9f1"],["copper","Copper","#d99f78"],["silver","Silver","#d0d4df"]];
const WALLS=[["amber","Golden mist","#81654b","#262027","#524431"],["night","After dark","#4b3c63","#171722","#28334b"],["arctic","Glacier","#436d88","#1a2939","#7b8da9"],["ember","Ember","#92563c","#291a21","#754830"],["graphite","Graphite","#3c434d","#141820","#53535a"]];
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const clean=(v)=>String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const clamp=(v,min,max)=>Math.min(max,Math.max(min,Number(v)||min));
const validHex=v=>typeof v==="string"&&/^#[a-fA-F0-9]{6}$/.test(v);
function sanitize(raw){
 const p={...DEFAULTS};
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return p;
 if(validHex(raw.accent))p.accent=raw.accent.toLowerCase();
 if(COLORS.some(x=>x[0]===raw.preset)||raw.preset==="custom")p.preset=raw.preset;
 if(WALLS.some(x=>x[0]===raw.wallpaper))p.wallpaper=raw.wallpaper;
 if(["island","toolbar"].includes(raw.layout))p.layout=raw.layout;
 if(["wide","compact"].includes(raw.sidebar))p.sidebar=raw.sidebar;
 for(const [key,min,max] of [["opacity",20,95],["blur",0,48],["saturation",100,190],["radius",8,36],["scale",85,115]])if(raw[key]!==undefined)p[key]=clamp(raw[key],min,max);
 for(const key of ["inspector","dock","motion","shadows","contrast"])if(typeof raw[key]==="boolean")p[key]=raw[key];
 return p;
}
function load(){try{return sanitize(JSON.parse(localStorage.getItem(KEY)||"null"))}catch{return {...DEFAULTS}}}
let prefs=load(),currentTab="appearance";
if(prefs.preset==="gold"&&prefs.accent.toLowerCase()==="#e2bb75"){
 prefs={...prefs,preset:DEFAULTS.preset,accent:DEFAULTS.accent,wallpaper:DEFAULTS.wallpaper};
 try{localStorage.setItem(KEY,JSON.stringify(prefs))}catch{}
}
// The original green experiment used these hard-coded accents.
// Migrate them once; preserve every other user-selected color.
if(["#44eda7","#38f0a4","#42f5a9","#40ffa8","#3df0a3","#38eea6","#52f7ab"].includes(prefs.accent.toLowerCase())){
 prefs={...prefs,accent:DEFAULTS.accent,preset:DEFAULTS.preset};
 try{localStorage.setItem(KEY,JSON.stringify(prefs))}catch{}
}
function save(){try{localStorage.setItem(KEY,JSON.stringify(prefs))}catch{}}
function apply(){
 const root=document.documentElement;
 const rgb=[1,3,5].map(i=>parseInt(prefs.accent.slice(i,i+2),16)).join(",");
 const vars={"--lg-accent":prefs.accent,"--lg-rgb":rgb,"--lg-alpha":String(1-prefs.opacity/115),"--lg-blur":prefs.blur+"px",
  "--lg-saturation":prefs.saturation+"%","--lg-radius":prefs.radius+"px","--lg-small-radius":Math.max(7,Math.round(prefs.radius*.55))+"px","--lg-scale":String(prefs.scale/100),
  "--accent":prefs.accent,"--accent-rgb":rgb};
 Object.entries(vars).forEach(([k,v])=>root.style.setProperty(k,v));
 root.dataset.lgWallpaper=prefs.wallpaper;
 root.dataset.lgLayout=prefs.layout;
 root.dataset.lgSidebar=prefs.sidebar;
 root.dataset.lgMotion=prefs.motion?"yes":"no";
 root.dataset.lgShadows=prefs.shadows?"yes":"no";
 root.dataset.lgContrast=prefs.contrast?"high":"normal";
 const hub=$("#hubMount");
 if(hub){
  hub.style.setProperty("--v3-accent",prefs.accent);
  hub.dataset.theme="glass";
  const shell=$(".v3-shell",hub);
  if(shell){shell.classList.toggle("v3-no-inspector",!prefs.inspector);shell.classList.toggle("v3-no-dock",!prefs.dock);}
 }
 const preview=$("#lgPreview");
 if(preview){preview.dataset.wallpaper=prefs.wallpaper;preview.style.setProperty("--sample-accent",prefs.accent);preview.style.setProperty("--sample-blur",prefs.blur+"px");
  preview.style.setProperty("--sample-alpha",String(1-prefs.opacity/115));preview.style.setProperty("--sample-radius",prefs.radius+"px");
  const title=$("#lgPreviewTitle");if(title)title.textContent=COLORS.find(p=>p[0]===prefs.preset)?.[1]||"Custom";
 }
 document.dispatchEvent(new CustomEvent("lightning:appearance-change",{detail:{...prefs}}));
}
function set(key,value){
 prefs=sanitize({...prefs,[key]:value});
 if(key==="preset"&&value!=="custom")prefs.accent=COLORS.find(p=>p[0]===value)?.[2]||DEFAULTS.accent;
 if(key==="accent")prefs.preset="custom";
 save();apply();
}
function box(title,description,html){return '<section class="lg-box"><div class="lg-box-heading"><h3>'+title+'</h3><p>'+description+'</p></div>'+html+'</section>';}
function slider(key,title,units,min,max){return '<label class="lg-slider"><span><b>'+title+'</b><output data-lg-out="'+key+'">'+prefs[key]+units+'</output></span><input type="range" data-lg-setting="'+key+'" min="'+min+'" max="'+max+'" value="'+prefs[key]+'" aria-label="'+title+'"></label>';}
function toggle(key,title,description){return '<label class="lg-switch"><span><strong>'+title+'</strong><small>'+description+'</small></span><input type="checkbox" data-lg-setting="'+key+'" '+(prefs[key]?"checked":"")+'><i></i></label>';}
function segment(key,items){return '<div class="lg-segments" role="group" aria-label="'+key+'">'+items.map(([id,title,desc])=>'<button type="button" data-lg-choice="'+key+'" data-value="'+id+'" class="'+(prefs[key]===id?"active":"")+'" aria-pressed="'+(prefs[key]===id)+'"><b>'+title+'</b><small>'+desc+'</small></button>').join("")+'</div>';}
function initDialog(){
 if($("#lgSettings"))return $("#lgSettings");
 const dialog=document.createElement("dialog");dialog.id="lgSettings";dialog.className="lg-settings";
 dialog.setAttribute("aria-labelledby","lgSettingsTitle");
 dialog.innerHTML='<div class="lg-shell"><aside class="lg-sidebar">'+
   '<div class="lg-brand"><i><img class="lightning-mark" src="/assets/lightning-mark.svg?v=1" alt=""></i><span><strong>Settings</strong><small>Appearance</small></span></div>'+
   '<span class="lg-rail-kicker">PERSONALIZATION</span>'+
   '<nav aria-label="Settings sections"><button data-lg-tab="appearance">◈ <span>Appearance</span></button>'+
   '<button data-lg-tab="layout">▣ <span>Layout & space</span></button>'+
   '<button data-lg-tab="accessibility">◐ <span>Accessibility</span></button>'+
   '<button data-lg-tab="data">⇄ <span>Preferences & data</span></button></nav>'+
   '<div class="lg-sidebar-footer">Made to feel like yours.</div></aside>'+
  '<div class="lg-main"><header class="lg-head"><div><small id="lgCategory">APPEARANCE</small><h2 id="lgSettingsTitle">The look and feel.</h2></div>'+
  '<button type="button" data-lg-action="close" class="lg-close" aria-label="Close preferences">×</button></header>'+
  '<div id="lgSettingsBody" class="lg-body"></div></div>'+
  '<aside class="lg-preview-side"><header><span>LIVE PREVIEW</span><b>● INSTANT</b></header>'+
  '<div id="lgPreview" class="lg-preview" data-wallpaper="amber">'+
   '<div class="lg-sample"><div class="lg-sample-island"><i><img class="lightning-mark" src="/assets/lightning-mark.svg?v=1" alt=""></i><span>⌂</span><span>♞</span><span>✧</span></div>'+
   '<div class="lg-sample-row"><div class="lg-sample-menu"><i></i><i></i><i></i><i></i></div>'+
   '<div class="lg-sample-content"><small>GOOD EVENING</small><strong>Make it yours.</strong><div class="lg-sample-art"></div>'+
   '<div class="lg-sample-bars"><i></i><i></i></div></div></div></div></div>'+
   '<div class="lg-preview-caption"><strong id="lgPreviewTitle">Frost</strong><p>Changes apply as you edit.</p></div>'+
   '<button data-lg-action="reset" class="lg-reset-button">↻ Restore original look</button></aside></div>';
 document.body.append(dialog);
 dialog.addEventListener("click",e=>{
  if(e.target===dialog){dialog.close();return;}
  const tab=e.target.closest("[data-lg-tab]");if(tab){draw(tab.dataset.lgTab);return;}
  const choice=e.target.closest("[data-lg-choice]");
  if(choice){set(choice.dataset.lgChoice,choice.dataset.value);draw(currentTab);return;}
  const button=e.target.closest("[data-lg-action]");if(!button)return;
  const action=button.dataset.lgAction;
  if(action==="close")dialog.close();
  if(action==="reset"&&confirm("Reset your appearance to Lightning defaults?")){prefs={...DEFAULTS};save();apply();draw(currentTab);}
  if(action==="browser"){dialog.close();document.dispatchEvent(new Event("lightning:browser-settings"));}
  if(action==="light"){
   prefs=sanitize({...prefs,opacity:30,blur:8,motion:false,shadows:false,contrast:true});save();apply();draw(currentTab);
  }
  if(action==="export"){
   const blob=new Blob([JSON.stringify({version:1,appearance:prefs},null,2)],{type:"application/json"});
   const url=URL.createObjectURL(blob),a=document.createElement("a");
   a.href=url;a.download="lightning-settings.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),500);
  }
  if(action==="import")$("#lgImport")?.click();
 });
 dialog.addEventListener("input",e=>{
  const input=e.target.closest("[data-lg-setting]");if(!input)return;
  const key=input.dataset.lgSetting;
  const value=input.type==="checkbox"?input.checked:input.type==="range"?Number(input.value):input.value;
  set(key,value);
  const output=$('[data-lg-out="'+key+'"]',dialog);
  if(output)output.textContent=value+(["blur","radius"].includes(key)?"px":"%");
  const code=$("#lgCustomHex",dialog);if(code&&key==="accent")code.textContent=String(value).toUpperCase();
 });
 dialog.addEventListener("change",e=>{
  if(!e.target.matches("#lgImport"))return;
  const file=e.target.files?.[0];if(!file||file.size>20000){alert("Invalid settings file.");return;}
  file.text().then(t=>{
   const parsed=JSON.parse(t),raw=parsed.appearance||parsed;
   if(!raw||typeof raw!=="object"||Array.isArray(raw))throw Error("Invalid settings file");
   prefs=sanitize(raw);save();apply();draw(currentTab);
  }).catch(()=>alert("Couldn't load that settings file."));
 });
 return dialog;
}
function draw(tab="appearance"){
 currentTab=["appearance","layout","accessibility","data"].includes(tab)?tab:"appearance";
 const dialog=initDialog(),titles={
  appearance:["APPEARANCE","Appearance"],layout:["LAYOUT","Layout"],
  accessibility:["ACCESSIBILITY","Accessibility"],data:["DATA","Data and preferences"]
 };
 $$("[data-lg-tab]",dialog).forEach(b=>{b.classList.toggle("active",b.dataset.lgTab===currentTab);b.setAttribute("aria-current",b.dataset.lgTab===currentTab?"page":"false")});
 $("#lgCategory",dialog).textContent=titles[currentTab][0];$("#lgSettingsTitle",dialog).textContent=titles[currentTab][1];
 let html="";
 if(currentTab==="appearance"){
  html='<div class="lg-intro"><span>COLORS</span><h3>Theme</h3><p>Choose a color and background.</p></div>'+
   box("Accent color","Used for buttons and highlights.",
     '<div class="lg-colors">'+COLORS.map(([id,name,color])=>'<button class="'+(prefs.preset===id?"active":"")+'" data-lg-choice="preset" data-value="'+id+'"><i style="--swatch:'+color+'"></i><b>'+name+'</b></button>').join("")+'</div>'+
     '<label class="lg-color-picker">Custom color <input data-lg-setting="accent" type="color" value="'+prefs.accent+'" aria-label="Custom accent color"><code id="lgCustomHex">'+prefs.accent.toUpperCase()+'</code></label>')+
   box("Background","Choose a background.",
     '<div class="lg-wallpapers">'+WALLS.map(([id,name,a,b,c])=>'<button class="'+(prefs.wallpaper===id?"active":"")+'" data-lg-choice="wallpaper" data-value="'+id+'"><i style="--wa:'+a+';--wb:'+b+';--wc:'+c+'"></i><b>'+name+'</b></button>').join("")+'</div>')+
   box("Glass effect","Change the blur and transparency.",
     '<div class="lg-slider-grid">'+slider("opacity","Transparency","%",20,95)+slider("blur","Glass blur","px",0,48)+slider("saturation","Color richness","%",100,190)+slider("radius","Corner radius","px",8,36)+'</div>');
 }else if(currentTab==="layout"){
  html='<div class="lg-intro"><span>LAYOUT</span><h3>Layout</h3><p>Adjust the toolbar and sidebar.</p></div>'+
   box("Top navigation","Choose a floating island or connected app bar.",segment("layout",[["island","◉ Island","Floating controls"],["toolbar","▤ Toolbar","Connected top bar"]]))+
   box("Sidebar","Compact keeps the essentials in reach.",segment("sidebar",[["wide","▣ Full","Servers and channels"],["compact","◫ Compact","Icon navigation"]]))+
   box("Your panels","Only keep the things you use.",toggle("inspector","Activity panel","People and recent messages")+
      toggle("dock","Game dock","Quick access to favorite games"))+
   box("Interface scale","Set a comfortable size.",slider("scale","Scale","%",85,115));
 }else if(currentTab==="accessibility"){
  html='<div class="lg-intro"><span>03 · COMFORT</span><h3>Use it your way.</h3><p>Glass should never get in the way of clarity.</p></div>'+
   box("Readability & performance","Adjust how the interface feels.",
     toggle("contrast","High contrast","Stronger boundaries and solid panels")+
     toggle("motion","Motion effects","Soft transitions and decorative movement")+
     toggle("shadows","Depth and reflections","Multi-layer shadows behind panels"))+
   box("Lightweight mode","A calmer look that uses less blur and motion.",
     '<button class="lg-plain-action" data-lg-action="light">Apply low-effects preset ↗</button>');
 }else{
  html='<div class="lg-intro"><span>04 · DATA</span><h3>Yours to keep.</h3><p>Appearance preferences are saved locally on this device.</p></div>'+
   box("Backup","Move your look between browsers and devices.",
     '<div class="lg-data-actions"><button data-lg-action="export">↓ Export theme</button><button data-lg-action="import">↑ Import theme</button></div><input id="lgImport" type="file" accept=".json,application/json" hidden>')+
   box("Browser settings","Search engine, tab behavior and browser preferences.",
     '<button data-lg-action="browser" class="lg-plain-action">Open browser settings ↗</button>')+
   box("Reset","Restores the original appearance, without deleting accounts or chats.",
     '<button data-lg-action="reset" class="lg-plain-action lg-danger">↻ Reset appearance</button>');
 }
 $("#lgSettingsBody",dialog).innerHTML=html+'<p class="lg-auto-save">● Changes save automatically</p>';
 apply();
}
function open(tab="appearance"){
 const dialog=initDialog();draw(tab);if(!dialog.open)dialog.showModal();
}
apply();
window.LightningGlass={get:()=>({...prefs}),set,apply,open,reset:()=>{prefs={...DEFAULTS};save();apply()}};
document.addEventListener("click",e=>{if(e.target.closest("[data-glass-settings]")){e.preventDefault();open();}});
document.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key===","){e.preventDefault();open();}});
window.addEventListener("storage",e=>{if(e.key===KEY){prefs=load();apply();}});
document.addEventListener("DOMContentLoaded",apply,{once:true});
})();
