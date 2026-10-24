import {drawBasketball} from "./pixel-scenes.js?v=3";

const GROUND=222, RIM=123, GRAVITY=385;
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const distance=(a,b)=>Math.abs(a.x-b.x);
const DEFAULT_RANDOM=Math.random;

/**
 * The shot meter controls probability, not the ball's visual arc.
 * A green release is in unless a defender blocks the shot.
 * Otherwise, the displayed quality is the probability used for the roll.
 */
export function createBasketball({difficulty="normal",random=DEFAULT_RANDOM}={}){
  const cpuSkill={easy:.72,normal:1,hard:1.2}[difficulty]||1;
  const game={
    mode:"basketball",difficulty,duration:110,time:110,score:[0,0],
    over:false,phase:"countdown",countdown:1.8,notice:"TIP OFF",clock:0,resetDelay:0,
    user:{x:128,jump:0,vy:0,vx:0,face:1,steal:0,stumble:0,crossover:0},
    cpu:{x:354,jump:0,vy:0,vx:0,face:-1,steal:0,stumble:0,defenseCooldown:1.3},
    ball:{x:140,y:GROUND-22,vx:0,vy:0,owner:0,lock:0,shotBy:-1,points:2,make:false},
    shot:{active:false,progress:0,greenStart:0,greenEnd:0,quality:0,perfect:false},
    feedback:"",feedbackTime:0,cooldown:0,streak:0,possessions:0,dribble:0,crossoverCooldown:0,turnovers:0
  };
  function reset(team=0){
    Object.assign(game.user,{x:128,jump:0,vy:0,vx:0,face:1,steal:0,stumble:0,crossover:0});
    Object.assign(game.cpu,{x:354,jump:0,vy:0,vx:0,face:-1,steal:0,stumble:0,defenseCooldown:1.3});
    Object.assign(game.ball,{x:team===0?140:340,y:GROUND-22,vx:0,vy:0,owner:team,lock:.25,shotBy:-1,points:2,make:false});
    Object.assign(game.shot,{active:false,progress:0,greenStart:0,greenEnd:0,quality:0,perfect:false});
    game.cooldown=0;game.crossoverCooldown=0;
  }
  function shotWindow(){
    const range=Math.abs(420-game.user.x);
    const width=clamp(.25-(range/450)*.2,.048,.24);
    const center=clamp(.74-range/3600,.59,.77);
    return {start:center-width/2,end:center+width/2,range};
  }
  game.shotWindow=shotWindow;
  function qualityAt(progress){
    const w=shotWindow();
    const perfect=progress>=w.start&&progress<=w.end;
    const gap=Math.max(0,w.start-progress,progress-w.end);
    const timing=clamp(1-gap/(.32),0,1);
    const rangeFactor=clamp(1-w.range/840,.56,1);
    const pressure=distance(game.user,game.cpu)<38?.76:1;
    const balance=Math.abs(game.user.vx)>125?.9:1;
    return {perfect,quality:perfect?1:clamp(timing*rangeFactor*pressure*balance,.04,.96)};
  }
  game.qualityAt=qualityAt;
  function feedback(text,time=1.1){
    game.feedback=text;game.feedbackTime=time;
  }
  function score(team,points){
    game.score[team]+=points;
    game.phase="score";game.resetDelay=1.5;game.notice=team===0?"+ "+points+" POINTS":"CPU SCORES";
    game.streak=team===0?game.streak+1:0;
    game.ball.owner=-1;game.ball.vx=game.ball.vy=0;
    game.shot.active=false;
  }
  function throwBall(team,accuracy=1,perfect=false){
    if(game.phase!=="play"||game.cooldown>0||game.ball.owner!==team)return false;
    const shooter=team===0?game.user:game.cpu, defender=team===0?game.cpu:game.user;
    const targetX=team===0?420:60;
    const direction=Math.sign(targetX-shooter.x)||1;
    const originX=shooter.x+direction*10;
    const delta=targetX-originX;
    const travel=clamp(Math.abs(delta)/220,.62,1.55);
    const close=distance(shooter,defender)<21;
    const blocked=close&&defender.jump>12&&random()<.8;
    const make=!blocked&&(perfect||random()<accuracy);
    const missOffset=(random()<.5?-1:1)*(13+random()*13);
    const yAtRim=make?RIM:clamp(RIM+missOffset,89,156);
    const originY=GROUND-27-shooter.jump;
    Object.assign(game.ball,{
      owner:-1,x:originX,y:originY,vx:delta/travel,
      vy:(yAtRim-originY-.5*GRAVITY*travel*travel)/travel,
      shotBy:blocked?-1:team,points:Math.abs(delta)>195?3:2,
      make,lock:.4
    });
    game.cooldown=.65;
    game.possessions++;
    if(blocked){game.ball.vx*=-.6;game.ball.vy=-70;feedback("BLOCKED");}
    else feedback(perfect?"GREEN":Math.round(accuracy*100)+"% RELEASE");
    return true;
  }
  game.press=key=>{
    if(key!=="x"&&key!=="shoot")return;
    if(game.phase!=="play"||game.cooldown>0||game.ball.owner!==0||game.shot.active)return;
    const window=shotWindow();
    Object.assign(game.shot,{active:true,progress:0,greenStart:window.start,greenEnd:window.end,quality:0,perfect:false});
    feedback("RELEASE IN THE GREEN",.6);
  };
  game.release=key=>{
    if(key!=="x"&&key!=="shoot"||!game.shot.active)return;
    const result=qualityAt(game.shot.progress);
    game.shot.active=false;
    game.shot.quality=result.quality;game.shot.perfect=result.perfect;
    throwBall(0,result.quality,result.perfect);
  };
  game.action=key=>{
    if(key==="x"){game.press("x");return;}
    // A crossover briefly shifts your dribble to the other hand and wrong-foots
    // a defender who is already in reach. It cannot be spammed.
    if(key==="c"||key==="crossover"){
      if(game.phase!=="play"||game.ball.owner!==0||game.crossoverCooldown>0||game.shot.active)return;
      game.user.crossover=.35;
      game.crossoverCooldown=.9;
      game.user.x=clamp(game.user.x+game.user.face*15,35,447);
      if(distance(game.cpu,game.user)<48){
        game.cpu.stumble=.48;
        feedback("ANKLE BREAK",.85);
      } else feedback("CROSSOVER",.6);
      return;
    }
    // Preserve the legacy one-tap API for older callers and replay tests.
    if(key==="space"||key==="shoot"){throwBall(0,.95,true);return;}
    if(key!=="z"&&key!=="steal")return;
    if(game.phase!=="play"||game.cooldown>0)return;
    game.user.steal=.28;
    const defender=game.cpu;
    const withinReach=distance(game.user,defender)<30&&game.user.jump<11;
    const vulnerable=Math.sin(game.clock*13)>-.2||defender.stumble>0;
    if(game.ball.owner===1&&withinReach&&vulnerable){
      game.ball.owner=-1;game.ball.x=(game.user.x+defender.x)/2;
      game.ball.y=GROUND-16;game.ball.vx=game.user.face*75;game.ball.vy=-65;
      game.ball.lock=.22;game.cooldown=.43;feedback("POKED LOOSE");
    }else if(game.ball.owner===-1&&Math.abs(game.ball.x-game.user.x)<20&&Math.abs(game.ball.y-(GROUND-25-game.user.jump))<28){
      game.ball.owner=0;game.cooldown=.16;feedback("REBOUND");
    }else{
      game.user.stumble=.22;game.cooldown=.58;feedback("MISSED STEAL",.55);
    }
  };
  game.tick=(dt,keys=new Set())=>{
    dt=clamp(dt,0,.04);game.clock+=dt;
    if(game.over)return;
    if(game.phase==="countdown"){game.countdown-=dt;if(game.countdown<=0){game.phase="play";game.notice="";}return;}
    if(game.phase==="score"){game.resetDelay-=dt;if(game.resetDelay<=0){reset(game.notice.startsWith("+")?1:0);game.phase="countdown";game.countdown=1;}return;}
    game.time=Math.max(0,game.time-dt);
    if(!game.time){
      game.over=true;game.phase="finished";
      game.notice=game.score[0]===game.score[1]?"DRAW":game.score[0]>game.score[1]?"YOU WIN":"CPU WINS";
      return;
    }
    game.cooldown=Math.max(0,game.cooldown-dt);
    game.crossoverCooldown=Math.max(0,game.crossoverCooldown-dt);
    game.cpu.defenseCooldown=Math.max(0,game.cpu.defenseCooldown-dt);
    game.user.crossover=Math.max(0,game.user.crossover-dt);
    game.feedbackTime=Math.max(0,game.feedbackTime-dt);
    for(const p of [game.user,game.cpu]){
      p.steal=Math.max(0,p.steal-dt);p.stumble=Math.max(0,p.stumble-dt);
    }
    const input=Number(keys.has("d")||keys.has("arrowright"))-Number(keys.has("a")||keys.has("arrowleft"));
    const speed=135*(keys.has("shift")?1.3:1)*(game.user.stumble>0?.45:1);
    const desired=input*speed;
    const response=input?920:1150;
    game.user.vx+=clamp(desired-game.user.vx,-response*dt,response*dt);
    game.user.x=clamp(game.user.x+game.user.vx*dt,35,447);
    if(input)game.user.face=Math.sign(input);
    if((keys.has("w")||keys.has("arrowup"))&&game.user.jump===0)game.user.vy=210;
    if(game.shot.active){
      game.shot.progress+=dt*(game.difficulty==="hard"?1.2:game.difficulty==="easy"?.86:1.04);
      if(game.shot.progress>1.06)game.shot.progress=0;
      Object.assign(game.shot,{...shotWindow()});
      const w=shotWindow();game.shot.greenStart=w.start;game.shot.greenEnd=w.end;
      game.shot.quality=qualityAt(game.shot.progress).quality;
    }
    const target=game.ball.owner===1?124:game.ball.owner===0?
      clamp(game.user.x+38,54,419):game.ball.x;
    const shift=target-game.cpu.x;
    const opponentSpeed=game.cpu.stumble>0?35:126*cpuSkill;
    game.cpu.vx=Math.sign(shift)*Math.min(Math.abs(shift)*5.2,opponentSpeed);
    game.cpu.x=clamp(game.cpu.x+game.cpu.vx*dt,35,447);
    // Do not let both players occupy the same pixel column.
    const overlap=game.cpu.x-game.user.x;
    if(Math.abs(overlap)<17){
      game.cpu.x=clamp(game.user.x+(overlap>=0?17:-17),35,447);
    }
    if(game.ball.owner===0&&Math.abs(game.cpu.x-game.user.x)<27&&game.cpu.defenseCooldown===0){
      game.cpu.defenseCooldown=clamp(1.9/cpuSkill,1.1,2.5);
      if(game.user.crossover===0&&game.cpu.stumble===0&&random()<.46*cpuSkill){
        game.ball.owner=-1;
        game.ball.x=(game.cpu.x+game.user.x)/2;
        game.ball.y=GROUND-26;
        game.ball.vx=-90;game.ball.vy=-75;game.ball.lock=.18;
        game.turnovers++;game.shot.active=false;feedback("STRIPPED!",.95);
        game.cpu.steal=.2;
      }else{
        game.cpu.steal=.24;
        feedback("DEFENDED",.5);
      }
    }
    if(shift)game.cpu.face=Math.sign(shift);
    if(game.ball.owner===0&&distance(game.cpu,game.user)<33&&game.cpu.jump===0&&game.clock%1.4<dt)game.cpu.vy=195;
    for(const p of [game.user,game.cpu]){
      if(p.jump>0||p.vy>0){
        p.jump+=p.vy*dt;p.vy-=GRAVITY*dt;
        if(p.jump<=0){p.jump=0;p.vy=0;}
      }
    }
    game.dribble+=dt*(Math.abs(game.user.vx)>10?13:9);
    game.ball.lock=Math.max(0,game.ball.lock-dt);
    if(game.ball.owner!==-1){
      const p=game.ball.owner===0?game.user:game.cpu;
      const bounce=Math.abs(Math.sin(game.clock*(Math.abs(p.vx)>90?16:10)))*17;
      const hand=p===game.user&&game.user.crossover>0?-1:(Math.sin(game.clock*5)>.15?1:-1);
      game.ball.x=p.x+p.face*(9+4*hand);
      game.ball.y=GROUND-21-p.jump+bounce;
      if(game.ball.owner===1&&game.cpu.x<236&&game.cooldown<=0)throwBall(1,.53*cpuSkill,false);
    }else{
      const b=game.ball,oldX=b.x,oldY=b.y;
      b.vy+=GRAVITY*dt;b.x+=b.vx*dt;b.y+=b.vy*dt;
      for(const [team,rim] of [[0,420],[1,60]]){
        if(b.shotBy===team&&b.make&&b.vy>0&&Math.min(oldX,b.x)<=rim&&Math.max(oldX,b.x)>=rim){
          const y=oldY+(b.y-oldY)*(rim-oldX)/(b.x-oldX||1);
          if(Math.abs(y-RIM)<11){score(team,b.points);return;}
        }
      }
      if(b.y>GROUND-6){b.y=GROUND-6;b.vy*=-.55;b.vx*=.77;if(Math.abs(b.vy)<23)b.vy=0;}
      if(b.x<24||b.x>456){b.x=clamp(b.x,24,456);b.vx*=-.64;}
      if(b.lock<=0&&(Math.abs(b.vx)<190||b.y>GROUND-52)){
        const pd=Math.hypot(game.user.x-b.x,GROUND-24-game.user.jump-b.y);
        const cd=Math.hypot(game.cpu.x-b.x,GROUND-24-game.cpu.jump-b.y);
        if(pd<21||cd<21){b.owner=pd<21&&pd<=cd?0:1;b.vx=b.vy=0;b.shotBy=-1;b.make=false;}
      }
    }
  };
  game.draw=ctx=>drawBasketball(ctx,game);
  reset();
  return game;
}
