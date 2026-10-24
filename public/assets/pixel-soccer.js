import { drawSoccer } from "./pixel-scenes.js?v=1";

const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
const approach = (value,target,step) => value + (target-value)*Math.min(1,step);
const dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);

export function createSoccer(options={}){
 const s={
  mode:"soccer",duration:100,time:100,score:[0,0],over:false,phase:"countdown",countdown:2.3,notice:"KICK OFF",
  user:{x:125,y:135,dir:1},cpu:{x:350,y:135,dir:-1},keeper:[{x:43,y:135},{x:437,y:135}],
  ball:{x:240,y:135,vx:0,vy:0,owner:-1,lock:0},actionCooldown:0,resetDelay:0,goalFlash:0,clock:0,
  difficulty:options.difficulty||"normal",lastKick:"",showHelp:true
 };
 const skill=s.difficulty==="hard"?1.23:s.difficulty==="easy"?.83:1;
 const resetPositions=(kickoff=-1)=>{
  Object.assign(s.user,{x:125,y:135,dir:1});Object.assign(s.cpu,{x:350,y:135,dir:-1});
  Object.assign(s.ball,{x:kickoff===0?139:kickoff===1?340:240,y:135,vx:0,vy:0,owner:kickoff,lock:0});
  s.keeper[0].y=s.keeper[1].y=135;
 };
 function score(team){
  s.score[team]++;s.phase="goal";s.notice=team===0?"GOOOAL! +1":"CPU SCORES";s.goalFlash=1.8;s.resetDelay=1.8;
  s.ball.vx=s.ball.vy=0;s.ball.owner=-1;
 }
 function kick(who){
  if(s.over||s.phase!=="play"||s.actionCooldown>0)return false;
  const self=who===0?s.user:s.cpu,other=who===0?s.cpu:s.user;
  if(s.ball.owner!==who&&dist(self,s.ball)>20)return false;
  s.ball.owner=-1;s.ball.lock=.4;s.actionCooldown=who===0?.28:.65;
  const targetX=who===0?475:5;
  const targetY=clamp(135+(self.y-135)*.25+(who===1?(Math.random()-.5)*24:0),111,157);
  let dx=targetX-s.ball.x,dy=targetY-s.ball.y;
  const length=Math.hypot(dx,dy)||1;
  const accuracy=who===0?Math.random()*.16-.08:(Math.random()-.5)*(.29/skill);
  const vx=dx/length,vy=dy/length;
  s.ball.vx=(vx-vy*accuracy)*265;
  s.ball.vy=(vy+vx*accuracy)*265;
  s.ball.x=self.x+vx*12;s.ball.y=self.y+vy*10;
  s.lastKick=who===0?"SHOT ON GOAL!":"CPU SHOOTS!";
  return true;
 }
 s.action=key=>{
  if(key==="space"||key===" "||key==="shoot")kick(0);
  if(key==="x"||key==="tackle"){
   if(s.actionCooldown>0)return;
   if(s.ball.owner===1&&dist(s.user,s.cpu)<23){s.ball.owner=0;s.actionCooldown=.45;s.notice="CLEAN TACKLE!";}
   else if(s.ball.owner===-1&&dist(s.user,s.ball)<20){s.ball.owner=0;s.actionCooldown=.35}
  }
 };
 s.tick=(dt,keys)=>{
  dt=clamp(dt,0,.04);s.clock+=dt;
  if(s.over)return;
  if(s.phase==="countdown"){
   s.countdown-=dt;
   if(s.countdown<=0){s.phase="play";s.notice="";}return;
  }
  if(s.phase==="goal"){
   s.resetDelay-=dt;s.goalFlash=Math.max(0,s.goalFlash-dt);
   if(s.resetDelay<=0){resetPositions(s.score[0]>s.score[1]?1:0);s.phase="countdown";s.countdown=1.2;}return;
  }
  s.time=Math.max(0,s.time-dt);if(s.time===0){s.phase="finished";s.over=true;s.notice=s.score[0]===s.score[1]?"FULL TIME · DRAW":s.score[0]>s.score[1]?"VICTORY!":"DEFEAT";return}
  s.actionCooldown=Math.max(0,s.actionCooldown-dt);
  const ux=(Number(keys.has("d")||keys.has("arrowright"))-Number(keys.has("a")||keys.has("arrowleft")));
  const uy=(Number(keys.has("s")||keys.has("arrowdown"))-Number(keys.has("w")||keys.has("arrowup")));
  const length=Math.hypot(ux,uy)||1;
  const sprint=keys.has("shift")?1.32:1;
  s.user.x=clamp(s.user.x+ux/length*112*sprint*dt,26,454);
  s.user.y=clamp(s.user.y+uy/length*112*sprint*dt,25,245);
  if(ux)s.user.dir=ux>0?1:-1;
  const cpuHas=s.ball.owner===1,userHas=s.ball.owner===0;
  let tx,ty;
  if(cpuHas){tx=163;ty=clamp(s.user.y*.22+135*.78,40,230)}
  else if(userHas){tx=s.user.x+28;ty=s.user.y}
  else{tx=s.ball.x;ty=s.ball.y}
  const dx=tx-s.cpu.x,dy=ty-s.cpu.y,dl=Math.hypot(dx,dy)||1;
  const cpuSpeed=104*skill;
  s.cpu.x=clamp(s.cpu.x+dx/dl*cpuSpeed*dt,26,454);
  s.cpu.y=clamp(s.cpu.y+dy/dl*cpuSpeed*dt,25,245);
  if(dx)s.cpu.dir=dx>0?1:-1;
  for(let i=0;i<2;i++){
   const k=s.keeper[i],target=s.ball.owner===-1?s.ball.y:(i===0?s.cpu.y:s.user.y);
   k.y=clamp(approach(k.y,clamp(target,113,157),dt*2.8),111,159);
  }
  s.ball.lock=Math.max(0,s.ball.lock-dt);
  if(s.ball.owner!==-1){
   const p=s.ball.owner===0?s.user:s.cpu;
   s.ball.x=p.x+p.dir*11;s.ball.y=p.y+6;
   if(s.ball.owner===1&&s.cpu.x<250&&s.actionCooldown<=0)kick(1);
   if(s.ball.owner===1&&dist(s.user,s.cpu)<14&&keys.has("x")){s.ball.owner=0;s.actionCooldown=.6}
  }else{
   s.ball.x+=s.ball.vx*dt;s.ball.y+=s.ball.vy*dt;
   const decay=Math.exp(-1.8*dt);s.ball.vx*=decay;s.ball.vy*=decay;
   if(s.ball.y<23||s.ball.y>247){s.ball.y=clamp(s.ball.y,23,247);s.ball.vy*=-.74}
   // Goal-line detector checks the mouth before wall bounce.
   if(s.ball.x>=469){if(s.ball.y>109&&s.ball.y<160){score(0);return}s.ball.x=469;s.ball.vx*=-.55}
   if(s.ball.x<=11){if(s.ball.y>109&&s.ball.y<160){score(1);return}s.ball.x=11;s.ball.vx*=-.55}
   // Goalkeepers occupy the near post and bounce moving shots away.
   for(let i=0;i<2;i++){
    const k=s.keeper[i];
    if(Math.abs(s.ball.x-k.x)<9&&Math.abs(s.ball.y-k.y)<10){
      s.ball.vx=(i===0?1:-1)*Math.max(115,Math.abs(s.ball.vx)*.83);
      s.ball.vy=(s.ball.y-k.y)*5.5;s.ball.lock=.2;
    }
   }
   if(s.ball.lock<=0){
    const p=dist(s.user,s.ball),b=dist(s.cpu,s.ball);
    if(p<14||b<14){
      s.ball.owner=p<14&&p<=b?0:1;
      s.ball.vx=s.ball.vy=0;
    }
   }
  }
 };
 s.draw = ctx => drawSoccer(ctx, s);
 resetPositions();
 return s;
}
