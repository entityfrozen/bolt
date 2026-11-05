import test from "node:test";
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {mkdtempSync,rmSync,readFileSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import net from "node:net";
import {once} from "node:events";
import WebSocket from "ws";

const read=file=>readFileSync(new URL("../"+file,import.meta.url),"utf8");
async function setup(t){
 const dir=mkdtempSync(path.join(tmpdir(),"ln-integrations-"));
 const socket=net.createServer();
 await new Promise(resolve=>socket.listen(0,"127.0.0.1",resolve));
 const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
 const child=spawn(process.execPath,["server.js"],{
  cwd:process.cwd(),env:{...process.env,PORT:String(port),BOLT_DATA_DIR:dir,
   BOLT_ADMIN_USER:"notify-admin",BOLT_ADMIN_PASSWORD:"strong-test-password",
   NVIDIA_API_KEY:"",TAVILY_API_KEY:"",BRAVE_SEARCH_API_KEY:""},
  stdio:["ignore","pipe","pipe"]
 });
 let errors="";child.stderr.on("data",bytes=>errors+=bytes.toString().slice(-1500));
 t.after(()=>{child.kill("SIGTERM");rmSync(dir,{recursive:true,force:true});});
 const origin="http://127.0.0.1:"+port;
 for(let i=0;i<100;i++){
  if(child.exitCode!==null)throw Error(errors);
  try{if((await fetch(origin+"/api/me")).status===401)break;}catch{}
  await new Promise(resolve=>setTimeout(resolve,90));
 }
 async function request(route,cookie="",method="GET",body){
  const response=await fetch(origin+route,{
   method,headers:{"Content-Type":"application/json",...(cookie?{Cookie:cookie}:{})},
   ...(body!==undefined?{body:JSON.stringify(body)}:{})
  });
  return {status:response.status,data:await response.json().catch(()=>({})),
   cookie:response.headers.get("set-cookie")?.split(";")[0]||""};
 }
 const admin=(await request("/api/login","","POST",{username:"notify-admin",password:"strong-test-password"})).cookie;
 assert.ok(admin);
 return {dir,origin,admin,request};
}
async function member(env,username){
 const password="user-test-password-123";
 const created=await env.request("/api/admin/users",env.admin,"POST",{username,password});
 assert.equal(created.status,201);
 const logged=await env.request("/api/login","","POST",{username,password});
 assert.equal(logged.status,200);
 return {id:created.data.user.id,cookie:logged.cookie,username};
}

test("Website admins store NVIDIA and Tavily server-side, without exposing saved keys", {timeout:35000},async t=>{
 const env=await setup(t),bob=await member(env,"provider-member");
 const original=await env.request("/api/ai/search-settings",env.admin);
 assert.equal(original.data.nvidia,false);
 assert.equal((await env.request("/api/ai/search-settings",bob.cookie)).status,403);
 assert.equal((await env.request("/api/ai/search-settings",bob.cookie,"POST",{provider:"nvidia",key:"member-cannot-store-secrets"})).status,403);
 const key="nvapi-demo-key-for-test-not-real";
 const saved=await env.request("/api/ai/search-settings",env.admin,"POST",{provider:"nvidia",key});
 assert.equal(saved.status,200);
 assert.equal(saved.data.nvidia,true);
 assert.equal(saved.data.source.nvidia,"shared");
 assert.ok(!JSON.stringify(saved.data).includes(key));
 const disk=readFileSync(path.join(env.dir,"lightning-search-credentials.json"),"utf8");
 assert.ok(!disk.includes(key));
 assert.match(disk,/"nvidia"/);
 const tavily=await env.request("/api/ai/search-settings",env.admin,"POST",{provider:"tavily",key:"tavily-demo-key-only"});
 assert.equal(tavily.data.tavily,true);
 assert.equal(tavily.data.source.tavily,"shared");
 assert.equal((await env.request("/api/ai/provider-test",bob.cookie,"POST",{provider:"nvidia"})).status,403);
 const removed=await env.request("/api/ai/search-settings/nvidia",env.admin,"DELETE");
 assert.equal(removed.data.nvidia,false);
 assert.equal(removed.data.tavily,true);
});

test("DM and announcements create personal notifications, with secure read and clear", {timeout:35000},async t=>{
 const env=await setup(t),alice=await member(env,"notice-alice"),bob=await member(env,"notice-bob");
 assert.equal((await env.request("/api/account/notifications")).status,401);
 const sent=await env.request("/api/account/dms/"+bob.id,alice.cookie,"POST",{text:"Private note to Bob"});
 assert.equal(sent.status,201);
 const bobInbox=await env.request("/api/account/notifications",bob.cookie);
 assert.equal(bobInbox.data.unread,1);
 assert.equal(bobInbox.data.items[0].kind,"dm");
 assert.equal(bobInbox.data.items[0].fromId,alice.id);
 assert.equal((await env.request("/api/account/notifications",alice.cookie)).data.unread,0);
 assert.equal((await env.request("/api/account/notifications/read",alice.cookie,"PATCH",{})).data.changed,0);
 const marked=await env.request("/api/account/notifications/read",bob.cookie,"PATCH",{ids:[bobInbox.data.items[0].id]});
 assert.equal(marked.data.unread,0);
 const forged=await env.request("/api/account/notifications/read",bob.cookie,"PATCH",{ids:"all"});
 assert.equal(forged.status,400);
 assert.equal((await env.request("/api/admin/notifications/announce",bob.cookie,"POST",{title:"Hello members",body:"Good news"})).status,403);
 const announcement=await env.request("/api/admin/notifications/announce",env.admin,"POST",{title:"Server update",body:"New notifications are now live."});
 assert.equal(announcement.status,200);
 assert.ok(announcement.data.recipients>=3);
 const next=await env.request("/api/account/notifications",bob.cookie);
 assert.equal(next.data.unread,1);
 assert.equal(next.data.items[0].kind,"announcement");
 assert.equal((await env.request("/api/admin/notifications/announce",env.admin,"POST",{title:"Again",body:"Too fast"})).status,429);
 const erased=await env.request("/api/account/notifications",bob.cookie,"DELETE");
 assert.equal(erased.data.unread,0);
 assert.equal((await env.request("/api/account/notifications",bob.cookie)).data.items.length,0);
 assert.equal((await env.request("/api/account/notifications",alice.cookie)).data.unread,1);
});

test("Legacy chat @mentions are written to the recipient's persistent inbox", {timeout:40000},async t=>{
 const env=await setup(t);
 const alice=await member(env,"mention-sender"),bob=await member(env,"mention-reader");
 const ws=new WebSocket(env.origin.replace("http:","ws:")+"/live",{headers:{Cookie:alice.cookie}});
 t.after(()=>ws.terminate());
 await once(ws,"open");
 ws.send(JSON.stringify({type:"chat",channel:"general",message:"Hey @mention-reader, look at this"}));
 let found=false;
 for(let i=0;i<60;i++){
  await new Promise(resolve=>setTimeout(resolve,80));
  const inbox=await env.request("/api/account/notifications",bob.cookie);
  if(inbox.data.items?.some(item=>item.kind==="mention"&&item.channel==="general")){found=true;break;}
 }
 assert.equal(found,true);
 const own=await env.request("/api/account/notifications",alice.cookie);
 assert.equal(own.data.unread,0);
});
test("Admin interface and signed-in app expose keys and a functional notification center",()=>{
 const admin=read("public/assets/admin-console.js"),app=read("views/app.html");
 const browser=read("public/assets/notifications.js");
 const styles=read("public/assets/notifications.css");
 assert.match(admin,/Provider Keys/);
 assert.match(admin,/data-ac-provider/);
 assert.match(admin,/\/api\/ai\/search-settings/);
 assert.match(admin,/\/api\/admin\/notifications\/announce/);
 assert.match(app,/notifications\.js/);
 assert.match(app,/notifications\.css/);
 assert.match(browser,/\/api\/account\/notifications/);
 assert.match(browser,/Notification\.requestPermission/);
 assert.match(browser,/data-ln-notice="readAll"/);
 assert.match(styles,/\.ln-notice-list/);
 assert.doesNotThrow(()=>new Function(browser));
});
