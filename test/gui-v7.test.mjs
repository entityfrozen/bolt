import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read=file=>fs.readFileSync(new URL("../"+file,import.meta.url),"utf8");
const html=read("views/app.html");
const engine=read("public/assets/lightning-gui-v7.js");
const core=read("public/assets/lightning-gui-v7-core.css");
const aura=read("public/assets/lightning-gui-aura.css");
const nova=read("public/assets/lightning-gui-nova.css");
const noir=read("public/assets/lightning-gui-noir.css");
const settings=read("public/assets/glass-settings.js");

test("Three completely different shell arrangements are available",()=>{
  for(const mode of ["aura","nova","noir"]) {
    assert.match(engine,new RegExp('id:"'+mode+'"'));
    assert.match(core,new RegExp("ln7-choice-"+mode));
    assert.match(html,new RegExp("ightning-gui-"+mode+"\\.css"));
  }
  assert.match(aura,/grid-template-areas:"rail tabbar" "rail toolbar" "rail stage"/);
  assert.match(nova,/grid-template-areas:"toolbar" "tabbar" "stage" "rail"/);
  assert.match(noir,/grid-template-areas:"rail toolbar" "rail tabbar" "rail stage"/);
  assert.match(aura,/\.ln7-aura-hero/);
  assert.match(nova,/\.ln7-nova-orbit/);
  assert.match(noir,/\.ln7-noir-columns/);
  assert.match(aura,/backdrop-filter:blur/);
  assert.match(nova,/backdrop-filter:blur/);
  assert.match(noir,/backdrop-filter:none/);
});

test("Native controls are relocated rather than replaced by mockups",()=>{
  for(const id of ["newtabForm","recentList","bookmarkList","lightningSuggestionButton"])
    assert.ok(engine.includes('$("#'+id+'")'),"missing native control "+id);
  assert.match(engine,/original\.forEach\(el=>el\.remove\(\)\)/);
  assert.match(engine,/target\("form"\)\?\.append\(controls\.form\)/);
  assert.match(engine,/target\("recent"\)\?\.append\(controls\.recent\)/);
  assert.match(engine,/for\(const item of controls\.shortcuts\)/);
  assert.match(engine,/wasHidden=home\.classList\.contains\("hidden"\)/);
  assert.match(engine,/wasHidden\?" hidden":""/);
  assert.match(core,/\.ln7-home\.hidden\{display:none!important\}/);
  assert.match(core,/\.frame-stack>\.proxy-frame\.active\{pointer-events:auto\}/);
});

test("The GUI switch is usable from settings, the main layout and community",()=>{
  assert.match(engine,/lightning\.gui\.mode/);
  assert.match(engine,/settings\.get\(KEY/);
  assert.match(engine,/settings\.set\(KEY,next\)/);
  assert.match(engine,/lightning:account-settings-loaded/);
  assert.match(engine,/lightning:gui-open-picker/);
  assert.match(engine,/ln7-hub-switcher/);
  assert.match(engine,/aria-pressed/);
  assert.match(engine,/startViewTransition/);
  assert.match(settings,/data-lg-tab="interfaces"/);
  assert.match(settings,/data-lg-gui-choice/);
  assert.match(settings,/window\.LightningGUI\?\.open/);
  for(const mode of ["aura","nova","noir"])assert.ok(settings.includes('["'+mode+'"'));
});

test("New styles are responsive and include accessibility fallbacks",()=>{
  assert.match(core,/@media\(max-width:600px\)/);
  assert.match(core,/prefers-reduced-motion:reduce/);
  assert.match(core,/prefers-reduced-transparency:reduce/);
  assert.match(core,/@supports not \(backdrop-filter/);
  for(const css of [aura,nova,noir])assert.match(css,/@media\(max-width:/);
});

test("The new UI runtime and existing appearance engine parse",()=>{
  const app=read("public/assets/app.js");
  assert.doesNotThrow(()=>new Function(engine));
  assert.doesNotThrow(()=>new Function(app));
  assert.doesNotThrow(()=>new Function(settings));
  assert.match(html,/&#108;ightning-gui-v7\.js/);
});