import test from "node:test";
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import net from "node:net";
import {ROLE_OPTIONS,hasPermission,canManageAccount,isValidRole} from "../staff-roles.js";
import {createCommunityStore} from "../community-v2.js";

test("Staff roles are real server permissions, not display badges",()=>{
 const expected=["user","support_agent","moderator","community_manager","account_manager","admin"];
 assert.deepEqual(ROLE_OPTIONS.map(role=>role.id),expected);
 for(const role of expected)assert.equal(isValidRole(role),true);
 assert.equal(isValidRole("super_admin"),false);
 assert.equal(hasPermission("account_manager","accounts.manage"),true);
 assert.equal(hasPermission("account_manager","roles.assign"),false);
 assert.equal(hasPermission("account_manager","settings.manage"),false);
 assert.equal(hasPermission("support_agent","accounts.read"),true);
 assert.equal(hasPermission("support_agent","accounts.manage"),false);
 assert.equal(hasPermission("moderator","community.moderate"),true);
 assert.equal(hasPermission("moderator","community.manage"),false);
 assert.equal(hasPermission("community_manager","community.manage"),true);
 assert.equal(hasPermission("admin","roles.assign"),true);
 assert.equal(canManageAccount({id:"staff",role:"account_manager"},{id:"target",role:"user"}),true);
 assert.equal(canManageAccount({id:"staff",role:"account_manager"},{id:"target",role:"moderator"}),false);
 assert.equal(canManageAccount({id:"staff",role:"support_agent"},{id:"target",role:"user"}),false);
});

test("Moderators can delete messages, but only community managers can edit channels",t=>{
 const dir=mkdtempSync(path.join(tmpdir(),"lightning-staff-community-"));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const store=createCommunityStore({dataDir:dir,sendToUser:()=>{},sendAll:()=>{}});
 const member={id:"member",name:"Member",role:"user"};
 const mod={id:"mod",name:"Mod",role:"moderator"};
 const manager={id:"manager",name:"Manager",role:"community_manager"};
 const support={id:"support",name:"Support",role:"support_agent"};
 for(const user of [member,mod,manager,support])store.snapshot(user);
 const server="lightning-main";
 store.handle(member,{type:"v2Message",serverId:server,channel:"general",message:"Example to moderate"});
 const msg=store.snapshot(mod).servers[0].messages.general[0];
 assert.equal(store.snapshot(mod).servers[0].canModerate,true);
 assert.equal(store.snapshot(mod).servers[0].canManage,false);
 store.handle(support,{type:"v2DeleteMessage",serverId:server,channel:"general",messageId:msg.id});
 assert.equal(store.snapshot(member).servers[0].messages.general.length,1);
 store.handle(mod,{type:"v2AddChannel",serverId:server,name:"blocked-channel"});
 assert.equal(store.snapshot(mod).servers[0].channels.some(c=>c.id==="blocked-channel"),false);
 store.handle(mod,{type:"v2DeleteMessage",serverId:server,channel:"general",messageId:msg.id});
 assert.equal(store.snapshot(member).servers[0].messages.general.length,0);
 store.handle(manager,{type:"v2AddChannel",serverId:server,name:"team-news"});
 assert.equal(store.snapshot(member).servers[0].channels.some(c=>c.id==="team-news"),true);
});

async function port(){
 const srv=net.createServer();
 await new Promise(resolve=>srv.listen(0,"127.0.0.1",resolve));
 const n=srv.address().port;
 await new Promise(resolve=>srv.close(resolve));return n;
}
async function launch(t){
 const dir=mkdtempSync(path.join(tmpdir(),"lightning-staff-api-"));
 const p=await port();
 const proc=spawn(process.execPath,["server.js"],{
  cwd:process.cwd(),env:{...process.env,PORT:String(p),BOLT_DATA_DIR:dir,
   BOLT_ADMIN_USER:"staff-root",BOLT_ADMIN_PASSWORD:"root-password-for-testing"},
  stdio:["ignore","pipe","pipe"]
 });
 let errors="";
 proc.stderr.on("data",d=>errors+=d.toString().slice(-1000));
 t.after(()=>{proc.kill("SIGTERM");rmSync(dir,{recursive:true,force:true})});
 const origin="http://127.0.0.1:"+p;
 for(let attempt=0;attempt<130;attempt++){
  if(proc.exitCode!==null)throw Error("Server crashed: "+errors);
  try{if((await fetch(origin+"/api/me")).status===401)return origin;}catch{}
  await new Promise(resolve=>setTimeout(resolve,175));
 }
 throw Error("Unable to launch: "+errors);
}
async function request(origin,path,cookie="",method="GET",data){
 const res=await fetch(origin+path,{method,
  headers:{"Content-Type":"application/json",...(cookie?{Cookie:cookie}:{})},
  body:data===undefined?undefined:JSON.stringify(data)});
 return {status:res.status,body:await res.json().catch(()=>({})),
  cookie:res.headers.get("set-cookie")?.split(";")[0]||""};
}

