import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {openAdminConsole} from "../public/assets/admin-console.js";

const read=file=>fs.readFileSync(new URL("../"+file,import.meta.url),"utf8");

test("Staff control center is a standalone, accessible dialog with role-scoped pages and working refresh",async()=>{
 const events=new Map();
 const app={innerHTML:""};
 const dialog={
  id:"",className:"",open:false,
  setAttribute(name,value){this[name]=value},
  removeAttribute(name){delete this[name]},
  addEventListener(name,handler){events.set(name,handler)},
  querySelector(selector){return selector==="#acApp"?app:null},
  contains(){return true},
  showModal(){this.open=true},
  close(){this.open=false;events.get("close")?.()}
 };
 const document={
  createElement(tag){assert.equal(tag,"dialog");return dialog},
  body:{append(node){assert.equal(node,dialog)}}
 };
 const previous=globalThis.document;
 globalThis.document=document;
 try{
  const data={
   permissions:["accounts.read","accounts.manage","roles.assign","community.moderate",
    "settings.manage","sessions.read","audit.read"],
   users:[{id:"u1",username:"test-admin",role:"admin",enabled:true,approved:true,createdAt:Date.now()},
    {id:"u2",username:"new-member",role:"user",enabled:true,approved:false,createdAt:Date.now()}],
   roles:[{id:"user",label:"Member"},{id:"admin",label:"Administrator"}],
   settings:{maintenance:false,features:{proxy:true,music:true,ai:true}},
   sessions:[{id:"s1",username:"test-admin",lastSeenAt:Date.now()}],
   audit:[{at:Date.now(),actor:"test-admin",action:"user.created",target:"new-member"}]
  };
  let calls=0;
  const services={api:async path=>{assert.equal(path,"/api/admin/state");calls++;return data},
   me:{id:"u1",username:"test-admin",role:"admin",sessionId:"s1"},
   notify(){},onSettings(){},onCommunity(){}};
  await openAdminConsole(services);
  assert.equal(dialog.open,true);
  assert.equal(dialog["aria-labelledby"],"acMainTitle");
  assert.match(app.innerHTML,/Your command center/);
  assert.match(app.innerHTML,/data-ac-page="accounts"/);
  assert.match(app.innerHTML,/data-ac-page="platform"/);
  assert.match(app.innerHTML,/data-ac-page="sessions"/);
  assert.match(app.innerHTML,/data-ac-page="activity"/);
  assert.match(app.innerHTML,/data-ac-action="close"/);
  assert.match(app.innerHTML,/Awaiting approval/);
  assert.equal(calls,1);
  const click=events.get("click");
  const button={disabled:false,dataset:{acPage:"accounts"},closest(){return this}};
  await click({target:button});
  assert.match(app.innerHTML,/Accounts &amp; access/);
  assert.match(app.innerHTML,/acCreateForm/);
  assert.match(app.innerHTML,/data-ac-role/);
  assert.match(app.innerHTML,/data-ac-filter/);
  assert.match(app.innerHTML,/data-ac-action="approve"/);

  const refresh={disabled:false,dataset:{acAction:"refresh"},closest(){return this}};
  await click({target:refresh});
  assert.equal(calls,2);
  const staffData={permissions:["community.moderate"],users:[],roles:[],settings:null,sessions:[],audit:[]};
  await openAdminConsole({...services,api:async()=>staffData,me:{id:"m",username:"mod",role:"moderator"}});
  assert.match(app.innerHTML,/data-ac-page="community"/);
  assert.doesNotMatch(app.innerHTML,/data-ac-page="accounts"/);
  assert.doesNotMatch(app.innerHTML,/data-ac-page="platform"/);
  assert.doesNotMatch(app.innerHTML,/data-ac-page="activity"/);
  assert.doesNotMatch(app.innerHTML,/Total accounts/);
 }finally{globalThis.document=previous;}
});

test("Legacy admin sidebar and single-login restriction are absent",()=>{
 const app=read("public/assets/app.js"),server=read("server.js");
 const html=read("views/app.html"),css=read("public/assets/admin-console.css");
 const module=read("public/assets/admin-console.js");
 assert.match(app,/openPanel\(name\)/);
 assert.match(app,/import\("\/assets\/admin-console\.js\?v=2"\)/);
 assert.doesNotMatch(app,/function renderAdminPanel\(/);
 assert.doesNotMatch(app,/function renderAdminUsers\(/);
 assert.match(html,/admin-console\.css\?v=2/);
 assert.match(css,/\.ac-console::backdrop/);
 assert.match(css,/@media\(max-width:720px\)/);
 assert.match(module,/showModal\(\)/);
 assert.match(module,/role="switch"/);
 assert.match(module,/\/api\/admin\/state/);
 assert.match(module,/\/api\/admin\/users/);
 assert.match(module,/\/api\/admin\/sessions/);
 assert.match(module,/\/api\/admin\/settings/);
 assert.doesNotMatch(server,/ACCOUNT_ALREADY_SIGNED_IN|sessionIdleMinutes/);
});
