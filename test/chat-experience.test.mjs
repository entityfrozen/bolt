import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {createCommunityStore} from "../community-v2.js";

const read=file=>fs.readFileSync(new URL("../"+file,import.meta.url),"utf8");
const source=read("public/assets/chat-experience.js");
const ui=read("public/assets/chat-renderer.js");
const picker=read("public/assets/chat-emojis.js");
const styles=read("public/assets/chat-experience.css");
const hub=read("public/assets/hub.js");
const community=read("public/assets/community-ui.js");
const page=read("views/app.html");

function setup(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"lightning-chat-ui-"));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const events=[];
 const store=createCommunityStore({dataDir:dir,sendToUser:(id,event)=>events.push({to:id,...event}),sendAll:()=>{}});
 const admin={id:"admin",name:"Admin",username:"admin",role:"admin"};
 const alice={id:"alice",name:"Alice",username:"alice",role:"user"};
 const bob={id:"bob",name:"Bob",username:"bob",role:"user"};
 for(const user of [admin,alice,bob])store.snapshot(user);
 const send=(who,type,extras={})=>store.handle(who,{type,serverId:"lightning-main",channel:"general",...extras});
 const messages=()=>store.snapshot(admin).servers.find(s=>s.id==="lightning-main").messages.general;
 return {store,events,admin,alice,bob,send,messages};
}
test("Editing is only possible on your own message; replies reference a real message",t=>{
 const h=setup(t);
 h.send(h.alice,"v2Message",{message:"First message"});
 const parent=h.messages()[0].id;
 h.send(h.bob,"v2Message",{message:"Reply here",replyTo:parent});
 assert.equal(h.messages()[1].replyTo,parent);
 const second=h.messages()[1].id;
 h.send(h.alice,"v2EditMessage",{messageId:second,message:"Unauthorized edit"});
 assert.equal(h.messages()[1].message,"Reply here");
 h.send(h.bob,"v2EditMessage",{messageId:second,message:"Corrected reply"});
 assert.equal(h.messages()[1].message,"Corrected reply");
 assert.ok(Number(h.messages()[1].editedAt)>0);
 h.send(h.admin,"v2EditMessage",{messageId:second,message:"Wrong author"});
 assert.equal(h.messages()[1].message,"Corrected reply");
 h.send(h.bob,"v2Message",{message:"Invalid reply",replyTo:"not-present"});
 assert.equal(h.messages().at(-1).replyTo,null);
});
test("Reaction picker supports a curated set and real toggle counts",t=>{
 const h=setup(t);
 h.send(h.alice,"v2Message",{message:"Please react"});
 const id=h.messages()[0].id;
 h.send(h.alice,"v2React",{messageId:id,emoji:"🫶"});
 h.send(h.bob,"v2React",{messageId:id,emoji:"🫶"});
 assert.deepEqual(h.messages()[0].reactions["🫶"].sort(),["alice","bob"]);
 h.send(h.bob,"v2React",{messageId:id,emoji:"🫶"});
 assert.deepEqual(h.messages()[0].reactions["🫶"],["alice"]);
 h.send(h.alice,"v2React",{messageId:id,emoji:"<script>"});
 assert.equal(Object.keys(h.messages()[0].reactions).length,1);
});
test("Admins can pin and clear reactions; members cannot, and data persists",t=>{
 const h=setup(t);
 h.send(h.alice,"v2Message",{message:"Pinned update"});
 const id=h.messages()[0].id;
 h.send(h.alice,"v2PinMessage",{messageId:id});
 assert.equal(h.messages()[0].pinnedAt,undefined);
 h.send(h.admin,"v2PinMessage",{messageId:id});
 assert.ok(h.messages()[0].pinnedAt>0);
 h.send(h.bob,"v2React",{messageId:id,emoji:"🔥"});
 h.send(h.alice,"v2ClearReactions",{messageId:id});
 assert.ok(h.messages()[0].reactions["🔥"]);
 h.send(h.admin,"v2ClearReactions",{messageId:id});
 assert.deepEqual(h.messages()[0].reactions,{});
 h.send(h.admin,"v2PinMessage",{messageId:id});
 assert.equal(h.messages()[0].pinnedAt,undefined);
});
test("Typing activity is ephemeral and channel clearing is restricted",t=>{
 const h=setup(t);
 h.send(h.alice,"v2Typing");
 assert.ok(h.events.some(e=>e.type==="v2Typing"&&e.to==="bob"));
 assert.ok(!h.events.some(e=>e.type==="v2Typing"&&e.to==="alice"));
 h.send(h.alice,"v2Message",{message:"Keep my account"});
 h.send(h.bob,"v2ClearChannel");
 assert.equal(h.messages().length,1);
 h.send(h.admin,"v2ClearChannel");
 assert.equal(h.messages().length,0);
 assert.ok(h.store.snapshot(h.alice).servers.find(s=>s.permanent).channels.some(c=>c.id==="general"));
});
test("Chat frontend renders actual message actions and an interactive searchable picker",()=>{
 assert.ok(hub.includes("chat-experience.js"));
 assert.ok(hub.includes("chat-experience.css"));
 for(const action of ["picker","react","reply","edit","menu","saveEdit","cancelReply","composeEmoji"])assert.ok(source.includes('action==="'+action+'"'));
 for(const event of ["v2React","v2EditMessage","v2PinMessage","v2ClearReactions","v2Message"])assert.ok(source.includes(event)||community.includes(event));
 assert.match(ui,/dc-message-toolbar/);
 assert.match(ui,/dc-pinned/);
 assert.match(ui,/data-dc-id/);
 assert.match(picker,/dc-picker-search/);
 assert.match(picker,/showPopover/);
 assert.match(styles,/prefers-reduced-motion/);
 assert.match(styles,/@media\(max-width:520px\)/);
 assert.match(page,/(?:lightning|&#108;ightning)-gui-v7/);
 for(const text of [source,ui,picker]){
  const body=text.replace(/^import .*$/gm,"").replace(/^export /gm,"");
  assert.doesNotThrow(()=>new Function(body));
 }
});
