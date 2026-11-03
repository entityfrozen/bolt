/* Lightning V4 · a real first-launch tour across the live workspace.
 * The companion is a 2D illustration, not a rendered avatar engine.
 * Progress and preferences are owned by the user's Lightning account.
 */
(()=>{
"use strict";
if(!document.getElementById("boltShell"))return;
const KEY="chan.settings",VERSION=4;
const $=(q,r=document)=>r.querySelector(q);
const $$=(q,r=document)=>Array.from(r.querySelectorAll(q));
const clean=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const defaults={seen:false,tourVersion:0,theme:"dark",voice:true,engine:"voiceai",voiceId:"",browserVoice:"",
 rate:1.14,pitch:1.1,hud:{side:"right",scale:105,compact:false,motion:true,sidebar:"full",
 announcement:true,shortcuts:true,widget:false,x:70,y:74}};
const steps=[
 {label:"Welcome",title:"Welcome to Lightning!",line:"Welcome to lightning!",
  detail:"Your new home for browsing, communities, announcements and a little bit of chaos. I'm Lightning-chan, and I'll show you around!",
  target:null},
 {label:"Appearance",title:"First, choose your appearance.",line:"Theres two gui colors you can use, let me just pull those up... Okay! Light or Dark?",
  detail:"Pick the theme that feels more like you. You can always switch with the sun and moon buttons at the top.",
  target:"#v4ThemeSwitch",theme:true},
 {label:"Navigation",title:"Your workspace awaits.",line:"Great choice, now allow me to show you around.",
  detail:"That glowing menu on the left is where all your favorite tools live. The home button always takes you back to the dashboard.",
  target:".rail"},
 {label:"Announcements",title:"Announcements & updates",line:"Heres annoucements, altough amare usally posts his update logs in there for some reason.. He's such an idiot",
  detail:"The Announcements panel uses real community posts. Amare's update logs have their own section too. Yes, I know, it's confusing.",
  target:".v5-announcement-card",ensureHome:true},
 {label:"Browser",title:"Your own browser.",line:"Here's the browser! Type a website or a search, open tabs, and save your favorite pages. Try not to open a hundred tabs... actually, I won't judge.",
  detail:"The browser lives in the top bar. The Browser button takes you straight to it.",
  target:"#addressForm"},
 {label:"Community",title:"Stay in the loop.",line:"Over here is Community! Chat with your friends, jump into channels, and hang out. Just don't start any drama while I'm watching!",
  detail:"Open Community from the left navigation whenever you want to talk.",
  target:"#v4NavCommunity"},
 {label:"Library",title:"The fun stuff.",line:"And this is your Library! All your favorite activities and links in one place. Consider this your little collection of distractions.",
  detail:"Your library items remain accessible as normal; none of your favorites are being removed.",
  target:"#v4NavLibrary"},
 {label:"AI Assistant",title:"Ask me anything.",line:"That sparkle right there? That's me! Ask a question, get help with something, or just chat. I may be cute, but I actually know stuff.",
  detail:"Lightning-chan uses the existing account-backed AI chat and can speak answers aloud when enabled.",
  target:"#v4NavAI"},
 {label:"HUD Editor",title:"Now make it yours.",line:"The HUD Editor lets you rearrange the layout, move my little portrait, resize things and customize your workspace. I promise I won't take it personally if you hide me!",
  detail:"Open the live HUD editor to customize the sidebar, quick shortcuts and floating assistant.",
  target:"#v4NavHUD"},
 {label:"Settings",title:"More ways to customize.",line:"Here are your settings! Glass effects, personal preferences and more. Your theme can be switched anytime with the sun and moon up top.",
  detail:"Changes are saved to your Lightning account, so they follow you between devices.",
  target:"#v4NavSettings"},
 {label:"Ready",title:"You're officially powered up!",line:"And we're done! You're officially a Lightning pro. Okay, maybe not a pro yet... but you've got me, so we're good. Let's go!",
  detail:"Welcome to your new workspace. You can replay this whole tour anytime using the question-mark button.",
  target:null}
];
let prefs=JSON.parse(JSON.stringify(defaults)),ready=false,openTour=false,current=0,playing=null,audioUrl=null;
let voiceList=[],voicesFetched=false,loadingVoices=false,selectionMade=false;
let focusObserver=null;
let voiceRequest=null,voiceGeneration=0;
const root=document.createElement("div");
root.id="v4CompanionRoot";
root.innerHTML=
 '<button id="v4Companion" type="button" aria-label="Open Lightning-chan guide" title="Lightning-chan · click for help">'+
 '<img src="/assets/lightning-chan.svg" alt=""><b>✦</b></button>'+
 '<div id="v4HudWidget" class="v4-hud-widget" hidden><div class="v4-hud-heading" id="v4HudDrag"><span>✦ LIGHTNING HUD</span>'+
 '<button id="v4HudClose" type="button" aria-label="Hide HUD">×</button></div><strong id="v4HudClock">--:--</strong>'+
 '<span>YOUR WORKSPACE</span><div><button type="button" data-v4-jump="announcements">Announcements</button>'+
 '<button type="button" data-v4-jump="assistant">Ask AI ✧</button></div></div>'+
 '<section id="v4Tour" class="v4-tour" role="dialog" aria-modal="true" aria-labelledby="v4TourTitle" hidden>'+
 '<div class="v4-tour-backdrop"></div><div class="v4-tour-spotlight" id="v4TourSpotlight" hidden></div>'+
 '<div class="v4-tour-grid"><section class="v4-tour-main">'+
 '<header class="v4-tour-top"><span class="v4-tour-logo">ϟ <strong>LIGHTNING</strong> <em>FIRST-LAUNCH EXPERIENCE</em></span>'+
 '<button type="button" id="v4TourClose" aria-label="Skip tutorial">✕</button></header>'+
 '<div class="v4-tour-copy"><span class="v4-tour-eyebrow" id="v4TourEyebrow"></span>'+
 '<h1 id="v4TourTitle"></h1><p id="v4TourDetail"></p></div>'+
 '<div class="v4-tour-feature" id="v4TourFeature"></div>'+
 '<footer class="v4-tour-bottom"><div class="v4-tour-progress" id="v4TourProgress"></div>'+
 '<div class="v4-tour-controls"><button id="v4TourSkip" type="button" class="v4-btn-quiet">Skip tour</button>'+
 '<button id="v4TourBack" type="button" class="v4-btn-quiet">← Back</button>'+
 '<button id="v4TourNext" type="button" class="v4-btn-primary">Next →</button></div></footer></section>'+
 '<aside class="v4-tour-character"><span class="v4-character-kicker">✧ SYSTEM COMPANION / ONLINE</span>'+
 '<div class="v4-character-orbit"></div><img id="v4TourArt" src="/assets/lightning-chan.svg" alt="Lightning-chan, your 2D anime guide">'+
 '<div class="v4-character-dialogue"><div class="v4-dialogue-title"><strong>ϟ Lightning-chan</strong>'+
 '<button id="v4LinePlay" type="button" title="Play this voiceline">▶ Listen</button></div>'+
 '<p id="v4TourLine" aria-live="polite"></p><div class="v4-voice-row"><label>'+
 '<input type="checkbox" id="v4VoiceToggle"><span>Voice lines</span></label>'+
 '<button id="v4TourVoiceSettings" type="button">Voice settings ⚙</button></div></div></aside></div></section>'+
 '<dialog id="v4HudEditor" class="v4-hud-editor" aria-labelledby="v4HudTitle"><div class="v4-editor-shell">'+
 '<div class="v4-editor-head"><div><span class="v4-mini-label">PERSONALIZATION / V4</span><h2 id="v4HudTitle">HUD Editor</h2>'+
 '<p>Make Lightning feel like your workspace.</p></div><button type="button" id="v4EditorClose" aria-label="Close HUD editor">✕</button></div>'+
 '<div class="v4-editor-grid"><div class="v4-editor-preview"><span>LIVE LAYOUT PREVIEW</span>'+
 '<div class="v4-preview-screen" id="v4PreviewScreen"><div class="v4-preview-sidebar"></div>'+
 '<div class="v4-preview-top"></div><div class="v4-preview-card"></div><div class="v4-preview-card right"></div>'+
 '<div class="v4-preview-mascot" id="v4PreviewMascot" tabindex="0" title="Drag to move the mascot">✦</div></div>'+
 '<small>Drag the ✦ mascot on the preview to set its position.</small></div>'+
 '<div class="v4-editor-options"><fieldset><legend>Appearance</legend><div class="v4-pill-group">'+
 '<button type="button" data-v4-theme="dark">☾ Midnight</button><button type="button" data-v4-theme="light">☀ Daybreak</button></div></fieldset>'+
 '<fieldset><legend>Sidebar size</legend><div class="v4-pill-group"><button type="button" data-v4-sidebar="full">Comfortable</button>'+
 '<button type="button" data-v4-sidebar="compact">Compact</button></div></fieldset>'+
 '<fieldset><legend>Lightning-chan</legend><div class="v4-pill-group">'+
 '<button type="button" data-v4-side="right">Right</button><button type="button" data-v4-side="left">Left</button>'+
 '<button type="button" data-v4-side="off">Hidden</button></div>'+
 '<label class="v4-range">Mascot size <output id="v4ScaleLabel">105%</output>'+
 '<input type="range" id="v4Scale" min="75" max="135" step="5"></label></fieldset>'+
 '<fieldset><legend>Widgets & motion</legend><label class="v4-check"><span>Show announcements</span>'+
 '<input id="v4ShowAnnouncements" type="checkbox"></label>'+
 '<label class="v4-check"><span>Show quick shortcuts</span><input id="v4ShowShortcuts" type="checkbox"></label>'+
 '<label class="v4-check"><span>Enable floating HUD widget</span><input id="v4ShowWidget" type="checkbox"></label>'+
 '<label class="v4-check"><span>Animate interface effects</span><input id="v4Motion" type="checkbox"></label></fieldset></div></div>'+
 '<div class="v4-editor-footer"><button id="v4EditorReset" type="button" class="v4-btn-quiet">Reset to defaults</button>'+
 '<button id="v4EditorSave" type="button" class="v4-btn-primary">Save layout ✓</button></div></div></dialog>'+
 '<dialog id="v4VoiceEditor" class="v4-voice-editor" aria-labelledby="v4VoiceTitle"><header>'+
 '<div><span class="v4-mini-label">LIGHTNING-CHAN / SOUND</span><h2 id="v4VoiceTitle">Voice Studio</h2>'+
 '<p>Choose her voice, then press Play sample.</p></div><button id="v4VoiceClose" type="button">✕</button></header>'+
 '<div class="v4-voice-body"><div class="v4-voice-wave">▂ ▄ ▆ █ ▆ ▄ ▂ ▄ ▆ █ ▆ ▄ ▂</div>'+
 '<label>Voice engine <select id="v4VoiceEngine"><option value="voiceai">Voice.ai</option>'+
 '<option value="browser">Browser speech</option></select></label>'+
 '<label>Available voice <select id="v4VoiceSelect"></select></label>'+
 '<p id="v4VoiceHint"></p><div class="v4-voice-sliders"><label>Speed <output id="v4RateLabel"></output>'+
 '<input id="v4Rate" type="range" min=".85" max="1.4" step=".05"></label>'+
 '<label>Pitch <output id="v4PitchLabel"></output>'+
 '<input id="v4Pitch" type="range" min=".8" max="1.35" step=".05"></label></div>'+
 '<div class="v4-voice-buttons"><button id="v4VoicePreview" type="button" class="v4-btn-primary">▶ Play sample</button>'+
 '<button id="v4VoiceStop" type="button" class="v4-btn-quiet">Stop</button></div></div></dialog>';
document.body.append(root);
const tour=$("#v4Tour"),editor=$("#v4HudEditor"),voiceEditor=$("#v4VoiceEditor");
function save(){const snapshot=JSON.parse(JSON.stringify(prefs));Promise.resolve(window.LightningAccount?.settings.set(KEY,snapshot)).catch(e=>console.warn("Lightning companion settings:",e.message))}
function init(){
 if(ready)return;
 const saved=window.LightningAccount?.settings.get(KEY,null);
 if(saved&&typeof saved==="object"){
  prefs={...defaults,...saved,hud:{...defaults.hud,...(saved.hud||{})}};
 }
 prefs.theme=["dark","light"].includes(prefs.theme)?prefs.theme:"dark";
 prefs.hud.side=["left","right","off"].includes(prefs.hud.side)?prefs.hud.side:"right";
 prefs.hud.scale=Math.max(75,Math.min(135,Number(prefs.hud.scale)||105));
 prefs.hud.x=Math.max(2,Math.min(90,Number(prefs.hud.x)||70));
 prefs.hud.y=Math.max(5,Math.min(90,Number(prefs.hud.y)||74));
 ready=true;apply();
 if(Number(prefs.tourVersion)<VERSION&&!tour.hidden)return;
 if(Number(prefs.tourVersion)<VERSION){
  // Give the real dashboard a chance to render before highlighting it.
  setTimeout(()=>begin(0),650);
 }
}
function apply(){
 const html=document.documentElement;
 html.dataset.chanTheme=prefs.theme;
 html.dataset.chanMotion=prefs.hud.motion?"yes":"no";
 html.dataset.chanSide=prefs.hud.side;
 html.dataset.chanCompact=prefs.hud.compact?"yes":"no";
 document.body.dataset.v4Sidebar=prefs.hud.sidebar;
 document.body.dataset.v4Announcements=prefs.hud.announcement?"on":"off";
 document.body.dataset.v4Shortcuts=prefs.hud.shortcuts?"on":"off";
 html.style.setProperty("--chan-scale",String(prefs.hud.scale/100));
 html.style.setProperty("--v4-widget-x",prefs.hud.x+"%");
 html.style.setProperty("--v4-widget-y",prefs.hud.y+"%");
 $("#v4Companion").hidden=prefs.hud.side==="off";
 $("#v4HudWidget").hidden=!prefs.hud.widget;
 $$("[data-v4-theme]").forEach(button=>{
  const pressed=button.dataset.v4Theme===prefs.theme;
  button.setAttribute("aria-pressed",String(pressed));
  button.classList.toggle("active",pressed);
 });
 $$("[data-v4-side]").forEach(button=>button.classList.toggle("active",button.dataset.v4Side===prefs.hud.side));
 $$("[data-v4-sidebar]").forEach(button=>button.classList.toggle("active",button.dataset.v4Sidebar===prefs.hud.sidebar));
 const preview=$("#v4PreviewMascot");
 if(preview){preview.style.left=prefs.hud.x+"%";preview.style.top=prefs.hud.y+"%";}
 $("#v4ShowAnnouncements").checked=!!prefs.hud.announcement;
 $("#v4ShowShortcuts").checked=!!prefs.hud.shortcuts;
 $("#v4ShowWidget").checked=!!prefs.hud.widget;
 $("#v4Motion").checked=!!prefs.hud.motion;
 $("#v4Scale").value=String(prefs.hud.scale);
 $("#v4ScaleLabel").textContent=prefs.hud.scale+"%";
 $("#v4VoiceToggle").checked=!!prefs.voice;
}
function setTheme(theme){
 if(!["dark","light"].includes(theme))return;
 prefs.theme=theme;save();apply();
 if(openTour&&steps[current].theme)renderStep();
}
function dashboard(){
 const card=$(".v5-announcement-card");
 if(card)return;
 // An existing quick action already opens Lightning's real overview.
 const go=$('#newtabView [data-hub="overview"]');
 if(go)go.click();
}
function targetForStep(){
 const selector=steps[current]?.target;
 return selector?$(selector):null;
}
function updateSpotlight(){
 if(!openTour)return;
 const focus=$("#v4TourSpotlight"),target=targetForStep();
 const backdrop=$(".v4-tour-backdrop");
 if(!target){focus.hidden=true;backdrop.style.clipPath="none";return;}
 const rect=target.getBoundingClientRect();
 if(rect.width<1||rect.height<1){focus.hidden=true;backdrop.style.clipPath="none";return;}
 focus.hidden=false;
 const pad=7;
 focus.style.left=Math.max(4,rect.left-pad)+"px";
 focus.style.top=Math.max(4,rect.top-pad)+"px";
 focus.style.width=Math.min(innerWidth-8,rect.width+pad*2)+"px";
 focus.style.height=Math.min(innerHeight-8,rect.height+pad*2)+"px";
 const x1=Math.max(0,rect.left-pad),y1=Math.max(0,rect.top-pad);
 const x2=Math.min(innerWidth,rect.right+pad),y2=Math.min(innerHeight,rect.bottom+pad);
 // The even-odd cutout leaves the actual interface visible.
 backdrop.style.clipPath="polygon(evenodd,0 0,100% 0,100% 100%,0 100%,0 0,"+
 x1+"px "+y1+"px,"+x1+"px "+y2+"px,"+x2+"px "+y2+"px,"+x2+"px "+y1+"px,"+x1+"px "+y1+"px)";
 const panel=$(".v4-tour-main");
 if(panel)tour.classList.toggle("v4-position-top",rect.top>innerHeight*.56);
}
function stepFeature(item){
 if(item.theme)return '<div class="v4-choice-heading"><strong>First, choose your preferred appearance!</strong>'+
  '<small>Both themes are fully usable. Change them later from the top-right toggle.</small></div>'+
  '<div class="v4-tour-themes"><button type="button" data-v4-theme="light" class="'+(prefs.theme==="light"?"active":"")+'">'+
  '<span class="v4-theme-demo light"><i></i><b></b><em></em></span>'+
  '<strong>☀ Light Mode</strong><small>Clean, bright and crisp</small><span class="v4-theme-check">'+(prefs.theme==="light"?"✓":"○")+'</span></button>'+
  '<button type="button" data-v4-theme="dark" class="'+(prefs.theme==="dark"?"active":"")+'">'+
  '<span class="v4-theme-demo dark"><i></i><b></b><em></em></span>'+
  '<strong>☾ Dark Mode</strong><small>Immersive, stylish and easy on your eyes</small><span class="v4-theme-check">'+(prefs.theme==="dark"?"✓":"○")+'</span></button></div>';
 if(current===0)return '<div class="v4-intro-grid"><div class="v4-tour-stat"><span>01</span><strong>Explore</strong><small>Everything in one place</small></div>'+
  '<div class="v4-tour-stat"><span>02</span><strong>Customize</strong><small>Your theme, your HUD</small></div>'+
  '<div class="v4-tour-stat"><span>03</span><strong>Ask</strong><small>Your own AI companion</small></div></div>';
 if(current===steps.length-1)return '<div class="v4-ready-card"><span>✦</span><strong>You are ready, Commander!</strong>'+
  '<p>Dark or light, the workspace is yours. I will be right here when you need me.</p></div>';
 const pointers=[
  ["→ Open the navigation", "Everything important stays within one click."],
  ["→ Read the latest news", "This is connected to actual announcements."],
  ["→ Browse with tabs", "The search bar and history still work."],
  ["→ Say hello", "Use community channels to chat."],
  ["→ Open the library", "Your saved links and activities are here."],
  ["→ Ask Lightning AI", "Real answers; your existing conversations."],
  ["→ Tune your layout", "The HUD editor applies changes live."],
  ["→ Make it personal", "Switch themes, voices and motion."]
 ];
 const pick=pointers[Math.max(0,current-2)]||pointers[0];
 return '<div class="v4-tour-tip"><span>✦ WHERE TO LOOK</span><strong>'+clean(pick[0])+'</strong>'+
  '<p>'+clean(pick[1])+'</p><div class="v4-tour-guide-actions">'+
  (current===8?'<button data-v4-open-hud type="button">Open HUD editor ↗</button>':"")+
  (current===7?'<button data-v4-open-ai type="button">Open AI chat ↗</button>':"")+
  (current===9?'<button data-v4-open-voice type="button">Voice studio ↗</button>':"")+
  '</div></div>';
}
function renderStep(){
 if(!openTour)return;
 const item=steps[current];
 tour.dataset.v4Stage=current>=2&&current<steps.length-1?"spotlight":"intro";
 $("#v4TourEyebrow").textContent="✧ FIRST-LAUNCH GUIDED TOUR · "+String(current+1).padStart(2,"0")+"/"+String(steps.length).padStart(2,"0");
 $("#v4TourTitle").textContent=item.title;
 $("#v4TourDetail").textContent=item.detail;
 $("#v4TourLine").textContent=item.line;
 $("#v4TourFeature").innerHTML=stepFeature(item);
 $("#v4TourBack").hidden=current===0;
 $("#v4TourNext").textContent=current===steps.length-1?"Finish & enter Lightning ↗":current===0?"Let's go →":"Next →";
 $("#v4TourProgress").innerHTML=steps.map((s,i)=>'<button type="button" aria-label="Go to '+clean(s.label)+'" data-v4-step="'+i+'"'+(i===current?' aria-current="step" class="active"':"")+'>'+
 '<span>'+String(i+1)+'</span><small>'+clean(s.label)+'</small></button>').join("");
 $("[data-v4-theme='dark']",$("#v4TourFeature"))?.setAttribute("aria-pressed",String(prefs.theme==="dark"));
 $("[data-v4-theme='light']",$("#v4TourFeature"))?.setAttribute("aria-pressed",String(prefs.theme==="light"));
 apply();requestAnimationFrame(updateSpotlight);
 if(item.ensureHome){dashboard();setTimeout(updateSpotlight,450);}
}
function begin(step=0){
 if(!ready)return;
 current=Math.max(0,Math.min(steps.length-1,step));
 openTour=true;tour.hidden=false;
 document.body.classList.add("v4-onboarding");
 dashboard();
 renderStep();
 const next=$("#v4TourNext");next?.focus({preventScroll:true});
 focusObserver?.disconnect();
 focusObserver=new MutationObserver(()=>{if(openTour)requestAnimationFrame(updateSpotlight)});
 focusObserver.observe($("#browserStage"),{childList:true,subtree:true});
 window.addEventListener("resize",updateSpotlight);
}
function stopSpeech(){
 voiceGeneration++;
 voiceRequest?.abort();voiceRequest=null;
 if(playing){playing.pause();playing.src="";playing=null;}
 if(audioUrl){URL.revokeObjectURL(audioUrl);audioUrl=null;}
 window.speechSynthesis?.cancel();
}
function endTour(){
 openTour=false;tour.hidden=true;
 $(".v4-tour-backdrop").style.clipPath="none";document.body.classList.remove("v4-onboarding");
 prefs.seen=true;prefs.tourVersion=VERSION;save();apply();
 stopSpeech();focusObserver?.disconnect();window.removeEventListener("resize",updateSpotlight);
 $("#v4Companion").focus({preventScroll:true});
}
function moveStep(next){
 stopSpeech();
 current=Math.max(0,Math.min(steps.length-1,next));
 renderStep();
 if(prefs.voice&&current>0)void speak(steps[current].line);
}
async function loadVoices(){
 if(voicesFetched||loadingVoices)return;
 loadingVoices=true;
 try{
  const response=await fetch("/api/chan/voices",{credentials:"same-origin",cache:"no-store"});
  const data=await response.json();
  voiceList=Array.isArray(data.voices)?data.voices:[];
  voicesFetched=!!data.configured;
  if(!prefs.voiceId&&voiceList.length){
   const preferred=voiceList.find(item=>/ellie|sakura|aria|anime|yuki|luna/i.test(item.name));
   if(preferred){prefs.voiceId=preferred.id;save();}
  }
 }catch(e){console.warn("Voice list unavailable:",e.message);}
 loadingVoices=false;
 if(voiceEditor.open)renderVoices();
}
function renderVoices(){
 $("#v4VoiceEngine").value=prefs.engine;
 const selector=$("#v4VoiceSelect");
 if(prefs.engine==="voiceai"){
  selector.innerHTML='<option value="">Voice.ai default</option>'+voiceList.map(v=>
   '<option value="'+clean(v.id)+'"'+(prefs.voiceId===v.id?" selected":"")+'>'+clean(v.name)+'</option>').join("");
  $("#v4VoiceHint").textContent=voicesFetched?
   "Choose a voice from your Voice.ai account. Preview with the button below.":
   "No Voice.ai voices available yet. Browser speech remains an option.";
 }else{
  const available=window.speechSynthesis?.getVoices().filter(v=>/^en/i.test(v.lang))||[];
  selector.innerHTML='<option value="">Automatic energetic English voice</option>'+available.map(v=>
   '<option value="'+clean(v.name)+'"'+(prefs.browserVoice===v.name?" selected":"")+'>'+clean(v.name)+'</option>').join("");
  $("#v4VoiceHint").textContent="Browser voices vary by operating system and device.";
 }
 $("#v4Rate").value=prefs.rate;$("#v4RateLabel").textContent=Number(prefs.rate).toFixed(2)+"×";
 $("#v4Pitch").value=prefs.pitch;$("#v4PitchLabel").textContent=Number(prefs.pitch).toFixed(2);
}
function voiceStudio(){
 if(!voiceEditor.open)voiceEditor.showModal();
 renderVoices();
 void loadVoices();
}
function browserSpeak(text){
 const speech=window.speechSynthesis;
 if(!speech||!window.SpeechSynthesisUtterance)return;
 const list=speech.getVoices().filter(v=>/^en/i.test(v.lang));
 const picked=list.find(v=>v.name===prefs.browserVoice)||list.find(v=>/aria|jenny|samantha|ava|karen|zira/i.test(v.name))||list[0];
 const line=new SpeechSynthesisUtterance(text);
 if(picked)line.voice=picked;
 line.rate=Number(prefs.rate)||1.1;line.pitch=Number(prefs.pitch)||1.1;
 speech.speak(line);
}
async function speak(input,manual=false){
 if(!prefs.voice&&!manual)return;
 stopSpeech();
 const text=String(input||"").replace(/https?:\/\/\S+/gi,"a website link").replace(/[#*_>\[\]]/g," ").replace(/\s+/g," ").trim().slice(0,500);
 if(!text)return;
 if(prefs.engine==="voiceai"){
  const generation=voiceGeneration;
  const controller=new AbortController();voiceRequest=controller;
  try{
   const response=await fetch("/api/chan/speech",{method:"POST",credentials:"same-origin",signal:controller.signal,
    headers:{"Content-Type":"application/json"},body:JSON.stringify({text,...(prefs.voiceId?{voiceId:prefs.voiceId}:{})})});
   if(!response.ok)throw Error("Voice.ai speech request failed");
   const blob=await response.blob();
   if(generation!==voiceGeneration)return;
   audioUrl=URL.createObjectURL(blob);
   playing=new Audio(audioUrl);
   playing.onended=()=>stopSpeech();
   await playing.play();
   return;
  }catch(e){if(generation!==voiceGeneration)return;console.warn("Using browser voice:",e.message)}
 }
 browserSpeak(text);
}
function openAi(){
 endTourIfNeeded();
 const bubble=$("#boltBubble");
 if(bubble&&$("#boltAiPanel")?.getAttribute("aria-hidden")!=="false")bubble.click();
 requestAnimationFrame(()=>$("#boltAiInput")?.focus());
}
function endTourIfNeeded(){if(openTour)endTour()}
function openHud(){
 endTourIfNeeded();
 if(!editor.open)editor.showModal();
 apply();
}
function openGuide(){if(!ready)init();begin(0);}
function clickRoot(event){
 const button=event.target.closest("button");if(!button)return;
 if(button.id==="v4Companion"){openGuide();return}
 if(button.hasAttribute("data-v4-theme")){setTheme(button.dataset.v4Theme);return}
 if(button.hasAttribute("data-v4-side")){prefs.hud.side=button.dataset.v4Side;save();apply();return}
 if(button.hasAttribute("data-v4-sidebar")){prefs.hud.sidebar=button.dataset.v4Sidebar;save();apply();return}
 if(button.hasAttribute("data-v4-step")){moveStep(Number(button.dataset.v4Step));return}
 if(button.hasAttribute("data-v4-open-hud")){openHud();return}
 if(button.hasAttribute("data-v4-open-ai")){openAi();return}
 if(button.hasAttribute("data-v4-open-voice")){voiceStudio();return}
 switch(button.id){
  case "v4TourNext":if(current>=steps.length-1)endTour();else moveStep(current+1);return;
  case "v4TourBack":moveStep(current-1);return;
  case "v4TourClose":case "v4TourSkip":endTour();return;
  case "v4LinePlay":void speak(steps[current].line,true);return;
  case "v4TourVoiceSettings":voiceStudio();return;
  case "v4EditorClose":case "v4EditorSave":editor.close();return;
  case "v4EditorReset":prefs.hud={...defaults.hud};save();apply();return;
  case "v4VoiceClose":voiceEditor.close();return;
  case "v4VoicePreview":void speak("Welcome to Lightning! I'm Lightning-chan! Let's make this place absolutely awesome!",true);return;
  case "v4VoiceStop":stopSpeech();return;
  case "v4HudClose":prefs.hud.widget=false;save();apply();return;
 }
 if(button.dataset.v4Jump==="announcements"){$("#v4NavHome")?.click();}
 if(button.dataset.v4Jump==="assistant")openAi();
}
root.addEventListener("click",clickRoot);
root.addEventListener("change",event=>{
 const input=event.target;
 if(input.id==="v4VoiceToggle")prefs.voice=input.checked;
 else if(input.id==="v4VoiceEngine"){prefs.engine=input.value;renderVoices();void loadVoices();}
 else if(input.id==="v4VoiceSelect"){
  if(prefs.engine==="voiceai")prefs.voiceId=input.value;else prefs.browserVoice=input.value;
 }else if(input.id==="v4ShowAnnouncements")prefs.hud.announcement=input.checked;
 else if(input.id==="v4ShowShortcuts")prefs.hud.shortcuts=input.checked;
 else if(input.id==="v4ShowWidget")prefs.hud.widget=input.checked;
 else if(input.id==="v4Motion")prefs.hud.motion=input.checked;
 else return;
 save();apply();
});
root.addEventListener("input",event=>{
 const input=event.target;
 if(input.id==="v4Scale")prefs.hud.scale=Number(input.value);
 else if(input.id==="v4Rate")prefs.rate=Number(input.value);
 else if(input.id==="v4Pitch")prefs.pitch=Number(input.value);
 else return;
 save();apply();if(voiceEditor.open)renderVoices();
});
document.addEventListener("click",event=>{
 const button=event.target.closest("button");if(!button||root.contains(button))return;
 if(button.hasAttribute("data-v4-theme")){setTheme(button.dataset.v4Theme);return;}
 if(button.hasAttribute("data-v4-tour")){openGuide();return;}
 if(button.hasAttribute("data-v4-hud")){openHud();return;}
 if(button.hasAttribute("data-v4-ai")){openAi();return;}
 if(button.hasAttribute("data-v4-browser")){
  $("#hubMount").hidden=true;$("#newTabBtn")?.click();return;
 }
 if(button.hasAttribute("data-v4-home")){dashboard();return;}
 if(button.hasAttribute("data-chan-open"))openGuide();
});
document.addEventListener("keydown",event=>{
 if((event.ctrlKey||event.metaKey)&&event.shiftKey&&event.key.toLowerCase()==="l"){
  event.preventDefault();openGuide();
 }
 if(event.key==="Escape"&&openTour)endTour();
});
// The editor and live HUD share the same account-backed drag coordinates.
function attachDrag(handle,area,commit){
 let start=null;
 handle.addEventListener("pointerdown",event=>{
  if(event.button!==0||event.target.closest("button"))return;
  start={pointer:event.pointerId};
  handle.setPointerCapture?.(event.pointerId);
  event.preventDefault();
 });
 handle.addEventListener("pointermove",event=>{
  if(!start||event.pointerId!==start.pointer)return;
  const box=area.getBoundingClientRect();
  if(!box.width||!box.height)return;
  const x=Math.max(6,Math.min(94,(event.clientX-box.left)/box.width*100));
  const y=Math.max(8,Math.min(92,(event.clientY-box.top)/box.height*100));
  commit(x,y);
 });
 const finish=()=>{if(start){start=null;save();}};
 handle.addEventListener("pointerup",finish);
 handle.addEventListener("pointercancel",finish);
}
attachDrag($("#v4PreviewMascot"),$("#v4PreviewScreen"),(x,y)=>{
 prefs.hud.x=x;prefs.hud.y=y;apply();
});
attachDrag($("#v4HudDrag"),document.documentElement,(x,y)=>{
 prefs.hud.x=x;prefs.hud.y=y;apply();
});
const clock=$("#v4HudClock");
function updateClock(){if(clock)clock.textContent=new Intl.DateTimeFormat(undefined,{hour:"numeric",minute:"2-digit"}).format(new Date());}
updateClock();
setInterval(updateClock,30000);
window.addEventListener("resize",updateSpotlight);
document.addEventListener("lightning:account-settings-loaded",init);
document.addEventListener("lightning:workspace-ready",()=>{if(openTour)requestAnimationFrame(updateSpotlight)});
document.addEventListener("lightning:ai-answer",event=>{if(event.detail?.text)void speak(event.detail.text)});
window.LightningChan={open:openGuide,openTour:openGuide,openHUD:openHud,openVoice:voiceStudio,speak,stop:stopSpeech};
})();
