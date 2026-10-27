import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {createCommunityStore} from "../community-v2.js";

function harness(){
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),"lightning-v2-"));
  const sent=[];
  const store=createCommunityStore({
    dataDir,
    sendToUser:(id,event)=>sent.push({id,...event}),
    sendAll:event=>sent.push({id:"ALL",...event})
  });
  const alice={id:"alice",name:"Alice",role:"user"};
  const bob={id:"bob",name:"Bob",role:"user"};
  return {store,sent,alice,bob,dataDir};
}
test("V2 creates persisted community servers with real channel membership",t=>{
  const h=harness();t.after(()=>fs.rmSync(h.dataDir,{recursive:true,force:true}));
  h.store.handle(h.alice,{type:"v2Create",name:"Game Room",icon:"🎮",description:"Play with friends"});
  const directory=h.store.directory();assert.equal(directory.length,2);
  assert.equal(directory.find(s=>!s.permanent).name,"Game Room");
  const server=h.store.snapshot("alice").servers.find(s=>!s.permanent);
  assert.deepEqual(server.channels.map(c=>c.id),["general","introductions","gaming"]);
  assert.equal(h.store.snapshot("bob").servers.length,1);
  assert.equal(fs.existsSync(path.join(h.dataDir,"lightning-v2-communities.json")),true);
  const restored=createCommunityStore({dataDir:h.dataDir,sendToUser:()=>{},sendAll:()=>{}});
  assert.equal(restored.snapshot("alice").servers.find(s=>!s.permanent).name,"Game Room");
});
test("Only joined members can send messages and only owners add channels",t=>{
  const h=harness();t.after(()=>fs.rmSync(h.dataDir,{recursive:true,force:true}));
  h.store.handle(h.alice,{type:"v2Create",name:"Creators Club"});
  const id=h.store.directory().find(s=>!s.permanent).id;
  h.store.handle(h.bob,{type:"v2Message",serverId:id,channel:"general",message:"unauthorized"});
  assert.equal(h.store.snapshot("alice").servers.find(s=>!s.permanent).messages.general.length,0);
  h.store.handle(h.bob,{type:"v2AddChannel",serverId:id,name:"private"});
  assert.equal(h.store.snapshot("alice").servers.find(s=>!s.permanent).channels.length,3);
  h.store.handle(h.bob,{type:"v2Join",serverId:id});
  h.store.handle(h.bob,{type:"v2Message",serverId:id,channel:"general",message:"Hello everyone"});
  assert.equal(h.store.snapshot("alice").servers.find(s=>!s.permanent).messages.general[0].by,"Bob");
  h.store.handle(h.bob,{type:"v2AddChannel",serverId:id,name:"testing"});
  assert.equal(h.store.snapshot("alice").servers.find(s=>!s.permanent).channels.length,3);
  h.store.handle(h.alice,{type:"v2AddChannel",serverId:id,name:"testing"});
  assert.equal(h.store.snapshot("bob").servers.find(s=>!s.permanent).channels[3].id,"testing");
  assert.ok(h.sent.some(msg=>msg.type==="v2Message"&&msg.id==="alice"));
});
test("Message deletion is author- or owner-only and leaving revokes access",t=>{
  const h=harness();t.after(()=>fs.rmSync(h.dataDir,{recursive:true,force:true}));
  h.store.handle(h.alice,{type:"v2Create",name:"Chess Friends"});
  const serverId=h.store.directory().find(s=>!s.permanent).id;
  h.store.handle(h.bob,{type:"v2Join",serverId});
  h.store.handle(h.alice,{type:"v2Message",serverId,channel:"general",message:"Permanent message"});
  const messageId=h.store.snapshot("alice").servers.find(s=>!s.permanent).messages.general[0].id;
  h.store.handle(h.bob,{type:"v2DeleteMessage",serverId,channel:"general",messageId});
  assert.equal(h.store.snapshot("alice").servers.find(s=>!s.permanent).messages.general[0].deleted,undefined);
  h.store.handle(h.alice,{type:"v2DeleteMessage",serverId,channel:"general",messageId});
  assert.equal(h.store.snapshot("bob").servers.find(s=>!s.permanent).messages.general[0].deleted,true);
  h.store.handle(h.bob,{type:"v2Leave",serverId});
  assert.equal(h.store.snapshot("bob").servers.length,1);
  h.store.handle(h.bob,{type:"v2Message",serverId,channel:"general",message:"should be blocked"});
  assert.equal(h.store.snapshot("alice").servers.find(s=>!s.permanent).messages.general.length,1);
});

