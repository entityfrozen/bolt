import test from "node:test";
import assert from "node:assert/strict";
import {activeRoleplay,completeAi} from "../ai-provider.js";

function answer(text){
 const packet=JSON.stringify({choices:[{delta:{content:text}}]});
 return new Response("data: "+packet+"\n\ndata: [DONE]\n\n",{
  status:200,headers:{"Content-Type":"text/event-stream"}
 });
}
test("Quiet roleplay command carries through the conversation until ended",()=>{
 const history=[
  {role:"user",content:"/rp A moonlit castle, you are a cryptic knight"},
  {role:"assistant",content:"The gates creak open."},
  {role:"user",content:"Who is there?"}
 ];
 assert.equal(activeRoleplay(history),"A moonlit castle, you are a cryptic knight");
 assert.equal(activeRoleplay([...history,{role:"user",content:"/endrp"}]),null);
 assert.equal(activeRoleplay([{role:"user",content:"Explain JavaScript"}]),null);
});
test("A slow primary model triggers a bounded fallback without waiting indefinitely",async()=>{
 const seen=[],updates=[],tokens=[];
 const fetcher=async (url,options)=>{
  const model=JSON.parse(options.body).model;seen.push(model);
  if(model==="primary-model")return new Promise((resolve,reject)=>{
   if(options.signal.aborted)reject(options.signal.reason);
   options.signal.addEventListener("abort",()=>reject(options.signal.reason),{once:true});
  });
  return answer("Backup worked.");
 };
 const result=await completeAi({
  apiKey:"fake-key",model:"primary-model",backupModel:"backup-model",
  messages:[{role:"user",content:"Hello"}],fetcher,budgets:[30,250],
  onStatus:x=>updates.push(x),onDelta:x=>tokens.push(x)
 });
 assert.equal(result.reply,"Backup worked.");
 assert.equal(result.usedBackup,true);
 assert.deepEqual(seen,["primary-model","backup-model"]);
 assert.deepEqual(tokens,["Backup worked."]);
 assert.ok(updates.some(text=>text.includes("another available AI model")));
});
test("A provider authorization error does not waste another model request",async()=>{
 const calls=[];
 const fetcher=async (url,opts)=>{
  calls.push(JSON.parse(opts.body).model);
  return new Response(JSON.stringify({detail:"Key rejected"}),{status:401,headers:{"Content-Type":"application/json"}});
 };
 await assert.rejects(completeAi({apiKey:"fake",messages:[{role:"user",content:"Hi"}],fetcher,budgets:[100,100]}),/API key/i);
 assert.equal(calls.length,1);
});
test("A configured backup is skipped if the first model responds",async()=>{
 const calls=[];
 const result=await completeAi({
  apiKey:"fake",messages:[{role:"user",content:"Hello"}],
  fetcher:async(url,opts)=>{calls.push(JSON.parse(opts.body).model);return answer("Primary reply.")},
  budgets:[100,100]
 });
 assert.equal(result.reply,"Primary reply.");
 assert.equal(result.usedBackup,false);
 assert.equal(calls.length,1);
});

test("The default fallback is a live NVIDIA endpoint, not a retired model",async()=>{
 const seen=[];
 const fetcher=async (url,opts)=>{
  const model=JSON.parse(opts.body).model;seen.push(model);
  if(seen.length===1)return new Response(JSON.stringify({error:{message:"Unavailable"}}),{status:503,headers:{"Content-Type":"application/json"}});
  return answer("Recovered.");
 };
 const result=await completeAi({
  apiKey:"fake",model:"fresh-primary-model",
  messages:[{role:"user",content:"Hey"}],fetcher,budgets:[100,100]
 });
 assert.equal(result.reply,"Recovered.");
 assert.equal(seen[1],"meta/llama-3.2-11b-vision-instruct");
 assert.ok(!seen.includes("mistralai/mistral-nemotron"));
});
