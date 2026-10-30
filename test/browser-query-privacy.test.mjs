import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {spawn} from "node:child_process";
import {mkdtempSync,rmSync,readFileSync} from "node:fs";
import {tmpdir} from "node:os";
import net from "node:net";
import path from "node:path";

const source=fs.readFileSync(new URL("../public/assets/app.js",import.meta.url),"utf8");

test("Private browser queries don't enter Lightning tab labels, the address display, or stored sessions",()=>{
 const fakeDocument={querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}};
 const context=vm.createContext({document:fakeDocument,window:{},URL,
  setTimeout,clearTimeout,console,Date,Math});
 vm.runInContext(source.replace(/\nstart\(\);\s*$/,""),context,{filename:"app.js"});
 const query="https://www.google.com/search?q=subway%20surfers";
 const nonGoogle="https://example.com/results?query=subway%20surfers";
 assert.equal(vm.runInContext("isPrivateSearchUrl("+JSON.stringify(query)+")",context),true);
 assert.equal(vm.runInContext("isPrivateSearchUrl("+JSON.stringify(nonGoogle)+")",context),true);
 assert.equal(vm.runInContext('isPrivateSearchUrl("https://example.com/docs/tutorial")',context),false);
 const label=vm.runInContext("privateTabLabel({url:"+JSON.stringify(query)+",title:'subway surfers - Search'})",context);
 assert.equal(label,"Research results · google.com");
 const display=vm.runInContext("privateAddress("+JSON.stringify(query)+")",context);
 assert.ok(!display.includes("subway"));
 assert.equal(vm.runInContext("protectedSavedTab({url:"+JSON.stringify(query)+",title:'subway surfers'})",context).url,"bolt://newtab");
 assert.equal(vm.runInContext("protectedSavedTab({url:"+JSON.stringify(query)+",title:'subway surfers'})",context).title,"New tab");
 assert.match(source,/settingSwitch\("privateSearches","Private searches"/);
 assert.match(source,/dom\.address\.value=privateAddress\(destination\)/);
 assert.match(source,/if\(isPrivateSearchUrl\(tab\.url\)\)tab\.title="Research results"/);
 assert.match(source,/if\(!\/\^https\?:/);
 vm.runInContext("prefs.privateSearches=false",context);
 assert.equal(vm.runInContext("isPrivateSearchUrl("+JSON.stringify(query)+")",context),false);
});

async function freePort(){
 const server=net.createServer();
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 const port=server.address().port;
 await new Promise(resolve=>server.close(resolve));
 return port;
}
async function launch(t){
 const dir=mkdtempSync(path.join(tmpdir(),"lightning-private-search-"));
 const port=await freePort();
 const child=spawn(process.execPath,["server.js"],{
  cwd:process.cwd(),
  env:{...process.env,PORT:String(port),BOLT_DATA_DIR:dir,BOLT_ADMIN_USER:"privacy-admin",
   BOLT_ADMIN_PASSWORD:"privacy-test-password"},
  stdio:["ignore","pipe","pipe"]
 });
 let errors="";
 child.stderr.on("data",chunk=>errors+=chunk.toString().slice(-1500));
 t.after(()=>{child.kill("SIGTERM");rmSync(dir,{recursive:true,force:true});});
 const origin="http://127.0.0.1:"+port;
 for(let attempt=0;attempt<125;attempt++){
  if(child.exitCode!==null)throw Error("Server stopped: "+errors);
  try{if((await fetch(origin+"/api/me")).status===401)return {origin,dir};}catch{}
  await new Promise(resolve=>setTimeout(resolve,160));
 }
 throw Error("Server did not start: "+errors);
}
async function req(origin,route,cookie="",method="GET",body){
 const r=await fetch(origin+route,{
  method,headers:{"Content-Type":"application/json",...(cookie?{Cookie:cookie}:{})},
  body:body===undefined?undefined:JSON.stringify(body)
 });
 return {status:r.status,body:await r.json().catch(()=>({})),
  cookie:r.headers.get("set-cookie")?.split(";")[0]||""};
}

test("Server prunes existing and new search URLs from account history, tabs and bookmarks by default",{timeout:50000},async t=>{
 const {origin,dir}=await launch(t);
 const login=await req(origin,"/api/login","","POST",{username:"privacy-admin",password:"privacy-test-password"});
 assert.equal(login.status,200);
 const cookie=login.cookie;
 const ordinary={url:"https://example.com/docs",title:"Study documentation",at:Date.now()};
 const secret={url:"https://www.google.com/search?q=subway%20surfers",title:"subway surfers results",at:Date.now()};
 const history=await req(origin,"/api/account/history/browser",cookie,"PUT",{items:[secret,ordinary]});
 assert.equal(history.status,200);assert.equal(history.body.count,1);
 assert.deepEqual((await req(origin,"/api/account/history/browser",cookie)).body.items.map(x=>x.url),[ordinary.url]);
 assert.equal((await req(origin,"/api/account/settings/bolt.tabs",cookie,"PUT",
  {value:{tabs:[{title:secret.title,url:secret.url},{title:ordinary.title,url:ordinary.url}],active:0}})).status,200);
 assert.equal((await req(origin,"/api/account/settings/bolt.bookmarks",cookie,"PUT",
  {value:[secret,ordinary]})).status,200);
 let settings=(await req(origin,"/api/account/settings",cookie)).body.settings;
 assert.equal(settings["bolt.tabs"].tabs[0].url,"bolt://newtab");
 assert.deepEqual(settings["bolt.bookmarks"].map(x=>x.url),[ordinary.url]);
 assert.equal(readFileSync(path.join(dir,"lightning-accounts.json"),"utf8").includes("subway"),false);

 // Users can explicitly turn private searches off. Turning them back on
 // also cleans up the saved data from that period.
 assert.equal((await req(origin,"/api/account/settings/bolt.prefs",cookie,"PUT",
  {value:{privateSearches:false}})).status,200);
 assert.equal((await req(origin,"/api/account/history/browser",cookie,"PUT",
  {items:[secret,ordinary]})).body.count,2);
 assert.equal((await req(origin,"/api/account/settings/bolt.prefs",cookie,"PUT",
  {value:{privateSearches:true}})).status,200);
 assert.equal((await req(origin,"/api/account/history/browser",cookie)).body.items.length,1);
 assert.equal(readFileSync(path.join(dir,"lightning-accounts.json"),"utf8").includes("subway"),false);
});
