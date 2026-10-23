import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";

async function freePort(){
  const server=net.createServer();
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  const port=server.address().port;
  await new Promise(resolve=>server.close(resolve));
  return port;
}
async function launch(t){
  const dir=mkdtempSync(path.join(tmpdir(),"lightning-auth-check-"));
  const port=await freePort();
  const proc=spawn(process.execPath,["server.js"],{
    cwd:process.cwd(),
    env:{...process.env,PORT:String(port),BOLT_DATA_DIR:dir,BOLT_ADMIN_USER:"test-admin",
      BOLT_ADMIN_PASSWORD:"test-admin-not-a-real-password",BOLT_SESSION_TTL_HOURS:"1"},
    stdio:["ignore","pipe","pipe"]
  });
  let stderr="";
  proc.stderr.on("data",data=>{stderr+=data.toString().slice(-6000)});
  const origin="http://127.0.0.1:"+port;
  t.after(()=>{
    proc.kill("SIGTERM");
    rmSync(dir,{recursive:true,force:true});
  });
  for(let attempt=0;attempt<125;attempt++){
    if(proc.exitCode!==null)throw new Error("Server did not start: "+stderr.slice(-900));
    try{
      const response=await fetch(origin+"/api/me");
      if(response.status===401)return origin;
    }catch{}
    await new Promise(resolve=>setTimeout(resolve,240));
  }
  throw new Error("Server start timed out: "+stderr.slice(-1200));
}
async function json(url,method,body,cookie=""){
  const r=await fetch(url,{method,
    headers:{"Content-Type":"application/json",...(cookie?{Cookie:cookie}:{})},
    body:body===undefined?undefined:JSON.stringify(body)});
  const result=await r.json().catch(()=>({}));
  return {r,status:r.status,body:result,cookie:r.headers.get("set-cookie")?.split(";")[0]||""};
}
test("registration is locked until manual admin approval, and codes are retired", {timeout:50000},async t=>{
  const origin=await launch(t);
  const request=await json(origin+"/api/register","POST",{username:"new-member",password:"example-test-password-123"});
  assert.equal(request.status,201);
  assert.equal(request.body.status,"pending");
  assert.equal(request.cookie,"");
  const pending=await json(origin+"/api/login","POST",{username:"new-member",password:"example-test-password-123"});
  assert.equal(pending.status,403);
  assert.equal(pending.body.status,"pending");
  const failedCode=await json(origin+"/api/access/redeem","POST",{code:"BOLT-OLD"});
  assert.equal(failedCode.status,404);
  const admin=await json(origin+"/api/login","POST",{username:"test-admin",password:"test-admin-not-a-real-password"});
  assert.equal(admin.status,200);
  assert.ok(admin.cookie.startsWith("bolt_session="));
  const listing=await json(origin+"/api/admin/state","GET",undefined,admin.cookie);
  assert.equal(listing.status,200);
  const member=listing.body.users.find(user=>user.username==="new-member");
  assert.equal(member.approved,false);
  const approval=await json(origin+"/api/admin/users/"+member.id,"PATCH",{approved:true},admin.cookie);
  assert.equal(approval.status,200);
  assert.equal(approval.body.user.approved,true);
  const login=await json(origin+"/api/login","POST",{username:"new-member",password:"example-test-password-123"});
  assert.equal(login.status,200);
  assert.ok(login.cookie.startsWith("bolt_session="));
  const features=await json(origin+"/api/config","GET",undefined,login.cookie);
  assert.equal(features.status,200);
  const revoke=await json(origin+"/api/admin/users/"+member.id,"PATCH",{approved:false},admin.cookie);
  assert.equal(revoke.status,200);
  const blocked=await json(origin+"/api/config","GET",undefined,login.cookie);
  assert.equal(blocked.status,401);
});
