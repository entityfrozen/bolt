(()=>{
"use strict";
if(!document.getElementById("boltShell"))return;
const KEY="chan.settings";
const $=(s,r=document)=>r.querySelector(s);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const defaults={seen:false,theme:"dark",voice:false,engine:"browser",voiceId:"",browserVoice:"",
 rate:1.12,pitch:1.1,hud:{side:"right",scale:100,compact:false,motion:true}};
const steps=[
 ["Welcome to Lightning.","I'm Lightning-chan! I'll help you find everything without getting in your way.","We can start with the basics. You can skip or replay this tour."],
 ["Choose your look.","Want a lighter workspace or a purple midnight theme? Pick what feels right.","Open Themes to swap between light and dark. It's saved to your account."],
 ["Meet the browser.","The address bar and tabs are at the top. Search, browse, and bookmark from there.","Ctrl+L focuses the address bar. Ctrl+T opens a new tab."],
 ["Explore the rail.","Community, Library, Updates and Settings live on the left side of Lightning.","Those tools are already part of your workspace; no separate accounts."],
 ["Edit the HUD.","Move my launcher, change its size, or hide it. You can also turn off movement.","You can come back to HUD Editor whenever you need."],
 ["Ask me anything!","I use Lightning's existing AI conversations, so your chats stay together.","Turn on voicelines if you want to hear me answer, too."]
];
const features=[
 ["guide","◇","Guided tour","Learn the new workspace"],
 ["assistant","✧","AI assistant","Ask questions with Lightning AI"],
 ["voice","◖))","Voicelines","Choose my voice"],
 ["themes","◐","Light / Dark","Switch up the atmosphere"],
 ["hud","☷","HUD editor","Arrange my launcher"],
 ["workspace","▱","Workspace guide","Find your way around"]
];
let state=JSON.parse(JSON.stringify(defaults)),loaded=false,shown=false,page="home",step=0;
let voices=[],providerReady=false,audio=null,objectUrl=null,loadingVoices=false;
const root=document.createElement("div");
root.id="lightningChanRoot";
root.innerHTML='<button type="button" id="chanLauncher" aria-label="Open Lightning-chan" title="Lightning-chan">'+
 '<img src="/assets/lightning-chan.svg" alt=""><span>✦</span></button>'+
 '<dialog id="chanStudio" aria-label="Lightning-chan studio"><div class="chan-shell">'+
 '<aside class="chan-sidebar"><div class="chan-brand"><i>ϟ</i><span><strong>Lightning</strong><small>STUDIO / v3.0</small></span></div>'+
 '<nav aria-label="Lightning-chan features">'+
 '<button data-chan-page="home">⌂ <span>Welcome</span></button>'+
 '<button data-chan-page="guide">◇ <span>Guided tour</span></button>'+
 '<button data-chan-page="assistant">✧ <span>AI assistant</span></button>'+
 '<button data-chan-page="voice">◖)) <span>Voice studio</span></button>'+
 '<button data-chan-page="themes">◐ <span>Themes</span></button>'+
 '<button data-chan-page="hud">☷ <span>HUD editor</span></button>'+
 '<button data-chan-page="workspace">▱ <span>Workspace guide</span></button></nav>'+
 '<footer><span>● COMPANION ONLINE</span><button data-chan-do="close">← Return to Lightning</button></footer></aside>'+
 '<main class="chan-main"><header class="chan-top"><span>LIGHTNING <b>/</b> <em id="chanLocation"></em></span>'+
 '<div><small>VERSION 3.0</small><button data-chan-do="close" aria-label="Close studio">✕</button></div></header>'+
 '<div class="chan-content" id="chanContent"></div></main>'+
 '<aside class="chan-character"><span class="chan-character-kicker">✦ SYSTEM COMPANION / READY</span>'+
 '<div class="chan-orbit"></div><img src="/assets/lightning-chan.svg" alt="Lightning-chan, a silver-haired anime guide" class="chan-character-art">'+
 '<div class="chan-character-chat"><strong>⚡ Lightning-chan</strong><p id="chanSayLine"></p>'+
 '<button data-chan-do="chat">↗ Talk to me</button></div></aside></div></dialog>';
document.body.append(root);
const studio=$("#chanStudio"),content=$("#chanContent");
function save(){
 const settings=JSON.parse(JSON.stringify(state));
 Promise.resolve(window.LightningAccount?.settings.set(KEY,settings)).catch(e=>console.warn("Companion settings:",e.message));
}
function apply(){
 const html=document.documentElement;
 html.dataset.chanTheme=state.theme;
 html.dataset.chanSide=state.hud.side;
 html.dataset.chanCompact=state.hud.compact?"yes":"no";
 html.dataset.chanMotion=state.hud.motion?"yes":"no";
 html.style.setProperty("--chan-scale",String(state.hud.scale/100));
 $("#chanLauncher").hidden=state.hud.side==="off";
}
function load(){
 if(loaded)return;
 const stored=window.LightningAccount?.settings.get(KEY,null);
 if(stored&&typeof stored==="object"){
  state={...defaults,...stored,hud:{...defaults.hud,...(stored.hud||{})}};
 }
 if(!["light","dark"].includes(state.theme))state.theme="dark";
 if(!["left","right","off"].includes(state.hud.side))state.hud.side="right";
 state.hud.scale=Math.max(75,Math.min(135,Number(state.hud.scale)||100));
 loaded=true;apply();
 if(!state.seen&&!shown){shown=true;step=0;open("guide");}
}
function open(next="home"){
 page=next;
 if(!studio.open)studio.showModal();
 draw();
 if(page==="voice")void loadVoices();
}
function stop(){
 if(audio){audio.pause();audio.currentTime=0;audio=null;}
 if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl=null;}
 window.speechSynthesis?.cancel();
}
function close(){stop();if(studio.open)studio.close();}
const header=(eyebrow,title,desc)=>'<div class="chan-heading"><span>'+eyebrow+'</span><h1>'+title+'</h1><p>'+desc+'</p></div>';
function home(){
 return '<section class="chan-hero"><small>⚡ WELCOME TO LIGHTNING v3</small>'+
 '<h1>Meet your new <em>sidekick.</em></h1>'+
 '<p>Hey! I’m Lightning-chan. Need a hand finding things, setting up your space, or asking AI a question? I’m right here.</p>'+
 '<div class="chan-hero-actions"><button class="chan-primary" data-chan-page="guide">▷ Start guided tour →</button>'+
 '<button class="chan-secondary" data-chan-do="close">Enter workspace</button></div>'+
 '<span class="chan-hero-end">NEW LOOK · MORE CONTROL · ONE FRIENDLY GUIDE</span></section>'+
 '<div class="chan-features">'+features.map(([key,mark,title,desc])=>
 '<button data-chan-page="'+key+'"><i>'+mark+'</i><strong>'+title+'</strong><small>'+desc+'</small><b>↗</b></button>').join("")+'</div>';
}
function guide(){
 const [title,line,tip]=steps[step];
 return header("GUIDED TOUR / "+(step+1)+" OF "+steps.length,title,line)+
 '<div class="chan-tour-card"><div class="chan-tour-symbol">ϟ</div><span>LIGHTNING QUICK START</span>'+
 '<h2>'+tip+'</h2>'+
 '<div class="chan-tour-dots">'+steps.map((item,i)=>'<button type="button" aria-label="Step '+(i+1)+'" data-chan-step="'+i+'" class="'+(i===step?"current":"")+'"></button>').join("")+'</div>'+
 '<div class="chan-tour-actions">'+(step?
 '<button class="chan-secondary" data-chan-do="back">← Back</button>':
 '<button class="chan-secondary" data-chan-do="skip">Skip</button>')+
 '<button class="chan-primary" data-chan-do="next">'+(step===steps.length-1?"Finish tour":"Continue →")+'</button></div></div>'+
 '<p class="chan-hint">You can replay this tour any time from Lightning-chan.</p>';
}
function themes(){
 return header("PERSONALIZATION / COLOR","Pick your atmosphere.","Two looks, one workspace. Switch themes whenever you want.")+
 '<div class="chan-themes"><button data-chan-theme="dark" class="'+(state.theme==="dark"?"selected":"")+'">'+
 '<span class="chan-theme-sample dark"><i></i><b></b><em></em></span><strong>Midnight voltage</strong>'+
 '<small>Deep navy, violet and bright accents</small></button>'+
 '<button data-chan-theme="light" class="'+(state.theme==="light"?"selected":"")+'">'+
 '<span class="chan-theme-sample light"><i></i><b></b><em></em></span><strong>Daybreak</strong>'+
 '<small>Warm white with lavender highlights</small></button></div>'+
 '<p class="chan-hint">Theme preferences are saved to your Lightning account.</p>';
}
function hud(){
 const sides=[["left","Left"],["right","Right"],["off","Hidden"]];
 return header("PERSONALIZATION / HUD","Your workspace, your rules.","Adjust the assistant position, size and effects without losing any functionality.")+
 '<div class="chan-hud-layout"><div class="chan-hud-preview"><span>LIVE PREVIEW</span><i class="'+state.hud.side+'">✦</i></div>'+
 '<div class="chan-controls"><label><b>Assistant location</b><div class="chan-choice">'+sides.map(([v,label])=>
 '<button type="button" class="'+(state.hud.side===v?"active":"")+'" data-chan-side="'+v+'">'+label+'</button>').join("")+'</div></label>'+
 '<label><b>Launcher size <output id="chanScaleLabel">'+state.hud.scale+'%</output></b>'+
 '<input type="range" id="chanScale" min="75" max="135" step="5" value="'+state.hud.scale+'"></label>'+
 '<label class="chan-checkbox"><span><b>Compact launcher</b><small>Less space, same assistant.</small></span>'+
 '<input type="checkbox" id="chanCompact" '+(state.hud.compact?"checked":"")+'></label>'+
 '<label class="chan-checkbox"><span><b>Animated effects</b><small>Optional hover and glow movement.</small></span>'+
 '<input type="checkbox" id="chanMotion" '+(state.hud.motion?"checked":"")+'></label></div></div>'+
 '<button data-chan-do="reset" class="chan-secondary">Restore default HUD</button>';
}
function assistant(){
 return header("ASSISTANT / AI","Ask me anything.","I use your existing Lightning AI chat. Your saved conversations stay in the same place.")+
 '<div class="chan-assistant-card"><strong>✧ Hey! What are we working on?</strong>'+
 '<p>Ask me about coding, schoolwork, finding a setting, or just brainstorm with me.</p>'+
 '<button class="chan-primary" data-chan-do="chat">Open our conversation →</button></div>'+
 '<p class="chan-hint">Voice playback is optional. Turn it on in Voice studio.</p>';
}
function workspace(){
 const items=[["Browser & tabs","Search and open pages from the top address bar. Bookmarks sit beside it."],
 ["Community","Open the chat icon in the left rail to get to channels and friends."],
 ["Library","Find activities and saved links through the library rail icon."],
 ["Appearance","Use the gear icon for glass, accent color, layout and other settings."],
 ["Staff tools","Staff accounts can open the separate admin console from the rail or account menu."],
 ["Lightning-chan","The floating launcher brings you back here for help or customization."]];
 return header("NAVIGATION / WORKSPACE","Everything in its place.","Here’s the quick map. You can explore the rest at your own pace.")+
 '<div class="chan-map">'+items.map(([title,desc],i)=>'<div><span>'+String(i+1).padStart(2,"0")+
 '</span><section><strong>'+title+'</strong><p>'+desc+'</p></section></div>').join("")+'</div>'+
 '<p class="chan-hint">KEYBOARD SHORTCUTS · Ctrl+L: address bar · Ctrl+T: new tab</p>';
}
function voice(){
 const browserVoices=window.speechSynthesis?.getVoices().filter(v=>/^en/i.test(v.lang))||[];
 const list=state.engine==="voiceai"?'<option value="">Default Voice.ai voice</option>'+
 voices.map(item=>'<option value="'+esc(item.id)+'"'+(state.voiceId===item.id?" selected":"")+'>'+esc(item.name)+'</option>').join(""):
 '<option value="">Automatically choose a bright voice</option>'+browserVoices.map(item=>
 '<option value="'+esc(item.name)+'"'+(item.name===state.browserVoice?" selected":"")+'>'+
 esc(item.name)+' ('+esc(item.lang)+')</option>').join("");
 return header("VOICE STUDIO / SOUND","Let me speak.","Listen to a sample first, then choose an energetic voice that feels right.")+
 '<div class="chan-voice-layout"><div class="chan-voice-preview"><div class="chan-wave">'+Array(9).fill("<i></i>").join("")+'</div>'+
 '<span>VOICE PREVIEW / LIGHTNING-CHAN</span><h2>Bright, warm, and a little electric.</h2>'+
 '<p>I’ll speak only when you enable voicelines or press Play sample.</p>'+
 '<button class="chan-primary" data-chan-do="preview">▷ Play sample</button>'+
 '<button class="chan-secondary" data-chan-do="stop">Stop</button></div>'+
 '<div class="chan-controls"><label class="chan-checkbox"><span><b>Voice replies</b><small>Read AI answers aloud.</small></span>'+
 '<input id="chanVoiceEnabled" type="checkbox" '+(state.voice?"checked":"")+'></label>'+
 '<label><b>Voice engine</b><div class="chan-choice">'+
 '<button class="'+(state.engine==="browser"?"active":"")+'" data-chan-engine="browser">Browser</button>'+
 '<button class="'+(state.engine==="voiceai"?"active":"")+'" data-chan-engine="voiceai">Voice.ai</button></div></label>'+
 '<label><b>Voice</b><select id="chanVoiceSelect">'+list+'</select></label>'+
 '<p class="chan-hint">'+(state.engine==="voiceai"?
 (providerReady?"Voice.ai is connected. Choose from your available voices.":"Voice.ai requires VOICEAI_API_KEY on Railway. Browser speech remains available."):
 "Browser voices depend on the device. Lightning-chan will prefer a lively English voice.")+'</p>'+
 '<label><b>Speed <output id="chanRateOut">'+Number(state.rate).toFixed(2)+'×</output></b>'+
 '<input type="range" id="chanRate" min=".8" max="1.4" step=".05" value="'+state.rate+'"></label>'+
 '<label><b>Pitch <output id="chanPitchOut">'+Number(state.pitch).toFixed(2)+'</output></b>'+
 '<input type="range" id="chanPitch" min=".8" max="1.4" step=".05" value="'+state.pitch+'"></label></div></div>';
}
function draw(){
 $("#chanLocation").textContent=({home:"Welcome",guide:"Guided tour",assistant:"AI assistant",voice:"Voice studio",
 themes:"Themes",hud:"HUD editor",workspace:"Workspace guide"})[page];
 root.querySelectorAll("[data-chan-page]").forEach(button=>button.classList.toggle("active",button.dataset.chanPage===page));
 content.innerHTML=({home,guide,assistant,voice,themes,hud,workspace}[page]||home)();
 $("#chanSayLine").textContent=page==="guide"?steps[step][1]:({
 home:"Hey! Ready to explore Lightning?",assistant:"Got a question? Ask away!",voice:"Let's find the right voice!",
 themes:"Dark or light? Your call!",hud:"Make the HUD fit your style.",workspace:"I've got the map memorized!"})[page];
}
async function loadVoices(){
 if(loadingVoices||providerReady)return;
 loadingVoices=true;
 try{
  const res=await fetch("/api/chan/voices",{credentials:"same-origin",cache:"no-store"});
  const data=await res.json();
  providerReady=Boolean(data.configured);
  voices=Array.isArray(data.voices)?data.voices:[];
  if(!state.voiceId&&voices.length){const pick=voices.find(v=>/ellie|flora|sakura/i.test(v.name));if(pick){state.voiceId=pick.id;save();}}
 }catch{voices=[];}
 loadingVoices=false;
 if(page==="voice"&&studio.open)draw();
}
function finish(){state.seen=true;save();page="home";draw();}
function openChat(){
 close();
 const bubble=$("#boltBubble");
 if(bubble&&$("#boltAiPanel")?.getAttribute("aria-hidden")!=="false")bubble.click();
 requestAnimationFrame(()=>$("#boltAiInput")?.focus());
}
function browserSpeak(text){
 if(!window.speechSynthesis||!window.SpeechSynthesisUtterance)return;
 const voices=window.speechSynthesis.getVoices().filter(v=>/^en/i.test(v.lang));
 const preferred=voices.find(v=>v.name===state.browserVoice)||
  voices.find(v=>/jenny|aria|samantha|ava|zira|karen/i.test(v.name))||voices[0];
 const speech=new SpeechSynthesisUtterance(text);
 if(preferred)speech.voice=preferred;
 speech.rate=Number(state.rate)||1.1;speech.pitch=Number(state.pitch)||1.1;
 window.speechSynthesis.speak(speech);
}
async function speak(message,manual=false){
 if(!state.voice&&!manual)return;
 stop();
 const clean=String(message||"").replace(/https?:\/\/\S+/g,"website link").replace(/[#*_\[\]>]/g," ").replace(/\s+/g," ").trim().slice(0,500);
 if(!clean)return;
 if(state.engine==="voiceai"){
  try{
   const res=await fetch("/api/chan/speech",{method:"POST",credentials:"same-origin",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({text:clean,...(state.voiceId?{voiceId:state.voiceId}:{})})});
   if(!res.ok)throw Error("Voice.ai unavailable");
   objectUrl=URL.createObjectURL(await res.blob());
   audio=new Audio(objectUrl);
   audio.onended=stop;
   await audio.play();
   return;
  }catch(error){console.warn("Voice fallback:",error.message);}
 }
 browserSpeak(clean);
}
root.addEventListener("click",event=>{
 const button=event.target.closest("button");if(!button)return;
 if(button.id==="chanLauncher"){open();return;}
 if(button.dataset.chanPage){
  page=button.dataset.chanPage;if(page==="guide")step=0;draw();if(page==="voice")void loadVoices();return;
 }
 if(button.dataset.chanTheme){state.theme=button.dataset.chanTheme;save();apply();draw();return;}
 if(button.dataset.chanSide){state.hud.side=button.dataset.chanSide;save();apply();draw();return;}
 if(button.dataset.chanEngine){state.engine=button.dataset.chanEngine;state.voiceId="";save();draw();if(state.engine==="voiceai")void loadVoices();return;}
 if(button.dataset.chanStep!==undefined){step=Number(button.dataset.chanStep)||0;draw();return;}
 switch(button.dataset.chanDo){
  case "close":state.seen=true;save();close();break;
  case "skip":finish();break;
  case "back":step=Math.max(0,step-1);draw();break;
  case "next":if(step===steps.length-1)finish();else{step++;draw();}break;
  case "chat":openChat();break;
  case "stop":stop();break;
  case "preview":void speak("Hey! I'm Lightning-chan. Ready to make this workspace awesome? Let's go!",true);break;
  case "reset":state.hud={...defaults.hud};save();apply();draw();break;
 }
});
root.addEventListener("change",event=>{
 const item=event.target;
 if(item.id==="chanVoiceEnabled")state.voice=item.checked;
 else if(item.id==="chanCompact")state.hud.compact=item.checked;
 else if(item.id==="chanMotion")state.hud.motion=item.checked;
 else if(item.id==="chanVoiceSelect"){
  if(state.engine==="voiceai")state.voiceId=item.value;
  else state.browserVoice=item.value;
 }else return;
 save();apply();
});
root.addEventListener("input",event=>{
 const item=event.target;
 if(item.id==="chanScale"){
  state.hud.scale=Number(item.value);$("#chanScaleLabel").textContent=item.value+"%";apply();
 }else if(item.id==="chanRate"||item.id==="chanPitch"){
  const key=item.id==="chanRate"?"rate":"pitch",output=item.id==="chanRate"?"#chanRateOut":"#chanPitchOut";
  state[key]=Number(item.value);$(output).textContent=state[key].toFixed(2)+(key==="rate"?"×":"");
 }else return;
 save();
});
document.addEventListener("lightning:ai-answer",event=>{if(event.detail?.text)void speak(event.detail.text);});
document.addEventListener("lightning:account-settings-loaded",load);
document.addEventListener("click",event=>{if(event.target.closest("[data-chan-open]"))open("home");});
document.addEventListener("keydown",event=>{if(event.ctrlKey&&event.shiftKey&&event.key.toLowerCase()==="l"){event.preventDefault();open("home");}});
window.LightningChan={open,openTour:()=>{step=0;open("guide")},openHUD:()=>open("hud"),speak,stop};
})();
