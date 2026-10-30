import test from "node:test";
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import net from "node:net";

async function freePort(){
 const socket=net.createServer();
 await new Promise(resolve=>socket.listen(0,"127.0.0.1",resolve));
 const port=socket.address().port;
 await new Promise(resolve=>socket.close(resolve));
 return port;
}
async function start(t){
 const dir=mkdtempSync(path.join(tmpdir(),"learning-portal-test-"));
 const port=await freePort();
 const child=spawn(process.execPath,["server.js"],{
  cwd:process.cwd(),
  env:{...process.env,PORT:String(port),BOLT_DATA_DIR:dir,
   BOLT_ADMIN_USER:"portal-admin",BOLT_ADMIN_PASSWORD:"portal-test-password"},
  stdio:["ignore","pipe","pipe"]
 });
 let errors="";
 child.stderr.on("data",chunk=>errors+=chunk.toString().slice(-1000));
 t.after(()=>{child.kill("SIGTERM");rmSync(dir,{recursive:true,force:true});});
 const origin="http://127.0.0.1:"+port;
 for(let i=0;i<130;i++){
  if(child.exitCode!==null)throw Error("Server stopped: "+errors);
  try{if((await fetch(origin+"/api/me")).status===401)return origin;}catch{}
  await new Promise(resolve=>setTimeout(resolve,170));
 }
 throw Error("Server did not start: "+errors);
}
test("Learning portal is the public landing page; links reveal the signed-in workspace",{timeout:60000},async t=>{
 const origin=await start(t);
 const noFollow={redirect:"manual"};
 const landing=await fetch(origin+"/",noFollow);
 assert.equal(landing.status,200);
 const html=await landing.text();
 assert.match(html,/<title>Brightpath — Learning Dashboard<\/title>/);
 assert.match(html,/Explore by subject/);
 assert.match(html,/Mathematics/);
 assert.match(html,/Learning resources/);
 assert.doesNotMatch(html,/\b(?:lightning|games?|chess|arcade|proxy|entertainment|scramjet|worldpvp)\b/i);
 const destinations=[...html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)].map(match=>match[1]);
 assert.ok(destinations.length>15);
 assert.deepEqual([...new Set(destinations)],["/workspace"]);
 const style=await fetch(origin+"/assets/learning-portal.css?v=1");
 assert.equal(style.status,200);
 const css=await style.text();
 assert.match(css,/\.subject-grid/);
 assert.doesNotMatch(css,/\b(?:lightning|games?|arcade|proxy|scramjet|worldpvp)\b/i);
 assert.equal((await fetch(origin+"/assets/brightpath-icon.svg")).status,200);
 const gated=await fetch(origin+"/workspace",noFollow);
 assert.equal(gated.status,302);
 assert.equal(gated.headers.get("location"),"/login");
 assert.equal((await fetch(origin+"/login",noFollow)).status,200);
 const invite="a".repeat(32);
 const invited=await fetch(origin+"/?invite="+invite,noFollow);
 assert.equal(invited.status,302);
 assert.equal(invited.headers.get("location"),"/login?invite="+invite);
 const login=await fetch(origin+"/api/login",{
  method:"POST",headers:{"Content-Type":"application/json"},
  body:JSON.stringify({username:"portal-admin",password:"portal-test-password"})
 });
 assert.equal(login.status,200);
 const cookie=login.headers.get("set-cookie")?.split(";")[0];
 assert.ok(cookie?.startsWith("bolt_session="));
 const auth={...noFollow,headers:{Cookie:cookie}};
 const authenticatedLanding=await fetch(origin+"/",auth);
 assert.equal(authenticatedLanding.status,200);
 assert.match(await authenticatedLanding.text(),/Brightpath — Learning Dashboard/);
 const workspace=await fetch(origin+"/workspace",auth);
 assert.equal(workspace.status,200);
 assert.match(await workspace.text(),/<title>Lightning<\/title>/);
 const signedInLogin=await fetch(origin+"/login",auth);
 assert.equal(signedInLogin.status,302);
 assert.equal(signedInLogin.headers.get("location"),"/workspace");
 const signedInvite=await fetch(origin+"/?invite="+invite,auth);
 assert.equal(signedInvite.status,302);
 assert.equal(signedInvite.headers.get("location"),"/workspace?invite="+invite);
 const launch=await fetch(origin+"/launch");
 assert.equal(launch.status,200);
 const launcher=await launch.text();
 assert.match(launcher,/new URL\("\/workspace", location\.href\)/);
});
