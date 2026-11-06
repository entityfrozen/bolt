import {readAiCompletionStream} from "./ai-stream.js";

const ENDPOINT="https://integrate.api.nvidia.com/v1/chat/completions";
// NVIDIA removed mistral-nemotron on 2026-09-28. This endpoint remains hosted.
// Both defaults have hosted NVIDIA API endpoints as of November 2026.
export const TEXT_MODEL="nvidia/nemotron-3.5-lightning-30b-a3b";
export const VISION_MODEL="meta/muse-glimmer-30b";
export const VISION_BACKUP="nvidia/nemotron-3.5-super-vl-120b-a12b";
const DEFAULT_BACKUP=VISION_MODEL;
const RETIRED_MODELS=new Set([
 "meta/llama-3.2-11b-vision-instruct",
 "meta/llama-3.2-90b-vision-instruct",
 "mistralai/mistral-nemotron"
]);
export function usableModel(value,fallback){
 const name=String(value||"").trim();
 return !name||RETIRED_MODELS.has(name)?fallback:name;
}
export function collapseHistory(messages){
 const result=[];
 for(const message of messages){
  const previous=result.at(-1);
  if(previous?.role===message.role){
   previous.content+=(previous.content?"\n\n":"")+String(message.content||"");
   if(message.image)previous.image=message.image;
  }else result.push({...message});
 }
 return result;
}
const modelCooldowns=new Map();

export function activeRoleplay(messages){
  let scene=null;
  // Look backward: the most recent mode command wins within the sent history.
  for(let i=messages.length-1;i>=0;i--){
    if(messages[i].role!=="user")continue;
    const line=messages[i].content.trim();
    if(/^\/(?:endrp|endroleplay)\b/i.test(line))return null;
    const match=line.match(/^\/(?:rp|roleplay)\s+([\s\S]+)/i);
    if(match){scene=match[1].trim().slice(0,1000);break;}
  }
  return scene;
}

export async function completeAi({
  apiKey,model=TEXT_MODEL,backupModel=DEFAULT_BACKUP,
  messages,stream=true,signal,fetcher=fetch,onStatus=()=>{},
  onDelta=()=>{},onReasoning=()=>{},budgets=[18000,23000],maxTokens=1200
}){
  const configured=[model,backupModel].filter((name,index,array)=>name&&array.indexOf(name)===index);
  // Once a model times out, start subsequent chats with the working alternative.
  // A failed model is tried again later, rather than permanently disabled.
  const now=Date.now();
  for(const [name,until] of modelCooldowns)if(until<=now)modelCooldowns.delete(name);
  const models=configured.slice().sort((a,b)=>Number(modelCooldowns.has(a))-Number(modelCooldowns.has(b)));
  let lastError=null,failures=[];
  for(const [index,name] of models.entries()){
    if(signal?.aborted)throw signal.reason||new Error("Request cancelled");
    if(index)onStatus("Trying another available AI model…");
    else if(name!==model)onStatus("Using the faster AI model…");
    const controller=new AbortController();
    const onAbort=()=>controller.abort(signal?.reason);
    signal?.addEventListener("abort",onAbort,{once:true});
    const budget=budgets[Math.min(index,budgets.length-1)]||19000;
    const timeout=setTimeout(()=>controller.abort(new Error("Model did not respond within "+Math.round(budget/1000)+" seconds")),budget);
    let emitted=false;
    const started=Date.now();
    try{
      console.info("Lightning AI model attempt:",name,"maxWaitMs:",budget);
      const response=await fetcher(ENDPOINT,{
        method:"POST",
        headers:{"Authorization":"Bearer "+apiKey,"Content-Type":"application/json",
          "Accept":stream?"text/event-stream":"application/json"},
        body:JSON.stringify({
          model:name,messages,stream,
          max_tokens:Math.max(32,Math.min(2048,Math.floor(Number(maxTokens)||1200),
            Number(process.env.NVIDIA_MAX_TOKENS)||1200)),
          temperature:name.includes("nemotron")||name.includes("muse-glimmer")?1:0.65,
          ...(name.includes("nemotron-3")?{chat_template_kwargs:{enable_thinking:false}}:{})
        }),
        signal:controller.signal
      });
      if(!response.ok){
        let info={};
        try{info=await response.json();}catch{}
        const error=new Error("AI model "+name+" returned HTTP "+response.status+".");
        error.status=response.status;
        console.warn("Lightning AI model unavailable:",name,response.status,
          String(info?.detail||info?.error?.message||"").slice(0,130));
        throw error;
      }
      onStatus("Generating the answer…");
      let reasoningSeen=false;
      const reply=stream
        ?await readAiCompletionStream(response,chunk=>{
          if(!emitted)onStatus("Writing the answer…");
          emitted=true;onDelta(chunk);
        },()=>{
          if(!reasoningSeen&&!emitted){reasoningSeen=true;onReasoning();}
        })
        :(await response.json())?.choices?.[0]?.message?.content;
      if(typeof reply!=="string"||!reply.trim())throw new Error("The AI provider returned no answer.");
      console.info("Lightning AI model completed:",name,"durationMs:",Date.now()-started);
      return {reply,model:name,usedBackup:index>0};
    }catch(error){
      if(signal?.aborted)throw signal.reason||error;
      lastError=error;
      const status=Number(error?.status)||0;
      const timeoutFailure=controller.signal.aborted;
      const problem=status?"HTTP "+status:timeoutFailure?"timed out":String(error?.message||"failed").slice(0,80);
      failures.push(name+": "+problem);
      console.warn("Lightning AI model attempt failed:",name,problem);
      if(status===410||status===404)modelCooldowns.set(name,Date.now()+24*60*60*1000);
      else if(timeoutFailure||status>=500||status===429)modelCooldowns.set(name,Date.now()+5*60*1000);
      if(emitted||status===401||status===403)break;
    }finally{
      clearTimeout(timeout);
      signal?.removeEventListener("abort",onAbort);
      controller.abort();
    }
  }
  const message=lastError?.status===401?"NVIDIA rejected Lightning\'s API key. Ask an admin to check Provider Keys in the admin console.":
    lastError?.status===403?"NVIDIA denied model access for this API key.":
    "NVIDIA could not generate an answer ("+failures.join("; ")+"). Ask an admin to use Provider Keys → Test connection, or try again shortly.";
  const error=new Error(message);
  error.cause=lastError;
  throw error;
}
