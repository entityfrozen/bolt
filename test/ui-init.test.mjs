import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source=fs.readFileSync(new URL("../public/assets/app.js",import.meta.url),"utf8");

test("Lightning binds home search, Games and Chat without crashing on startup",async()=>{
 const elements=new Map();
 function el(key){
  if(!elements.has(key)){
   const handlers=new Map();
   elements.set(key,{
    key,handlers,dataset:{hub:key.includes("data-hub")?"games":undefined,lightningQuick:"https://example.com"},
    classList:{add(){},remove(){},toggle(){},contains(){return false}},
    style:{setProperty(){}},
    addEventListener(name,fn){handlers.set(name,fn)},
    replaceChildren(){},append(){},setAttribute(){},focus(){},select(){},
    value:"",hidden:false,textContent:"",innerHTML:""
   });
  }
  return elements.get(key);
 }
 const hubButtons=[el("hub-chat"),el("hub-games"),el("hub-updates")];
 const shortcuts=[el("shortcut-google"),el("shortcut-wiki")];
 const panels=[el("panel-history"),el("panel-settings")];
 const document={
  createElement:tag=>el("created-"+tag+"-"+elements.size),
  querySelector:selector=>el(selector),
  querySelectorAll:selector=>selector==="[data-hub]"?hubButtons:
   selector===".lightning-quick"?shortcuts:
   selector===".rail-button[data-panel]"?panels:[],
  body:el("body"),documentElement:el("html"),
  addEventListener(){}
 };
 const context={
  document,window:{},localStorage:{getItem(){return null},setItem(){}},
  // Keep the authenticated API request pending so the test exercises initial
  // listener attachment without reaching unrelated browser/proxy bootstrapping.
  fetch(){return new Promise(()=>{})},
  setTimeout,clearTimeout,console,Date,URL,Math
 };
 vm.runInNewContext(source,context,{filename:"app.js"});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(el("#newtabForm").handlers.has("submit"),true,"homepage search should attach");
 assert.equal(el("#addressForm").handlers.has("submit"),true,"address bar should attach");
 assert.equal(el("#lightningSuggestionButton").handlers.has("click"),true,"suggestions should attach");
 assert.equal(el("#newTabBtn").handlers.has("click"),true,"new tab should attach");
 for(const button of hubButtons)assert.ok(button.handlers.has("click"),button.key+" should attach");
 for(const button of shortcuts)assert.ok(button.handlers.has("click"),button.key+" should attach");
});

test("single-element selectors are never used as collections",()=>{
 assert.doesNotMatch(source,/(?<!\$)\$\([^)\n]+\)\.forEach\s*\(/);
 assert.match(source,/\$\$\("\[data-hub\]"\)\.forEach/);
});
