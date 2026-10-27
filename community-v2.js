import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const MAIN_SERVER_ID="lightning-main";
const LIMITS={servers:60,owned:5,channels:35,messages:150,roles:30};
const id=()=>crypto.randomBytes(8).toString("hex");
const clean=(value,max)=>String(value??"").trim().slice(0,max);
const slug=value=>clean(value,40).toLowerCase().replace(/[^a-z0-9_-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,30);
const nameOK=name=>/^[\p{L}\p{N}][\p{L}\p{N} _.-]{1,38}$/u.test(name);
const channels=[
  {id:"announcements",name:"announcements",category:"INFORMATION",readOnly:true,protected:true},
  {id:"welcome",name:"welcome",category:"INFORMATION",readOnly:true,protected:true},
  {id:"general",name:"general",category:"COMMUNITY",protected:true},
  {id:"games",name:"games",category:"COMMUNITY"},
  {id:"suggestions",name:"suggestions",category:"COMMUNITY"},
  {id:"support",name:"support",category:"HELP"},
  {id:"introductions",name:"introductions",category:"COMMUNITY"}
];
const makeMain=()=>({
 id:MAIN_SERVER_ID,name:"Lightning",icon:"bolt",description:"The home of every Lightning member.",
 owner:null,permanent:true,members:[],roles:[{id:"member",name:"Member",color:"#C5BCA9"}],
 memberRoles:{},profiles:{},channels:channels.map(c=>({...c})),messages:{},createdAt:Date.now()
});
const publicServer=s=>({
 id:s.id,name:s.name,icon:s.icon,description:s.description,permanent:!!s.permanent,inviteOnly:!!s.inviteOnly,
 memberCount:s.members.length,channelCount:s.channels.length
});
const canManage=(u,s)=>u.role==="admin"||(!s.permanent&&s.owner===u.id);
const channelAccess=(u,s,c)=>!c.staffOnly||canManage(u,s);
const memberState=(s,u)=>({
 ...publicServer(s),owner:s.owner,canManage:canManage(u,s),
  ...(canManage(u,s)&&s.inviteOnly?{inviteCode:s.inviteCode||""}:{}),
 channels:s.channels.filter(c=>channelAccess(u,s,c)).map(c=>({...c})),
 roles:s.roles.map(r=>({...r})),
 members:s.members.slice(-500).map(userId=>({
  id:userId,name:s.profiles?.[userId]?.name||"Member",role:s.memberRoles?.[userId]||"member",
  admin:s.profiles?.[userId]?.admin===true
 })),
 messages:Object.fromEntries(s.channels.filter(c=>channelAccess(u,s,c)).map(c=>[c.id,(s.messages[c.id]||[]).slice(-LIMITS.messages)]))
});

// Server-authoritative permissions. Never trust roles or ownership supplied by clients.
export function createCommunityStore({dataDir,sendToUser,sendAll}){
 const filename=path.join(dataDir,"lightning-v2-communities.json");
 let servers=[];
 try{
  const parsed=JSON.parse(fs.readFileSync(filename,"utf8"));
  if(Array.isArray(parsed?.servers))servers=parsed.servers.filter(s=>s&&Array.isArray(s.members)&&Array.isArray(s.channels)&&s.messages&&typeof s.messages==="object").slice(0,LIMITS.servers);
 }catch{}
 // Upgrade existing installations in place; leave user-created servers and messages intact.
 let main=servers.find(s=>s.id===MAIN_SERVER_ID);
 let migrated=false;
 if(!main){main=makeMain();servers.unshift(main);migrated=true;}
 if(!Array.isArray(main.roles)){main.roles=[{id:"member",name:"Member",color:"#C5BCA9"}];migrated=true;}
 if(!main.roles.some(r=>r.id==="member")){main.roles.unshift({id:"member",name:"Member",color:"#C5BCA9"});migrated=true;}
 for(const s of servers){
  if(!s.memberRoles){s.memberRoles={};migrated=true;}
  if(typeof s.inviteOnly!=="boolean"){s.inviteOnly=false;migrated=true;}
  if(s.inviteOnly&&!s.inviteCode){s.inviteCode=crypto.randomBytes(16).toString("hex");migrated=true;}
  if(!s.profiles){s.profiles={};migrated=true;}
  if(!Array.isArray(s.roles)){s.roles=[{id:"member",name:"Member",color:"#C5BCA9"}];migrated=true;}
  if(!Array.isArray(s.members))s.members=[];
  if(s.permanent!==true&&s.id===MAIN_SERVER_ID){s.permanent=true;migrated=true;}
  for(const c of s.channels)if(!Array.isArray(s.messages[c.id])){s.messages[c.id]=[];migrated=true;}
 }
 for(const c of channels){
  const existing=main.channels.find(item=>item.id===c.id);
  if(!existing){main.channels.push({...c});main.messages[c.id]=[];migrated=true;}
  else if(c.protected&&!existing.protected){existing.protected=true;if(c.readOnly)existing.readOnly=true;migrated=true;}
 }
 main.channels.sort((a,b)=>{
  const ai=channels.findIndex(c=>c.id===a.id),bi=channels.findIndex(c=>c.id===b.id);
  return (ai<0?999:ai)-(bi<0?999:bi);
 });
 // Import earlier public chat into the permanent server on first creation only.
 if(migrated&&!main.messages.general?.length){
  try{
   const old=JSON.parse(fs.readFileSync(path.join(dataDir,"lightning-social.json"),"utf8"));
   for(const c of ["general","games","suggestions","support"]){
    if(Array.isArray(old?.[c])&&!main.messages[c]?.length){
     main.messages[c]=old[c].slice(-LIMITS.messages).map(m=>({
      id:clean(m.id,40)||id(),channel:c,message:clean(m.message,1500),
      by:clean(m.by,32)||"Member",userId:clean(m.userId,100),
      at:Number(m.at)||Date.now(),deleted:!!m.deleted
     }));
    }
   }
  }catch{}
 }
 const save=()=>{
  const temp=filename+".tmp";
  fs.writeFileSync(temp,JSON.stringify({version:3,servers}));
  fs.renameSync(temp,filename);
 };
 if(migrated)save();
 // Keep unlisted servers out of all directory broadcasts.
 const directory=()=>servers.filter(s=>!s.inviteOnly||s.permanent).map(publicServer);
 const refreshProfile=u=>{
  if(!u?.id)return false;
  const name=clean(u.name,32)||"Member",isAdmin=u.role==="admin";
  let changed=false;
  if(!main.members.includes(u.id)){main.members.push(u.id);changed=true;}
  // Update every joined server so the admin UI and backend privileges agree.
  for(const server of servers.filter(server=>server.members.includes(u.id))){
   if(!server.profiles)server.profiles={};
   const previous=server.profiles[u.id];
   if(previous?.name!==name||previous?.admin!==isAdmin){
    server.profiles[u.id]={name,admin:isAdmin};changed=true;
   }
  }
  if(changed)save();
  return changed;
 };
 const snapshot=u=>{
  const previous=typeof u==="string"?main.profiles[u]:null;
  const user=typeof u==="string"
   ?{id:u,name:previous?.name||"Member",role:previous?.admin?"admin":"user"}:u;
  refreshProfile(user);
  return {servers:servers.filter(s=>s.members.includes(user.id)).map(s=>memberState(s,user)),
   directory:directory(),defaultServerId:MAIN_SERVER_ID};
 };
 const err=(u,message)=>sendToUser(u.id,{type:"error",message});
 const notifyMembers=(s,event)=>s.members.forEach(memberId=>sendToUser(memberId,event));
 const serverChanged=s=>{
  s.members.forEach(uid=>{
   const profile=s.profiles?.[uid]||{};
   sendToUser(uid,{type:"v2Server",server:memberState(s,{id:uid,role:profile.admin?"admin":"user"})});
  });
  sendAll({type:"v2Directory",directory:directory()});
 };
 const authorized=(u,s)=>canManage(u,s);
 function handle(u,data){
  const type=String(data.type||"");
  if(type==="v2Snapshot"){sendToUser(u.id,{type:"v2State",...snapshot(u)});return;}
  refreshProfile(u);
  if(type==="v2Create"){
   const name=clean(data.name,40);
   if(!nameOK(name))return err(u,"Use a server name of 2–40 letters, numbers, spaces, dots or dashes.");
   if(servers.length>=LIMITS.servers)return err(u,"The community directory is full.");
   if(servers.filter(s=>s.owner===u.id).length>=LIMITS.owned)return err(u,"You can create up to five servers.");
   const s={id:id(),name,icon:clean(data.icon,4)||"users",description:clean(data.description,140)||"A place to meet and talk.",
    owner:u.id,members:[u.id],roles:[{id:"member",name:"Member",color:"#C5BCA9"}],memberRoles:{},
     inviteOnly:!!data.inviteOnly,inviteCode:data.inviteOnly?crypto.randomBytes(16).toString("hex"):null,
    profiles:{[u.id]:{name:u.name,admin:u.role==="admin"}},channels:[
     {id:"general",name:"general",category:"TEXT"},
     {id:"introductions",name:"introductions",category:"TEXT"},
     {id:"gaming",name:"gaming",category:"GAMES"}
    ],messages:{general:[],introductions:[],gaming:[]},createdAt:Date.now()};
   servers.push(s);save();
   sendToUser(u.id,{type:"v2State",...snapshot(u),selected:s.id});
   sendAll({type:"v2Directory",directory:directory()});return;
  }
  if(type==="v2JoinInvite"){
   const token=clean(data.inviteCode,100).toLowerCase();
   const invited=servers.find(s=>s.inviteOnly&&s.inviteCode===token&&!s.permanent);
   if(!invited)return err(u,"Invite is invalid or has expired.");
   if(!invited.members.includes(u.id)){
    if(invited.members.length>=500)return err(u,"That server is full.");
    invited.members.push(u.id);invited.profiles[u.id]={name:u.name,admin:u.role==="admin"};save();
   }
   sendToUser(u.id,{type:"v2State",...snapshot(u),selected:invited.id});
   serverChanged(invited);return;
  }
  const s=servers.find(s=>s.id===clean(data.serverId,60));
  if(!s)return err(u,"Server not found.");
  const member=s.members.includes(u.id);
  if(type==="v2Join"){
   if(!member){if(s.inviteOnly)return err(u,"This server requires an invite.");
    if(s.members.length>=500&&!s.permanent)return err(u,"That server is full.");
    s.members.push(u.id);s.profiles[u.id]={name:u.name,admin:u.role==="admin"};save();}
   sendToUser(u.id,{type:"v2State",...snapshot(u),selected:s.id});
   serverChanged(s);return;
  }
  if(type==="v2DeleteServer"){
   if(s.permanent)return err(u,"The main server cannot be deleted.");
   if(s.owner!==u.id&&u.role!=="admin")return err(u,"Only the owner or a platform admin can delete this server.");
   const members=[...s.members];
   servers=servers.filter(item=>item.id!==s.id);save();
   for(const uid of members)sendToUser(uid,{type:"v2State",...snapshot(uid),selected:MAIN_SERVER_ID});
   sendAll({type:"v2Directory",directory:directory()});return;
  }
  if(!member)return err(u,"Join this server before using its channels.");
  if(type==="v2Leave"){
   if(s.permanent)return err(u,"The Lightning server is home to every account and cannot be left.");
   if(s.owner===u.id)return err(u,"The server owner cannot leave.");
   s.members=s.members.filter(memberId=>memberId!==u.id);delete s.memberRoles[u.id];delete s.profiles[u.id];save();
   sendToUser(u.id,{type:"v2State",...snapshot(u),selected:MAIN_SERVER_ID});
   serverChanged(s);return;
  }
  if(["v2AddChannel","v2EditChannel","v2DeleteChannel","v2CreateRole","v2EditRole","v2DeleteRole","v2AssignRole","v2EditServer","v2SetPrivacy","v2RotateInvite"].includes(type)){
   if(!authorized(u,s))return err(u,"Only the server owner or a Lightning admin can manage this server.");
  }
  if(type==="v2AddChannel"){
   if(s.channels.length>=LIMITS.channels)return err(u,"This server has reached its channel limit.");
   const channel=slug(data.name);
   if(channel.length<2||s.channels.some(c=>c.id===channel))return err(u,"Choose a unique channel name of at least two letters.");
   const category=["INFORMATION","COMMUNITY","GAMES","HELP","TEXT"].includes(data.category)?data.category:"TEXT";
   s.channels.push({id:channel,name:channel,category,readOnly:!!data.readOnly,staffOnly:!!data.staffOnly});
   s.messages[channel]=[];save();serverChanged(s);return;
  }
  if(type==="v2EditChannel"){
   const c=s.channels.find(c=>c.id===clean(data.channel,40));
   if(!c)return err(u,"Channel not found.");
   if(data.name!==undefined){
    const newName=slug(data.name);
    if(newName.length<2)return err(u,"Channel names need at least two letters.");
    c.name=newName;
   }
   if(data.category!==undefined&&["INFORMATION","COMMUNITY","GAMES","HELP","TEXT"].includes(data.category))c.category=data.category;
   if(typeof data.readOnly==="boolean")c.readOnly=data.readOnly;
   if(typeof data.staffOnly==="boolean"&&!c.protected)c.staffOnly=data.staffOnly;
   save();serverChanged(s);return;
  }
  if(type==="v2DeleteChannel"){
   const c=s.channels.find(c=>c.id===clean(data.channel,40));
   if(!c)return err(u,"Channel not found.");
   if(c.protected)return err(u,"This is a required Lightning channel.");
   s.channels=s.channels.filter(ch=>ch.id!==c.id);
   delete s.messages[c.id];save();serverChanged(s);return;
  }
  if(type==="v2CreateRole"){
   if(s.roles.length>=LIMITS.roles)return err(u,"This server has reached its role limit.");
   const name=clean(data.name,32),roleId=slug(name);
   if(roleId.length<2||!nameOK(name)||["owner","admin","administrator","everyone","member"].includes(roleId)||s.roles.some(r=>r.id===roleId))
    return err(u,"Choose a unique role name of 2–32 characters.");
   const color=/^#[\da-fA-F]{6}$/.test(data.color)?data.color:"#C5BCA9";
   s.roles.push({id:roleId,name,color});save();serverChanged(s);return;
  }
  if(type==="v2EditRole"){
   const role=s.roles.find(r=>r.id===clean(data.roleId,40));
   if(!role||role.id==="member")return err(u,"This role can't be edited.");
   const name=clean(data.name,32);
   if(name&&!nameOK(name))return err(u,"Invalid role name.");
   if(name)role.name=name;
   if(/^#[\da-fA-F]{6}$/.test(data.color))role.color=data.color;
   save();serverChanged(s);return;
  }
  if(type==="v2DeleteRole"){
   const roleId=clean(data.roleId,40);
   if(roleId==="member"||!s.roles.some(r=>r.id===roleId))return err(u,"This role can't be deleted.");
   s.roles=s.roles.filter(r=>r.id!==roleId);
   for(const memberId of Object.keys(s.memberRoles))if(s.memberRoles[memberId]===roleId)delete s.memberRoles[memberId];
   save();serverChanged(s);return;
  }
  if(type==="v2AssignRole"){
   const memberId=clean(data.memberId,100),roleId=clean(data.roleId,40);
   if(!s.members.includes(memberId))return err(u,"Member not found.");
   if(roleId!=="member"&&!s.roles.some(r=>r.id===roleId))return err(u,"Role not found.");
   if(roleId==="member")delete s.memberRoles[memberId];else s.memberRoles[memberId]=roleId;
   save();serverChanged(s);return;
  }
  if(type==="v2SetPrivacy"){
   if(s.permanent)return err(u,"The main server must stay public.");
   if(typeof data.inviteOnly!=="boolean")return err(u,"Choose a privacy setting.");
   s.inviteOnly=data.inviteOnly;
   if(s.inviteOnly&&!s.inviteCode)s.inviteCode=crypto.randomBytes(16).toString("hex");
   save();serverChanged(s);return;
  }
  if(type==="v2RotateInvite"){
   if(s.permanent||!s.inviteOnly)return err(u,"Enable invite-only access first.");
   s.inviteCode=crypto.randomBytes(16).toString("hex");
   save();serverChanged(s);return;
  }
  if(type==="v2EditServer"){
   if(data.name!==undefined){
    if(s.permanent)return err(u,"The main server's name is protected.");
    const name=clean(data.name,40);
    if(!nameOK(name))return err(u,"Invalid server name.");
    s.name=name;
   }
   if(data.description!==undefined)s.description=clean(data.description,140);
   save();serverChanged(s);return;
  }
  if(type==="v2Message"){
   const channel=clean(data.channel,40),message=clean(data.message,1500);
   const c=s.channels.find(c=>c.id===channel);
   if(!c||!channelAccess(u,s,c)||!message)return err(u,"Choose a channel and enter a message.");
   if(c.readOnly&&!authorized(u,s))return err(u,"This is a staff-only posting channel.");
   const entry={id:id(),channel,message,by:u.name,userId:u.id,at:Date.now()};
   (s.messages[channel]??=[]).push(entry);s.messages[channel]=s.messages[channel].slice(-LIMITS.messages);
   save();s.members.forEach(memberId=>{const p=s.profiles[memberId]||{};if(!c.staffOnly||p.admin||memberId===s.owner)sendToUser(memberId,{type:"v2Message",serverId:s.id,entry});});return;
  }
  if(type==="v2DeleteMessage"){
   const channel=clean(data.channel,40),c=s.channels.find(c=>c.id===channel);
   if(!c||!channelAccess(u,s,c))return err(u,"Channel not found.");
   const entry=(s.messages[channel]||[]).find(m=>m.id===clean(data.messageId,40));
   if(!entry)return err(u,"Message not found.");
   if(entry.userId!==u.id&&!authorized(u,s))return err(u,"You cannot remove this message.");
   entry.message="";entry.deleted=true;save();
   s.members.forEach(memberId=>{const p=s.profiles[memberId]||{};if(!c.staffOnly||p.admin||memberId===s.owner)sendToUser(memberId,{type:"v2MessageUpdate",serverId:s.id,entry});});return;
  }
 }
 return {snapshot,handle,directory,mainId:MAIN_SERVER_ID};
}
