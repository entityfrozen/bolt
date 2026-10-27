import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// Per-account web search credentials; no keys reach the browser after saving.
export function installSearchCredentials({app,dataDir,mustBeSignedIn,sameOrigin,searchWeb}){
 const secretsFile=path.join(dataDir,"lightning-search-credentials.json");
 const secretFile=path.join(dataDir,".lightning-search-master-key");
 const accepted=new Set(["tavily","brave"]);
 let master;
 try{master=Buffer.from(fs.readFileSync(secretFile,"utf8").trim(),"hex");if(master.length!==32)throw Error("Invalid saved encryption key");}
 catch(err){
  if(fs.existsSync(secretFile))throw new Error("Cannot read saved search encryption key: "+err.message);
  master=crypto.randomBytes(32);
  fs.writeFileSync(secretFile,master.toString("hex"),{mode:0o600,flag:"wx"});
 }
 let state={};
 try{state=JSON.parse(fs.readFileSync(secretsFile,"utf8"));if(!state||Array.isArray(state)||typeof state!=="object")state={};}catch{}
 const save=()=>{
  const tmp=secretsFile+".tmp";fs.writeFileSync(tmp,JSON.stringify(state),{mode:0o600});
  fs.renameSync(tmp,secretsFile);
 };
 const seal=plaintext=>{
  const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv("aes-256-gcm",master,iv);
  const body=Buffer.concat([cipher.update(plaintext,"utf8"),cipher.final()]);
  return [iv.toString("base64"),cipher.getAuthTag().toString("base64"),body.toString("base64")].join(".");
 };
 const unseal=sealed=>{
  try{
   const [nonce,tag,body]=String(sealed).split(".");
   const decipher=crypto.createDecipheriv("aes-256-gcm",master,Buffer.from(nonce,"base64"));
   decipher.setAuthTag(Buffer.from(tag,"base64"));
   return Buffer.concat([decipher.update(Buffer.from(body,"base64")),decipher.final()]).toString("utf8");
  }catch{return "";}
 };
 const owned=id=>{
  const cfg=state[id]||{};
  return {tavilyKey:unseal(cfg.tavily),braveKey:unseal(cfg.brave)};
 };
 const status=id=>{
  const keys=owned(id);
  return {tavily:!!(keys.tavilyKey||process.env.TAVILY_API_KEY),
   brave:!!(keys.braveKey||process.env.BRAVE_SEARCH_API_KEY),
   source:{
    tavily:keys.tavilyKey?"account":process.env.TAVILY_API_KEY?"server":"missing",
    brave:keys.braveKey?"account":process.env.BRAVE_SEARCH_API_KEY?"server":"missing"
   }};
 };
 const search=(id,query,options={})=>{
  const config=owned(id);
  return searchWeb(query,{...options,
   tavilyKey:config.tavilyKey||process.env.TAVILY_API_KEY||"",
   braveKey:config.braveKey||process.env.BRAVE_SEARCH_API_KEY||""});
 };
 app.get("/api/ai/search-settings",mustBeSignedIn,(req,res)=>{
  res.setHeader("Cache-Control","no-store");
  res.json(status(req.auth.identity.id));
 });
 app.post("/api/ai/search-settings",mustBeSignedIn,sameOrigin,(req,res)=>{
  const provider=req.body?.provider,key=req.body?.key;
  if(!accepted.has(provider))return res.status(400).json({error:"Choose Tavily or Brave Search."});
  if(typeof key!=="string"||key.length<10||key.length>300||/[^\x21-\x7e]/.test(key))
   return res.status(400).json({error:"Paste a valid API key (10–300 characters, no spaces)."});
  const id=req.auth.identity.id;
  (state[id]??={})[provider]=seal(key);
  save();res.json({ok:true,...status(id)});
 });
 app.delete("/api/ai/search-settings/:provider",mustBeSignedIn,sameOrigin,(req,res)=>{
  const provider=req.params.provider;
  if(!accepted.has(provider))return res.status(404).json({error:"Unknown provider."});
  const id=req.auth.identity.id;
  if(state[id]){delete state[id][provider];save();}
  res.json({ok:true,...status(id)});
 });
 app.post("/api/ai/search-test",mustBeSignedIn,sameOrigin,async(req,res)=>{
  const provider=req.body?.provider;
  if(!accepted.has(provider))return res.status(400).json({error:"Choose Tavily or Brave Search."});
  const config=status(req.auth.identity.id);
  if(!config[provider])return res.status(400).json({error:provider+" is not configured. Save a key first."});
  try{
   const result=await search(req.auth.identity.id,"Lightning browser official website",{providerOnly:provider});
   res.json({ok:!!result.sources.length,provider,sourceCount:result.sources.length,
    error:result.error||(!result.sources.length?"Provider responded without search results.":null)});
  }catch{res.status(502).json({ok:false,error:"Search provider could not be reached."});}
 });
 return {search,status};
}
