import test from "node:test";
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import net from "node:net";

const freePort=()=>new Promise(resolve=>{
 const srv=net.createServer();srv.listen(0,"127.0.0.1",()=>{
  const port=srv.address().port;srv.close(()=>resolve(port));
 });
});
async function runServer(t){
 const dir=mkdtempSync(path.join(tmpdir(),"lightning-account-check-")),port=await freePort();
 const child=spawn(process.execPath,["server.js"],{cwd:process.cwd(),
  env:{...process.env,PORT:String(port),BOLT_DATA_DIR:dir,BOLT_ADMIN_USER:"account-admin",BOLT_ADMIN_PASSWORD:"safe-test-admin-password"},stdio:["ignore","pipe","pipe"]});
 let error="";child.stderr.on("data",d=>error+=d.toString().slice(-2000));
 t.after(()=>{child.kill("SIGTERM");rmSync(dir,{recursive:true,force:true});});
 const origin="http://127.0.0.1:"+port;
 for(let attempt=0;attempt<100;attempt++){
  if(child.exitCode!==null)throw Error("Server stopped: "+error);
  try{const res=await fetch(origin+"/api/me");if(res.status===401)return origin;}catch{}
  await new Promise(resolve=>setTimeout(resolve,150));
 }
 throw Error("Unable to start test server: "+error);
}
async function request(origin,route,cookie="",method="GET",body){
 const headers={"Content-Type":"application/json"};
 if(cookie)headers.Cookie=cookie;
 const r=await fetch(origin+route,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
 return {status:r.status,data:await r.json().catch(()=>({})),cookie:r.headers.get("set-cookie")?.split(";")[0]||""};
}
test("Profile, DMs and history follow the signed-in account, not the device", {timeout:50000}, async t=>{
 const origin=await runServer(t);
 const admin=await request(origin,"/api/login","","POST",{username:"account-admin",password:"safe-test-admin-password"});
 assert.equal(admin.status,200);
 const a=await request(origin,"/api/admin/users",admin.cookie,"POST",{username:"alice-dm",password:"alice-test-pass-123"});
 const b=await request(origin,"/api/admin/users",admin.cookie,"POST",{username:"bob-dm",password:"bob-test-pass-123"});
 const c=await request(origin,"/api/admin/users",admin.cookie,"POST",{username:"carol-dm",password:"carol-test-pass-123"});
 assert.equal(a.status,201);assert.equal(b.status,201);assert.equal(c.status,201);
 const alice=(await request(origin,"/api/login","","POST",{username:"alice-dm",password:"alice-test-pass-123"})).cookie;
 const bob=(await request(origin,"/api/login","","POST",{username:"bob-dm",password:"bob-test-pass-123"})).cookie;
 const carol=(await request(origin,"/api/login","","POST",{username:"carol-dm",password:"carol-test-pass-123"})).cookie;
 const idA=a.data.user.id,idB=b.data.user.id;
 assert.equal((await request(origin,"/api/account/profile")).status,401);
 assert.equal((await request(origin,"/api/account/dms/"+idB)).status,401);
 const changed=await request(origin,"/api/account/profile",alice,"PATCH",{displayName:"Alice Aurora",bio:"Hello Lightning",accent:"#a3cef8"});
 assert.equal(changed.status,200);
 assert.equal(changed.data.profile.displayName,"Alice Aurora");
 assert.equal(changed.data.profile.username,"alice-dm");
 const search=await request(origin,"/api/account/people?q=aurora",bob);
 assert.equal(search.status,200);assert.ok(search.data.people.some(p=>p.id===idA));
 const invalid=await request(origin,"/api/account/profile",alice,"PATCH",{displayName:"<script>"});
 assert.equal(invalid.status,400);
 const sent=await request(origin,"/api/account/dms/"+idB,alice,"POST",{text:"Hello Bob. Private message."});
 assert.equal(sent.status,201);assert.equal(sent.data.message.from,idA);
 const inbox=await request(origin,"/api/account/dms",bob);
 assert.equal(inbox.status,200);assert.equal(inbox.data.threads.length,1);
 const conversation=await request(origin,"/api/account/dms/"+idA,bob);
 assert.equal(conversation.data.messages[0].text,"Hello Bob. Private message.");
 const outsider=await request(origin,"/api/account/dms",carol);
 assert.equal(outsider.data.threads.length,0);
 assert.equal((await request(origin,"/api/account/dms/"+idA,carol)).data.messages.length,0);
 const browserHistory=[{url:"https://example.com/",title:"A page",at:Date.now()}];
 const saveBrowser=await request(origin,"/api/account/history/browser",alice,"PUT",{items:browserHistory});
 assert.equal(saveBrowser.status,200);
 const saveAi=await request(origin,"/api/account/history/ai",alice,"PUT",{items:[{role:"user",content:"What's new?"},{role:"assistant",content:"Not much."}]});
 assert.equal(saveAi.status,200);
 assert.equal((await request(origin,"/api/account/history/browser",bob)).data.items.length,0);
 assert.equal((await request(origin,"/api/account/history/ai",carol)).data.items.length,0);
 const anotherAliceSession=(await request(origin,"/api/login","","POST",{username:"alice-dm",password:"alice-test-pass-123"})).cookie;
 assert.equal((await request(origin,"/api/account/history/browser",anotherAliceSession)).data.items[0].title,"A page");
 assert.equal((await request(origin,"/api/account/history/ai",anotherAliceSession)).data.items.length,2);
 assert.equal((await request(origin,"/api/account/profile",anotherAliceSession)).data.profile.displayName,"Alice Aurora");
 const cleared=await request(origin,"/api/account/history/browser",alice,"PUT",{items:[]});
 assert.equal(cleared.status,200);
 assert.equal((await request(origin,"/api/account/history/browser",anotherAliceSession)).data.items.length,0);
});

test("Search settings stay private to the account and never echo credentials", {timeout:50000}, async t=>{
 const origin=await runServer(t);
 const admin=await request(origin,"/api/login","","POST",{username:"account-admin",password:"safe-test-admin-password"});
 assert.equal(admin.status,200);
 const made=await request(origin,"/api/admin/users",admin.cookie,"POST",{username:"test-search-account",password:"test-account-password-456"});
 assert.equal(made.status,201);
 const cookie=(await request(origin,"/api/login","","POST",{username:"test-search-account",password:"test-account-password-456"})).cookie;
 assert.equal((await request(origin,"/api/ai/search-settings")).status,401);
 const before=await request(origin,"/api/ai/search-settings",cookie);
 assert.equal(before.data.tavily,false);
 const saved=await request(origin,"/api/ai/search-settings",cookie,"POST",{provider:"tavily",key:"demo-test-key-not-real"});
 assert.equal(saved.status,200);
 assert.equal(saved.data.source.tavily,"account");
 assert.ok(!JSON.stringify(saved.data).includes("demo-test-key-not-real"));
 assert.equal((await request(origin,"/api/ai/search-settings",admin.cookie)).data.tavily,false);
 const invalid=await request(origin,"/api/ai/search-settings",cookie,"POST",{provider:"brave",key:"x"});
 assert.equal(invalid.status,400);
 const removed=await request(origin,"/api/ai/search-settings/tavily",cookie,"DELETE");
 assert.equal(removed.data.tavily,false);
});
