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
const continents=[
 [[2,5],[7,3],[14,4],[19,6],[22,10],[18,13],[15,12],[13,14],[9,12],[8,9],[4,10]],
 [[14,13],[17,14],[19,16],[18,19],[22,22],[20,26],[16,29],[15,25],[13,21],[12,17]],
 [[25,2],[32,1],[35,4],[34,7],[31,9],[26,7]],
 [[27,9],[31,8],[33,10],[36,9],[38,11],[35,13],[33,15],[29,14],[27,12]],
 [[28,15],[35,14],[40,17],[39,23],[36,27],[33,29],[31,26],[30,21],[27,18]],
 [[34,6],[40,4],[47,3],[55,5],[61,7],[61,12],[57,15],[52,14],[48,12],[45,17],[42,13],[39,12],[36,9]],
 [[42,15],[47,15],[50,18],[54,18],[55,22],[51,20],[47,21],[45,18]],
 [[51,23],[57,22],[62,25],[60,29],[55,28],[52,26]],
 [[58,13],[60,14],[61,17],[59,19],[58,16]],
 [[38,24],[40,23],[41,26],[40,29],[38,28]],
 [[0,31],[12,30],[24,31],[38,30],[50,31],[63,30],[63,32],[0,32]]
];
function inside(x,y,p){
 let result=false;
 for(let i=0,j=p.length-1;i<p.length;j=i++){
  const a=p[i],b=p[j];
  if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])result=!result;
 }
 return result;
}
function makeMap(){
 const out=[];
 for(let y=0;y<32;y++)for(let x=0;x<64;x++){
  const land=continents.some(p=>inside(x+.5,y+.5,p));
  const n=land&&((x*19+y*7)%83===0)?4:0;
  out.push(land?{owner:null,def:6+n,kind:"",fort:0}:{owner:"sea"});
 }
 return out;
}
const world={cells:makeMap(),players:{},start:Date.now(),winner:null};
const at=(x,y)=>Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&x<64&&y>=0&&y<32?x+y*64:-1;
const adj=(a,b)=>Math.abs(a%64-b%64)+Math.abs(Math.floor(a/64)-Math.floor(b/64))===1;
const colors=["#f0bd67","#72b9c1","#f08381","#9c91d3","#89c574","#d9a0da","#d5c777","#87a5de","#c28d78","#9bc4a6"];
const clients=new Map(),queues={chess:[],rps:[]},chessGames=new Map(),rpsGames=new Map(),tournaments=new Map();
const usersOnline=()=>[...new Set([...clients.values()].map(u=>u.id))];
const channelsFileName="lightning-social.json";
export function attachLightningLive({server,sessionFromHeaders,dataDir}){
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
 const summary=()=>({users:usersOnline().length,queue:{chess:queues.chess.length,rps:queues.rps.length},tournaments:[...tournaments.values()].filter(t=>!t.done).map(t=>({id:t.id,players:t.ids.length,max:4,status:t.status})),games:{chess:chessGames.size,rps:rpsGames.size}});
 const presence=()=>sendAll({type:"presence",...summary()});
 const validateSend=(ws,msg)=>{
  const u=clients.get(ws);
  if(!u)return false;
  if(Date.now()-u.last<550){safeSend(ws,{type:"error",message:"You're sending commands too quickly."});return false}
  u.last=Date.now();return true;
 };
 function worldSnapshot(){
  const players=Object.values(world.players);
  const territories={};
  for(const p of players) territories[p.id]=0;
  for(const c of world.cells)if(c.owner&&c.owner!=="sea")territories[c.owner]=(territories[c.owner]||0)+1;
  return {type:"world",cells:world.cells.map(c=>c.owner==="sea"?-1:c.owner||""),structures:world.cells.map((c,i)=>c.kind?{i,kind:c.kind}:null).filter(Boolean),
    players:players.map(p=>({id:p.id,name:p.name,color:p.color,troops:Math.floor(p.troops),gold:Math.floor(p.gold),land:territories[p.id]||0,allies:p.allies})),
    tick:world.tick||0,winner:world.winner,landTotal:world.cells.filter(c=>c.owner!=="sea").length};
 }
 function sendWorld(){sendAll(worldSnapshot())}
 function owned(player){return world.cells.reduce((n,c)=>n+(c.owner===player.id?1:0),0)}
 function worldJoin(u){
  if(world.winner){safeSend(u.ws,{type:"error",message:"Match finished. Next round is starting."});return}
  let p=world.players[u.id];
  if(!p){
   const taken=Object.keys(world.players).length;
   if(taken>=24)return safeSend(u.ws,{type:"error",message:"The WorldPvP match is full."});
   const available=world.cells.map((c,i)=>c.owner===null?i:-1).filter(i=>i!==-1);
   let spawn=-1;
   for(let tries=0;tries<100;tries++){
    const ix=available[Math.floor(Math.random()*available.length)];
    if(ix===undefined)break;
    if(!Object.values(world.players).some(q=>Math.abs(q.spawn%64-ix%64)+Math.abs(Math.floor(q.spawn/64)-Math.floor(ix/64))<7)){spawn=ix;break}
   }
   if(spawn===-1)spawn=available[Math.floor(Math.random()*available.length)];
   if(spawn===undefined)return safeSend(u.ws,{type:"error",message:"No land left to spawn."});
   p={id:u.id,name:u.name,spawn,color:colors[taken%colors.length],gold:260,troops:240,allies:[],lastAttack:0};
   world.players[u.id]=p;
   world.cells[spawn].owner=u.id;
   for(const d of [-1,1,-64,64]){const n=spawn+d;if(n>=0&&n<world.cells.length&&adj(spawn,n)&&world.cells[n].owner===null)world.cells[n].owner=u.id}
  }
  u.world=true;safeSend(u.ws,worldSnapshot());sendWorld();
 }
 function worldAction(u,data){
  const p=world.players[u.id];
  if(!p)return safeSend(u.ws,{type:"error",message:"Join WorldPvP first."});
  if(world.winner)return;
  const index=at(data.x,data.y),tile=world.cells[index];
  if(index<0||!tile||tile.owner==="sea")return;
  const amount=Math.min(.75,Math.max(.1,Number(data.ratio)||.25));
  if(data.action==="attack"){
   if(Date.now()-p.lastAttack<1150)return;
   p.lastAttack=Date.now();
   if(tile.owner===p.id)return;
   if(!world.cells.some((cell,j)=>cell.owner===p.id&&adj(j,index)))return safeSend(u.ws,{type:"error",message:"Choose a territory along your land border."});
   if(tile.owner&&p.allies.includes(tile.owner))return safeSend(u.ws,{type:"error",message:"You cannot attack an ally."});
   const committed=Math.floor(p.troops*amount);
   const defender=tile.owner&&world.players[tile.owner]?Math.max(22,Math.floor(world.players[tile.owner].troops/Math.max(1,owned(world.players[tile.owner]))*.85)+tile.def*3+tile.fort*8):tile.def*9;
   if(committed<defender){p.troops=Math.max(0,p.troops-Math.ceil(committed*.45));safeSend(u.ws,{type:"worldInfo",text:"Your attack failed. Build up more troops."})}
   else{
    p.troops-=Math.ceil(defender*.72);
    const enemy=world.players[tile.owner];
    if(enemy)enemy.troops=Math.max(10,enemy.troops-Math.floor(defender*.25));
    tile.owner=p.id;tile.fort=0;tile.kind="";
   }
  }else if(data.action==="build"){
   if(tile.owner!==p.id)return;
   if(tile.kind)return safeSend(u.ws,{type:"error",message:"This territory already has infrastructure."});
   const type=String(data.kind||"");
   const costs={city:180,factory:230,port:160,fort:130};
   if(!costs[type])return;
   if(p.gold<costs[type])return safeSend(u.ws,{type:"error",message:"Not enough gold."});
   if(type==="port"&&![-1,1,-64,64].some(d=>{const n=index+d;return n>=0&&n<world.cells.length&&adj(index,n)&&world.cells[n].owner==="sea"}))return safeSend(u.ws,{type:"error",message:"Ports must be built on the coast."});
   p.gold-=costs[type];tile.kind=type;tile.fort=type==="fort"?3:0;
  }else if(data.action==="alliance"){
   const other=world.players[trimText(data.target,70)];
   if(!other||other.id===p.id)return;
   if(p.allies.includes(other.id)){p.allies=p.allies.filter(id=>id!==other.id);other.allies=other.allies.filter(id=>id!==p.id)}
   else if(other.allies.includes(p.id)){p.allies.push(other.id)}
   else {p.allies.push(other.id);other.allies.push(p.id)}
  }else if(data.action==="nuke"){
   if(tile.owner===p.id||p.gold<1800)return safeSend(u.ws,{type:"error",message:"A nuclear strike costs 1,800 gold and cannot target your own land."});
   p.gold-=1800;
   for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++){
    const n=at(data.x+x,data.y+y),c=world.cells[n];
    if(c&&c.owner!=="sea"&&c.owner!==p.id){c.owner=null;c.kind="";c.fort=0}
   }
  }else return;
  const total=world.cells.filter(c=>c.owner!=="sea").length;
  if(owned(p)/total>=.8){world.winner=p.name;sendAll({type:"worldInfo",text:p.name+" has conquered 80% of the world!"});setTimeout(()=>{world.cells=makeMap();world.players={};world.winner=null;world.tick=0;sendWorld()},13000).unref()}
  sendWorld();
 }
 function newChess(ids){
  const id=uid(),game={id,ids,engine:new Chess(),created:Date.now(),over:false};
  chessGames.set(id,game);
  for(let i=0;i<2;i++)sendUser(ids[i],{type:"chessStart",id,color:i===0?"w":"b",players:ids.map(z=>clientOf(z)[0]?.[1]?.name||z),fen:game.engine.fen()});
  presence();
  return game;
 }
 function chessMove(u,data){
  const game=chessGames.get(data.id);
  if(!game||game.over||!game.ids.includes(u.id))return;
  const color=game.ids[0]===u.id?"w":"b";
  if(game.engine.turn()!==color)return safeSend(u.ws,{type:"error",message:"It's not your turn."});
  let move=null;
  try{move=game.engine.move({from:data.from,to:data.to,promotion:"q"})}catch{}
  if(!move)return safeSend(u.ws,{type:"error",message:"Illegal chess move."});
  game.over=game.engine.isGameOver();
  const snapshot={type:"chessState",id:game.id,fen:game.engine.fen(),last:move.san,turn:game.engine.turn(),over:game.over,
    result:game.engine.isCheckmate()?("Checkmate · "+u.name+" wins"):game.engine.isDraw()?"Draw":""};
  for(const user of game.ids)sendUser(user,snapshot);
  if(game.over)setTimeout(()=>chessGames.delete(game.id),60000).unref();
 }
 function newRPS(ids,tournament=null){
  const id=uid(),game={id,ids,choices:{},tournament};
  rpsGames.set(id,game);
  for(const user of ids)sendUser(user,{type:"rpsStart",id,players:ids.map(z=>clientOf(z)[0]?.[1]?.name||z),tournament});
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
  const line=queues[kind];for(const k of ["chess","rps"])queues[k]=queues[k].filter(id=>id!==u.id);
  if(other){
   const id=trimText(other,36),partner=clientOf(id)[0];
   if(!partner||id===u.id)return safeSend(u.ws,{type:"error",message:"That player isn't online."});
   if(kind==="chess")newChess([u.id,id]);else newRPS([u.id,id]);
   return;
  }
  const opponent=line.shift();
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
  wss.handleUpgrade(req,socket,head,ws=>wss.emit("connection",ws,auth));
 });
 wss.on("connection",(ws,auth)=>{
  const id=auth.identity.id,u={ws,id,name:nameOf(auth.identity),last:0,world:false};
  clients.set(ws,u);
  safeSend(ws,{type:"hello",id,name:u.name,channels:CHANNELS,history,online:usersOnline().map(id=>({id,name:clientOf(id)[0]?.[1]?.name||id})),summary:summary()});
  presence();
  ws.on("message",raw=>{
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
   if(data.type==="queue")return queue(u,data.game);
   if(data.type==="duel")return queue(u,data.game,data.target);
   if(data.type==="chessMove")return chessMove(u,data);
   if(data.type==="rpsChoice")return rpsChoice(u,data);
   if(data.type==="tournamentJoin")return tournamentJoin(u);
   if(data.type==="worldJoin")return worldJoin(u);
   if(data.type==="worldAction")return worldAction(u,data);
  });
  ws.on("close",()=>{
   clients.delete(ws);
   for(const kind of ["chess","rps"])queues[kind]=queues[kind].filter(id=>id!==u.id);
   presence();
  });
 });
 const ticker=setInterval(()=>{
  if(!wss.clients.size)return;
  world.tick=(world.tick||0)+1;
  for(const p of Object.values(world.players)){
   const land=owned(p);
   if(!land)continue;
   const structures=world.cells.filter(c=>c.owner===p.id);
   const cities=structures.filter(c=>c.kind==="city").length;
   const factories=structures.filter(c=>c.kind==="factory").length;
   const ports=structures.filter(c=>c.kind==="port").length;
   p.troops=Math.min(50000+400*cities,p.troops+Math.min(150,land*.3+6+cities*3));
   p.gold=Math.min(25000,p.gold+Math.min(100,land*.25+4+factories*7+ports*2));
  }
  if(world.tick%2===0)sendWorld();
 },3000);
 ticker.unref();
 console.log("Lightning Live: WebSocket social + games ready");
 return {wss};
}
