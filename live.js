import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {WebSocketServer, WebSocket} from "ws";
import {Chess} from "chess.js";

const CHANNELS=["general","games","suggestions","support"];
const LIMIT=1100;
const uid=()=>crypto.randomBytes(7).toString("hex");
const nameOf=user=>String(user?.username||"guest").slice(0,32);
const trimText=(value,n=LIMIT)=>String(value||"").trim().slice(0,n);
const safeSend=(ws,data)=>{if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify(data));};
// Land comes from Natural Earth's 1:110m vector coastline, rasterized to a global 360×180 grid.
const atlas=JSON.parse(fs.readFileSync(new URL("./public/assets/world-land.json",import.meta.url),"utf8"));
const WORLD_W=atlas.width,WORLD_H=atlas.height;
const landMask=Buffer.from(atlas.mask,"base64");
const isLand=i=>i>=0&&i<WORLD_W*WORLD_H&&!!(landMask[i>>3]&(1<<(i&7)));
const at=(x,y)=>Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&x<WORLD_W&&y>=0&&y<WORLD_H?x+y*WORLD_W:-1;
const adj=(a,b)=>Math.abs(a%WORLD_W-b%WORLD_W)+Math.abs(Math.floor(a/WORLD_W)-Math.floor(b/WORLD_W))===1;
const neighbor=i=>[i%WORLD_W?i-1:-1,i%WORLD_W<WORLD_W-1?i+1:-1,i>=WORLD_W?i-WORLD_W:-1,i<WORLD_W*(WORLD_H-1)?i+WORLD_W:-1].filter(n=>n>=0);
const coast=new Uint8Array(WORLD_W*WORLD_H),region=new Int32Array(WORLD_W*WORLD_H).fill(-1);
const landIndices=[];
for(let i=0;i<WORLD_W*WORLD_H;i++)if(isLand(i)){
 landIndices.push(i);
 if(neighbor(i).some(n=>!isLand(n)))coast[i]=1;
}
let componentCount=0;
for(const seed of landIndices){
 if(region[seed]!==-1)continue;
 const pending=[seed];region[seed]=componentCount;
 for(let head=0;head<pending.length;head++)for(const next of neighbor(pending[head]))if(isLand(next)&&region[next]===-1){region[next]=componentCount;pending.push(next)}
 componentCount++;
}
const makeMap=()=>Array.from({length:WORLD_W*WORLD_H},(_,i)=>isLand(i)?{owner:null,def:4+(i*17%5),kind:"",fort:0}:{owner:"sea"});
const colors=["#f0bd67","#72b9c1","#f08381","#9c91d3","#89c574","#d9a0da","#d5c777","#87a5de","#c28d78","#9bc4a6"];
const clients=new Map(),queues={chess:[],rps:[]},chessGames=new Map(),rpsGames=new Map(),tournaments=new Map();
const usersOnline=()=>[...new Set([...clients.values()].map(u=>u.id))];
const channelsFileName="lightning-social.json";
export function attachLightningLive({server,sessionFromHeaders,dataDir}){
 const world={cells:makeMap(),players:{},tick:0,winner:null,phase:"waiting",matchId:null,start:0};
 let worldQueue=[],worldQueueTimer=null;
 const file=path.join(dataDir,channelsFileName);
 let history={};
 try{history=JSON.parse(fs.readFileSync(file,"utf8"))}catch{}
 for(const c of CHANNELS)if(!Array.isArray(history[c]))history[c]=[];
 let saveQueued=false;
 const save=()=>{
  if(saveQueued)return;saveQueued=true;
  setTimeout(()=>{
   saveQueued=false;
   try{const tmp=file+".tmp";fs.writeFileSync(tmp,JSON.stringify(history));fs.renameSync(tmp,file)}
   catch(err){console.warn("Social history save error:",err.message)}
  },500);
 };
 const sendAll=(evt)=>{for(const ws of clients.keys())safeSend(ws,evt)};
 const clientOf=id=>[...clients.entries()].filter(([,u])=>u.id===id);
 const sendUser=(id,evt)=>{for(const [socket] of clientOf(id))safeSend(socket,evt)};
 const summary=()=>({users:usersOnline().length,queue:{chess:queues.chess.length,rps:queues.rps.length,world:worldQueue.length},tournaments:[...tournaments.values()].filter(t=>!t.done).map(t=>({id:t.id,players:t.ids.length,max:4,status:t.status})),games:{chess:chessGames.size,rps:rpsGames.size}});
 const presence=()=>sendAll({type:"presence",...summary(),online:usersOnline().map(id=>({id,name:clientOf(id)[0]?.[1]?.name||id}))});
 const validateSend=(ws,msg)=>{
  const u=clients.get(ws);
  if(!u)return false;
  if(Date.now()-u.last<130){safeSend(ws,{type:"error",message:"You're sending commands too quickly."});return false}
  u.last=Date.now();return true;
 };
 function worldSnapshot(){
  const players=Object.values(world.players),territories={};
  for(const p of players)territories[p.id]=0;
  for(const c of world.cells)if(c.owner&&c.owner!=="sea")territories[c.owner]=(territories[c.owner]||0)+1;
  return {type:"world",width:WORLD_W,height:WORLD_H,matchId:world.matchId,phase:world.phase,queued:worldQueue.length,
   cells:world.cells.map(c=>c.owner==="sea"?-1:c.owner||""),
   structures:world.cells.map((c,i)=>c.kind?{i,kind:c.kind}:null).filter(Boolean),
   players:players.map(p=>({id:p.id,name:p.name,color:p.color,bot:!!p.bot,troops:Math.floor(p.troops),gold:Math.floor(p.gold),land:territories[p.id]||0,allies:p.allies})),
   tick:world.tick||0,winner:world.winner,landTotal:landIndices.length};
 }
 function sendWorld(){const snap=worldSnapshot();for(const [ws,u] of clients)if(u.world)safeSend(ws,snap)}
 function owned(p){let n=0;for(const c of world.cells)if(c.owner===p.id)n++;return n}
 const botNames=["Ash Dominion","Iron Coast","Cobalt Union","Ember Pact","Verdant Order","Crimson Crown","Polar Legion","Violet Realm","Solar Republic","Obsidian Guard","Azure Empire","Silver League"];
 function spawnNation(id,name,bot=false){
  if(world.players[id])return world.players[id];
  const taken=Object.keys(world.players).length;
  if(taken>=24)return null;
  let spawn=-1;
  for(let attempts=0;attempts<450;attempts++){
   const next=landIndices[Math.floor(Math.random()*landIndices.length)];
   if(world.cells[next].owner!==null)continue;
   if(Object.values(world.players).some(p=>Math.abs(p.spawn%WORLD_W-next%WORLD_W)+Math.abs(Math.floor(p.spawn/WORLD_W)-Math.floor(next/WORLD_W))<14))continue;
   if(neighbor(next).filter(n=>isLand(n)).length>=3){spawn=next;break}
  }
  if(spawn<0)spawn=landIndices.find(i=>world.cells[i].owner===null);
  if(spawn===undefined)return null;
  const p={id,name:trimText(name,32),bot,spawn,color:colors[taken%colors.length]||"hsl("+((taken*79)%360)+" 56% 65%)",
   gold:390,troops:950,allies:[],lastAttack:0};
  world.players[id]=p;
  const x=spawn%WORLD_W,y=Math.floor(spawn/WORLD_W);
  for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
   if(Math.abs(dx)+Math.abs(dy)>3)continue;
   const i=at(x+dx,y+dy);
   if(i>=0&&world.cells[i].owner===null&&region[i]===region[spawn])world.cells[i].owner=id;
  }
  world.cells[spawn].owner=id;
  return p;
 }
 function startWorld(){
  if(world.phase==="playing")return;
  if(worldQueueTimer){clearTimeout(worldQueueTimer);worldQueueTimer=null}
  const people=worldQueue.filter(id=>clientOf(id).length).slice(0,12);
  worldQueue=[];
  if(!people.length){presence();return}
  world.cells=makeMap();world.players={};world.winner=null;world.tick=0;
  world.phase="playing";world.matchId=uid();world.start=Date.now();
  for(const id of people)spawnNation(id,clientOf(id)[0][1].name);
  for(let b=0;b<Math.max(7,12-people.length);b++)spawnNation("npc:"+b,botNames[b%botNames.length],true);
  for(const [ws,u] of clients)if(people.includes(u.id)){u.world=true;safeSend(ws,{type:"worldMatch",matchId:world.matchId})}
  sendWorld();presence();
 }
 function worldQueueJoin(u,instant=false){
  if(world.phase==="playing"&&world.players[u.id]){
   u.world=true;safeSend(u.ws,{type:"worldMatch",matchId:world.matchId});safeSend(u.ws,worldSnapshot());return;
  }
  if(world.phase==="playing"&&!world.winner){
   const p=spawnNation(u.id,u.name);
   if(p){u.world=true;safeSend(u.ws,{type:"worldMatch",matchId:world.matchId});sendWorld();return}
  }
  if(!worldQueue.includes(u.id))worldQueue.push(u.id);
  u.world=true;
  sendUser(u.id,{type:"worldQueued",position:worldQueue.indexOf(u.id)+1,players:worldQueue.length});
  safeSend(u.ws,worldSnapshot());presence();
  if(instant&&world.phase==="waiting")startWorld();
  else if(world.phase==="waiting"&&worldQueue.length>=2)startWorld();
  else if(!worldQueueTimer&&world.phase==="waiting"){worldQueueTimer=setTimeout(startWorld,11000);worldQueueTimer.unref()}
 }
 function worldCancel(u){
  worldQueue=worldQueue.filter(id=>id!==u.id);
  if(worldQueue.length===0&&worldQueueTimer){clearTimeout(worldQueueTimer);worldQueueTimer=null}
  u.world=false;sendUser(u.id,{type:"worldQueueCancelled"});presence();
 }
 function worldSync(u){
  if(world.phase==="playing"&&world.players[u.id]){
   u.world=true;
   safeSend(u.ws,{type:"worldMatch",matchId:world.matchId});
  }else if(worldQueue.includes(u.id)){
   u.world=true;
   safeSend(u.ws,{type:"worldQueued",position:worldQueue.indexOf(u.id)+1,players:worldQueue.length});
  }
  safeSend(u.ws,worldSnapshot());
 }
 // Across continuous landmasses, expeditions may target distant land. Crossing
 // open ocean requires owning a coastal tile and landing on a coastal tile.
 function travel(p,i){
  const regions=new Set(),ownsCoast=world.cells.some((c,j)=>{
   if(c.owner!==p.id)return false;
   regions.add(region[j]);return !!coast[j];
  });
  // some() short-circuits on a coast tile; collect all landmasses separately.
  for(const q of world.cells.keys())if(world.cells[q].owner===p.id)regions.add(region[q]);
  if(regions.has(region[i]))return "land";
  return ownsCoast&&!!coast[i]?"naval":null;
 }
 function capture(p,index,ratio){
  const tile=world.cells[index];
  if(!tile||tile.owner==="sea"||tile.owner===p.id)return {error:"Choose enemy or neutral land."};
  if(tile.owner&&p.allies.includes(tile.owner))return {error:"You cannot attack an ally."};
  const route=travel(p,index);
  if(!route)return {error:"No land route. Naval attacks need coastal land and a coastal destination."};
  if(p.troops<35)return {error:"Recruit more troops before attacking."};
  const committed=Math.floor(p.troops*ratio);
  const rival=world.players[tile.owner];
  const defender=rival?Math.max(20,Math.floor(rival.troops/Math.max(1,owned(rival))*.8)+tile.def*4+tile.fort*15):tile.def*7;
  if(committed*(route==="naval"?.82:1)<defender){
   p.troops=Math.max(0,p.troops-Math.ceil(committed*.35));
   return {error:"Assault repelled. Build up more troops.",route};
  }
  p.troops=Math.max(1,p.troops-Math.ceil(defender*.55));
  if(rival)rival.troops=Math.max(15,rival.troops-Math.floor(defender*.24));
  tile.owner=p.id;tile.kind="";tile.fort=0;
  // Successful landings secure nearby neutral territories so expansion is visible.
  const x=index%WORLD_W,y=Math.floor(index/WORLD_W);
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   const i=at(x+dx,y+dy);
   if(i>=0&&world.cells[i].owner===null&&region[i]===region[index]){
    world.cells[i].owner=p.id;p.troops=Math.max(1,p.troops-3);
   }
  }
  return {route,success:true};
 }
 function checkWorldWin(){
  const winner=Object.values(world.players).find(p=>owned(p)/landIndices.length>=.8);
  if(!winner||world.winner)return;
  world.winner=winner.name;
  sendAll({type:"worldInfo",text:winner.name+" has conquered 80% of the world!"});sendWorld();
  const timer=setTimeout(()=>{
   world.phase="waiting";world.cells=makeMap();world.players={};world.winner=null;
   world.matchId=null;world.tick=0;for(const u of clients.values())u.world=false;
   sendAll({type:"worldEnded"});presence();
  },15000);timer.unref();
 }
 function worldAction(u,data){
  const p=world.players[u.id];
  if(!p||world.phase!=="playing")return safeSend(u.ws,{type:"error",message:"Join a WorldPvP match first."});
  if(world.winner)return;
  const index=at(data.x,data.y),tile=world.cells[index];
  if(index<0||!tile||tile.owner==="sea")return safeSend(u.ws,{type:"error",message:"Select land, not ocean."});
  const amount=Math.min(.9,Math.max(.1,Number(data.ratio)||.35));
  if(data.action==="attack"){
   if(Date.now()-p.lastAttack<900)return;
   p.lastAttack=Date.now();
   const result=capture(p,index,amount);
   safeSend(u.ws,{type:"worldInfo",text:result.success?(result.route==="naval"?"Naval landing successful.":"Land offensive successful."):result.error});
  }else if(data.action==="build"){
   if(tile.owner!==p.id)return safeSend(u.ws,{type:"error",message:"Build on your own land."});
   if(tile.kind)return safeSend(u.ws,{type:"error",message:"This region already has a building."});
   const type=String(data.kind||""),costs={city:170,factory:230,port:160,fort:130};
   if(!costs[type])return;
   if(p.gold<costs[type])return safeSend(u.ws,{type:"error",message:"Not enough gold."});
   if(type==="port"&&!coast[index])return safeSend(u.ws,{type:"error",message:"Ports must be built on the coast."});
   p.gold-=costs[type];tile.kind=type;tile.fort=type==="fort"?3:0;
  }else if(data.action==="alliance"){
   const other=world.players[trimText(data.target,70)];
   if(!other||other.id===p.id)return;
   if(p.allies.includes(other.id)){p.allies=p.allies.filter(id=>id!==other.id);other.allies=other.allies.filter(id=>id!==p.id)}
   else{p.allies.push(other.id);other.allies.push(p.id)}
  }else if(data.action==="nuke"){
   if(tile.owner===p.id||p.gold<1800)return safeSend(u.ws,{type:"error",message:"A nuclear strike costs 1,800 gold."});
   p.gold-=1800;
   for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){
    if(dx*dx+dy*dy>10)continue;
    const i=at(data.x+dx,data.y+dy),c=world.cells[i];
    if(c&&c.owner!=="sea"&&c.owner!==p.id){c.owner=null;c.kind="";c.fort=0}
   }
  }else return;
  checkWorldWin();sendWorld();
 }
 function chessLegal(engine){return engine.moves({verbose:true}).map(m=>({from:m.from,to:m.to,promotion:m.promotion||""}))}
 function newChess(ids){
  const id=uid(),game={id,ids,engine:new Chess(),created:Date.now(),over:false,bot:ids[1]==="npc:chess"};
  chessGames.set(id,game);
  for(let i=0;i<2;i++)if(i===0||!game.bot)
   sendUser(ids[i],{type:"chessStart",id,color:i===0?"w":"b",players:ids.map(z=>z==="npc:chess"?"Lightning Bot":clientOf(z)[0]?.[1]?.name||z),fen:game.engine.fen(),turn:"w",legal:chessLegal(game.engine)});
  presence();return game;
 }
 function publishChess(game,move,by){
  game.over=game.engine.isGameOver();
  const snapshot={type:"chessState",id:game.id,fen:game.engine.fen(),last:move.san,turn:game.engine.turn(),over:game.over,
   legal:game.over?[]:chessLegal(game.engine),
   result:game.engine.isCheckmate()?("Checkmate · "+by+" wins"):game.engine.isDraw()?"Draw":""};
  for(const id of game.ids)if(id!=="npc:chess")sendUser(id,snapshot);
  if(game.over){const timer=setTimeout(()=>chessGames.delete(game.id),60000);timer.unref()}
 }
 function chessMove(u,data){
  const game=chessGames.get(data.id);
  if(!game||game.over||!game.ids.includes(u.id))return safeSend(u.ws,{type:"error",message:"Chess match unavailable. Refresh or start a new game."});
  const color=game.ids[0]===u.id?"w":"b";
  if(game.engine.turn()!==color)return safeSend(u.ws,{type:"error",message:"It's not your turn."});
  let move=null;
  try{
   const piece=game.engine.get(data.from);
   const promotion=piece?.type==="p"&&["1","8"].includes(String(data.to||"")[1]);
   move=game.engine.move(promotion?{from:data.from,to:data.to,promotion:data.promotion||"q"}:{from:data.from,to:data.to});
  }catch{}
  if(!move)return safeSend(u.ws,{type:"error",message:"Illegal move. Select a highlighted square."});
  publishChess(game,move,u.name);
  if(game.bot&&!game.over){
   const timer=setTimeout(()=>{
    if(game.over||game.engine.turn()!=="b")return;
    const moves=game.engine.moves({verbose:true});
    // Captures, checks and promotions are favored over quiet moves.
    const score=m=>(m.captured?8:0)+(m.san.includes("+")?3:0)+(m.san.includes("#")?100:0)+(m.promotion?14:0)+Math.random()*5;
    moves.sort((a,b)=>score(b)-score(a));
    const reply=game.engine.move(moves[0]);
    publishChess(game,reply,"Lightning Bot");
   },700);
   timer.unref();
  }
 }
 function chessSync(u,data){
  const game=(data.id?chessGames.get(String(data.id)):null)||[...chessGames.values()].find(g=>g.ids.includes(u.id)&&!g.over);
  if(!game||!game.ids.includes(u.id)){
   return safeSend(u.ws,{type:"error",message:"That chess match is no longer active. Start a new game."});
  }
  const index=game.ids.indexOf(u.id),last=game.engine.history().at(-1)||"";
  safeSend(u.ws,{type:"chessStart",id:game.id,color:index===0?"w":"b",
   players:game.ids.map(id=>id==="npc:chess"?"Lightning Bot":clientOf(id)[0]?.[1]?.name||id),
   fen:game.engine.fen(),turn:game.engine.turn(),legal:game.over?[]:chessLegal(game.engine),
   over:game.over,result:game.engine.isCheckmate()?"Checkmate":game.engine.isDraw()?"Draw":"",last});
 }
 function newRPS(ids,tournament=null){
  const id=uid(),game={id,ids,choices:{},tournament,bot:ids.includes("npc:rps")};
  if(game.bot)game.choices["npc:rps"]=["rock","paper","scissors"][Math.floor(Math.random()*3)];
  rpsGames.set(id,game);
  for(const user of ids)if(user!=="npc:rps")sendUser(user,{type:"rpsStart",id,ids,players:ids.map(z=>z==="npc:rps"?"Lightning Bot":clientOf(z)[0]?.[1]?.name||z),tournament,bot:game.bot});
  return game;
 }
 function rpsChoice(u,data){
  const g=rpsGames.get(data.id);
  if(!g||!g.ids.includes(u.id)||g.choices[u.id]||!["rock","paper","scissors"].includes(data.choice))return;
  g.choices[u.id]=data.choice;
  sendUser(u.id,{type:"rpsWaiting",id:g.id});
  if(Object.keys(g.choices).length!==2)return;
  const [a,b]=g.ids,[ca,cb]=[g.choices[a],g.choices[b]];
  const awin=ca===cb?null:(ca==="rock"&&cb==="scissors")||(ca==="scissors"&&cb==="paper")||(ca==="paper"&&cb==="rock");
  const winner=awin===null?null:awin?a:b;
  for(const id of g.ids)sendUser(id,{type:"rpsResult",id:g.id,choices:g.choices,winner,tie:winner===null});
  rpsGames.delete(g.id);
  if(g.tournament){
   const t=tournaments.get(g.tournament);
   if(t&&winner){t.winners.push(winner);if(t.winners.length===2){t.status="final";newRPS(t.winners,t.id);t.winners=[]}else if(t.status==="final"){t.done=true;sendAll({type:"tournamentWinner",id:t.id,winner});presence()}}
   else if(t&&!winner)newRPS(g.ids,g.tournament);
  }else if(!winner){newRPS(g.ids)}
 }
 function queue(u,kind,other=null){
  if(!["chess","rps"].includes(kind))return;
  const existing=kind==="chess"?[...chessGames.values()].some(g=>!g.over&&g.ids.includes(u.id)):[...rpsGames.values()].some(g=>g.ids.includes(u.id));
  if(existing)return safeSend(u.ws,{type:"error",message:"Finish your current game first."});
  for(const k of ["chess","rps"])queues[k]=queues[k].filter(id=>id!==u.id);
  const line=queues[kind];
  if(other){
   const id=trimText(other,36),partner=clientOf(id)[0];
   if(!partner||id===u.id)return safeSend(u.ws,{type:"error",message:"That player isn't online."});
   if(kind==="chess")newChess([u.id,id]);else newRPS([u.id,id]);
   return;
  }
  let opponent=line.shift();
  while(opponent&&!clientOf(opponent).length)opponent=line.shift();
  if(opponent&&opponent!==u.id){kind==="chess"?newChess([opponent,u.id]):newRPS([opponent,u.id])}
  else {queues[kind].push(u.id);safeSend(u.ws,{type:"queued",game:kind});}
  presence();
 }
 function tournamentJoin(u){
  let t=[...tournaments.values()].find(x=>!x.done&&x.status==="waiting"&&x.ids.length<4);
  if(!t){t={id:uid(),ids:[],winners:[],status:"waiting",done:false};tournaments.set(t.id,t)}
  if(!t.ids.includes(u.id))t.ids.push(u.id);
  sendUser(u.id,{type:"tournamentJoined",id:t.id,players:t.ids.length});
  if(t.ids.length===4){t.status="semifinal";newRPS(t.ids.slice(0,2),t.id);newRPS(t.ids.slice(2,4),t.id);sendAll({type:"tournamentStarted",id:t.id,players:t.ids})}
  presence();
 }
 const wss=new WebSocketServer({noServer:true,maxPayload:8192,perMessageDeflate:false});
 server.on("upgrade",(req,socket,head)=>{
  if(!req.url?.startsWith("/live"))return;
  const origin=req.headers.origin;
  let expected="";
  try{expected=new URL(origin).host}catch{}
  if(origin&&expected!==req.headers.host){socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");socket.destroy();return}
  const auth=sessionFromHeaders(req.headers);
  if(!auth){socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");socket.destroy();return}
  wss.handleUpgrade(req,socket,head,ws=>wss.emit("connection",ws,auth,req));
 });
 wss.on("connection",(ws,auth,req)=>{
  const id=auth.identity.id,u={ws,id,name:nameOf(auth.identity),last:0,world:false};
  clients.set(ws,u);
  safeSend(ws,{type:"hello",id,name:u.name,channels:CHANNELS,history,online:usersOnline().map(id=>({id,name:clientOf(id)[0]?.[1]?.name||id})),summary:summary()});
  presence();
  ws.on("message",raw=>{
   const current=sessionFromHeaders(req.headers);
   if(!current||current.identity.id!==u.id){
     ws.close(4003,"Session expired");return;
   }
   let data;try{data=JSON.parse(raw.toString())}catch{return}
   if(!data||typeof data!=="object")return;
   if(!validateSend(ws,data))return;
   if(data.type==="chat"){
    const channel=trimText(data.channel,25),message=trimText(data.message,1000);
    if(!CHANNELS.includes(channel)||!message)return;
    const entry={id:uid(),by:u.name,userId:u.id,channel,message,at:Date.now()};
    history[channel].push(entry);history[channel]=history[channel].slice(-120);save();
    sendAll({type:"chat",entry});return;
   }
   if(data.type==="chessSync")return chessSync(u,data);
   if(data.type==="worldSync")return worldSync(u);
   if(data.type==="worldPractice")return worldQueueJoin(u,true);
   if(data.type==="worldLeave")return worldCancel(u);
   if(data.type==="queue")return queue(u,data.game);
   if(data.type==="duel")return queue(u,data.game,data.target);
   if(data.type==="chessMove")return chessMove(u,data);
   if(data.type==="rpsChoice")return rpsChoice(u,data);
   if(data.type==="tournamentJoin")return tournamentJoin(u);
   if(data.type==="worldQueue"||data.type==="worldJoin")return worldQueueJoin(u);
   if(data.type==="worldCancel")return worldCancel(u);
   if(data.type==="chessBot")return newChess([u.id,"npc:chess"]);
    if(data.type==="rpsBot")return newRPS([u.id,"npc:rps"]);
   if(data.type==="worldAction")return worldAction(u,data);
  });
  ws.on("close",()=>{
   clients.delete(ws);
   if(!clientOf(u.id).length){
    for(const kind of ["chess","rps"])queues[kind]=queues[kind].filter(id=>id!==u.id);
    worldQueue=worldQueue.filter(id=>id!==u.id);
   }
   presence();
  });
 });
 const ticker=setInterval(()=>{
  if(!wss.clients.size)return;
  if(world.phase!=="playing"||world.winner)return;
  world.tick++;
  const ownedBy=new Map();
  for(let i=0;i<world.cells.length;i++){
   const owner=world.cells[i].owner;
   if(owner&&owner!=="sea"){
    let arr=ownedBy.get(owner);
    if(!arr){arr=[];ownedBy.set(owner,arr)}
    arr.push(i);
   }
  }
  for(const p of Object.values(world.players)){
   const territory=ownedBy.get(p.id)||[];
   if(!territory.length)continue;
   let cities=0,factories=0,ports=0;
   for(const i of territory){const kind=world.cells[i].kind;if(kind==="city")cities++;else if(kind==="factory")factories++;else if(kind==="port")ports++}
   p.troops=Math.min(90000,p.troops+Math.min(280,territory.length*.4+18+cities*7));
   p.gold=Math.min(30000,p.gold+Math.min(120,territory.length*.24+9+factories*8+ports*3));
   if(!p.bot||p.troops<100)continue;
   // NPC armies build a real economy and strategically expand along the front.
   if(p.gold>=230&&world.tick%6===0){
    const site=territory.find(i=>!world.cells[i].kind);
    if(site!==undefined){world.cells[site].kind="factory";p.gold-=230}
   }else if(p.gold>=170&&world.tick%8===0){
    const site=territory.find(i=>!world.cells[i].kind);
    if(site!==undefined){world.cells[site].kind="city";p.gold-=170}
   }else if(p.gold>=160&&world.tick%10===0){
    const site=territory.find(i=>coast[i]&&!world.cells[i].kind);
    if(site!==undefined){world.cells[site].kind="port";p.gold-=160}
   }
   // Bot generals expand from real front lines, or launch coastal invasions.
   let target=-1;
   for(let attempt=0;attempt<45;attempt++){
    const origin=territory[Math.floor(Math.random()*territory.length)];
    const options=neighbor(origin).filter(i=>isLand(i)&&world.cells[i].owner!==p.id);
    if(!options.length)continue;
    options.sort((a,b)=>(world.cells[a].owner?1:0)-(world.cells[b].owner?1:0));
    target=options[0];break;
   }
   // When land frontiers are exhausted, a coastal empire can invade another shore.
   if(target<0&&territory.some(i=>coast[i])){
    for(let tries=0;tries<45;tries++){
     const next=landIndices[Math.floor(Math.random()*landIndices.length)];
     if(coast[next]&&world.cells[next].owner!==p.id){target=next;break}
    }
   }
   if(target>=0)capture(p,target,.4+Math.random()*.4);
  }
  checkWorldWin();
  if(world.tick%2===0)sendWorld();
 },3000);
 ticker.unref();
 console.log("Lightning Live: WebSocket social + games ready");
 return {wss};
}
