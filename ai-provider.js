import {readAiCompletionStream} from "./ai-stream.js";

const ENDPOINT="https://integrate.api.nvidia.com/v1/chat/completions";
const DEFAULT_BACKUP="mistralai/mistral-nemotron";

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
  apiKey,model="openai/gpt-oss-20b",backupModel=DEFAULT_BACKUP,
  messages,stream=true,signal,fetcher=fetch,onStatus=()=>{},
  onDelta=()=>{},onReasoning=()=>{},budgets=[16000,19000]
}){
  const models=[model,backupModel].filter((name,index,array)=>name&&array.indexOf(name)===index);
  let lastError=null;
  for(const [index,name] of models.entries()){
    if(signal?.aborted)throw signal.reason||new Error("Request cancelled");
    if(index)onStatus("Primary model was slow. Trying a backup…");
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
          max_tokens:Math.min(1200,Number(process.env.NVIDIA_MAX_TOKENS)||1200),
          temperature:name.includes("gpt-oss")?1:0.65,
          ...(name.includes("gpt-oss")?{reasoning_effort:"low"}:{})
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
      console.warn("Lightning AI model attempt failed:",name, error?.status||error?.message||"unknown");
      if(emitted||error?.status===401||error?.status===403)break;
    }finally{
      clearTimeout(timeout);
      signal?.removeEventListener("abort",onAbort);
      controller.abort();
    }
  }
  const message=lastError?.status===401?"NVIDIA rejected Lightning's server API key. The admin needs to check NVIDIA_API_KEY.":
    lastError?.status===403?"NVIDIA denied model access for this API key.":
    "Both AI model attempts failed or took too long. Try again shortly.";
  const error=new Error(message);
  error.cause=lastError;
  throw error;
}
