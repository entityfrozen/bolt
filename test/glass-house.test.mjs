import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read=path=>fs.readFileSync(new URL("../"+path,import.meta.url),"utf8");
const page=read("views/app.html");
const css=read("public/assets/glass-house.css");
const uiCss=read("public/assets/glass-house-ui.css");
const studio=read("public/assets/glass-house-ui.js");
const app=read("public/assets/app.js");
const settings=read("public/assets/glass-settings.js");

test("Glass House assets load on the stable signed-in workspace",()=>{
  for(const file of ["glass-house.css","glass-house-ui.css","glass-house-ui.js"])
    assert.ok(page.includes("/assets/"+file),file+" missing from browser page");
  assert.match(css,/backdrop-filter:blur/);
  assert.match(css,/body\.app-page \.tabbar/);
  assert.match(css,/body\.app-page \.v3-browser-home/);
  assert.match(css,/prefers-reduced-transparency/);
  assert.match(css,/prefers-reduced-motion/);
  assert.match(css,/@supports not \(backdrop-filter/);
  assert.match(uiCss,/\.gx-tour-focus/);
  assert.match(uiCss,/\.gx-cloak-dialog/);
  assert.doesNotMatch(page,/lightning-chan/i);
});

test("Guided tour has actual steps, keyboard controls and exit",()=>{
  for(const selector of ['"#homeMark"','"#addressForm"','"#newTabBtn"','"#gxCloakLaunch"'])
    assert.ok(studio.includes(selector),"Missing tour target "+selector);
  for(const name of ["Browse","Community","Glass","Privacy"])
    assert.ok(studio.includes('name:"'+name+'"'),"Missing guide chapter "+name);
  assert.match(studio,/function startTour/);
  assert.match(studio,/function positionTour/);
  assert.match(studio,/ArrowRight/);
  assert.match(studio,/ArrowLeft/);
  assert.match(studio,/Escape/);
  assert.match(studio,/glass\.guide\.completed/);
  assert.match(studio,/showModal\(\)/);
});

test("Cloaking presets use account-owned settings and real favicon changes",()=>{
  for(const id of ["dcss","iready","classroom","clever","canvas","schoology","powerschool","google","docs","chatgpt"])
    assert.match(app,new RegExp(" "+id+":\\{title:"));
  assert.match(studio,/lightning:set-cloak/);
  assert.match(app,/document\.addEventListener\("lightning:set-cloak"/);
  assert.match(app,/document\.title=/);
  assert.match(app,/link\.href=icon/);
  assert.match(app,/savePrefs\(\)/);
  assert.match(settings,/data-lg-tab="privacy"/);
  assert.match(settings,/window\.LightningTabStudio\?\.open\(\)/);
  assert.match(settings,/window\.LightningGuide\?\.open\(\)/);
  assert.match(studio,/about:blank/);
  assert.match(studio,/network requests and browsing records are not hidden/);
});

test("Both new runtime modules parse under Node",()=>{
  assert.doesNotThrow(()=>new Function(studio));
  assert.doesNotThrow(()=>new Function(app));
  assert.doesNotThrow(()=>new Function(settings));
});