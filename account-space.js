import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {normalizeAiImage} from "./ai-images.js";

// Private, session-scoped account data. Never infer identity from a request body.
export function registerAccountSpace({app,dataDir,mustBeSignedIn,sameOrigin,listUsers}){
 const filename=path.join(dataDir,"lightning-accounts.json");
 let data={profiles:{},history:{},dm:{},settings:{},sharedApps:[],aiWorkspaces:{}};
 try{
  const parsed=JSON.parse(fs.readFileSync(filename,"utf8"));
  if(parsed&&typeof parsed==="object"){
   for(const key of ["profiles","history","dm","settings","aiWorkspaces"])
    if(parsed[key]&&!Array.isArray(parsed[key])&&typeof parsed[key]==="object")data[key]=parsed[key];
   if(Array.isArray(parsed.sharedApps))data.sharedApps=parsed.sharedApps.slice(0,100);
  }
 }catch{}
 const persist=()=>{
  const temp=filename+".tmp";
  fs.writeFileSync(temp,JSON.stringify(data));
  fs.renameSync(temp,filename);
 };
 const clip=(v,max)=>String(v??"").trim().slice(0,max);
 const safeText=(v,max)=>clip(v,max).replace(/[\u0000-\u001f\u007f]/g," ");
 const users=()=>listUsers().filter(u=>u.enabled&&u.approved!==false&&(!u.expiresAt||u.expiresAt>Date.now()));
 const account=(id)=>users().find(u=>u.id===id);
 const getDisplayName=(id,username="Member")=>data.profiles[id]?.displayName||username;
 const profile=(u)=>({
  id:u.id,username:u.username,displayName:getDisplayName(u.id,u.username),
  bio:data.profiles[u.id]?.bio||"",accent:data.profiles[u.id]?.accent||"#a9bdd1",role:u.role,
  createdAt:u.createdAt||null
 });
 const getOwn=req=>account(req.auth.identity.id)||req.auth.identity;
 const validName=name=>typeof name==="string"&&name.trim().length>=2&&name.trim().length<=32&&
   !/[\u0000-\u001f\u007f<>]/.test(name)&&!/^\s*$/.test(name);
 const color=value=>/^#[0-9a-fA-F]{6}$/.test(value||"")?value.toLowerCase():null;
 const fail=(res,code,message)=>res.status(code).json({error:message});
 const rawName=id=>account(id)?.username||"Member";
 const summary=(user)=>({id:user.id,username:user.username,displayName:getDisplayName(user.id,user.username),
  accent:data.profiles[user.id]?.accent||"#a9bdd1"});
 const threadKey=(a,b)=>[a,b].sort().join(":");
 // Existing conversations predate read receipts. Start them at their latest
 // message rather than treating months of old messages as new notifications.
 let migratedReads=false;
 for(const thread of Object.values(data.dm)){
  if(!thread||!Array.isArray(thread.people)||!Array.isArray(thread.messages))continue;
  if(!thread.readAt){
   const last=thread.messages.at(-1)?.at||0;
   thread.readAt=Object.fromEntries(thread.people.map(id=>[id,last]));
   migratedReads=true;
  }
 }
 if(migratedReads)persist();
 const unreadIn=(thread,userId)=>thread.messages.filter(message=>
  message.from!==userId&&message.at>Number(thread.readAt?.[userId]||0)).length;
 const historyTypes=["browser","ai"];
 const visitRecord=record=>{
  if(!record||typeof record!=="object")return null;
  const url=clip(record.url,1600);
  if(!/^https?:\/\//i.test(url))return null;
  return {url,title:safeText(record.title,160)||url,at:Math.min(Date.now(),Math.max(0,Number(record.at)||Date.now()))};
 };
 const aiRecord=record=>{
  if(!record||typeof record!=="object"||!["assistant","user"].includes(record.role))return null;
  if(typeof record.content!=="string"||!record.content.trim())return null;
  return {role:record.role,content:record.content.slice(0,9000),
   sources:Array.isArray(record.sources)?record.sources.slice(0,8).map(s=>({
    title:clip(s?.title,120),url:/^https?:\/\//i.test(s?.url)?clip(s.url,1600):""
   })).filter(s=>s.url):[]};
 };
 const bounded=(kind,items)=>{
  const limit=kind==="browser"?100:32;
  return items.slice(-limit).map(item=>kind==="browser"?visitRecord(item):aiRecord(item)).filter(Boolean);
 };
 app.get("/api/account/profile",mustBeSignedIn,(req,res)=>res.json({profile:profile(getOwn(req))}));
 app.patch("/api/account/profile",mustBeSignedIn,sameOrigin,(req,res)=>{
  const u=getOwn(req),input=req.body||{};
  if(input.displayName!==undefined&&!validName(input.displayName))return fail(res,400,"Display name must be 2–32 readable characters.");
  if(input.bio!==undefined&&(typeof input.bio!=="string"||input.bio.length>280))return fail(res,400,"Bio must be 280 characters or fewer.");
  if(input.accent!==undefined&&!color(input.accent))return fail(res,400,"Choose a valid profile color.");
  const before=data.profiles[u.id]||{};
  data.profiles[u.id]={...before,
   ...(input.displayName!==undefined?{displayName:clip(input.displayName,32)}:{}),
   ...(input.bio!==undefined?{bio:safeText(input.bio,280)}:{}),
   ...(input.accent!==undefined?{accent:color(input.accent)}:{})};
  persist();res.json({profile:profile(u)});
 });
 app.get("/api/account/people",mustBeSignedIn,(req,res)=>{
  const q=clip(req.query.q,32).toLowerCase();
  if(q.length<2)return res.json({people:[]});
  const people=users().filter(u=>u.id!==req.auth.identity.id&&
   (u.username.includes(q)||getDisplayName(u.id,u.username).toLowerCase().includes(q)))
   .slice(0,16).map(summary);
  res.json({people});
 });
 app.get("/api/account/history/:kind",mustBeSignedIn,(req,res)=>{
  const kind=req.params.kind;if(!historyTypes.includes(kind))return fail(res,404,"Not found");
  const id=req.auth.identity.id;res.setHeader("Cache-Control","no-store");
  res.json({items:data.history[id]?.[kind]||[]});
 });
 app.put("/api/account/history/:kind",mustBeSignedIn,sameOrigin,(req,res)=>{
  const kind=req.params.kind;if(!historyTypes.includes(kind))return fail(res,404,"Not found");
  if(!Array.isArray(req.body?.items)||req.body.items.length>160)return fail(res,400,"Invalid history.");
  const id=req.auth.identity.id;
  (data.history[id]??={})[kind]=bounded(kind,req.body.items);
  persist();res.json({ok:true,count:data.history[id][kind].length});
 });
 // Account settings include appearance, tabs, bookmarks, server-channel choice,
 // game favorites and scores. Device storage is not the source of truth.
 const allowedSettings=new Set(["bolt.prefs","bolt.tabs","bolt.bookmarks","bolt.soundcloud","appearance",
  "favorites","theme","inspector","dock","channels","gameScores","customApps"]);
 const cleanSettings=record=>Object.fromEntries(Object.entries(record||{})
  .filter(([key])=>allowedSettings.has(key)));
 // Shared apps are managed centrally, never by changing a personal preference.
 // All accounts can read them; only a platform admin can publish or remove them.
 const sharedCategories=new Set(["Games","Music","Streaming"]);
 const validateShared=(name,url,category)=>{
  if(typeof name!=="string"||name.trim().length<2||name.length>48)return "Name must be 2–48 characters.";
  if(!sharedCategories.has(category))return "Choose Games, Music or Streaming.";
  if(typeof url!=="string"||url.length>1800)return "Enter a valid website URL.";
  try{
   const parsed=new URL(url);
   if(!["http:","https:"].includes(parsed.protocol)||parsed.username||parsed.password)return "Use an http or https website.";
  }catch{return "Enter a valid website URL.";}
  return "";
 };
 const sharedView=()=>data.sharedApps.map(a=>({...a}));
 app.get("/api/apps",mustBeSignedIn,(req,res)=>{
  res.setHeader("Cache-Control","no-store");
  res.json({apps:sharedView(),canManage:req.auth.identity.role==="admin"});
 });
 app.post("/api/apps",mustBeSignedIn,sameOrigin,(req,res)=>{
  if(req.auth.identity.role!=="admin")return fail(res,403,"Admin only.");
  if(data.sharedApps.length>=100)return fail(res,400,"The shared app library is full.");
  const {name,url,category}=req.body||{};
  const error=validateShared(name,url,category);
  if(error)return fail(res,400,error);
  const address=new URL(url).href;
  if(data.sharedApps.some(a=>a.url===address))return fail(res,409,"This link is already shared.");
  const item={id:"shared-"+crypto.randomBytes(9).toString("hex"),name:name.trim(),url:address,category};
  data.sharedApps.push(item);
  persist();res.status(201).json({app:item});
 });
 app.delete("/api/apps/:id",mustBeSignedIn,sameOrigin,(req,res)=>{
  if(req.auth.identity.role!=="admin")return fail(res,403,"Admin only.");
  const before=data.sharedApps.length;
  data.sharedApps=data.sharedApps.filter(app=>app.id!==req.params.id);
  if(data.sharedApps.length===before)return fail(res,404,"App not found.");
  persist();res.json({ok:true});
 });
 app.get("/api/account/settings",mustBeSignedIn,(req,res)=>{
  res.setHeader("Cache-Control","no-store");
  res.json({settings:cleanSettings(data.settings[req.auth.identity.id])});
 });
 app.put("/api/account/settings/:key",mustBeSignedIn,sameOrigin,(req,res)=>{
  const key=req.params.key;
  if(!allowedSettings.has(key))return fail(res,400,"Unknown setting.");
  const value=req.body?.value;
  let encoded;
  try{encoded=JSON.stringify(value);}catch{return fail(res,400,"Invalid setting.");}
  if(typeof encoded!=="string"||encoded.length>50000)return fail(res,400,"Setting is too large.");
  if(value!==null&&typeof value!=="string"&&typeof value!=="number"&&typeof value!=="boolean"&&
   (!value||typeof value!=="object"||Object.prototype.toString.call(value)!=="[object Object]"&&!Array.isArray(value)))
   return fail(res,400,"Invalid setting.");
  if(key==="customApps"){
   if(!Array.isArray(value)||value.length>30)return fail(res,400,"You can save up to 30 apps.");
   const ids=new Set();
   for(const item of value){
    if(!item||typeof item!=="object"||typeof item.id!=="string"||!/^user-[a-z0-9-]{2,60}$/.test(item.id)||
      typeof item.name!=="string"||item.name.trim().length<2||item.name.length>48||
      !["Games","Music","Streaming"].includes(item.category)||ids.has(item.id))
     return fail(res,400,"Invalid app details.");
    ids.add(item.id);
    try{const u=new URL(item.url);if(!["https:","http:"].includes(u.protocol)||u.username||u.password||item.url.length>1800)
     return fail(res,400,"Use a valid http or https link.");}
    catch{return fail(res,400,"Use a valid http or https link.");}
   }
  }
  (data.settings[req.auth.identity.id]??={})[key]=value;
  persist();res.json({ok:true});
 });
 app.get("/api/account/dms",mustBeSignedIn,(req,res)=>{
  const id=req.auth.identity.id;res.setHeader("Cache-Control","no-store");
  const threads=Object.values(data.dm).filter(thread=>thread.people.includes(id)&&thread.messages.length)
   .map(thread=>{
    const other=thread.people.find(u=>u!==id),member=account(other);
    if(!member)return null;
    const last=thread.messages.at(-1);
    return {user:summary(member),last:{id:last.id,text:last.text,at:last.at,from:last.from},updatedAt:last.at,unread:unreadIn(thread,id)};
   }).filter(Boolean).sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,100);
  res.json({threads,totalUnread:threads.reduce((sum,t)=>sum+t.unread,0)});
 });
 app.get("/api/account/dms/:target",mustBeSignedIn,(req,res)=>{
  const id=req.auth.identity.id,target=clip(req.params.target,100),other=account(target);
  if(!other||target===id)return fail(res,404,"Member not found");
  const conversation=data.dm[threadKey(id,target)];
  if(conversation){
   const latest=conversation.messages.at(-1)?.at||0;
   if(latest>Number(conversation.readAt?.[id]||0)){
    (conversation.readAt??={})[id]=latest;persist();
   }
  }
  res.setHeader("Cache-Control","no-store");
  res.json({user:summary(other),messages:(conversation?.messages||[]).slice(-120)});
 });
 const rate=new Map();
 app.post("/api/account/dms/:target",mustBeSignedIn,sameOrigin,(req,res)=>{
  const id=req.auth.identity.id,target=clip(req.params.target,100),other=account(target);
  if(!other||id===target)return fail(res,404,"Member not found");
  if(typeof req.body?.text!=="string")return fail(res,400,"Message is required");
  const message=safeText(req.body.text,1500);
  if(!message)return fail(res,400,"Message is required");
  const now=Date.now(),status=rate.get(id)||{count:0,until:now+60000};
  if(status.until<now){status.count=0;status.until=now+60000;}
  if(++status.count>35){rate.set(id,status);return fail(res,429,"You are sending messages too quickly.");}
  rate.set(id,status);
  const key=threadKey(id,target);
  const thread=data.dm[key]||{people:[id,target],messages:[],readAt:{[id]:now,[target]:0}};
  const entry={id:crypto.randomBytes(10).toString("hex"),from:id,to:target,text:message,at:now};
  (thread.readAt??={})[id]=now;
  thread.messages.push(entry);
  thread.messages=thread.messages.slice(-300);
  data.dm[key]=thread;
  persist();res.status(201).json({message:entry});
 });
 app.delete("/api/account/dms/:target/:message",mustBeSignedIn,sameOrigin,(req,res)=>{
  const id=req.auth.identity.id,target=clip(req.params.target,100),messageId=clip(req.params.message,40);
  if(!account(target)||id===target)return fail(res,404,"Conversation not found");
  const thread=data.dm[threadKey(id,target)];
  const index=thread?.messages.findIndex(item=>item.id===messageId)??-1;
  if(index<0)return fail(res,404,"Message not found");
  if(thread.messages[index].from!==id)return fail(res,403,"You can only delete your own messages");
  thread.messages.splice(index,1);
  persist();res.json({ok:true,id:messageId});
 });
 app.post("/api/account/dms/:target/:message/reactions",mustBeSignedIn,sameOrigin,(req,res)=>{
  const id=req.auth.identity.id,target=clip(req.params.target,100),messageId=clip(req.params.message,40);
  if(!account(target)||id===target)return fail(res,404,"Conversation not found");
  const thread=data.dm[threadKey(id,target)];
  const entry=thread?.messages.find(message=>message.id===messageId);
  if(!entry)return fail(res,404,"Message not found");
  const emoji=String(req.body?.emoji||"");
  if(!["❤️","🔥","😂","😭","👍","💀","🎉","👀","✨"].includes(emoji))return fail(res,400,"Choose a supported reaction");
  entry.reactions??={};
  const voters=Array.isArray(entry.reactions[emoji])?entry.reactions[emoji]:[];
  entry.reactions[emoji]=voters.includes(id)?voters.filter(voter=>voter!==id):[...voters,id];
  if(!entry.reactions[emoji].length)delete entry.reactions[emoji];
  persist();res.json({ok:true,reactions:entry.reactions});
 });

 // Each AI workspace is owned by its authenticated Lightning account.
 const AI_TONES=["balanced","casual","professional","direct","creative"];
 const AI_LENGTHS=["short","balanced","detailed"];
 const aiMessage=value=>{
  if(!value||!["user","assistant"].includes(value.role)||typeof value.content!=="string")return null;
  const content=value.content.trim().slice(0,9000);
  if(!content)return null;
  const image=value.role==="user"&&value.image!==undefined?normalizeAiImage(value.image):null;
  if(value.image!==undefined&&!image)return null;
  return {role:value.role,content,
   ...(image?{image}:{}),
   ...(Array.isArray(value.sources)?{sources:value.sources.slice(0,8).filter(x=>x&&typeof x.url==="string").map(x=>({
    title:clip(x.title,120),url:clip(x.url,1600)
   })).filter(x=>/^https?:\/\//i.test(x.url))}:{}),
   ...(value.searched===true?{searched:true}:{})};
 };
 const aiDefaults=()=>({name:"Lightning AI",tone:"balanced",length:"balanced",instructions:""});
 function aiWorkspace(userId){
  let ws=data.aiWorkspaces[userId];
  if(!ws||!Array.isArray(ws.chats)){
   const old=Array.isArray(data.history[userId]?.ai)?data.history[userId].ai.map(aiMessage).filter(Boolean).slice(-48):[];
   const first=old.length?{id:crypto.randomBytes(12).toString("hex"),title:"Previous conversation",messages:old,createdAt:Date.now(),updatedAt:Date.now()}:null;
   ws={chats:first?[first]:[],activeId:first?.id||null,preferences:aiDefaults()};
   data.aiWorkspaces[userId]=ws;
   persist();
  }
  return ws;
 }
 const aiSummary=chat=>({id:chat.id,title:chat.title,createdAt:chat.createdAt,updatedAt:chat.updatedAt,
  messageCount:chat.messages.length,preview:chat.messages.at(-1)?.content?.slice(0,110)||""});
 app.get("/api/account/ai/workspace",mustBeSignedIn,(req,res)=>{
  const ws=aiWorkspace(req.auth.identity.id);
  res.setHeader("Cache-Control","no-store");
  res.json({chats:ws.chats.map(aiSummary).sort((a,b)=>b.updatedAt-a.updatedAt),
   activeId:ws.activeId,preferences:{...aiDefaults(),...ws.preferences}});
 });
 app.post("/api/account/ai/chats",mustBeSignedIn,sameOrigin,(req,res)=>{
  const ws=aiWorkspace(req.auth.identity.id);
  if(ws.chats.length>=40)return fail(res,409,"You can keep up to 40 AI conversations. Delete one to create another.");
  const now=Date.now(),title=clip(req.body?.title,80)||"New conversation";
  const chat={id:crypto.randomBytes(12).toString("hex"),title,messages:[],createdAt:now,updatedAt:now};
  ws.chats.push(chat);ws.activeId=chat.id;persist();
  res.status(201).json({chat});
 });
 app.get("/api/account/ai/chats/:id",mustBeSignedIn,(req,res)=>{
  const ws=aiWorkspace(req.auth.identity.id),chat=ws.chats.find(c=>c.id===req.params.id);
  if(!chat)return fail(res,404,"Conversation not found.");
  res.setHeader("Cache-Control","no-store");res.json({chat});
 });
 app.patch("/api/account/ai/chats/:id",mustBeSignedIn,sameOrigin,(req,res)=>{
  const ws=aiWorkspace(req.auth.identity.id),chat=ws.chats.find(c=>c.id===req.params.id);
  if(!chat)return fail(res,404,"Conversation not found.");
  const title=clip(req.body?.title,80);
  if(!title)return fail(res,400,"Give this conversation a title.");
  chat.title=title;chat.updatedAt=Date.now();ws.activeId=chat.id;persist();res.json({chat:aiSummary(chat)});
 });
 app.put("/api/account/ai/chats/:id/messages",mustBeSignedIn,sameOrigin,(req,res)=>{
  const ws=aiWorkspace(req.auth.identity.id),chat=ws.chats.find(c=>c.id===req.params.id);
  if(!chat)return fail(res,404,"Conversation not found.");
  if(!Array.isArray(req.body?.messages)||req.body.messages.length>48)return fail(res,400,"Conversation is too long.");
  if(req.body.messages.filter(message=>message?.image!==undefined).length>1)
   return fail(res,400,"Only the latest image can be saved in conversation history.");
  const messages=req.body.messages.map(aiMessage);
  if(messages.some(x=>!x))return fail(res,400,"Invalid conversation messages.");
  chat.messages=messages;chat.updatedAt=Date.now();ws.activeId=chat.id;
  if(chat.title==="New conversation"&&messages.length){
   const first=messages.find(m=>m.role==="user")?.content;
   if(first)chat.title=first.replace(/\s+/g," ").slice(0,56)+(first.length>56?"…":"");
  }
  persist();res.json({chat:aiSummary(chat)});
 });
 app.delete("/api/account/ai/chats/:id",mustBeSignedIn,sameOrigin,(req,res)=>{
  const ws=aiWorkspace(req.auth.identity.id),before=ws.chats.length;
  ws.chats=ws.chats.filter(c=>c.id!==req.params.id);
  if(ws.chats.length===before)return fail(res,404,"Conversation not found.");
  if(ws.activeId===req.params.id)ws.activeId=ws.chats.at(-1)?.id||null;
  persist();res.json({ok:true,activeId:ws.activeId});
 });
 app.patch("/api/account/ai/preferences",mustBeSignedIn,sameOrigin,(req,res)=>{
  const ws=aiWorkspace(req.auth.identity.id),body=req.body||{};
  if(body.tone!==undefined&&!AI_TONES.includes(body.tone))return fail(res,400,"Invalid tone.");
  if(body.length!==undefined&&!AI_LENGTHS.includes(body.length))return fail(res,400,"Invalid response length.");
  if(body.name!==undefined&&(typeof body.name!=="string"||body.name.length>50))return fail(res,400,"Assistant name is too long.");
  if(body.instructions!==undefined&&(typeof body.instructions!=="string"||body.instructions.length>1200))return fail(res,400,"Instructions must be under 1,200 characters.");
  ws.preferences={...aiDefaults(),...ws.preferences,
   ...(body.tone!==undefined?{tone:body.tone}:{}),
   ...(body.length!==undefined?{length:body.length}:{}),
   ...(body.name!==undefined?{name:clip(body.name,50)||"Lightning AI"}:{}),
   ...(body.instructions!==undefined?{instructions:body.instructions.trim()}: {})};
  persist();res.json({preferences:ws.preferences});
 });
 function getAiPreferences(userId){
  const ws=aiWorkspace(userId);
  return {...aiDefaults(),...ws.preferences};
 }

 return {getDisplayName,profile,getAiPreferences};
}
