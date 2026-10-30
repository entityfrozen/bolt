import crypto from "node:crypto";

// This protects Lightning-owned search transport and storage, not the
// third-party page the user chooses to open or browser memory/DevTools.
export function installPrivateResearch({app,mustBeSignedIn,sameOrigin,search}){
 const {publicKey,privateKey}=crypto.generateKeyPairSync("rsa",{
  modulusLength:2048,publicExponent:0x10001
 });
 const publicJwk=publicKey.export({format:"jwk"});
 const rate=new Map(),recent=new Map();
 const windowMs=60000,ttlMs=10*60000;
 function cleanMaps(){
  const now=Date.now();
  for(const [key,entry] of rate)if(now-entry.at>windowMs)rate.delete(key);
  for(const [key,entry] of recent)if(entry.until<=now)recent.delete(key);
  if(rate.size>2000)rate.clear();
  if(recent.size>2000)recent.clear();
 }
 function noStore(res){
  res.setHeader("Cache-Control","no-store, private");
  res.setHeader("Referrer-Policy","no-referrer");
 }
 const idOf=req=>String(req.auth?.session?.id||req.auth?.identity?.id||"");
 app.get("/api/research/key",mustBeSignedIn,(_req,res)=>{
  noStore(res);
  res.json({key:publicJwk,algorithm:"RSA-OAEP",hash:"SHA-256"});
 });
 app.post("/api/research/query",mustBeSignedIn,sameOrigin,async(req,res)=>{
  noStore(res);
  const payload=req.body?.ciphertext;
  if(typeof payload!=="string"||payload.length!==344||!/^[A-Za-z0-9+/]+={0,2}$/.test(payload))
   return res.status(400).json({error:"Invalid encrypted request."});
  let query;
  try{
   const decrypted=crypto.privateDecrypt({
    key:privateKey,padding:crypto.constants.RSA_PKCS1_OAEP_PADDING,oaepHash:"sha256"
   },Buffer.from(payload,"base64"));
   query=decrypted.toString("utf8").replace(/\s+/g," ").trim();
   if(decrypted.length>180||query.length<2||query.length>180||/[\x00-\x1f\x7f]/.test(query))
    return res.status(400).json({error:"Enter a shorter search phrase."});
  }catch{return res.status(400).json({error:"Could not read the encrypted request."});}
  const actor=idOf(req),now=Date.now();
  const current=rate.get(actor);
  const entry=current&&now-current.at<windowMs?current:{at:now,used:0};
  if(entry.used>=8)return res.status(429).json({error:"Too many searches. Try again shortly."});
  entry.used++;rate.set(actor,entry);
  cleanMaps();
  let response;
  try{response=await search(actor,query);}
  catch{return res.status(502).json({error:"Search service unavailable."});}
  const quote=query.replace(/[^a-z0-9]/gi,char=>"\\"+char);
  const exact=new RegExp(quote,"gi");
  const redact=text=>String(text||"").replace(exact,"this topic");
  const links=new Map();
  const results=[];
  for(const source of (response?.sources||[]).slice(0,8)){
   if(!source||typeof source.title!=="string")continue;
   let parsed;
   try{
    parsed=new URL(source.url);
    if(!["https:","http:"].includes(parsed.protocol)||parsed.username||parsed.password)continue;
   }catch{continue;}
   const id=crypto.randomBytes(15).toString("hex");
   links.set(id,parsed.href);
   results.push({id,title:redact(source.title).slice(0,160),
    snippet:redact(source.snippet).slice(0,450),domain:parsed.hostname});
  }
  recent.set(actor,{until:Date.now()+ttlMs,links});
  res.json({results,provider:results.length?String(response?.provider||"Search").slice(0,32):null,
   notice:results.length?"":"No matching results. Try different words."});
 });
 app.post("/api/research/open",mustBeSignedIn,sameOrigin,(req,res)=>{
  noStore(res);
  const id=req.body?.id,entry=recent.get(idOf(req));
  if(typeof id!=="string"||!entry||entry.until<=Date.now()||!entry.links.has(id))
   return res.status(404).json({error:"Result expired. Search again."});
  res.json({url:entry.links.get(id)});
 });
 return {clear:()=>{rate.clear();recent.clear()}};
}
