// Server-side Voice.ai bridge. The provider credential never reaches the browser.
export function installChanVoice({app,mustBeSignedIn,sameOrigin,fetchImpl=fetch,key=()=>process.env.VOICEAI_API_KEY||""}){
 const base="https://dev.voice.ai/api/v1/tts";
 const usage=new Map();
 let cached=null;
 const noStore=res=>{res.set("Cache-Control","private, no-store");res.set("Referrer-Policy","no-referrer");};
 const token=()=>String(key()||"").trim();
 const validVoice=id=>typeof id==="string"&&/^[a-zA-Z0-9_-]{1,90}$/.test(id);
 const actor=req=>req.auth?.session?.id||req.auth?.identity?.id||"unknown";
 async function call(path,options={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),15000);
  try{
   return await fetchImpl(base+path,{...options,signal:controller.signal,
    headers:{"Authorization":"Bearer "+token(),...(options.headers||{})}});
  }finally{clearTimeout(timer)}
 }
 app.get("/api/chan/voices",mustBeSignedIn,async(req,res)=>{
  noStore(res);
  if(!token())return res.json({provider:"browser",voices:[],configured:false});
  try{
   if(!cached||Date.now()-cached.at>600000){
    const response=await call("/voices");
    if(!response.ok)throw Error("Could not load Voice.ai voices");
    const list=await response.json();
    cached={at:Date.now(),voices:(Array.isArray(list)?list:[])
     .filter(item=>item&&validVoice(item.voice_id)&&item.status!=="DELETED")
     .slice(0,75).map(item=>({id:item.voice_id,name:String(item.name||"Voice").slice(0,64),status:String(item.status||"")}))};
   }
   res.json({provider:"voiceai",configured:true,voices:cached.voices});
  }catch{res.status(502).json({error:"Voice list unavailable. Browser voices still work."});}
 });
 app.post("/api/chan/speech",mustBeSignedIn,sameOrigin,async(req,res)=>{
  noStore(res);
  if(!token())return res.status(503).json({error:"Voice.ai is not configured."});
  const text=typeof req.body?.text==="string"?req.body.text.trim():"";
  const voice=req.body?.voiceId||process.env.VOICEAI_VOICE_ID||"";
  if(text.length<1||text.length>500||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text))
   return res.status(400).json({error:"Speech must be 1–500 characters."});
  if(voice&&!validVoice(voice))return res.status(400).json({error:"Invalid voice."});
  const id=actor(req),now=Date.now();
  const history=(usage.get(id)||[]).filter(at=>now-at<60000);
  if(history.length>=6)return res.status(429).json({error:"Voice limit reached. Try again soon."});
  history.push(now);usage.set(id,history);
  if(usage.size>1000)for(const [uid,items] of usage)if(items.every(at=>now-at>=60000))usage.delete(uid);
  try{
   const body={text,audio_format:"mp3",language:"en",temperature:1,top_p:.85};
   if(voice)body.voice_id=voice;
   const response=await call("/speech",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
   if(!response.ok)return res.status(502).json({error:"Voice.ai could not generate speech."});
   const length=Number(response.headers.get("content-length")||0);
   if(length>3500000)return res.status(502).json({error:"Voice response too large."});
   const reader=response.body?.getReader();
   if(!reader)return res.status(502).json({error:"No audio returned."});
   const buffers=[];let total=0;
   while(true){
    const {done,value}=await reader.read();
    if(done)break;
    total+=value.length;
    if(total>3500000){await reader.cancel();return res.status(502).json({error:"Voice response too large."});}
    buffers.push(Buffer.from(value));
   }
   if(!total)return res.status(502).json({error:"Voice.ai returned empty audio."});
   res.type("audio/mpeg");res.send(Buffer.concat(buffers));
  }catch{return res.status(502).json({error:"Voice service unavailable. Try a browser voice."});}
 });
}
