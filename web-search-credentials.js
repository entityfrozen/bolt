import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// One encrypted search configuration for the whole installation.
// Only authenticated admins can read its status, save/remove keys or test them.
export function installSearchCredentials({app,dataDir,mustBeAdmin,sameOrigin,searchWeb,getAdminIds=()=>[]}){
 const secretsFile=path.join(dataDir,"lightning-search-credentials.json");
 const secretFile=path.join(dataDir,".lightning-search-master-key");
 const accepted=new Set(["tavily","brave"]);
 let master;
 try{
  master=Buffer.from(fs.readFileSync(secretFile,"utf8").trim(),"hex");
  if(master.length!==32)throw Error("Invalid saved encryption key");
 }catch(err){
  if(fs.existsSync(secretFile))throw new Error("Cannot read search encryption key: "+err.message);
  master=crypto.randomBytes(32);
  fs.writeFileSync(secretFile,master.toString("hex"),{mode:0o600,flag:"wx"});
 }
 let state={};
 try{
  const loaded=JSON.parse(fs.readFileSync(secretsFile,"utf8"));
  if(loaded&&typeof loaded==="object"&&!Array.isArray(loaded))state=loaded;
 }catch{}
 const save=()=>{
  const tmp=secretsFile+".tmp";
  fs.writeFileSync(tmp,JSON.stringify(state),{mode:0o600});
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
 // Existing keys saved by an admin in the earlier per-account system are
 // transferred into shared settings once. Keys from regular users are not used.
 const migrate=()=>{
  if(state.migratedShared===true)return;
  const shared=state.shared&&typeof state.shared==="object"?state.shared:{};
  for(const id of getAdminIds()){
   const legacy=state[id];
   if(!legacy||typeof legacy!=="object")continue;
   for(const provider of accepted)if(!shared[provider]&&unseal(legacy[provider]))shared[provider]=legacy[provider];
  }
  // Discard all old per-user encrypted credentials after migrating admin keys.
  state={shared,migratedShared:true};
  save();
 };
 migrate();
 const keys=()=>{
  const config=state.shared||{};
  return {tavilyKey:unseal(config.tavily)||process.env.TAVILY_API_KEY||"",
   braveKey:unseal(config.brave)||process.env.BRAVE_SEARCH_API_KEY||""};
 };
 const status=()=>{
  const config=state.shared||{},present=keys();
  return {tavily:!!present.tavilyKey,brave:!!present.braveKey,
   source:{
    tavily:unseal(config.tavily)?"shared":process.env.TAVILY_API_KEY?"server":"missing",
    brave:unseal(config.brave)?"shared":process.env.BRAVE_SEARCH_API_KEY?"server":"missing"
   }};
 };
 const search=(_userId,query,options={})=>searchWeb(query,{...options,...keys()});
 app.get("/api/ai/search-settings",mustBeAdmin,(req,res)=>{
  res.setHeader("Cache-Control","no-store");
  res.json(status());
 });
 app.post("/api/ai/search-settings",mustBeAdmin,sameOrigin,(req,res)=>{
  const provider=req.body?.provider,key=req.body?.key;
  if(!accepted.has(provider))return res.status(400).json({error:"Choose Tavily or Brave Search."});
  if(typeof key!=="string"||key.length<10||key.length>300||/[^\x21-\x7e]/.test(key))
   return res.status(400).json({error:"Paste a valid API key (10–300 characters, no spaces)."});
  (state.shared??={})[provider]=seal(key);
  save();res.json({ok:true,...status()});
 });
 app.delete("/api/ai/search-settings/:provider",mustBeAdmin,sameOrigin,(req,res)=>{
  const provider=req.params.provider;
  if(!accepted.has(provider))return res.status(404).json({error:"Unknown provider."});
  if(state.shared){delete state.shared[provider];save();}
  res.json({ok:true,...status()});
 });
 app.post("/api/ai/search-test",mustBeAdmin,sameOrigin,async(req,res)=>{
  const provider=req.body?.provider;
  if(!accepted.has(provider))return res.status(400).json({error:"Choose Tavily or Brave Search."});
  if(!status()[provider])return res.status(400).json({error:"Save a "+provider+" key first."});
  try{
   const result=await search(null,"Lightning browser official website",{providerOnly:provider});
   res.json({ok:!!result.sources.length,provider,sourceCount:result.sources.length,
    error:result.error||(!result.sources.length?"No results returned.":null)});
  }catch{
   res.status(502).json({ok:false,error:"Search provider could not be reached."});
  }
 });
 return {search,status};
}
