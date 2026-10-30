import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read=path=>fs.readFileSync(new URL("../"+path,import.meta.url),"utf8");
function node(){
 const handlers=new Map(),classes=new Set();
 return {
  handlers,children:[],dataset:{},value:"",disabled:false,
  classList:{
   add(...names){names.forEach(name=>classes.add(name));},
   remove(...names){names.forEach(name=>classes.delete(name));},
   contains(name){return classes.has(name);},
   toggle(name,state){if(state===undefined? !classes.has(name):state)classes.add(name);else classes.delete(name);}
  },
  style:{setProperty(){}},
  addEventListener(name,handler){handlers.set(name,handler)},
  append(...items){this.children.push(...items)},
  replaceChildren(...items){this.children=items;},
  querySelectorAll(selector){return selector==="button"?this.children:[]},
  closest(selector){return selector==="[data-science-answer]"?this:null},
  setAttribute(){},focus(){},select(){},replaceChildrenFake(){},
  textContent:"",innerHTML:"",hidden:false
 };
}

test("The education dashboard offers real math and science practice",()=>{
 const html=read("views/learning.html"),script=read("public/assets/study-practice.js");
 assert.match(html,/id="practiceMathForm"/);
 assert.match(html,/id="practiceScienceQuestion"/);
 assert.match(html,/study-practice\.js\?v=1/);
 for(const source of [html,script,read("public/assets/learning-portal.css")])
  assert.doesNotMatch(source,/\b(?:games|entertainment|arcade|proxy|scramjet|lightning)\b/i);

 const ids=new Map();
 const get=id=>{if(!ids.has(id))ids.set(id,node());return ids.get(id)};
 const doc={getElementById:get,createElement:()=>node()};
 const fakeMath=Object.create(Math);fakeMath.random=()=>0;
 vm.runInNewContext(script,{document:doc,Math:fakeMath,Number,console},{filename:"study-practice.js"});
 assert.equal(get("practiceMathQuestion").textContent,"3 + 2 = ?");
 get("practiceMathAnswer").value="5";
 get("practiceMathForm").handlers.get("submit")({preventDefault(){}});
 assert.match(get("practiceMathFeedback").textContent,/Correct/);
 assert.ok(get("practiceMathFeedback").classList.contains("correct"));
 get("practiceMathAnswer").value="6";
 get("practiceMathForm").handlers.get("submit")({preventDefault(){}});
 assert.match(get("practiceMathFeedback").textContent,/Not quite/);
 const science=get("practiceScienceOptions");
 assert.equal(science.children.length,3);
 assert.match(get("practiceScienceQuestion").textContent,/photosynthesis/);
 science.handlers.get("click")({target:science.children[1]});
 assert.match(get("practiceScienceFeedback").textContent,/Exactly/);
 assert.equal(science.children.every(button=>button.disabled),true);
 assert.ok(science.children[1].classList.contains("correct"));
});

test("Prevent Closing is enabled by default, can be disabled, and uses the browser confirmation",async()=>{
 const source=read("public/assets/app.js");
 const elements=new Map(),events=new Map(),browserEvents=new Map();
 const el=id=>{if(!elements.has(id))elements.set(id,node());return elements.get(id)};
 const hubButtons=[el("hub-chat"),el("hub-games"),el("hub-updates")],quick=[el("quick-google")];
 const panelButtons=[el("panel-history"),el("panel-settings")];
 const document={
  querySelector:el,
  querySelectorAll:selector=>selector==="[data-hub]"?hubButtons:
   selector===".lightning-quick"?quick:
   selector===".rail-button[data-panel]"?panelButtons:[],
  createElement:()=>el("created-"+elements.size),
  body:el("body"),documentElement:el("html"),head:el("head"),
  addEventListener(name,handler){events.set(name,handler)}
 };
 const win={
  addEventListener(name,handler){browserEvents.set(name,handler)},
  removeEventListener(name,handler){if(browserEvents.get(name)===handler)browserEvents.delete(name)}
 };
 const context={document,window:win,localStorage:{getItem(){return null},setItem(){}},
  fetch(){return new Promise(()=>{})},
  setTimeout,clearTimeout,console,Date,URL,Math,CustomEvent:class CustomEvent{}};
 vm.runInNewContext(source,context,{filename:"app.js"});
 await new Promise(resolve=>setImmediate(resolve));
 const handler=browserEvents.get("beforeunload");
 assert.equal(typeof handler,"function","enabled by default");
 const closeEvent={returnValue:null,cancelled:false,preventDefault(){this.cancelled=true}};
 handler(closeEvent);
 assert.equal(closeEvent.cancelled,true);
 assert.equal(closeEvent.returnValue,true);
 events.get("lightning:set-prevent-closing")({detail:{enabled:false}});
 assert.equal(browserEvents.has("beforeunload"),false,"disabled on demand");
 events.get("lightning:set-prevent-closing")({detail:{enabled:true}});
 assert.equal(browserEvents.has("beforeunload"),true,"re-enabled on demand");
 assert.match(source,/settingSwitch\("preventClosing","Prevent Closing"/);
 assert.match(read("public/assets/glass-settings.js"),/data-lg-close-protection/);
});
