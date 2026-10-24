// Lightning Pixel Basketball: original side-view arcade match.
const W=480,H=270,GROUND=222,RIM=123,GRAVITY=385;
const clip=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
const drawBox=(g,x,y,w,h,c)=>{g.fillStyle=c;g.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h))};
const drawText=(g,text,x,y,size,color,align="left")=>{g.textAlign=align;g.font="bold "+size+"px monospace";g.fillStyle=color;g.fillText(text,x,y)};
function basketPlayer(g,p,kit,trim,number,clock){
 const x=p.x|0,feet=(GROUND-p.jump)|0,step=Math.sin(clock*11)*Math.min(2,Math.abs(p.vx)*.025);
 drawBox(g,x-10,GROUND+1,21,3,"#1b2224a0");
 drawBox(g,x-6,feet-23,12,12,kit);
 drawBox(g,x-6,feet-28,12,7,"#d49c78");drawBox(g,x-6,feet-29,12,3,"#262839");
 drawBox(g,x-10,feet-21,4,12,"#c98f6e");drawBox(g,x+6,feet-21,4,12,"#c98f6e");
 drawBox(g,x-5,feet-11,10,5,trim);
 drawBox(g,x-5,feet-6,4,6+step,"#f4e9c4");drawBox(g,x+2,feet-6,4,6-step,"#f4e9c4");
 drawText(g,number,x,feet-12,8,"#fff9da","center");
}
function hoop(g,x,side){
 const left=side===-1;
 const post=left?x-20:x+17;
 drawBox(g,post,RIM-15,5,110,"#acb6bb");drawBox(g,post+1,RIM-15,2,110,"#5c7889");
 drawBox(g,post+(left?-7:0),RIM-30,13,23,"#f9e6ba");
 drawBox(g,post+(left?-4:3),RIM-27,7,17,"#1b4856");
 drawBox(g,x-10,RIM,20,3,"#f1825e");
 for(let i=0;i<4;i++){
   const start=x-9+i*6;
   drawBox(g,start,RIM+4,1,17,"#e0decf");
   drawBox(g,start+(i%2===0?2:-2),RIM+21,5,1,"#e0decf");
 }
}
function ballSprite(g,b){
 const x=b.x|0,y=b.y|0;
 drawBox(g,x-6,y-5,11,11,"#131b28");
 drawBox(g,x-5,y-5,10,10,"#e98f43");
 drawBox(g,x-5,y-1,10,2,"#5a342d");
 drawBox(g,x-1,y-5,2,10,"#5a342d");
 drawBox(g,x-4,y-4,2,2,"#ffba68");
}
export function createBasketball(options={}){
 const state={
  mode:"basketball",duration:110,time:110,score:[0,0],over:false,
  phase:"countdown",countdown:2.1,notice:"TIP OFF",clock:0,resetDelay:0,
  user:{x:128,jump:0,vy:0,vx:0,face:1},cpu:{x:354,jump:0,vy:0,vx:0,face:-1},
  ball:{x:142,y:GROUND-15,vx:0,vy:0,owner:0,lock:0,shotBy:-1,points:2},
  difficulty:options.difficulty||"normal",cooldown:0,lastShot:"",streak:0
 };
 const skill=state.difficulty==="hard"?1.25:state.difficulty==="easy"?.75:1;
 function reset(team=0){
   Object.assign(state.user,{x:128,jump:0,vy:0,vx:0,face:1});
   Object.assign(state.cpu,{x:354,jump:0,vy:0,vx:0,face:-1});
   Object.assign(state.ball,{x:team===0?141:339,y:GROUND-19,vx:0,vy:0,owner:team,lock:.3,shotBy:-1,points:2});
   state.cooldown=0;
 }
 function goal(team,points){
   state.score[team]+=points;state.notice=(team===0?"+":"-")+points+" POINTS!";
   state.phase="score";state.resetDelay=1.85;state.streak=team===0?state.streak+1:0;
   state.ball.owner=-1;state.ball.vx=state.ball.vy=0;
 }
 function shoot(team){
   if(state.phase!=="play"||state.cooldown>0||state.ball.owner!==team)return;
   const me=team===0?state.user:state.cpu;
   const targetX=team===0?420:59;
   const dx=targetX-me.x,travel=clip(Math.abs(dx)/220,.65,1.55);
   const y0=GROUND-27-me.jump;
   const jitter=(team===0?Math.random()-.5:(Math.random()-.5)/skill)*Math.min(18,Math.abs(dx)/22);
   const targetY=RIM+jitter;
   state.ball.owner=-1;state.ball.shotBy=team;
   state.ball.x=me.x+Math.sign(dx)*10;state.ball.y=y0;
   state.ball.vx=dx/travel;state.ball.vy=(targetY-y0-.5*GRAVITY*travel*travel)/travel;
   state.ball.points=Math.abs(dx)>195?3:2;
   state.ball.lock=.45;state.cooldown=.7;
   state.lastShot=team===0?"YOU SHOOT":"CPU SHOOTS";
 }
 state.action=key=>{
   if(key==="space"||key==="shoot")shoot(0);
   if(key==="x"||key==="steal"){
     if(state.cooldown>0)return;
     if(state.ball.owner===1&&Math.abs(state.user.x-state.cpu.x)<24&&state.user.jump<10){
       state.ball.owner=0;state.cooldown=.55;state.notice="STEAL!";
     }else if(state.ball.owner===-1&&Math.abs(state.user.x-state.ball.x)<20&&Math.abs(GROUND-21-state.user.jump-state.ball.y)<25){
       state.ball.owner=0;state.ball.lock=0;state.cooldown=.25;
     }
   }
 };
 state.tick=(dt,keys)=>{
   dt=clip(dt,0,.04);state.clock+=dt;
   if(state.over)return;
   if(state.phase==="countdown"){
     state.countdown-=dt;if(state.countdown<=0){state.phase="play";state.notice="";}return;
   }
   if(state.phase==="score"){
     state.resetDelay-=dt;
     if(state.resetDelay<=0){reset(state.notice.startsWith("+")?1:0);state.phase="countdown";state.countdown=1.05}
     return;
   }
   state.time=Math.max(0,state.time-dt);
   if(state.time===0){
     state.over=true;state.phase="finished";
     state.notice=state.score[0]>state.score[1]?"YOU WIN!":state.score[0]<state.score[1]?"CPU WINS":"OVERTIME DRAW";
     return;
   }
   state.cooldown=Math.max(0,state.cooldown-dt);
   let input=Number(keys.has("d")||keys.has("arrowright"))-Number(keys.has("a")||keys.has("arrowleft"));
   const sprint=keys.has("shift")?1.36:1;
   state.user.vx=input*125*sprint;state.user.x=clip(state.user.x+state.user.vx*dt,35,447);
   if(input)state.user.face=input>0?1:-1;
   if((keys.has("w")||keys.has("arrowup"))&&state.user.jump===0){state.user.vy=210}
   const target=state.ball.owner===1?120:state.ball.owner===0?state.user.x+22:state.ball.x;
   let delta=target-state.cpu.x;
   state.cpu.vx=Math.sign(delta)*Math.min(Math.abs(delta)*4.6,111*skill);
   state.cpu.x=clip(state.cpu.x+state.cpu.vx*dt,35,447);
   if(state.cpu.vx)state.cpu.face=state.cpu.vx>0?1:-1;
   if(state.ball.owner===0&&Math.abs(state.cpu.x-state.user.x)<25&&state.cpu.jump===0&&state.clock%1.4<.025){
     state.cpu.vy=176;
   }
   for(const p of [state.user,state.cpu]){
     if(p.jump>0||p.vy>0){
       p.jump+=p.vy*dt;p.vy-=GRAVITY*dt;
       if(p.jump<=0){p.jump=0;p.vy=0}
     }
   }
   state.ball.lock=Math.max(0,state.ball.lock-dt);
   if(state.ball.owner!==-1){
     const holder=state.ball.owner===0?state.user:state.cpu;
     const dribble=Math.abs(Math.sin(state.clock*12))*11;
     state.ball.x=holder.x+holder.face*11;
     state.ball.y=GROUND-17-holder.jump+dribble;
     if(state.ball.owner===1&&state.cpu.x<238&&state.cooldown<=0)shoot(1);
     if(state.ball.owner===1&&Math.abs(state.user.x-state.cpu.x)<14&&keys.has("x")&&state.cooldown===0){
       state.ball.owner=0;state.cooldown=.7;
     }
   }else{
     const b=state.ball,oldX=b.x,oldY=b.y;
     b.vy+=GRAVITY*dt;b.x+=b.vx*dt;b.y+=b.vy*dt;
     // Only a descending ball can pass through the rim from above.
     for(const [team,rim] of [[0,420],[1,59]]){
       if(b.shotBy===team&&b.vy>0&&Math.min(oldX,b.x)<=rim&&Math.max(oldX,b.x)>=rim){
         const crossing=oldY+(b.y-oldY)*(rim-oldX)/(b.x-oldX||1);
         if(Math.abs(crossing-RIM)<10){goal(team,b.points);return}
       }
     }
     if(b.y>GROUND-6){b.y=GROUND-6;b.vy*=-.53;b.vx*=.8;if(Math.abs(b.vy)<27){b.vy=0;b.vx*=.92}}
     if(b.x<25||b.x>455){b.x=clip(b.x,25,455);b.vx*=-.68}
     if(b.lock<=0&&(Math.abs(b.vx)<190||b.y>GROUND-51)){
       const p=state.user,q=state.cpu;
       const pd=Math.hypot(p.x-b.x,GROUND-24-p.jump-b.y),qd=Math.hypot(q.x-b.x,GROUND-24-q.jump-b.y);
       if(pd<21||qd<21){b.owner=pd<=qd&&pd<21?0:1;b.vx=b.vy=0;b.shotBy=-1}
     }
   }
 };
 state.draw=g=>{
   g.imageSmoothingEnabled=false;
   drawBox(g,0,0,W,H,"#171f32");
   for(let i=0;i<8;i++){drawBox(g,0,i*13,W,10,i%2?"#343955":"#2a3150")}
   // Bleachers, pixel spectators and arena signage.
   for(let j=0;j<91;j++){const x=(j*37)%W,y=10+((j*13)%83);
     drawBox(g,x,y,4,4,["#e7b58b","#b0c0d1","#a781b8","#aec28c"][j%4]);
     drawBox(g,x-1,y+4,6,4,["#526683","#d27d65","#6b709d","#7b9d8c"][j%4]);
   }
   drawBox(g,0,97,W,6,"#a67a50");drawBox(g,0,103,W,12,"#1c263c");
   drawBox(g,0,115,W,118,"#c28a51");
   for(let i=0;i<19;i++)drawBox(g,i*27,115,1,118,"#b07845");
   drawBox(g,0,228,W,42,"#171e31");
   for(let i=0;i<11;i++)drawBox(g,i*44,239,20,1,"#6a7b8f");
   g.strokeStyle="#eac48c";g.lineWidth=2;g.beginPath();g.arc(240,230,44,Math.PI,0);g.stroke();
   drawBox(g,239,115,2,112,"#eac48c");
   g.strokeRect(18,146,98,80);g.strokeRect(364,146,98,80);
   drawBox(g,4,116,472,2,"#e4b984a9");
   hoop(g,59,-1);hoop(g,420,1);
   basketPlayer(g,state.cpu,"#6554ca","#9f8aff",8,state.clock);
   basketPlayer(g,state.user,"#e6a252","#ffdd87",11,state.clock);
   ballSprite(g,state.ball);
   if(state.phase!=="play"){
     drawBox(g,133,92,214,66,"#0e1427dd");drawBox(g,136,95,208,60,"#253247");
     drawText(g,state.over?state.notice:state.phase==="score"?state.notice:"TIP OFF!",240,124,17,"#ffe1a2","center");
     drawText(g,state.over?"FINAL SCORE":"READY IN "+Math.max(1,Math.ceil(state.countdown||state.resetDelay)),240,143,9,"#a8c4d5","center");
   }
 };
 reset(0);
 return state;
}
