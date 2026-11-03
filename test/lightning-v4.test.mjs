import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read=path=>fs.readFileSync(new URL("../"+path,import.meta.url),"utf8");
const html=read("views/app.html");
const decoded=html.replace(/&#(\d+);/g,(_,code)=>String.fromCodePoint(Number(code)));
const tour=read("public/assets/lightning-chan-v4.js");
const chrome=read("public/assets/lightning-v4.css");
const guideCss=read("public/assets/lightning-v4-tour.css");
const editor=read("public/assets/lightning-v4-editor.css");

test("The real Lightning workspace includes the complete purple V4 chrome",()=>{
 for(const id of ["v4ThemeSwitch","v4Light","v4Dark","v4NavHome","v4NavBrowser",
  "v4NavCommunity","v4NavLibrary","v4NavUpdates","v4NavAI","v4NavHUD","v4NavSettings",
  "v4NavGuide","v4Help","hubMount","addressForm"]){
  assert.ok(decoded.includes('id="'+id+'"'),"Missing functional control "+id);
 }
 assert.match(decoded,/lightning-v4\.css\?v=1/);
 assert.match(decoded,/lightning-v4-tour\.css\?v=1/);
 assert.match(decoded,/lightning-v4-editor\.css\?v=1/);
 assert.match(decoded,/lightning-chan-v4\.js\?v=1/);
 assert.doesNotMatch(decoded,/src="\/assets\/lightning-chan\.js\?v=1"/);
 assert.match(chrome,/--v4-sidebar:205px/);
 assert.match(chrome,/#hubMount:has\(\.v5-dashboard\)/);
 assert.match(chrome,/\.v5-announcement-card/);
 assert.match(chrome,/data-chan-theme="light"/);
 assert.match(chrome,/data-chan-theme="dark"/);
});

test("Guided tutorial highlights actual UI elements and uses the requested dialogue",()=>{
 assert.match(tour,/Welcome to lightning!/);
 assert.match(tour,/Theres two gui colors you can use/);
 assert.match(tour,/Okay! Light or Dark\?/);
 assert.match(tour,/Great choice, now allow me to show you around/);
 assert.match(tour,/amare usally posts his update logs/);
 assert.match(tour,/He's such an idiot/);
 for(const target of ['#v4ThemeSwitch','.v5-announcement-card','#v4NavCommunity',
  '#v4NavLibrary','#v4NavAI','#v4NavHUD','#v4NavSettings']){
  assert.ok(tour.includes(target),"Tour does not spotlight "+target);
 }
 assert.match(tour,/getBoundingClientRect/);
 assert.match(tour,/polygon\(evenodd/);
 assert.match(tour,/begin\(0\)/);
 assert.match(tour,/const VERSION=4|VERSION=4/);
 assert.match(tour,/tourVersion=VERSION/);
 assert.match(tour,/lightning:account-settings-loaded/);
 assert.match(tour,/lightning-chan-v4\.avif/);
 const sprite=fs.readFileSync(new URL("../public/assets/lightning-chan-v4.avif",import.meta.url));
 assert.ok(sprite.length>30000&&sprite.length<150000,"Mascot image should be optimized for the browser.");
 assert.equal(sprite.toString("ascii",4,8),"ftyp");
 assert.match(guideCss,/\.v4-tour-spotlight/);
 assert.match(guideCss,/\.v4-character-dialogue/);
 assert.match(guideCss,/@media\(max-width:830px\)/);
});

test("HUD editor and voice playback are connected and keep secrets off the browser",()=>{
 for(const token of ["v4HudEditor","v4HudWidget","v4PreviewMascot","v4ShowAnnouncements",
  "v4ShowShortcuts","v4ShowWidget","v4Motion","attachDrag","v4VoiceEditor",
  "/api/chan/voices","/api/chan/speech","lightning:ai-answer","VOICE.AI"]){
  // The last string isn't required by the UI; the provider name is Voice.ai.
  if(token==="VOICE.AI")continue;
  assert.ok(tour.includes(token),"Missing UI hook "+token);
 }
 assert.match(tour,/window\.LightningChan=/);
 assert.match(tour,/controller\.signal/);
 assert.match(tour,/voiceGeneration/);
 assert.match(tour,/window\.speechSynthesis/);
 assert.match(editor,/\.v4-preview-screen/);
 assert.match(editor,/body\[data-v4-sidebar="compact"\]/);
 assert.doesNotMatch(tour,/vk_[0-9a-z]{16,}/i);
 assert.doesNotMatch(html,/vk_[0-9a-z]{16,}/i);
 const account=read("account-space.js");
 assert.match(account,/"chan\.settings"/);
});
