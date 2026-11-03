import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read=path=>fs.readFileSync(new URL("../"+path,import.meta.url),"utf8");
const html=read("views/app.html");
const decoded=html.replace(/&#(\d+);/g,(_,number)=>String.fromCodePoint(Number(number)));
const source=read("public/assets/lightning-v5.js");
const css=read("public/assets/lightning-v5.css");
const novelCss=read("public/assets/lightning-v5-novel.css");

test("V5 replaces V4 overlay assets, preserving real browser, account and staff hooks",()=>{
 assert.match(decoded,/lightning-v5\.js\?v=2/);
 assert.match(decoded,/lightning-v5\.css\?v=2/);
 assert.match(decoded,/lightning-v5-novel\.css\?v=1/);
 assert.doesNotMatch(decoded,/src="\/assets\/lightning-chan-v4\.js/);
 assert.doesNotMatch(decoded,/href="\/assets\/lightning-v4\.css/);
 for(const id of ["boltShell","hubMount","tabs","newTabBtn","addressForm","accountButton",
  "v4NavHome","v4NavBrowser","v4NavCommunity","v4NavLibrary","v4NavUpdates",
  "v4NavAI","v4NavHUD","v4NavSettings","v4Help"]){
  assert.ok(decoded.includes('id="'+id+'"'),"Missing existing functionality hook: "+id);
 }
 assert.match(css,/--l5-rail:/);
 assert.match(css,/\.l5-welcome-banner/);
 assert.match(css,/\.v5-announcement-card/);
 assert.match(css,/html\[data-l5-theme="dark"\]/);
 assert.match(source,/import\('\/assets\/hub\.js\?v=48'\)/);
});

test("Lightning-chan is page selective: home, library, assistant, and tutorial",()=>{
 for(const token of ["upgradeHome()","decorateLibrary()","decorateAi()",
  "updateCharacterVisibility()","l5-hero-character","l5-library-character",
  "l5-ai-character","l5-tour-character"]){
  assert.ok(source.includes(token),"Missing selective placement "+token);
 }
 assert.match(source,/Never shown over web pages, DMs, games or the admin console/);
 assert.match(source,/scene = 'browser'/);
 assert.match(source,/prefs\.hud\.homeMascot/);
 assert.match(source,/prefs\.hud\.libraryMascot/);
 assert.match(source,/prefs\.hud\.aiMascot/);
 assert.match(source,/if \(hero\) hero\.hidden = !prefs\.hud\.homeMascot \|\| touring/);
 assert.match(css,/body\.app-page \.browser-stage/);
});

test("Sprite atlas supports 5 poses and mouth-only speech changes, with closed idle state",()=>{
 const data=fs.readFileSync(new URL("../public/assets/lightning-chan-v5-sprites.webp",import.meta.url));
 assert.ok(data.length>200000&&data.length<1500000,"Sprite atlas should be optimized for browsers");
 assert.equal(data.toString("ascii",0,4),"RIFF");
 assert.equal(data.toString("ascii",8,12),"WEBP");
 assert.match(css,/background-size:500% 200%/);
 for(const percent of ["0%","25%","50%","75%","100%"]){
  assert.ok(css.includes("background-position-x:"+percent),"Pose index "+percent);
 }
 assert.match(css,/\.l5-character\[data-speaking="true"\] \.l5-character-art\{background-position-y:100%\}/);
 assert.match(source,/audio\.onplaying = \(\) => \{ if \(token === speechToken\) mouth\(true\)/);
 assert.match(source,/audio\.onended = \(\) => \{ if \(token === speechToken\) stopSpeech\(\)/);
 assert.match(source,/line\.onstart = \(\) => \{ if \(token === speechToken\) mouth\(true\)/);
 assert.match(source,/line\.onend = line\.onerror = \(\) => \{ if \(token === speechToken\) mouth\(false\)/);
 assert.match(source,/window\.speechSynthesis\?\.cancel\(\)/);
 assert.match(source,/mouth\(false\);/);
 assert.doesNotMatch(source,/vk_[a-zA-Z0-9]{24,}/);
});

test("Visual-novel tour has exact dialogue, theme choice and first-run persistence",()=>{
 for(const line of ["Welcome to lightning!",
  "Theres two gui colors you can use, let me just pull those up... Okay! Light or Dark?",
  "Great choice, now allow me to show you around.",
  "Heres annoucements, altough amare usally posts his update logs in there for some reason.. He's such an idiot"]){
  assert.ok(source.includes(line),"Missing requested dialogue "+line);
 }
 assert.match(source,/TOUR_VERSION = 5/);
 assert.match(source,/prefs\.tourVersion = TOUR_VERSION/);
 assert.match(source,/lightning:account-settings-loaded/);
 assert.match(source,/l5-nameplate/);
 assert.match(source,/l5ThemeChoice/);
 assert.match(source,/data-l5-theme="light"/);
 assert.match(source,/data-l5-theme="dark"/);
 assert.match(source,/getBoundingClientRect/);
 assert.match(source,/l5Next/);
 assert.match(source,/l5Auto/);
 assert.match(source,/l5Log/);
 assert.match(source,/l5Voice/);
 assert.match(novelCss,/\.l5-vn-box/);
 assert.match(novelCss,/\.l5-tour-character/);
 assert.match(novelCss,/@media\(max-width:800px\)/);
 assert.match(read("account-space.js"),/"chan\.settings"/);
});

test("V5 HUD editor controls theme, sidebar, mascot pages and shortcuts",()=>{
 for(const feature of ["l5HudEditor","l5HomeMascot","l5LibraryMascot","l5AiMascot",
  "l5Announcements","l5Shortcuts","l5Motion","l5Scale","l5Reset",
  "data-l5-sidebar","l5PlaySample","l5VoiceStudio"]){
  assert.ok(source.includes(feature),"Missing editor control "+feature);
 }
 assert.match(css,/body\[data-l5-sidebar="compact"\]/);
 assert.match(css,/body\[data-l5-announcements="no"\]/);
 assert.match(css,/body\[data-l5-shortcuts="no"\]/);
 assert.match(source,/\/api\/chan\/voices/);
 assert.match(source,/\/api\/chan\/speech/);
 assert.match(source,/lightning:ai-answer/);
 assert.match(source,/button\.hasAttribute\(\x27data-v4-tour\x27\)/);
 assert.match(source,/if \(button\.dataset\.l5Go\)/);
});
