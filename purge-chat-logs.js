/* One-time, server-side reset of Lightning chat history.
 *
 * Keep account identities, sessions, roles, community structure, bookmarks,
 * browsing history, AI preferences and provider secrets untouched.
 *
 * Run BEFORE registerAccountSpace() and attachLightningLive() initialize their
 * in-memory stores. A marker on the persistent data volume makes the reset
 * idempotent across Railway restarts and future deployments.
 */
import fs from "node:fs";
import path from "node:path";

const MARKER=".lightning-chat-reset-2026-11-05.json";
const SOCIAL="lightning-social.json";
const COMMUNITIES="lightning-v2-communities.json";
const ACCOUNTS="lightning-accounts.json";

function asObject(value){
 return value!==null&&typeof value==="object"&&!Array.isArray(value)?value:null;
}

function readExistingJson(dataDir,filename){
 const filepath=path.join(dataDir,filename);
 if(!fs.existsSync(filepath))return null;
 // Fail before modifying any files if one of the stores cannot be parsed.
 // The app must never silently throw away the rest of a damaged data file.
 const data=JSON.parse(fs.readFileSync(filepath,"utf8"));
 if(!asObject(data))throw new Error(filename+" does not contain an object");
 return {filepath,data};
}

function atomicWrite(filepath,value){
 const temp=filepath+"."+process.pid+".reset.tmp";
 try{
  fs.writeFileSync(temp,JSON.stringify(value),{mode:0o600,flag:"wx"});
  fs.renameSync(temp,filepath);
 }catch(error){
  try{fs.unlinkSync(temp)}catch{}
  throw error;
 }
}

export function purgeChatLogs(dataDir){
 const marker=path.join(dataDir,MARKER);
 if(fs.existsSync(marker))return {alreadyDone:true};

 // Parse all existing stores before touching any of them.
 const social=readExistingJson(dataDir,SOCIAL);
 const communities=readExistingJson(dataDir,COMMUNITIES);
 const accounts=readExistingJson(dataDir,ACCOUNTS);
 const counts={social:0,community:0,direct:0,ai:0};

 if(social){
  // Legacy live-chat channels are arrays directly on the root object.
  for(const [key,value] of Object.entries(social.data)){
   if(!Array.isArray(value))continue;
   counts.social+=value.length;
   social.data[key]=[];
  }
 }
 if(communities){
  for(const server of Array.isArray(communities.data.servers)?communities.data.servers:[]){
   if(!asObject(server)||!asObject(server.messages))continue;
   for(const [channel,value] of Object.entries(server.messages)){
    if(!Array.isArray(value))continue;
    counts.community+=value.length;
    server.messages[channel]=[];
   }
  }
 }
 if(accounts){
  const data=accounts.data;
  if(asObject(data.dm)){
   for(const thread of Object.values(data.dm)){
    if(asObject(thread)&&Array.isArray(thread.messages))counts.direct+=thread.messages.length;
   }
   data.dm={};
  }
  if(asObject(data.history)){
   for(const record of Object.values(data.history)){
    if(!asObject(record)||!Object.hasOwn(record,"ai"))continue;
    if(Array.isArray(record.ai))counts.ai+=record.ai.length;
    delete record.ai;
   }
  }
  if(asObject(data.aiWorkspaces)){
   for(const workspace of Object.values(data.aiWorkspaces)){
    if(!asObject(workspace))continue;
    if(Array.isArray(workspace.chats)){
     for(const chat of workspace.chats){
      if(asObject(chat)&&Array.isArray(chat.messages))counts.ai+=chat.messages.length;
     }
    }
    workspace.chats=[];
    workspace.activeId=null;
    // Keep workspace.preferences (model, tone, custom instructions) as-is.
   }
  }
 }

 // The reset is intentionally not a wholesale deletion of data files.
 // Retaining the existing structures prevents accounts and community roles
 // from being lost and avoids legacy history being imported on boot.
 for(const store of [social,communities,accounts]){
  if(store)atomicWrite(store.filepath,store.data);
 }
 const receipt={completedAt:new Date().toISOString(),counts};
 fs.writeFileSync(marker,JSON.stringify(receipt),{flag:"wx",mode:0o600});
 return {alreadyDone:false,counts};
}