test("Main Lightning server is automatic and cannot be left",t=>{
 const h=harness();t.after(()=>fs.rmSync(h.dataDir,{recursive:true,force:true}));
 const main=h.store.snapshot(h.alice).servers.find(s=>s.permanent);
 assert.equal(main.id,"lightning-main");
 assert.ok(main.channels.some(c=>c.id==="announcements"&&c.readOnly));
 assert.equal(main.canManage,false);
 h.store.handle(h.alice,{type:"v2Leave",serverId:"lightning-main"});
 assert.ok(h.store.snapshot(h.alice).servers.some(s=>s.id==="lightning-main"));
 h.store.handle(h.alice,{type:"v2Message",serverId:"lightning-main",channel:"announcements",message:"blocked"});
 assert.equal(h.store.snapshot(h.alice).servers.find(s=>s.permanent).messages.announcements.length,0);
});
test("Platform admins manage channels and display roles while users cannot",t=>{
 const h=harness();t.after(()=>fs.rmSync(h.dataDir,{recursive:true,force:true}));
 const admin={id:"admin1",name:"Admin",role:"admin"};
 assert.equal(h.store.snapshot(admin).servers.find(s=>s.permanent).canManage,true);
 h.store.snapshot(h.alice);
 h.store.handle(admin,{type:"v2Message",serverId:"lightning-main",channel:"announcements",message:"Official news"});
 assert.equal(h.store.snapshot(h.alice).servers.find(s=>s.permanent).messages.announcements[0].message,"Official news");
 h.store.handle(h.alice,{type:"v2AddChannel",serverId:"lightning-main",name:"not-allowed"});
 h.store.handle(admin,{type:"v2AddChannel",serverId:"lightning-main",name:"events",category:"INFORMATION",readOnly:true});
 h.store.handle(admin,{type:"v2CreateRole",serverId:"lightning-main",name:"Helper",color:"#BBAA99"});
 h.store.handle(admin,{type:"v2AssignRole",serverId:"lightning-main",memberId:"alice",roleId:"helper"});
 const server=h.store.snapshot(h.alice).servers.find(s=>s.permanent);
 assert.equal(server.members.find(m=>m.id==="alice").role,"helper");
 assert.ok(server.channels.some(c=>c.id==="events"));
 assert.ok(!server.channels.some(c=>c.id==="not-allowed"));
 h.store.handle(admin,{type:"v2DeleteChannel",serverId:"lightning-main",channel:"announcements"});
 assert.ok(h.store.snapshot(admin).servers.find(s=>s.permanent).channels.some(c=>c.id==="announcements"));
});
test("Staff-only channel contents never reach regular members",t=>{
 const h=harness();t.after(()=>fs.rmSync(h.dataDir,{recursive:true,force:true}));
 const admin={id:"admin1",name:"Admin",role:"admin"};
 h.store.snapshot(admin);h.store.snapshot(h.alice);
 h.store.handle(admin,{type:"v2AddChannel",serverId:"lightning-main",name:"staff-room",staffOnly:true});
 assert.ok(!h.store.snapshot(h.alice).servers.find(s=>s.permanent).channels.some(c=>c.id==="staff-room"));
 h.sent.length=0;
 h.store.handle(admin,{type:"v2Message",serverId:"lightning-main",channel:"staff-room",message:"private"});
 assert.ok(!h.sent.some(m=>m.type==="v2Message"&&m.id==="alice"));
});

test("Admin profiles persist in existing servers and survive legacy snapshot reads",t=>{
 const h=harness();t.after(()=>fs.rmSync(h.dataDir,{recursive:true,force:true}));
 h.store.handle(h.alice,{type:"v2Create",name:"Game Lounge"});
 const server=h.store.directory().find(s=>!s.permanent);
 const admin={id:"admin-id",name:"Operator",role:"admin"};
 h.store.handle(admin,{type:"v2Join",serverId:server.id});
 assert.equal(h.store.snapshot(admin).servers.find(s=>s.id===server.id).canManage,true);
 assert.equal(h.store.snapshot(admin.id).servers.find(s=>s.id===server.id).canManage,true);
 assert.equal(h.store.snapshot(admin.id).servers.find(s=>s.id===server.id).members.find(m=>m.id===admin.id).name,"Operator");
 h.store.handle(admin,{type:"v2CreateRole",serverId:server.id,name:"Reader"});
 assert.ok(h.store.snapshot(admin).servers.find(s=>s.id===server.id).roles.some(r=>r.id==="reader"));
 admin.role="user";
 const demoted=h.store.snapshot(admin).servers.find(s=>s.id===server.id);
 assert.equal(demoted.canManage,false);
 assert.equal(demoted.members.find(m=>m.id===admin.id).admin,false);
});
