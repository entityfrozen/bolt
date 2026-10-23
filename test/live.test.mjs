import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import http from "node:http";
import { once } from "node:events";
import WebSocket from "ws";
import { attachLightningLive } from "../live.js";

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function setup(t) {
  const temp = mkdtempSync(path.join(tmpdir(), "lightning-live-"));
  const server = http.createServer((req, res) => { res.writeHead(404); res.end(); });
  attachLightningLive({
    server, dataDir: temp,
    sessionFromHeaders: headers => {
      const token = /(?:^|;\s*)tester=(\w+)/.exec(headers.cookie || "")?.[1];
      return token ? { identity: { id: token, username: token }, session: { id: token } } : null;
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  const sockets = [];
  const messages = new Map();
  t.after(async () => {
    for (const ws of sockets) { try { ws.terminate() } catch {} }
    await new Promise(resolve => server.close(resolve));
    rmSync(temp, { recursive: true, force: true });
  });
  async function connect(name) {
    const ws = new WebSocket("ws://127.0.0.1:" + port + "/live", { headers: { Cookie: "tester=" + name } });
    const history = [];
    sockets.push(ws);
    messages.set(ws, history);
    ws.on("message", raw => { try { history.push(JSON.parse(raw.toString())) } catch {} });
    await once(ws, "open");
    await until(() => history.some(m => m.type === "hello"));
    return ws;
  }
  async function until(predicate, timeout = 11000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      const result = predicate();
      if (result) return result;
      await delay(20);
    }
    throw new Error("Timed out waiting for WebSocket event");
  }
  return { connect, until, messages, port };
}

test("rejects unauthenticated websocket upgrades", async t => {
  const env = await setup(t);
  const ws = new WebSocket("ws://127.0.0.1:" + env.port + "/live");
  await new Promise((resolve, reject) => {
    ws.once("error", e => { assert.match(e.message, /401/); resolve() });
    ws.once("open", () => reject(new Error("Unauthenticated connection accepted")));
  });
});

test("shared chat broadcasts and records history", async t => {
  const env = await setup(t), alice = await env.connect("alice"), bob = await env.connect("bob");
  alice.send(JSON.stringify({ type: "chat", channel: "general", message: "Hello from Alice" }));
  const entry = await env.until(() => env.messages.get(bob).find(m => m.type === "chat"));
  assert.equal(entry.entry.message, "Hello from Alice");
  assert.equal(entry.entry.by, "alice");
  assert.equal(entry.entry.channel, "general");
  assert.equal(env.messages.get(alice).find(m => m.type === "hello").name, "alice");
});

test("chess enforces player turn and broadcasts legal moves", async t => {
  const env = await setup(t), alice = await env.connect("alice"), bob = await env.connect("bob");
  alice.send(JSON.stringify({ type: "queue", game: "chess" }));
  await env.until(() => env.messages.get(alice).some(m => m.type === "queued"));
  bob.send(JSON.stringify({ type: "queue", game: "chess" }));
  const start = await env.until(() => env.messages.get(alice).find(m => m.type === "chessStart"));
  await env.until(() => env.messages.get(bob).find(m => m.type === "chessStart"));
  await delay(600);
  alice.send(JSON.stringify({ type: "chessMove", id: start.id, from: "e2", to: "e4" }));
  const state = await env.until(() => env.messages.get(bob).find(m => m.type === "chessState"));
  assert.equal(state.last, "e4");
  assert.equal(state.turn, "b");
  await delay(600);
  alice.send(JSON.stringify({ type: "chessMove", id: start.id, from: "d2", to: "d4" }));
  const rejected = await env.until(() => env.messages.get(alice).find(m => m.type === "error" && /not your turn/.test(m.message)));
  assert.match(rejected.message, /not your turn/);
});

test("WorldPvP queues solo players and starts a full-Earth match with bots", async t => {
  const env = await setup(t), alice = await env.connect("alice");
  alice.send(JSON.stringify({ type: "worldQueue" }));
  const msg = await env.until(() => env.messages.get(alice).find(m => m.type === "world" && m.players.length));
  assert.equal(msg.width, 360);
 assert.equal(msg.height, 180);
 assert.equal(msg.cells.length, 64800);
 assert.ok(msg.players.some(p => p.bot), "match should include NPC nations");
  assert.ok(msg.landTotal > 0);
  assert.ok(msg.players.some(p => p.name === "alice"));
  assert.ok(msg.players.find(p => p.name === "alice").land > 0);
});


test("RPS keeps choices hidden until both players throw", async t => {
  const env = await setup(t), alice = await env.connect("alice"), bob = await env.connect("bob");
  alice.send(JSON.stringify({type:"queue",game:"rps"}));
  await env.until(() => env.messages.get(alice).some(m=>m.type==="queued"));
  bob.send(JSON.stringify({type:"queue",game:"rps"}));
  const start = await env.until(() => env.messages.get(alice).find(m=>m.type==="rpsStart"));
  const bobStart = await env.until(() => env.messages.get(bob).find(m=>m.type==="rpsStart"));
  assert.deepEqual(start.ids, ["alice","bob"]);
  assert.deepEqual(bobStart.ids, start.ids, "both clients must know their own seat");
  assert.deepEqual(start.players, ["alice","bob"]);
  await delay(620);
  alice.send(JSON.stringify({type:"rpsChoice",id:start.id,choice:"rock"}));
  await env.until(() => env.messages.get(alice).find(m=>m.type==="rpsWaiting"));
  assert.equal(env.messages.get(bob).some(m=>m.type==="rpsResult"), false);
  bob.send(JSON.stringify({type:"rpsChoice",id:start.id,choice:"scissors"}));
  const result=await env.until(()=>env.messages.get(alice).find(m=>m.type==="rpsResult"));
  assert.equal(result.winner,"alice");
  assert.equal(result.choices.alice,"rock");
  assert.equal(result.choices.bob,"scissors");
});

test("WorldPvP captures neutral land on a real-world landmass", async t => {
  const env = await setup(t), alice = await env.connect("alice");
  alice.send(JSON.stringify({type:"worldQueue"}));
  const first=await env.until(()=>env.messages.get(alice).find(m=>m.type==="world"&&m.players.some(p=>p.id==="alice")));
  const before=first.players.find(p=>p.id==="alice").land;
  const neighbor=first.cells.findIndex((owner,i)=>{
    if(owner!=="")return false;
    const x=i%first.width,y=Math.floor(i/first.width);
    return (x>0&&first.cells[i-1]==="alice")||(x<first.width-1&&first.cells[i+1]==="alice")||
      (y>0&&first.cells[i-first.width]==="alice")||(y<first.height-1&&first.cells[i+first.width]==="alice");
  });
  assert.ok(neighbor>=0,"spawn has neighboring neutral land");
  await delay(620);
  alice.send(JSON.stringify({type:"worldAction",action:"attack",x:neighbor%first.width,y:Math.floor(neighbor/first.width),ratio:.75}));
  const second=await env.until(()=>env.messages.get(alice).find(m=>m.type==="world"&&m.players.find(p=>p.id==="alice")?.land>before));
  assert.ok(second.players.find(p=>p.id==="alice").land>before);
});


test("Chess bot responds after a legal highlighted opening move", async t => {
 const env=await setup(t),alice=await env.connect("alice");
 alice.send(JSON.stringify({type:"chessBot"}));
 const start=await env.until(()=>env.messages.get(alice).find(m=>m.type==="chessStart"));
 assert.equal(start.color,"w");
 assert.ok(start.legal.some(m=>m.from==="e2"&&m.to==="e4"),"opening options should be sent to the client");
 await delay(180);
 alice.send(JSON.stringify({type:"chessMove",id:start.id,from:"e2",to:"e4"}));
 const state=await env.until(()=>env.messages.get(alice).find(m=>m.type==="chessState"&&m.last==="e4"));
 assert.equal(state.turn,"b");
 const response=await env.until(()=>env.messages.get(alice).find(m=>m.type==="chessState"&&m.turn==="w"&&m.last!=="e4"));
 assert.ok(response.legal.length>0,"client should receive legal destinations when it's their turn");
});

test("WorldPvP permits distant land campaigns but rejects inland water jumps", async t => {
 const env=await setup(t),alice=await env.connect("alice");
 alice.send(JSON.stringify({type:"worldQueue"}));
 const first=await env.until(()=>env.messages.get(alice).find(m=>m.type==="world"&&m.phase==="playing"&&m.players.some(p=>p.id==="alice")));
 const {width:W,height:H,cells}=first;
 const own=cells.findIndex(o=>o==="alice");
 const reachable=new Uint8Array(cells.length),queue=[own];reachable[own]=1;
 for(let k=0;k<queue.length;k++){
  const i=queue[k],x=i%W,y=Math.floor(i/W);
  for(const n of [x>0?i-1:-1,x<W-1?i+1:-1,y>0?i-W:-1,y<H-1?i+W:-1]){
   if(n<0||reachable[n]||cells[n]===-1)continue;
   reachable[n]=1;queue.push(n);
  }
 }
 const ox=own%W,oy=Math.floor(own/W);
 const distant=cells.findIndex((o,i)=>o===""&&reachable[i]&&Math.abs(i%W-ox)+Math.abs(Math.floor(i/W)-oy)>20);
 assert.ok(distant>=0,"have reachable neutral land outside immediate border");
 await delay(190);
 alice.send(JSON.stringify({type:"worldAction",action:"attack",x:distant%W,y:Math.floor(distant/W),ratio:.9}));
 const victory=await env.until(()=>env.messages.get(alice).find(m=>m.type==="world"&&m.cells[distant]==="alice"));
 assert.equal(victory.cells[distant],"alice");
 // An inland target on a disconnected landmass cannot be landed on by ship.
 const farInland=cells.findIndex((o,i)=>{
  if(o!==""||reachable[i]||i<=W||i>=W*(H-1))return false;
  const x=i%W;
  return x>0&&x<W-1&&[i-1,i+1,i-W,i+W].every(j=>cells[j]!==-1);
 });
 assert.ok(farInland>=0,"there should be inland land on another continent");
 await delay(1050);
 alice.send(JSON.stringify({type:"worldAction",action:"attack",x:farInland%W,y:Math.floor(farInland/W),ratio:.7}));
 const failed=await env.until(()=>env.messages.get(alice).find(m=>m.type==="worldInfo"&&/No land route|Naval attacks/.test(m.text)));
 assert.match(failed.text,/No land route/);
});


test("RPS bot plays a hidden choice and reveals both moves fairly",async t=>{
 const env=await setup(t),alice=await env.connect("alice");
 alice.send(JSON.stringify({type:"rpsBot"}));
 const match=await env.until(()=>env.messages.get(alice).find(m=>m.type==="rpsStart"&&m.bot===true));
 assert.equal(env.messages.get(alice).some(m=>m.type==="rpsResult"),false);
 await delay(180);
 alice.send(JSON.stringify({type:"rpsChoice",id:match.id,choice:"paper"}));
 const result=await env.until(()=>env.messages.get(alice).find(m=>m.type==="rpsResult"&&m.id===match.id));
 assert.equal(result.choices.alice,"paper");
 assert.ok(["rock","paper","scissors"].includes(result.choices["npc:rps"]));
});


test("WorldPvP instant match starts bot nations and allows reconnecting", async t => {
  const env=await setup(t),alice=await env.connect("alice");
  alice.send(JSON.stringify({type:"worldPractice"}));
  const start=await env.until(()=>env.messages.get(alice).find(m=>m.type==="world"&&m.phase==="playing"&&m.players.some(p=>p.id==="alice")));
  assert.ok(start.players.some(p=>p.bot),"instant matches should provide NPC opponents");
  assert.equal(start.width,360);
  assert.equal(start.height,180);
  await delay(190);
  alice.send(JSON.stringify({type:"worldSync"}));
  const matches=await env.until(()=>env.messages.get(alice).filter(m=>m.type==="worldMatch").length>=2);
  assert.equal(matches,true,"player should be able to resume an active battle");
});

test("Chess refresh returns current server state and usable legal moves", async t => {
  const env=await setup(t),alice=await env.connect("alice");
  alice.send(JSON.stringify({type:"chessBot"}));
  const game=await env.until(()=>env.messages.get(alice).find(m=>m.type==="chessStart"));
  assert.equal(game.color,"w");
  await delay(190);
  alice.send(JSON.stringify({type:"chessSync",id:game.id}));
  const refresh=await env.until(()=>env.messages.get(alice).filter(m=>m.type==="chessStart"&&m.id===game.id).at(-1)?.legal?.some(m=>m.from==="g1"&&m.to==="f3")&&env.messages.get(alice).filter(m=>m.type==="chessStart").length>=2);
  assert.equal(refresh,true);
});
