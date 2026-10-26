import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const LIMITS={servers:60,owned:5,channels:25,messages:150};
const id=()=>crypto.randomBytes(8).toString("hex");
const clean=(value,max)=>String(value??"").trim().slice(0,max);
const nameOK=name=>/^[\p{L}\p{N}][\p{L}\p{N} _.-]{1,38}$/u.test(name);
const slug=value=>clean(value,40).toLowerCase().replace(/[^a-z0-9_-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,30);
const publicServer=s=>({id:s.id,name:s.name,icon:s.icon,description:s.description,memberCount:s.members.length,channelCount:s.channels.length});
const memberState=s=>({...publicServer(s),owner:s.owner,channels:s.channels.map(c=>({...c})),messages:Object.fromEntries(s.channels.map(c=>[c.id,(s.messages[c.id]||[]).slice(-LIMITS.messages)]))});

// All permissions and persistence live here, not in the browser UI.
export function createCommunityStore({dataDir,sendToUser,sendAll}){
  const filename=path.join(dataDir,"lightning-v2-communities.json");
  let servers=[];
  try{
    const parsed=JSON.parse(fs.readFileSync(filename,"utf8"));
    if(Array.isArray(parsed?.servers))servers=parsed.servers.filter(s=>s&&Array.isArray(s.members)&&Array.isArray(s.channels)&&s.messages&&typeof s.messages==="object").slice(0,LIMITS.servers);
  }catch{}
  const save=()=>{
    const temp=filename+".tmp";
    fs.writeFileSync(temp,JSON.stringify({version:2,servers}));
    fs.renameSync(temp,filename);
  };
  const directory=()=>servers.map(publicServer);
  const snapshot=userId=>({servers:servers.filter(s=>s.members.includes(userId)).map(memberState),directory:directory()});
  const err=(u,message)=>sendToUser(u.id,{type:"error",message});
  const notifyMembers=(s,event)=>s.members.forEach(userId=>sendToUser(userId,event));
  const updateDirectory=()=>sendAll({type:"v2Directory",directory:directory()});
  function handle(u,data){
    const type=String(data.type||"");
    if(type==="v2Snapshot"){sendToUser(u.id,{type:"v2State",...snapshot(u.id)});return;}
    if(type==="v2Create"){
      const name=clean(data.name,40);
      if(!nameOK(name))return err(u,"Use a server name of 2–40 letters, numbers, spaces, dots or dashes.");
      if(servers.length>=LIMITS.servers)return err(u,"The community directory is full.");
      if(servers.filter(s=>s.owner===u.id).length>=LIMITS.owned)return err(u,"You can create up to five servers.");
      const icon=clean(data.icon,4)||"✦";
      const description=clean(data.description,140)||"A place to meet and talk.";
      const s={id:id(),name,icon,description,owner:u.id,members:[u.id],channels:[
        {id:"general",name:"general",category:"TEXT"},
        {id:"introductions",name:"introductions",category:"TEXT"},
        {id:"gaming",name:"gaming",category:"GAMES"}
      ],messages:{general:[],introductions:[],gaming:[]},createdAt:Date.now()};
      servers.push(s);save();
      sendToUser(u.id,{type:"v2State",...snapshot(u.id),selected:s.id});
      updateDirectory();return;
    }
    const s=servers.find(item=>item.id===clean(data.serverId,60));
    if(!s)return err(u,"Server not found.");
    const member=s.members.includes(u.id);
    if(type==="v2Join"){
      if(!member){if(s.members.length>=500)return err(u,"That server is full.");s.members.push(u.id);save();}
      sendToUser(u.id,{type:"v2State",...snapshot(u.id),selected:s.id});
      notifyMembers(s,{type:"v2MemberCount",serverId:s.id,count:s.members.length});
      updateDirectory();return;
    }
    if(!member)return err(u,"Join this server before using its channels.");
    if(type==="v2Leave"){
      if(s.owner===u.id)return err(u,"The server owner cannot leave. Ownership is required to manage this server.");
      s.members=s.members.filter(id=>id!==u.id);save();
      sendToUser(u.id,{type:"v2State",...snapshot(u.id),selected:null});
      notifyMembers(s,{type:"v2MemberCount",serverId:s.id,count:s.members.length});
      updateDirectory();return;
    }
    if(type==="v2AddChannel"){
      if(s.owner!==u.id&&u.role!=="admin")return err(u,"Only the owner or an admin can add channels.");
      if(s.channels.length>=LIMITS.channels)return err(u,"This server has reached its channel limit.");
      const channel=slug(data.name);
      if(channel.length<2)return err(u,"Choose a channel name of at least two letters.");
      if(s.channels.some(c=>c.id===channel))return err(u,"That channel already exists.");
      const category=["TEXT","GAMES","HELP"].includes(data.category)?data.category:"TEXT";
      s.channels.push({id:channel,name:channel,category});s.messages[channel]=[];save();
      notifyMembers(s,{type:"v2Server",server:memberState(s)});updateDirectory();return;
    }
    if(type==="v2Message"){
      const channel=clean(data.channel,40),message=clean(data.message,1500);
      if(!s.channels.some(c=>c.id===channel)||!message)return err(u,"Choose a channel and enter a message.");
      const entry={id:id(),channel,message,by:u.name,userId:u.id,at:Date.now()};
      (s.messages[channel]??=[]).push(entry);
      s.messages[channel]=s.messages[channel].slice(-LIMITS.messages);
      save();notifyMembers(s,{type:"v2Message",serverId:s.id,entry});return;
    }
    if(type==="v2DeleteMessage"){
      const channel=clean(data.channel,40),entry=(s.messages[channel]||[]).find(m=>m.id===clean(data.messageId,40));
      if(!entry)return err(u,"Message not found.");
      if(entry.userId!==u.id&&s.owner!==u.id&&u.role!=="admin")return err(u,"You cannot remove this message.");
      entry.message="";entry.deleted=true;save();
      notifyMembers(s,{type:"v2MessageUpdate",serverId:s.id,entry});return;
    }
  }
  return {snapshot,handle,directory};
}
