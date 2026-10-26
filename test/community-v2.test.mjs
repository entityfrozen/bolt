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
  const directory=h.store.directory();assert.equal(directory.length,1);
  assert.equal(directory[0].name,"Game Room");
  const server=h.store.snapshot("alice").servers[0];
  assert.deepEqual(server.channels.map(c=>c.id),["general","introductions","gaming"]);
  assert.equal(h.store.snapshot("bob").servers.length,0);
  assert.equal(fs.existsSync(path.join(h.dataDir,"lightning-v2-communities.json")),true);
  const restored=createCommunityStore({dataDir:h.dataDir,sendToUser:()=>{},sendAll:()=>{}});
  assert.equal(restored.snapshot("alice").servers[0].name,"Game Room");
});
test("Only joined members can send messages and only owners add channels",t=>{
  const h=harness();t.after(()=>fs.rmSync(h.dataDir,{recursive:true,force:true}));
  h.store.handle(h.alice,{type:"v2Create",name:"Creators Club"});
  const id=h.store.directory()[0].id;
  h.store.handle(h.bob,{type:"v2Message",serverId:id,channel:"general",message:"unauthorized"});
  assert.equal(h.store.snapshot("alice").servers[0].messages.general.length,0);
  h.store.handle(h.bob,{type:"v2AddChannel",serverId:id,name:"private"});
  assert.equal(h.store.snapshot("alice").servers[0].channels.length,3);
  h.store.handle(h.bob,{type:"v2Join",serverId:id});
  h.store.handle(h.bob,{type:"v2Message",serverId:id,channel:"general",message:"Hello everyone"});
  assert.equal(h.store.snapshot("alice").servers[0].messages.general[0].by,"Bob");
  h.store.handle(h.bob,{type:"v2AddChannel",serverId:id,name:"testing"});
  assert.equal(h.store.snapshot("alice").servers[0].channels.length,3);
  h.store.handle(h.alice,{type:"v2AddChannel",serverId:id,name:"testing"});
  assert.equal(h.store.snapshot("bob").servers[0].channels[3].id,"testing");
  assert.ok(h.sent.some(msg=>msg.type==="v2Message"&&msg.id==="alice"));
});
test("Message deletion is author- or owner-only and leaving revokes access",t=>{
  const h=harness();t.after(()=>fs.rmSync(h.dataDir,{recursive:true,force:true}));
  h.store.handle(h.alice,{type:"v2Create",name:"Chess Friends"});
  const serverId=h.store.directory()[0].id;
  h.store.handle(h.bob,{type:"v2Join",serverId});
  h.store.handle(h.alice,{type:"v2Message",serverId,channel:"general",message:"Permanent message"});
  const messageId=h.store.snapshot("alice").servers[0].messages.general[0].id;
  h.store.handle(h.bob,{type:"v2DeleteMessage",serverId,channel:"general",messageId});
  assert.equal(h.store.snapshot("alice").servers[0].messages.general[0].deleted,undefined);
  h.store.handle(h.alice,{type:"v2DeleteMessage",serverId,channel:"general",messageId});
  assert.equal(h.store.snapshot("bob").servers[0].messages.general[0].deleted,true);
  h.store.handle(h.bob,{type:"v2Leave",serverId});
  assert.equal(h.store.snapshot("bob").servers.length,0);
  h.store.handle(h.bob,{type:"v2Message",serverId,channel:"general",message:"should be blocked"});
  assert.equal(h.store.snapshot("alice").servers[0].messages.general.length,1);
});
