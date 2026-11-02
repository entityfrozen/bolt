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


test("Only admins configure shared web search; members never see the key",{timeout:50000},async t=>{
 const origin=await runServer(t);
 const admin=await request(origin,"/api/login","","POST",{username:"account-admin",password:"safe-test-admin-password"});
 assert.equal(admin.status,200);
 const made=await request(origin,"/api/admin/users",admin.cookie,"POST",{username:"search-member",password:"test-account-password-456"});
 assert.equal(made.status,201);
 const member=(await request(origin,"/api/login","","POST",{username:"search-member",password:"test-account-password-456"})).cookie;
 assert.equal((await request(origin,"/api/ai/search-settings")).status,401);
 assert.equal((await request(origin,"/api/ai/search-settings",member)).status,403);
 assert.equal((await request(origin,"/api/ai/search-settings",member,"POST",{provider:"tavily",key:"member-key-not-allowed"})).status,403);
 assert.equal((await request(origin,"/api/ai/search-test",member,"POST",{provider:"tavily"})).status,403);
 const before=await request(origin,"/api/ai/search-settings",admin.cookie);
 assert.equal(before.data.tavily,false);
 const saved=await request(origin,"/api/ai/search-settings",admin.cookie,"POST",{provider:"tavily",key:"demo-key-not-real"});
 assert.equal(saved.status,200);
 assert.equal(saved.data.source.tavily,"shared");
 assert.ok(!JSON.stringify(saved.data).includes("demo-key-not-real"));
 assert.equal((await request(origin,"/api/ai/search-settings/tavily",member,"DELETE")).status,403);
 assert.equal((await request(origin,"/api/ai/search-settings",admin.cookie)).data.tavily,true);
 const invalid=await request(origin,"/api/ai/search-settings",admin.cookie,"POST",{provider:"brave",key:"x"});
 assert.equal(invalid.status,400);
 const removed=await request(origin,"/api/ai/search-settings/tavily",admin.cookie,"DELETE");
 assert.equal(removed.status,200);assert.equal(removed.data.tavily,false);
});

test("Preferences and game scores persist between sessions, isolated by account",{timeout:50000},async t=>{
 const origin=await runServer(t);
 const admin=await request(origin,"/api/login","","POST",{username:"account-admin",password:"safe-test-admin-password"});
 const a=await request(origin,"/api/admin/users",admin.cookie,"POST",{username:"account-a",password:"test-account-password-456"});
 const b=await request(origin,"/api/admin/users",admin.cookie,"POST",{username:"account-b",password:"test-account-password-456"});
 assert.equal(a.status,201);assert.equal(b.status,201);
 const alice=(await request(origin,"/api/login","","POST",{username:"account-a",password:"test-account-password-456"})).cookie;
 const bob=(await request(origin,"/api/login","","POST",{username:"account-b",password:"test-account-password-456"})).cookie;
 assert.equal((await request(origin,"/api/account/settings")).status,401);
 assert.equal((await request(origin,"/api/account/settings",alice)).data.settings.appearance,undefined);
 const prefs={accent:"#a3cef8",preset:"ice",sidebar:"compact"};
 assert.equal((await request(origin,"/api/account/settings/appearance",alice,"PUT",{value:prefs})).status,200);
 assert.equal((await request(origin,"/api/account/settings/channels",alice,"PUT",{value:{"lightning-main":"announcements"}})).status,200);
 assert.equal((await request(origin,"/api/account/settings/gameScores",alice,"PUT",{value:{best2048:1024}})).status,200);
 const newSession=(await request(origin,"/api/login","","POST",{username:"account-a",password:"test-account-password-456"})).cookie;
 const settings=(await request(origin,"/api/account/settings",newSession)).data.settings;
 assert.deepEqual(settings.appearance,prefs);
 assert.equal(settings.channels["lightning-main"],"announcements");
 assert.equal(settings.gameScores.best2048,1024);
 assert.deepEqual((await request(origin,"/api/account/settings",bob)).data.settings,{});
 assert.equal((await request(origin,"/api/account/settings/secrets",alice,"PUT",{value:"x"})).status,400);
});