test("Account Managers can manage members, but no staff can self-promote",{timeout:60000},async t=>{
 const origin=await launch(t);
 const root=(await request(origin,"/api/login","","POST",{username:"staff-root",password:"root-password-for-testing"})).cookie;
 assert.ok(root);
 const created={};
 for(const role of ["account_manager","community_manager","moderator","support_agent","user"]){
  const name="test-"+role.replaceAll("_","-");
  const response=await request(origin,"/api/admin/users",root,"POST",{username:name,password:"member-test-password",role});
  assert.equal(response.status,201,role);
  created[role]=response.body.user;
 }
 const login=async role=>(await request(origin,"/api/login","","POST",{
  username:created[role].username,password:"member-test-password"})).cookie;
 const account=await login("account_manager"),support=await login("support_agent");
 const mod=await login("moderator"),community=await login("community_manager");
 const target=created.user.id;
 const accountState=await request(origin,"/api/admin/state",account);
 assert.equal(accountState.status,200);
 assert.ok(accountState.body.permissions.includes("accounts.manage"));
 assert.ok(accountState.body.users.every(u=>u.role==="user"));
 assert.deepEqual(accountState.body.sessions,[]);
 assert.deepEqual(accountState.body.audit,[]);
 assert.equal(accountState.body.settings,null);
 assert.equal((await request(origin,"/api/admin/users/"+target,account,"PATCH",{enabled:false})).status,200);
 assert.equal((await request(origin,"/api/admin/users/"+target,account,"PATCH",{enabled:true})).status,200);
 assert.equal((await request(origin,"/api/admin/users/"+target,account,"PATCH",{role:"admin"})).status,403);
 assert.equal((await request(origin,"/api/admin/users",account,"POST",{username:"bad-staff",password:"sample-password",role:"moderator"})).status,403);
 assert.equal((await request(origin,"/api/admin/users/"+created.moderator.id,account,"PATCH",{enabled:false})).status,403);
 assert.equal((await request(origin,"/api/admin/users/"+created.moderator.id,account,"DELETE")).status,403);
 assert.equal((await request(origin,"/api/admin/users/"+created.moderator.id+"/revoke",account,"POST",{})).status,403);
 assert.equal((await request(origin,"/api/admin/settings",account,"PATCH",{maintenance:true})).status,403);
 const createdMember=await request(origin,"/api/admin/users",account,"POST",{username:"managed-member",password:"sample-password"});
 assert.equal(createdMember.status,201);
 assert.equal(createdMember.body.user.role,"user");
 const supportState=await request(origin,"/api/admin/state",support);
 assert.equal(supportState.status,200);
 assert.ok(supportState.body.users.every(u=>u.role==="user"));
 assert.ok(supportState.body.permissions.includes("accounts.read"));
 assert.equal((await request(origin,"/api/admin/users/"+target,support,"PATCH",{approved:false})).status,403);
 assert.equal((await request(origin,"/api/admin/users",mod,"POST",{username:"bad-create",password:"sample-password"})).status,403);
 assert.equal((await request(origin,"/api/admin/users",community,"POST",{username:"bad-create",password:"sample-password"})).status,403);
 assert.equal((await request(origin,"/api/admin/state",mod)).body.users.length,0);
 assert.equal((await request(origin,"/api/admin/state",community)).body.users.length,0);
 const invalid=await request(origin,"/api/admin/users/"+target,root,"PATCH",{role:"ghost"});
 assert.equal(invalid.status,400);
 assert.equal((await request(origin,"/api/admin/users/"+created.account_manager.id,root,"PATCH",{role:"support_agent"})).status,200);
 const demoted=await request(origin,"/api/admin/users",account,"POST",{username:"nope",password:"sample-password"});
 assert.equal(demoted.status,403);
 const rootState=await request(origin,"/api/admin/state",root);
 const self=rootState.body.users.find(u=>u.username==="staff-root");
 assert.equal((await request(origin,"/api/admin/users/"+self.id,root,"PATCH",{role:"moderator"})).status,400);
});
