import test from "node:test";
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import net from "node:net";

const credentials={username:"single-session-admin",password:"single-session-test-password"};
async function freePort(){
 const server=net.createServer();
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 const port=server.address().port;
 await new Promise(resolve=>server.close(resolve));
 return port;
}
async function launch(t,dir){
 const port=await freePort(),child=spawn(process.execPath,["server.js"],{
  cwd:process.cwd(),
  env:{...process.env,PORT:String(port),BOLT_DATA_DIR:dir,BOLT_ADMIN_USER:credentials.username,
   BOLT_ADMIN_PASSWORD:credentials.password,BOLT_SESSION_IDLE_MINUTES:"30"},
  stdio:["ignore","pipe","pipe"]
 });
 let errors="";
 child.stderr.on("data",chunk=>errors+=chunk.toString().slice(-1000));
 t.after(()=>{if(child.exitCode===null)child.kill("SIGTERM");});
 const origin="http://127.0.0.1:"+port;
 for(let attempt=0;attempt<125;attempt++){
  if(child.exitCode!==null)throw Error("Server exited: "+errors);
  try{if((await fetch(origin+"/api/me")).status===401)return {origin,child};}catch{}
  await new Promise(resolve=>setTimeout(resolve,160));
 }
 throw Error("Server did not start: "+errors);
}
async function request(origin,route,{cookie="",method="GET",body}={}){
 const res=await fetch(origin+route,{method,headers:{
  "Content-Type":"application/json",...(cookie?{Cookie:cookie}:{})
 },body:body===undefined?undefined:JSON.stringify(body)});
 return {status:res.status,data:await res.json().catch(()=>({})),
  cookie:res.headers.get("set-cookie")?.split(";")[0]||""};
}
const signIn=(origin,credentials,cookie="")=>request(origin,"/api/login",{
 method:"POST",cookie,body:credentials
});

test("Only one active login exists per account and the old session stays valid on a rejected login",{timeout:50000},async t=>{
 const dir=mkdtempSync(path.join(tmpdir(),"lightning-single-login-"));
 t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const {origin}=await launch(t,dir);
 const [first,second]=await Promise.all([signIn(origin,credentials),signIn(origin,credentials)]);
 const outcomes=[first.status,second.status].sort();
 assert.deepEqual(outcomes,[200,409]);
 const accepted=first.status===200?first:second,denied=first.status===409?first:second;
 assert.ok(accepted.cookie.startsWith("bolt_session="));
 assert.equal(denied.cookie,"");
 assert.equal(denied.data.code,"ACCOUNT_ALREADY_SIGNED_IN");
 assert.match(denied.data.error,/already signed in/i);
 assert.equal((await request(origin,"/api/me",{cookie:accepted.cookie})).status,200);
 const sameBrowser=await signIn(origin,credentials,accepted.cookie);
 assert.equal(sameBrowser.status,200);
 assert.equal(sameBrowser.data.alreadySignedIn,true);
 assert.equal(sameBrowser.cookie,"");
 assert.equal((await request(origin,"/api/logout",{cookie:accepted.cookie,method:"POST"})).status,200);
 assert.equal((await request(origin,"/api/me",{cookie:accepted.cookie})).status,401);
 const fresh=await signIn(origin,credentials);
 assert.equal(fresh.status,200);
 assert.notEqual(fresh.cookie,accepted.cookie);
 assert.equal((await request(origin,"/api/me",{cookie:fresh.cookie})).status,200);
});

test("Admin session revocation and idle session expiry release the account without allowing overlap",{timeout:50000},async t=>{
 const dir=mkdtempSync(path.join(tmpdir(),"lightning-session-release-"));
 t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const {origin,child}=await launch(t,dir);
 const admin=await signIn(origin,credentials);
 const created=await request(origin,"/api/admin/users",{
  cookie:admin.cookie,method:"POST",
  body:{username:"single-user",password:"member-password-456"}
 });
 assert.equal(created.status,201);
 const memberCredentials={username:"single-user",password:"member-password-456"};
 const member=await signIn(origin,memberCredentials);
 assert.equal(member.status,200);
 assert.equal((await signIn(origin,memberCredentials)).status,409);
 const revoked=await request(origin,"/api/admin/sessions/revoke-users",{
  cookie:admin.cookie,method:"POST",body:{}
 });
 assert.equal(revoked.status,200);
 assert.equal((await request(origin,"/api/me",{cookie:member.cookie})).status,401);
 const next=await signIn(origin,memberCredentials);
 assert.equal(next.status,200);
 assert.equal((await signIn(origin,memberCredentials)).status,409);

 // Simulate a previously active member that went idle while the server
 // restarted. It must not lock the account until the absolute TTL expires.
 await new Promise(resolve=>{
  child.once("exit",resolve);
  child.kill("SIGTERM");
 });
 const dataFile=path.join(dir,"bolt.json");
 const state=JSON.parse(readFileSync(dataFile,"utf8"));
 const active=state.sessions.find(entry=>entry.userId===created.data.user.id);
 assert.ok(active,"member session was saved");
 active.lastSeenAt=Date.now()-31*60*1000;
 writeFileSync(dataFile,JSON.stringify(state));
 const restarted=await launch(t,dir);
 assert.equal((await request(restarted.origin,"/api/me",{cookie:next.cookie})).status,401);
 const reclaimed=await signIn(restarted.origin,memberCredentials);
 assert.equal(reclaimed.status,200);
 assert.equal((await request(restarted.origin,"/api/me",{cookie:reclaimed.cookie})).status,200);
});
