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
  h.store.handle(h.bob,{type:"v2React",serverId,channel:"general",messageId,emoji:"❤️"});
  assert.ok(h.store.snapshot("alice").servers.find(s=>!s.permanent).messages.general[0].reactions["❤️"].includes("bob"));
  h.store.handle(h.alice,{type:"v2DeleteMessage",serverId,channel:"general",messageId});
  assert.equal(h.store.snapshot("bob").servers.find(s=>!s.permanent).messages.general.length,0);
  h.store.handle(h.bob,{type:"v2Leave",serverId});
  assert.equal(h.store.snapshot("bob").servers.length,1);
  h.store.handle(h.bob,{type:"v2Message",serverId,channel:"general",message:"should be blocked"});
  assert.equal(h.store.snapshot("alice").servers.find(s=>!s.permanent).messages.general.length,0);
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

test("Admins can create roles and delete other members' messages",t=>{
 const h=harness();t.after(()=>fs.rmSync(h.dataDir,{recursive:true,force:true}));
 const admin={id:"moderator",name:"Mod",role:"admin"};
 h.store.snapshot(admin);h.store.snapshot(h.alice);h.store.snapshot(h.bob);
 h.store.handle(admin,{type:"v2CreateRole",serverId:"lightning-main",name:"Event Team",color:"#aaccee"});
 const main=h.store.snapshot(admin).servers.find(s=>s.permanent);
 assert.ok(main.roles.some(r=>r.id==="event-team"&&r.name==="Event Team"));
 h.store.handle(h.alice,{type:"v2CreateRole",serverId:"lightning-main",name:"Not allowed"});
 assert.equal(h.store.snapshot(admin).servers.find(s=>s.permanent).roles.length,2);
 h.store.handle(h.bob,{type:"v2Message",serverId:"lightning-main",channel:"general",message:"Please remove this"});
 const message=h.store.snapshot(admin).servers.find(s=>s.permanent).messages.general.at(-1);
 h.store.handle(h.alice,{type:"v2DeleteMessage",serverId:"lightning-main",channel:"general",messageId:message.id});
 assert.equal(h.store.snapshot(admin).servers.find(s=>s.permanent).messages.general.at(-1).deleted,undefined);
 h.store.handle(admin,{type:"v2DeleteMessage",serverId:"lightning-main",channel:"general",messageId:message.id});
 assert.equal(h.store.snapshot(h.bob).servers.find(s=>s.permanent).messages.general.some(m=>m.id===message.id),false);
 assert.ok(h.sent.some(m=>m.type==="v2MessageDeleted"&&m.id==="bob"));
});

test("Invite-only servers are hidden, restricted, and joinable by an unguessable link",t=>{
 const h=harness();t.after(()=>fs.rmSync(h.dataDir,{recursive:true,force:true}));
 h.store.handle(h.alice,{type:"v2Create",name:"Close Friends",inviteOnly:true});
 const owned=h.store.snapshot(h.alice).servers.find(s=>s.name==="Close Friends");
 assert.equal(owned.inviteOnly,true);
 assert.match(owned.inviteCode,/^[a-f0-9]{32}$/);
 assert.equal(h.store.directory().some(s=>s.name==="Close Friends"),false);
 assert.equal(h.store.snapshot(h.bob).directory.some(s=>s.name==="Close Friends"),false);
 h.store.handle(h.bob,{type:"v2Join",serverId:owned.id});
 assert.equal(h.store.snapshot(h.bob).servers.some(s=>s.id===owned.id),false);
 h.store.handle(h.bob,{type:"v2JoinInvite",inviteCode:"bad-code"});
 assert.equal(h.store.snapshot(h.bob).servers.some(s=>s.id===owned.id),false);
 h.store.handle(h.bob,{type:"v2JoinInvite",inviteCode:owned.inviteCode});
 const joined=h.store.snapshot(h.bob).servers.find(s=>s.id===owned.id);
 assert.ok(joined);
 assert.equal("inviteCode" in joined,false);
 assert.equal(h.store.snapshot(h.alice).servers.find(s=>s.id===owned.id).memberCount,2);
 const replay=createCommunityStore({dataDir:h.dataDir,sendToUser:()=>{},sendAll:()=>{}});
 assert.equal(replay.snapshot(h.alice).servers.find(s=>s.id===owned.id).inviteCode,owned.inviteCode);
});

test("Owners manage privacy, revoke invites, and delete servers for all members",t=>{
 const h=harness();t.after(()=>fs.rmSync(h.dataDir,{recursive:true,force:true}));
 h.store.handle(h.alice,{type:"v2Create",name:"Practice Team"});
 const owned=h.store.snapshot(h.alice).servers.find(s=>s.name==="Practice Team");
 h.store.handle(h.bob,{type:"v2Join",serverId:owned.id});
 h.store.handle(h.bob,{type:"v2SetPrivacy",serverId:owned.id,inviteOnly:true});
 assert.equal(h.store.snapshot(h.alice).servers.find(s=>s.id===owned.id).inviteOnly,false);
 h.store.handle(h.alice,{type:"v2SetPrivacy",serverId:owned.id,inviteOnly:true});
 const original=h.store.snapshot(h.alice).servers.find(s=>s.id===owned.id).inviteCode;
 assert.ok(original);
 assert.equal(h.store.directory().some(s=>s.id===owned.id),false);
 h.store.handle(h.alice,{type:"v2RotateInvite",serverId:owned.id});
 const replacement=h.store.snapshot(h.alice).servers.find(s=>s.id===owned.id).inviteCode;
 assert.notEqual(original,replacement);
 h.store.handle({id:"carol",name:"Carol",role:"user"},{type:"v2JoinInvite",inviteCode:original});
 assert.equal(h.store.snapshot("carol").servers.some(s=>s.id===owned.id),false);
 h.store.handle(h.bob,{type:"v2DeleteServer",serverId:owned.id});
 assert.ok(h.store.snapshot(h.alice).servers.some(s=>s.id===owned.id));
 h.store.handle(h.alice,{type:"v2DeleteServer",serverId:owned.id});
 assert.equal(h.store.snapshot(h.alice).servers.some(s=>s.id===owned.id),false);
 assert.equal(h.store.snapshot(h.bob).servers.some(s=>s.id===owned.id),false);
 assert.ok(h.sent.some(m=>m.id==="bob"&&m.type==="v2State"&&m.selected==="lightning-main"));
 assert.ok(!h.store.directory().some(s=>s.id===owned.id));
 const restarted=createCommunityStore({dataDir:h.dataDir,sendToUser:()=>{},sendAll:()=>{}});
 assert.equal(restarted.snapshot(h.alice).servers.some(s=>s.id===owned.id),false);
});

test("Main server can neither be deleted nor made invite-only",t=>{
 const h=harness();t.after(()=>fs.rmSync(h.dataDir,{recursive:true,force:true}));
 const admin={id:"root",name:"Root",role:"admin"};
 h.store.snapshot(admin);
 h.store.handle(admin,{type:"v2SetPrivacy",serverId:"lightning-main",inviteOnly:true});
 h.store.handle(admin,{type:"v2DeleteServer",serverId:"lightning-main"});
 const main=h.store.snapshot(admin).servers.find(s=>s.id==="lightning-main");
 assert.equal(main.inviteOnly,false);
 assert.ok(main);
});
