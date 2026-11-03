import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import http from "node:http";
import {installChanVoice} from "../chan-voice.js";

const text=path=>fs.readFileSync(new URL("../"+path,import.meta.url),"utf8");
async function fixture(t,secret="test-only-voice-key"){
 const app=express();app.use(express.json());
 const outbound=[];
 const identity=(req,res,next)=>{
  if(req.headers["x-test-auth"]!=="ok")return res.status(401).json({error:"Sign in required"});
  req.auth={session:{id:"test-session"}};next();
 };
 const fetchImpl=async(url,opts={})=>{
  outbound.push({url,authorization:opts.headers?.Authorization,body:opts.body});
  if(url.endsWith("/voices"))return Response.json([
   {voice_id:"voice-test-id",name:"Ellie",status:"READY"},
   {voice_id:"junk",name:"Removed",status:"DELETED"}]);
  return new Response(Buffer.from("ID3fake-audio"),{status:200,headers:{"content-type":"audio/mpeg"}});
 };
 installChanVoice({app,mustBeSignedIn:identity,sameOrigin:(req,res,next)=>next(),
  fetchImpl,key:()=>secret});
 const server=http.createServer(app);
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 t.after(()=>server.close());
 const origin="http://127.0.0.1:"+server.address().port;
 async function request(path,body,auth="ok"){
  const response=await fetch(origin+path,{
   method:body===undefined?"GET":"POST",
   headers:{"Content-Type":"application/json",...(auth?{"x-test-auth":auth}:{})},
   body:body===undefined?undefined:JSON.stringify(body)
  });
  return {status:response.status,body:response.headers.get("content-type")?.includes("audio")?
   Buffer.from(await response.arrayBuffer()):await response.json(),headers:response.headers};
 }
 return {request,outbound};
}

test("Voice.ai stays server-side and only authenticated clients can list voices or request audio",async t=>{
 const {request,outbound}=await fixture(t);
 assert.equal((await request("/api/chan/voices",undefined,null)).status,401);
 assert.equal((await request("/api/chan/speech",{text:"Hey!"},null)).status,401);
 const list=await request("/api/chan/voices");
 assert.equal(list.status,200);
 assert.deepEqual(list.body.voices,[{id:"voice-test-id",name:"Ellie",status:"READY"}]);
 assert.equal(list.headers.get("cache-control"),"private, no-store");
 const result=await request("/api/chan/speech",{text:"Hey! Welcome to Lightning.",voiceId:"voice-test-id"});
 assert.equal(result.status,200);
 assert.equal(result.body.toString(),"ID3fake-audio");
 assert.ok(outbound.every(entry=>entry.authorization==="Bearer test-only-voice-key"));
 assert.equal(JSON.stringify(list.body).includes("test-only-voice-key"),false);
 const sent=JSON.parse(outbound.find(item=>item.url.endsWith("/speech")).body);
 assert.equal(sent.voice_id,"voice-test-id");
 assert.equal(sent.audio_format,"mp3");
});

test("Missing keys, invalid requests, and rate limits are handled safely",async t=>{
 const {request,outbound}=await fixture(t);
 assert.equal((await request("/api/chan/speech",{text:"a".repeat(501)})).status,400);
 assert.equal((await request("/api/chan/speech",{text:"hi",voiceId:"../bad"})).status,400);
 assert.equal(outbound.length,0);
 for(let i=0;i<6;i++)assert.equal((await request("/api/chan/speech",{text:"Hello!"})).status,200);
 assert.equal((await request("/api/chan/speech",{text:"Hello!"})).status,429);
 const noKey=await fixture(t,"");
 assert.equal((await noKey.request("/api/chan/voices")).body.configured,false);
 assert.equal((await noKey.request("/api/chan/speech",{text:"Hello!"})).status,503);
});

test("Chapter VI companion uses the existing AI and keeps provider credentials on the server",()=>{
 const js=text("public/assets/lightning-v6.js");
 const html=text("views/app.html");
 const client=text("public/assets/bolt-tools.js");
 const server=text("server.js");
 assert.match(js,/const tour = \[/);
 assert.match(js,/lightning:account-settings-loaded/);
 assert.match(js,/prefs\.tourVersion = TOUR_VERSION/);
 assert.match(js,/data-ln-theme/);
 assert.match(js,/homeMascot/);
 assert.match(js,/libraryMascot/);
 assert.match(js,/aiMascot/);
 assert.match(js,/\/api\/chan\/voices/);
 assert.match(js,/\/api\/chan\/speech/);
 assert.match(js,/lightning:ai-answer/);
 assert.match(html,/&#108;ightning-v6\.js\?v=1/);
 assert.match(html,/data-ln-guide/);
 assert.match(client,/new CustomEvent\("lightning:ai-answer"/);
 assert.match(server,/installChanVoice\(/);
 assert.doesNotMatch(js,/process\.env|Authorization[^\n]*Bearer/);
});