test("Members can change their username and password without losing account data",{timeout:50000},async t=>{
 const origin=await runServer(t);
 const admin=await request(origin,"/api/login","","POST",{username:"account-admin",password:"safe-test-admin-password"});
 const created=await request(origin,"/api/admin/users",admin.cookie,"POST",{username:"old-handle",password:"initial-password-123"});
 assert.equal(created.status,201);
 const login=await request(origin,"/api/login","","POST",{username:"old-handle",password:"initial-password-123"});
 const cookie=login.cookie;
 const another=await request(origin,"/api/login","","POST",{username:"old-handle",password:"initial-password-123"});
 const wrong=await request(origin,"/api/account/credentials",cookie,"PATCH",{username:"new-handle",currentPassword:"wrong"});
 assert.equal(wrong.status,403);
 const short=await request(origin,"/api/account/credentials",cookie,"PATCH",{username:"new-handle",currentPassword:"initial-password-123",newPassword:"too-short"});
 assert.equal(short.status,400);
 const saved=await request(origin,"/api/account/credentials",cookie,"PATCH",{username:"new-handle",currentPassword:"initial-password-123",newPassword:"better-password-789"});
 assert.equal(saved.status,200);
 assert.equal(saved.data.user.username,"new-handle");
 assert.equal((await request(origin,"/api/login","","POST",{username:"old-handle",password:"initial-password-123"})).status,401);
 assert.equal((await request(origin,"/api/login","","POST",{username:"new-handle",password:"better-password-789"})).status,200);
 assert.equal((await request(origin,"/api/me",another.cookie)).status,401);
 assert.equal((await request(origin,"/api/account/profile",cookie)).data.profile.username,"new-handle");
});

test("Custom Apps are per-account and cannot contain unsafe schemes",{timeout:50000},async t=>{
 const origin=await runServer(t);
 const admin=await request(origin,"/api/login","","POST",{username:"account-admin",password:"safe-test-admin-password"});
 const u=await request(origin,"/api/admin/users",admin.cookie,"POST",{username:"my-apps",password:"test-password-789"});
 const cookie=(await request(origin,"/api/login","","POST",{username:"my-apps",password:"test-password-789"})).cookie;
 const app={id:"user-test-a1",name:"My Game",url:"https://example.com/game",category:"Games"};
 const save=await request(origin,"/api/account/settings/customApps",cookie,"PUT",{value:[app]});
 assert.equal(save.status,200);
 assert.deepEqual((await request(origin,"/api/account/settings",cookie)).data.settings.customApps,[app]);
 assert.equal((await request(origin,"/api/account/settings",admin.cookie)).data.settings.customApps,undefined);
 assert.equal((await request(origin,"/api/account/settings/customApps",cookie,"PUT",{value:[{...app,url:"javascript:alert(1)"}]})).status,400);
 assert.equal((await request(origin,"/api/account/settings/customApps",cookie,"PUT",{value:[app,app]})).status,400);
 assert.deepEqual((await request(origin,"/api/account/settings",cookie)).data.settings.customApps,[app]);
});

test("Admins publish shared apps for everyone; ordinary members can only read them",{timeout:50000},async t=>{
 const origin=await runServer(t);
 const admin=(await request(origin,"/api/login","","POST",{username:"account-admin",password:"safe-test-admin-password"})).cookie;
 const created=await request(origin,"/api/admin/users",admin,"POST",{username:"regular-app-user",password:"regular-pass-123"});
 assert.equal(created.status,201);
 const member=(await request(origin,"/api/login","","POST",{username:"regular-app-user",password:"regular-pass-123"})).cookie;
 assert.equal((await request(origin,"/api/apps")).status,401);
 const empty=await request(origin,"/api/apps",member);
 assert.equal(empty.status,200);assert.equal(empty.data.canManage,false);assert.deepEqual(empty.data.apps,[]);
 const input={name:"Shared Video",url:"https://example.com/stream",category:"Streaming"};
 assert.equal((await request(origin,"/api/apps",member,"POST",input)).status,403);
 const publish=await request(origin,"/api/apps",admin,"POST",input);
 assert.equal(publish.status,201);assert.match(publish.data.app.id,/^shared-/);
 const id=publish.data.app.id;
 const visible=await request(origin,"/api/apps",member);
 assert.equal(visible.data.apps.length,1);assert.equal(visible.data.apps[0].name,"Shared Video");
 assert.equal((await request(origin,"/api/apps",admin)).data.canManage,true);
 assert.equal((await request(origin,"/api/apps",admin,"POST",{...input,url:"javascript:alert(1)"})).status,400);
 assert.equal((await request(origin,"/api/apps",admin,"POST",input)).status,409);
 assert.equal((await request(origin,"/api/apps/"+id,member,"DELETE")).status,403);
 assert.equal((await request(origin,"/api/apps/"+id,admin,"DELETE")).status,200);
 assert.deepEqual((await request(origin,"/api/apps",member)).data.apps,[]);
});


