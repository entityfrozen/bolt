import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import {readFileSync} from "node:fs";
import express from "express";
import {installPrivateResearch} from "../private-research.js";

async function launch(t){
 const app=express();
 app.use(express.json());
 const searched=[];
 const identity=(req,res,next)=>{
  if(!req.headers["x-test-identity"])return res.status(401).json({error:"Sign in."});
  req.auth={identity:{id:req.headers["x-test-identity"]},session:{id:req.headers["x-test-identity"]}};
  next();
 };
 installPrivateResearch({app,mustBeSignedIn:identity,sameOrigin:(_req,_res,next)=>next(),
  search:async(_user,query)=>{
   searched.push(query);
   return {provider:"Local example",sources:[
    {title:"Subway Surfers walkthrough",url:"https://example.org/learning?topic=subway%20surfers",
     snippet:"Subway Surfers explained step by step."},
    {title:"Other resource",url:"https://docs.example.org/lessons",snippet:"Independent reading."}
   ]};
  }});
 const server=http.createServer(app);
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 t.after(()=>server.close());
 return {base:"http://127.0.0.1:"+server.address().port,searched};
}
async function request(base,path,uid="member",body){
 const res=await fetch(base+path,{method:body===undefined?"GET":"POST",
  headers:{"Content-Type":"application/json",...(uid?{"x-test-identity":uid}:{})},
  body:body===undefined?undefined:JSON.stringify(body)});
 return {status:res.status,json:await res.json(),headers:res.headers};
}
function encode(jwk,query){
 const key=crypto.createPublicKey({key:jwk,format:"jwk"});
 return crypto.publicEncrypt({key,oaepHash:"sha256",
  padding:crypto.constants.RSA_PKCS1_OAEP_PADDING},Buffer.from(query,"utf8")).toString("base64");
}

test("The private results search encrypts the request, removes the phrase from the response, and never returns destination URLs before a click",{timeout:25000},async t=>{
 const {base,searched}=await launch(t);
 assert.equal((await request(base,"/api/research/key",null)).status,401);
 const key=(await request(base,"/api/research/key")).json.key;
 assert.equal(key.kty,"RSA");
 const query="subway surfers";
 const ciphertext=encode(key,query);
 assert.equal(ciphertext.length,344);
 assert.ok(!ciphertext.toLowerCase().includes(query));
 const found=await request(base,"/api/research/query","member",{ciphertext});
 assert.equal(found.status,200);
 assert.equal(searched[0],query);
 assert.equal(found.headers.get("cache-control"),"no-store, private");
 assert.equal(found.json.results.length,2);
 assert.doesNotMatch(JSON.stringify(found.json),/subway surfers/i);
 assert.ok(found.json.results[0].id);
 assert.equal(found.json.results[0].domain,"example.org");
 assert.equal(found.json.results[0].url,undefined);
 assert.equal((await request(base,"/api/research/open","other-user",{id:found.json.results[0].id})).status,404);
 const opened=await request(base,"/api/research/open","member",{id:found.json.results[0].id});
 assert.equal(opened.status,200);
 assert.equal(opened.json.url,"https://example.org/learning?topic=subway%20surfers");
});

test("Invalid and excessive encrypted requests are rejected without calling the provider",{timeout:25000},async t=>{
 const {base,searched}=await launch(t);
 const key=(await request(base,"/api/research/key")).json.key;
 const invalid=await request(base,"/api/research/query","member",{ciphertext:"subway surfers"});
 assert.equal(invalid.status,400);
 assert.equal(searched.length,0);
 const tooLong=await request(base,"/api/research/query","member",{ciphertext:encode(key,"a".repeat(190))});
 assert.equal(tooLong.status,400);
 for(let i=0;i<8;i++)assert.equal((await request(base,"/api/research/query","member",
  {ciphertext:encode(key,"subway surfers")})).status,200);
 assert.equal((await request(base,"/api/research/query","member",
  {ciphertext:encode(key,"subway surfers")})).status,429);
 assert.equal(searched.length,8);
});

test("The browser encrypts private searches rather than inserting them into URLs",()=>{
 const source=readFileSync(new URL("../public/assets/research-client.js",import.meta.url),"utf8");
 assert.match(source,/crypto\.subtle\.encrypt/);
 assert.match(source,/RSA-OAEP/);
 assert.match(source,/\/api\/research\/query/);
 assert.match(source,/ciphertext:encoded/);
 assert.doesNotMatch(source,/searchParams\.set\("q"/);
});
