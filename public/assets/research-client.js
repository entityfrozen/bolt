(()=>{
 "use strict";
 async function json(url,options={}){
  const response=await fetch(url,{credentials:"same-origin",cache:"no-store",...options});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.error||"Research request failed.");
  return data;
 }
 window.LightningResearch={
  async search(text){
   const bytes=new TextEncoder().encode(String(text||"").trim());
   if(bytes.length<2||bytes.length>180)throw Error("Use a search phrase of 2–180 bytes.");
   if(!window.crypto?.subtle)throw Error("Private results require a secure browser connection.");
   const info=await json("/api/research/key");
   const key=await window.crypto.subtle.importKey("jwk",info.key,
    {name:"RSA-OAEP",hash:"SHA-256"},false,["encrypt"]);
   const ciphertext=await window.crypto.subtle.encrypt({name:"RSA-OAEP"},key,bytes);
   const encoded=btoa(String.fromCharCode(...new Uint8Array(ciphertext)));
   return json("/api/research/query",{method:"POST",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({ciphertext:encoded})});
  },
  async open(id){
   const response=await json("/api/research/open",{method:"POST",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({id})});
   return response.url;
  }
 };
})();
