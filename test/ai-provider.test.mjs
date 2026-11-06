import test from "node:test";
import assert from "node:assert/strict";
import {activeRoleplay,completeAi,TEXT_MODEL,VISION_MODEL,VISION_BACKUP,usableModel,collapseHistory} from "../ai-provider.js";

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
 assert.equal(seen[1],VISION_MODEL);
 assert.ok(!seen.includes("mistralai/mistral-nemotron"));
});

test("Retired NVIDIA model names are never chosen as active defaults",()=>{
 assert.equal(TEXT_MODEL,"nvidia/nemotron-3.5-lightning-30b-a3b");
 assert.equal(VISION_MODEL,"meta/muse-glimmer-30b");
 assert.equal(VISION_BACKUP,"nvidia/nemotron-3.5-super-vl-120b-a12b");
 assert.equal(usableModel("meta/llama-3.2-11b-vision-instruct",TEXT_MODEL),TEXT_MODEL);
 assert.equal(usableModel("meta/llama-3.2-90b-vision-instruct",VISION_MODEL),VISION_MODEL);
 assert.equal(usableModel("nvidia/custom-model",TEXT_MODEL),"nvidia/custom-model");
});

test("Repeated unanswered user turns collapse so the provider gets alternating roles",()=>{
 const original=[
  {role:"user",content:"Hi"}, {role:"user",content:"Are you still there?"},
  {role:"assistant",content:"Yes"},
  {role:"user",content:"Explain this"}, {role:"user",content:"Please be brief",image:"data:image/png;base64,AAAA"}
 ];
 const normalized=collapseHistory(original);
 assert.deepEqual(normalized.map(x=>x.role),["user","assistant","user"]);
 assert.equal(normalized[0].content,"Hi\n\nAre you still there?");
 assert.equal(normalized[2].content,"Explain this\n\nPlease be brief");
 assert.equal(normalized[2].image,"data:image/png;base64,AAAA");
 assert.equal(original[0].content,"Hi");
});

test("Fast NVIDIA model uses non-reasoning chat settings and bounded tokens",async()=>{
 let request;
 const result=await completeAi({
  apiKey:"fake",model:TEXT_MODEL,backupModel:VISION_MODEL,maxTokens:64,
  messages:[{role:"user",content:"Respond with OK."}],stream:false,
  fetcher:async(_url,options)=>{
   request=JSON.parse(options.body);
   return new Response(JSON.stringify({choices:[{message:{content:"OK"}}]}),{status:200});
  }
 });
 assert.equal(result.reply,"OK");
 assert.equal(request.model,TEXT_MODEL);
 assert.equal(request.max_tokens,64);
 assert.equal(request.temperature,1);
 assert.deepEqual(request.chat_template_kwargs,{enable_thinking:false});
});
