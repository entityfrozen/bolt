import test from "node:test";
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {once} from "node:events";
import {mkdtempSync,rmSync,readFileSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import net from "node:net";

async function freePort(){
 const server=net.createServer();
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 const value=server.address().port;
 await new Promise(resolve=>server.close(resolve));
 return value;
}

async function launch(port,dataDir){
 const child=spawn(process.execPath,["server.js"],{
  cwd:process.cwd(),env:{...process.env,PORT:String(port),BOLT_DATA_DIR:dataDir,
   BOLT_ADMIN_USER:"update-admin",BOLT_ADMIN_PASSWORD:"update-admin-password-for-tests"},
  stdio:["ignore","pipe","pipe"]
 });
 let errors="";
 child.stderr.on("data",chunk=>{errors+=chunk.toString().slice(-2000)});
 const origin="http://127.0.0.1:"+port;
 for(let attempt=0;attempt<130;attempt++){
  if(child.exitCode!==null)throw Error("Server stopped: "+errors);
  try{if((await fetch(origin+"/api/me")).status===401)return {child,origin};}catch{}
  await new Promise(resolve=>setTimeout(resolve,150));
 }
 child.kill("SIGTERM");
 throw Error("Server did not start: "+errors);
}

async function request(origin,route,cookie="",method="GET",body){
 const response=await fetch(origin+route,{
  method,headers:{"Content-Type":"application/json",...(cookie?{Cookie:cookie}:{})},
  body:body===undefined?undefined:JSON.stringify(body)
 });
 return {status:response.status,data:await response.json().catch(()=>({})),
  cookie:response.headers.get("set-cookie")?.split(";")[0]||""};
}

test("Admins can publish, edit, remove and persist any plain-text release note",{timeout:60000},async t=>{
 const dir=mkdtempSync(path.join(tmpdir(),"lightning-update-log-"));
 const port=await freePort();
 let running;
 t.after(async()=>{
  if(running?.exitCode===null){running.kill("SIGTERM");await once(running,"exit").catch(()=>{});}
  rmSync(dir,{recursive:true,force:true});
 });
 let server=await launch(port,dir);running=server.child;
 const origin=server.origin;
 assert.equal((await request(origin,"/api/updates")).status,401);
 assert.equal((await request(origin,"/api/updates","","POST",{body:"Unauthorized"})).status,401);
 const admin=(await request(origin,"/api/login","","POST",{
  username:"update-admin",password:"update-admin-password-for-tests"})).cookie;
 assert.ok(admin.startsWith("bolt_session="));
 const memberResponse=await request(origin,"/api/admin/users",admin,"POST",{
  username:"update-reader",password:"update-reader-password",role:"user"});
 const staffResponse=await request(origin,"/api/admin/users",admin,"POST",{
  username:"update-staff",password:"update-staff-password",role:"account_manager"});
 assert.equal(memberResponse.status,201);
 assert.equal(staffResponse.status,201);
 const member=(await request(origin,"/api/login","","POST",{
  username:"update-reader",password:"update-reader-password"})).cookie;
 const staff=(await request(origin,"/api/login","","POST",{
  username:"update-staff",password:"update-staff-password"})).cookie;
 const read=await request(origin,"/api/updates",member);
 assert.equal(read.status,200);assert.equal(read.data.canEdit,false);
 assert.deepEqual(read.data.updates,[]);
 assert.equal((await request(origin,"/api/updates",member,"POST",{title:"No",body:"Not allowed"})).status,403);
 assert.equal((await request(origin,"/api/updates",staff,"POST",{title:"No",body:"Not allowed"})).status,403);
 assert.equal((await request(origin,"/api/updates",admin,"POST",{body:"  "})).status,400);
 assert.equal((await request(origin,"/api/updates",admin,"POST",{body:"x".repeat(30001)})).status,400);
 const raw='⚡ Patch 1.0\n\nFixed a bug, shipped something new.\n<script>alert("unsafe")</script>\n💚 Thanks!';
 const published=await request(origin,"/api/updates",admin,"POST",{title:"",body:raw});
 assert.equal(published.status,201);
 const id=published.data.update.id;
 assert.ok(id.startsWith("upd_"));
 assert.equal(published.data.update.body,raw);
 const visible=await request(origin,"/api/updates",member);
 assert.equal(visible.status,200);assert.equal(visible.data.updates[0].body,raw);
 assert.equal(visible.data.updates[0].author,"update-admin");
 assert.equal(visible.data.canEdit,false);
 const adminRead=await request(origin,"/api/updates",admin);
 assert.equal(adminRead.data.canEdit,true);
 assert.equal((await request(origin,"/api/updates/"+id,member,"PATCH",{body:"No edits"})).status,403);
 assert.equal((await request(origin,"/api/updates/"+id,staff,"DELETE")).status,403);
 const edited=await request(origin,"/api/updates/"+id,admin,"PATCH",{title:"Official change",body:"Edited\nwith line breaks ✦"});
 assert.equal(edited.status,200);
 assert.equal(edited.data.update.title,"Official change");
 assert.equal(edited.data.update.body,"Edited\nwith line breaks ✦");
 assert.ok(edited.data.update.updatedAt);
 const saved=JSON.parse(readFileSync(path.join(dir,"bolt.json"),"utf8"));
 assert.equal(saved.updates[0].id,id);
 assert.equal(saved.updates[0].body,"Edited\nwith line breaks ✦");
 assert.ok(saved.audit.some(event=>event.action==="update.published"));
 assert.ok(saved.audit.some(event=>event.action==="update.edited"));
 running.kill("SIGTERM");await once(running,"exit");
 server=await launch(port,dir);running=server.child;
 const restored=await request(origin,"/api/updates",member);
 assert.equal(restored.status,200);
 assert.equal(restored.data.updates[0].id,id);
 assert.equal(restored.data.updates[0].body,"Edited\nwith line breaks ✦");
 assert.equal((await request(origin,"/api/updates/"+id,admin,"DELETE")).status,200);
 assert.equal((await request(origin,"/api/updates",member)).data.updates.length,0);
 assert.equal((await request(origin,"/api/updates/"+id,admin,"PATCH",{body:"Gone"})).status,404);
 assert.ok(JSON.parse(readFileSync(path.join(dir,"bolt.json"),"utf8")).audit.some(event=>event.action==="update.deleted"));
});

test("Update log interface escapes admin-entered markup instead of rendering it as HTML",()=>{
 const source=readFileSync(new URL("../public/assets/update-log.js",import.meta.url),"utf8");
 assert.match(source,/escapeHtml\(entry\.title\)/);
 assert.match(source,/escapeHtml\(entry\.body\)/);
 assert.match(source,/data\.canEdit===true/);
 assert.match(source,/maxlength="30000"/);
 assert.match(source,/Publish update/);
});
