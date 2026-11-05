import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read=file=>fs.readFileSync(new URL("../"+file,import.meta.url),"utf8");
const app=read("views/app.html");
const login=read("views/login.html");
const learning=read("views/learning.html");
const gui=read("public/assets/lightning-gui-v7.js");
const aura=read("public/assets/lightning-gui-aura.css");
const studio=read("public/assets/glass-house-ui.js");
const main=read("public/assets/app.js");
const blank=read("public/assets/tab-blank.js");
const scroll=read("public/assets/ui-scrollbars.css");

function fakeBrowser({blocked=false,insideBlank=false}={}){
 const opened=[];
 const elements=[];
 const listeners={};
 const doc={
  title:"",html:"",opened:false,body:{items:[],append(el){this.items.push(el);}},
  head:{items:[],append(el){this.items.push(el);}},
  open(){this.opened=true;},write(text){this.html+=text;},close(){},
  createElement(tag){
   const el={tag,style:{},attributes:{},contentWindow:{},setAttribute(k,v){this.attributes[k]=v;}};
   elements.push(el);return el;
  }
 };
 const popup={document:doc,opener:{},focus(){this.focused=true;},close(){this.closed=true;},
  addEventListener(kind,callback){listeners[kind]=callback;}};
 const contextWindow={
  parent:null,
  open(url,target){opened.push({url,target});return blocked?null:popup;}
 };
 contextWindow.parent=insideBlank?{location:{href:"about:blank"}}:contextWindow;
 const sourceDoc={title:"Google Classroom",querySelector:()=>({href:"https://classroom.google.com/favicon.ico"})};
 const origin="https://bolt-v5-preview-production.up.railway.app";
 const location={origin,href:origin+"/"};
 contextWindow.location=location;
 vm.runInNewContext(blank,{window:contextWindow,document:sourceDoc,location,URL});
 return {contextWindow,opened,elements,doc,popup,listeners,origin};
}

test("AURA has no Lightning Desk; GUI selection stays in Settings",()=>{
 assert.doesNotMatch(gui,/THE LIGHTNING DESK|ln7-rail-switch|ln7-tab-switch|ln7-toolbar-switch|ln7-hub-switcher/);
 assert.match(gui,/rail\.replaceChildren\(brand,group1,group2\)/);
 assert.match(gui,/ln7-aura-footer/);
 assert.match(aura,/\.ln7-aura\{\s*display:block/);
 assert.doesNotMatch(aura,/\.ln7-aura-aside/);
 assert.match(read("public/assets/glass-settings.js"),/data-lg-gui-choice/);
});
test("Native page scrollbar tracks are hidden; activity and reading feeds remain scrollable",()=>{
 for(const page of [app,login,learning])assert.match(page,/\/assets\/ui-scrollbars\.css/);
 assert.match(scroll,/scrollbar-width:none/);
 assert.match(scroll,/scrollbar-width:thin/);
 assert.match(scroll,/\.v3-inspector/);
 assert.match(scroll,/\.v3-overview/);
 assert.match(scroll,/\.v2-room-feed/);
 assert.match(scroll,/::-webkit-scrollbar/);
 assert.match(scroll,/forced-colors:active/);
 assert.match(scroll,/body\.app-page \.ln7-home/);
});
test("Cloaking preset Apply opens about:blank directly; iframe still loads real origin",()=>{
 const b=fakeBrowser();
 const result=b.contextWindow.LightningBlankCloak.open();
 assert.equal(result.ok,true);
 assert.equal(result.alreadyOpen,false);
 assert.deepEqual(b.opened,[{url:"about:blank",target:"_blank"}]);
 assert.match(b.doc.html,/height:100%/);
 const frame=b.doc.body.items.find(el=>el.tag==="iframe");
 assert.ok(frame);
 assert.equal(frame.src,b.origin+"/");
 assert.equal(b.doc.title,"Google Classroom");
 assert.equal(b.popup.opener,null);
 assert.equal(b.popup.focused,true);
 assert.ok(b.doc.head.items.some(el=>el.rel==="icon"));
 assert.match(studio,/LightningBlankCloak\?\.open\(\)/);
 assert.match(app,/\/assets\/tab-blank\.js/);
 assert.match(main,/lightning:cloak-identity/);
});
test("Inner frame can update the blank tab title only through trusted same-origin messages",()=>{
 const b=fakeBrowser();
 b.contextWindow.LightningBlankCloak.open();
 const frame=b.doc.body.items.find(el=>el.tag==="iframe");
 const favicon=b.doc.head.items.find(el=>el.rel==="icon");
 b.listeners.message({origin:"https://other.example",source:frame.contentWindow,data:{type:"lightning:cloak-identity",title:"Spoofed",icon:"https://other.example/icon.ico"}});
 assert.equal(b.doc.title,"Google Classroom");
 b.listeners.message({origin:b.origin,source:{},data:{type:"lightning:cloak-identity",title:"Spoofed"}});
 assert.equal(b.doc.title,"Google Classroom");
 b.listeners.message({origin:b.origin,source:frame.contentWindow,data:{type:"lightning:cloak-identity",title:"Homework",icon:"https://example.com/icon.ico"}});
 assert.equal(b.doc.title,"Homework");
 assert.equal(favicon.href,"https://example.com/icon.ico");
 b.listeners.message({origin:b.origin,source:frame.contentWindow,data:{type:"lightning:cloak-identity",title:"Safe",icon:"javascript:alert(1)"}});
 assert.equal(favicon.href,b.origin+"/favicon.svg");
});
test("Popup blockers never destroy the source tab; already blank never opens another",()=>{
 const blocked=fakeBrowser({blocked:true});
 assert.equal(blocked.contextWindow.LightningBlankCloak.open().ok,false);
 const nested=fakeBrowser({insideBlank:true});
 const value=nested.contextWindow.LightningBlankCloak.open();
 assert.equal(value.ok,true);
 assert.equal(value.alreadyOpen,true);
 assert.equal(nested.opened.length,0);
});
test("Blank launcher and UI modules parse",()=>{
 assert.doesNotThrow(()=>new Function(blank));
 assert.doesNotThrow(()=>new Function(gui));
 assert.doesNotThrow(()=>new Function(studio));
 assert.doesNotThrow(()=>new Function(main));
});