test("Private messages have scoped reactions, permanent deletion and unread receipts",{timeout:50000},async t=>{
 const origin=await runServer(t);
 const admin=(await request(origin,"/api/login","","POST",{username:"account-admin",password:"safe-test-admin-password"})).cookie;
 const aliceUser=await request(origin,"/api/admin/users",admin,"POST",{username:"dm-reaction-a",password:"safe-test-user-password"});
 const bobUser=await request(origin,"/api/admin/users",admin,"POST",{username:"dm-reaction-b",password:"safe-test-user-password"});
 const carolUser=await request(origin,"/api/admin/users",admin,"POST",{username:"dm-reaction-c",password:"safe-test-user-password"});
 const alice=(await request(origin,"/api/login","","POST",{username:"dm-reaction-a",password:"safe-test-user-password"})).cookie;
 const bob=(await request(origin,"/api/login","","POST",{username:"dm-reaction-b",password:"safe-test-user-password"})).cookie;
 const carol=(await request(origin,"/api/login","","POST",{username:"dm-reaction-c",password:"safe-test-user-password"})).cookie;
 const aid=aliceUser.data.user.id,bid=bobUser.data.user.id,cid=carolUser.data.user.id;
 const sent=await request(origin,"/api/account/dms/"+bid,alice,"POST",{text:"Reaction test"});
 assert.equal(sent.status,201);
 const mid=sent.data.message.id;
 const unread=await request(origin,"/api/account/dms",bob);
 assert.equal(unread.data.totalUnread,1);
 assert.equal(unread.data.threads[0].unread,1);
 assert.equal((await request(origin,"/api/account/dms",carol)).data.totalUnread,0);
 const stranger=await request(origin,"/api/account/dms/"+cid+"/"+mid+"/reactions",carol,"POST",{emoji:"❤️"});
 assert.equal(stranger.status,404);
 const reaction=await request(origin,"/api/account/dms/"+aid+"/"+mid+"/reactions",bob,"POST",{emoji:"❤️"});
 assert.equal(reaction.status,200);
 assert.ok(reaction.data.reactions["❤️"].includes(bid));
 assert.equal((await request(origin,"/api/account/dms/"+aid+"/"+mid,bob,"DELETE")).status,403);
 const opened=await request(origin,"/api/account/dms/"+aid,bob);
 assert.equal(opened.data.messages[0].reactions["❤️"].length,1);
 assert.equal((await request(origin,"/api/account/dms",bob)).data.totalUnread,0);
 assert.equal((await request(origin,"/api/account/dms/"+bid+"/"+mid,alice,"DELETE")).status,200);
 const after=await request(origin,"/api/account/dms/"+aid,bob);
 assert.equal(after.data.messages.length,0,"Deleted messages should disappear for both participants");
});


test("AI workspaces isolate chats, support renaming, deletion and saved preferences",{timeout:50000},async t=>{
 const origin=await runServer(t);
 const admin=(await request(origin,"/api/login","","POST",{username:"account-admin",password:"safe-test-admin-password"})).cookie;
 await request(origin,"/api/admin/users",admin,"POST",{username:"ai-workspace-a",password:"safe-workspace-test-123"});
 await request(origin,"/api/admin/users",admin,"POST",{username:"ai-workspace-b",password:"safe-workspace-test-123"});
 const alice=(await request(origin,"/api/login","","POST",{username:"ai-workspace-a",password:"safe-workspace-test-123"})).cookie;
 const bob=(await request(origin,"/api/login","","POST",{username:"ai-workspace-b",password:"safe-workspace-test-123"})).cookie;
 assert.equal((await request(origin,"/api/account/ai/workspace")).status,401);
 const legacy=await request(origin,"/api/account/history/ai",alice,"PUT",{items:[{role:"user",content:"Previously saved conversation"}]});
 assert.equal(legacy.status,200);
 const imported=await request(origin,"/api/account/ai/workspace",alice);
 assert.equal(imported.data.chats.length,1);
 const oldId=imported.data.chats[0].id;
 const oldChat=await request(origin,"/api/account/ai/chats/"+oldId,alice);
 assert.equal(oldChat.data.chat.messages[0].content,"Previously saved conversation");
 const newChat=await request(origin,"/api/account/ai/chats",alice,"POST",{title:"Coding notes"});
 assert.equal(newChat.status,201);
 const id=newChat.data.chat.id;
 const saved=await request(origin,"/api/account/ai/chats/"+id+"/messages",alice,"PUT",{
  messages:[{role:"user",content:"Teach me JavaScript"},{role:"assistant",content:"Let's start with functions."}]
 });
 assert.equal(saved.status,200);
 const renamed=await request(origin,"/api/account/ai/chats/"+id,alice,"PATCH",{title:"JS study"});
 assert.equal(renamed.status,200);
 assert.equal(renamed.data.chat.title,"JS study");
 const edited=await request(origin,"/api/account/ai/preferences",alice,"PATCH",{
  name:"Sparky",tone:"direct",length:"detailed",instructions:"Use examples and short headings."
 });
 assert.equal(edited.status,200);
 const state=await request(origin,"/api/account/ai/workspace",alice);
 assert.equal(state.data.chats.length,2);
 assert.equal(state.data.preferences.name,"Sparky");
 assert.equal(state.data.preferences.tone,"direct");
 const outsider=await request(origin,"/api/account/ai/chats/"+id,bob);
 assert.equal(outsider.status,404);
 assert.equal((await request(origin,"/api/account/ai/workspace",bob)).data.chats.length,0);
 assert.equal((await request(origin,"/api/account/ai/preferences",alice,"PATCH",{instructions:"x".repeat(1201)})).status,400);
 assert.equal((await request(origin,"/api/account/ai/chats/"+id,bob,"DELETE")).status,404);
 assert.equal((await request(origin,"/api/account/ai/chats/"+id,alice,"DELETE")).status,200);
 assert.equal((await request(origin,"/api/account/ai/workspace",alice)).data.chats.length,1);
});

test("Pasted screenshot is saved only for its signed-in AI conversation",{timeout:50000},async t=>{
  const origin=await runServer(t);
  const admin=await request(origin,"/api/login","","POST",{username:"account-admin",password:"safe-test-admin-password"});
  assert.equal(admin.status,200);
  const chat=await request(origin,"/api/account/ai/chats",admin.cookie,"POST",{title:"Image test"});
  assert.equal(chat.status,201);
  const id=chat.data.chat.id;
  const path="/api/account/ai/chats/"+id+"/messages";
  const image="data:image/jpeg;base64,"+Buffer.from([255,216,255,224,1,2,3,4]).toString("base64");
  const saved=await request(origin,path,admin.cookie,"PUT",{messages:[{role:"user",content:"What is shown?",image}]});
  assert.equal(saved.status,200);
  const fetched=await request(origin,"/api/account/ai/chats/"+id,admin.cookie);
  assert.equal(fetched.data.chat.messages[0].image,image);
  assert.equal((await request(origin,path,admin.cookie,"PUT",{messages:[{role:"user",content:"invalid",image:"https://evil.example/image.png"}]})).status,400);
  assert.equal((await request(origin,path,admin.cookie,"PUT",{messages:[
    {role:"user",content:"image 1",image},
    {role:"user",content:"image 2",image}
  ]})).status,400);
});
