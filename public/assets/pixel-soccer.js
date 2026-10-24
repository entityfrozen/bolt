import {drawSoccer} from "./pixel-scenes.js?v=2";

const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

/** z is the ball's height above the grass; x/y are its position on the pitch. */
export function createSoccer({difficulty="normal",random=Math.random}={}){
  const skill={easy:.8,normal:1,hard:1.24}[difficulty]||1;
  const game={
    mode:"soccer",difficulty,duration:100,time:100,score:[0,0],over:false,
    phase:"countdown",countdown:2,notice:"KICK OFF",clock:0,resetDelay:0,goalFlash:0,
    user:{x:125,y:135,dir:1,jump:0,vz:0,sprint:100,fake:0,tackle:0},
    cpu:{x:350,y:135,dir:-1,jump:0,vz:0,fake:0,tackle:0,hesitate:0,stealCooldown:1},
    mate:{x:163,y:202,dir:1,jump:0,vz:0,fake:0,tackle:0},
    rival:{x:319,y:70,dir:-1,jump:0,vz:0,fake:0,tackle:0,stealCooldown:1.6},
    keeper:[{x:43,y:135,jump:0},{x:437,y:135,jump:0}],
    ball:{x:139,y:135,z:0,vx:0,vy:0,vz:0,spin:0,owner:0,lock:0},
    shot:{active:false,progress:0,greenStart:.68,greenEnd:.83,quality:0,lob:false,curve:0},
    actionCooldown:0,feedback:"",feedbackTime:0,lastKick:""
  };
  function say(value,duration=1){game.feedback=value;game.feedbackTime=duration;game.lastKick=value;}
  function reset(kickoff=0){
    Object.assign(game.user,{x:125,y:135,dir:1,jump:0,vz:0,fake:0,tackle:0,sprint:100});
    Object.assign(game.cpu,{x:350,y:135,dir:-1,jump:0,vz:0,fake:0,tackle:0,hesitate:0,stealCooldown:1});
    Object.assign(game.mate,{x:163,y:202,dir:1,jump:0,vz:0,fake:0,tackle:0});
    Object.assign(game.rival,{x:319,y:70,dir:-1,jump:0,vz:0,fake:0,tackle:0,stealCooldown:1.6});
    Object.assign(game.ball,{x:kickoff===0?139:kickoff===1?340:240,y:135,z:0,vx:0,vy:0,vz:0,spin:0,owner:kickoff,lock:.15});
    game.keeper.forEach(k=>{k.y=135;k.jump=0;});
    game.actionCooldown=0;game.shot.active=false;
  }
  function score(team){
    game.score[team]++;game.phase="goal";game.notice=team===0?"GOAL!":"CPU SCORES";
    game.resetDelay=1.8;game.goalFlash=1.5;
    game.ball.owner=-1;game.ball.vx=game.ball.vy=game.ball.vz=0;
    game.shot.active=false;
  }
  function windowFor(player){
    const range=player===game.user?Math.abs(465-player.x):Math.abs(player.x-15);
    const width=clamp(.24-range/2800,.06,.23);
    const center=clamp(.75-range/3000,.59,.76);
    return {start:center-width/2,end:center+width/2};
  }
  game.shotWindow=()=>windowFor(game.user);
  const actor=team=>[game.user,game.cpu,game.mate,game.rival][team];
  const home=team=>team===0||team===2;

  function pass(team,target){
    if(game.ball.owner!==team||game.phase!=="play")return false;
    const from=actor(team),to=actor(target);
    if(!from||!to)return false;
    const dx=to.x-from.x,dy=to.y-from.y,len=Math.hypot(dx,dy)||1;
    Object.assign(game.ball,{
      owner:-1,x:from.x+Math.sign(dx)*12,y:from.y,
      z:0,vx:dx/len*228,vy:dy/len*228,vz:0,spin:0,lock:.13,
      intendedTarget:target
    });
    game.actionCooldown=.16;
    say(team===0?"PASS":"ONE-TWO",.75);
    return true;
  }
  game.pass=()=>pass(0,2);

  function shoot(team,{progress=.74,lob=false,curve=0}={}){
    if(game.phase!=="play"||game.actionCooldown>0||game.ball.owner!==team)return false;
    const player=actor(team);
    const zone=windowFor(player);
    const perfect=progress>=zone.start&&progress<=zone.end;
    const gap=Math.max(0,zone.start-progress,progress-zone.end);
    const quality=perfect?1:clamp(1-gap/.4,.08,.94);
    const power=clamp(.66+progress*.45,.52,1.18);
    const direction=home(team)?1:-1;
    const distanceGoal=home(team)?469-player.x:player.x-11;
    const targetY=clamp(135+(player.y-135)*.24+(random()-.5)*(1-quality)*135,104,166);
    const dx=direction*Math.max(42,distanceGoal);
    const dy=targetY-player.y;
    const length=Math.hypot(dx,dy)||1;
    const speed=270*power;
    Object.assign(game.ball,{
      owner:-1,x:player.x+direction*12,y:player.y+4,z:0,
      vx:dx/length*speed,vy:dy/length*speed,
      vz:lob?clamp(145+progress*70,140,230):0,
      spin:clamp(curve,-1,1)*90,lock:.35,intendedTarget:null
    });
    game.actionCooldown=.48;
    game.shot.active=false;
    say((perfect?"PERFECT · ":"")+(lob?"CHIP SHOT":curve?"CURVE SHOT":"STRIKE")+(perfect?"":" · "+Math.round(quality*100)+"%"),1);
    return true;
  }
  game.press=key=>{
    if(key!=="x"&&key!=="shoot")return;
    if(game.phase!=="play"||game.actionCooldown>0||game.ball.owner!==0||game.shot.active)return;
    const zone=windowFor(game.user);
    Object.assign(game.shot,{active:true,progress:0,greenStart:zone.start,greenEnd:zone.end,quality:0,lob:false,curve:0});
    say("HOLD X · RELEASE TO SHOOT",.6);
  };
  game.release=key=>{
    if((key!=="x"&&key!=="shoot")||!game.shot.active)return;
    shoot(0,game.shot);
  };
  game.fake=()=>{
    if(!game.shot.active||game.ball.owner!==0)return;
    game.shot.active=false;
    game.user.fake=.45;game.cpu.hesitate=.7;
    game.rival.hesitate=.35;
    game.actionCooldown=.13;
    say("FAKE SHOT",.9);
  };
  game.action=key=>{
    if(key==="shoot"||key==="space"){shoot(0);return;}
    if(key==="x"){game.press("x");return;}
    if(key==="v"||key==="pass"){game.pass();return;}
    if(key==="fake"||key==="f"){game.fake();return;}
    if(key==="z"||key==="tackle"){
      if(game.phase!=="play"||game.actionCooldown>0)return;
      game.user.tackle=.28;
      const defender=distance(game.user,game.cpu)<distance(game.user,game.rival)?game.cpu:game.rival;
      if((game.ball.owner===1||game.ball.owner===3)&&distance(game.user,defender)<25){
        game.ball.owner=-1;game.ball.x=(game.user.x+defender.x)/2;
        game.ball.y=(game.user.y+defender.y)/2;
        game.ball.z=0;game.ball.vx=game.user.dir*90;game.ball.vy=15;
        game.ball.lock=.16;game.actionCooldown=.35;say("TACKLED");
      }else if(game.ball.owner===-1&&distance(game.user,game.ball)<19&&game.ball.z<9){
        game.ball.owner=0;game.actionCooldown=.15;say("INTERCEPTION");
      }else{game.actionCooldown=.53;say("MISSED TACKLE",.6);}
    }
    if(key==="c"||key==="jump"){
      if(game.shot.active){game.shot.lob=!game.shot.lob;say(game.shot.lob?"CHIP ON":"CHIP OFF",.6);return;}
      if(game.user.jump<=0){game.user.vz=155;say("JUMP",.45);}
    }
  };
  game.tick=(dt,keys=new Set())=>{
    dt=clamp(dt,0,.04);game.clock+=dt;
    if(game.over)return;
    if(game.phase==="countdown"){game.countdown-=dt;if(game.countdown<=0){game.phase="play";game.notice="";}return;}
    if(game.phase==="goal"){
      game.resetDelay-=dt;game.goalFlash=Math.max(0,game.goalFlash-dt);
      if(game.resetDelay<=0){reset(game.notice==="GOAL!"?1:0);game.phase="countdown";game.countdown=1;}
      return;
    }
    game.time=Math.max(0,game.time-dt);
    if(!game.time){game.over=true;game.phase="finished";game.notice=game.score[0]===game.score[1]?"DRAW":game.score[0]>game.score[1]?"YOU WIN":"CPU WINS";return;}
    game.feedbackTime=Math.max(0,game.feedbackTime-dt);
    game.actionCooldown=Math.max(0,game.actionCooldown-dt);
    game.user.fake=Math.max(0,game.user.fake-dt);
    game.user.tackle=Math.max(0,game.user.tackle-dt);
    game.cpu.hesitate=Math.max(0,game.cpu.hesitate-dt);
    game.cpu.tackle=Math.max(0,game.cpu.tackle-dt);
    game.cpu.stealCooldown=Math.max(0,game.cpu.stealCooldown-dt);
    game.rival.stealCooldown=Math.max(0,game.rival.stealCooldown-dt);
    game.rival.tackle=Math.max(0,game.rival.tackle-dt);
    const x=Number(keys.has("d")||keys.has("arrowright"))-Number(keys.has("a")||keys.has("arrowleft"));
    const y=Number(keys.has("s")||keys.has("arrowdown"))-Number(keys.has("w")||keys.has("arrowup"));
    const magnitude=Math.hypot(x,y)||1;
    const running=keys.has("shift")&&game.user.sprint>0;
    const pace=running?162:113;
    game.user.x=clamp(game.user.x+(x/magnitude)*pace*dt,26,454);
    game.user.y=clamp(game.user.y+(y/magnitude)*pace*dt,26,245);
    if(x)game.user.dir=Math.sign(x);
    if(running&&(x||y))game.user.sprint=Math.max(0,game.user.sprint-dt*21);
    else game.user.sprint=Math.min(100,game.user.sprint+dt*13);
    if(game.shot.active){
      game.shot.progress+=dt*({easy:.88,normal:1.05,hard:1.18}[difficulty]||1);
      if(game.shot.progress>1.04)game.shot.progress=0;
      const zone=windowFor(game.user);
      game.shot.greenStart=zone.start;game.shot.greenEnd=zone.end;
      const gap=Math.max(0,zone.start-game.shot.progress,game.shot.progress-zone.end);
      game.shot.quality=game.shot.progress>=zone.start&&game.shot.progress<=zone.end?1:clamp(1-gap/.4,.08,.94);
      const curve=Number(keys.has("d")||keys.has("arrowright"))-Number(keys.has("a")||keys.has("arrowleft"));
      if(curve)game.shot.curve=clamp(game.shot.curve+curve*dt*2.2,-1,1);
    }
    const cpuOwn=game.ball.owner===1||game.ball.owner===3;
    const userOwn=game.ball.owner===0||game.ball.owner===2;
    // The supporting player finds open space instead of stacking on the ball.
    const mateTarget=game.ball.owner===2?
      {x:365,y:clamp(game.mate.y,40,226)}:
      {x:clamp(game.user.x+72,110,391),y:clamp(game.user.y+(game.user.y>135?-73:73),40,230)};
    const mdx=mateTarget.x-game.mate.x,mdy=mateTarget.y-game.mate.y;
    const md=Math.hypot(mdx,mdy)||1;
    game.mate.x=clamp(game.mate.x+(mdx/md)*105*dt,28,451);
    game.mate.y=clamp(game.mate.y+(mdy/md)*105*dt,26,244);
    if(mdx)game.mate.dir=Math.sign(mdx);

    const target=cpuOwn?{x:155,y:135}:userOwn?
      (game.ball.owner===2?{x:game.mate.x+20,y:game.mate.y}:{x:game.user.x+24,y:game.user.y}):game.ball;
    const dx=target.x-game.cpu.x,dy=target.y-game.cpu.y,len=Math.hypot(dx,dy)||1;
    const speed=game.cpu.hesitate>0?26:106*skill;
    game.cpu.x=clamp(game.cpu.x+dx/len*speed*dt,27,453);
    game.cpu.y=clamp(game.cpu.y+dy/len*speed*dt,26,245);
    if(dx)game.cpu.dir=Math.sign(dx);
    const defend=game.ball.owner===0?game.user:game.ball.owner===2?game.mate:game.ball;
    const rivalTarget=cpuOwn?{x:clamp(game.cpu.x-45,35,420),y:game.cpu.y>130?68:195}:
      {x:clamp(defend.x+54,34,450),y:clamp(defend.y-24,34,242)};
    const rx=rivalTarget.x-game.rival.x,ry=rivalTarget.y-game.rival.y;
    const rl=Math.hypot(rx,ry)||1;
    game.rival.x=clamp(game.rival.x+rx/rl*96*skill*dt,28,452);
    game.rival.y=clamp(game.rival.y+ry/rl*96*skill*dt,26,245);
    if(rx)game.rival.dir=Math.sign(rx);

    // Actual pressure: a defender who gets close can poke the ball away.
    if(userOwn&&game.ball.owner!==-1){
      for(const defender of [game.cpu,game.rival]){
        const carrier=actor(game.ball.owner);
        if(defender.stealCooldown<=0&&distance(defender,carrier)<23){
          defender.stealCooldown=clamp(1.45/skill,1,2.2);
          defender.tackle=.26;
          if(game.user.fake>0||Math.random()<.53*skill){
            game.ball.owner=-1;
            game.ball.x=(defender.x+carrier.x)/2;
            game.ball.y=(defender.y+carrier.y)/2;
            game.ball.vx=-75;game.ball.vy=(defender.y-carrier.y)*2;
            game.ball.z=0;game.ball.vz=0;game.ball.lock=.15;
            game.shot.active=false;say("TACKLED!",.75);
            break;
          }
        }
      }
    }
    // Headed balls and goalkeeper jumps are real collision counters to chips.
    if(game.ball.z>15&&game.ball.owner===-1&&distance(game.cpu,game.ball)<35&&game.cpu.jump<1)game.cpu.vz=185;
    for(const player of [game.user,game.cpu,game.mate,game.rival]){
      if(player.jump>0||player.vz>0){
        player.jump+=player.vz*dt;player.vz-=460*dt;
        if(player.jump<=0){player.jump=0;player.vz=0;}
      }
    }
    for(let i=0;i<2;i++){
      const keeper=game.keeper[i];
      const targetY=game.ball.owner===-1?game.ball.y:game.ball.owner===i?game.ball.y:135;
      keeper.y=clamp(keeper.y+(targetY-keeper.y)*Math.min(1,dt*3.6),113,157);
      if(game.ball.z>15&&distance(keeper,game.ball)<28)keeper.jump=15;
      else keeper.jump=Math.max(0,keeper.jump-dt*55);
    }
    game.ball.lock=Math.max(0,game.ball.lock-dt);
    if(game.ball.owner!==-1){
      const holder=actor(game.ball.owner);
      game.ball.x=holder.x+holder.dir*(running&&game.ball.owner===0?15:10);
      game.ball.y=holder.y+6;
      game.ball.z=0;
      if(cpuOwn&&holder.x<230&&game.actionCooldown<=0)
        shoot(game.ball.owner,{progress:.61+random()*.25});
      if(game.ball.owner===2&&game.actionCooldown<=0){
        if(game.mate.x>298)shoot(2,{progress:.66+random()*.12});
        else if(distance(game.mate,game.rival)<37)pass(2,0);
      }
      return;
    }
    const ball=game.ball;
    const oldZ=ball.z;
    ball.x+=ball.vx*dt;ball.y+=ball.vy*dt;
    ball.vy+=ball.spin*dt;
    ball.spin*=Math.exp(-.85*dt);
    ball.z=Math.max(0,ball.z+ball.vz*dt);
    ball.vz-=360*dt;
    if(ball.z<=0){ball.z=0;if(oldZ>0)ball.vz=Math.max(0,-ball.vz*.34);else ball.vz=0;}
    const friction=Math.exp(-(ball.z>1?.65:1.6)*dt);
    ball.vx*=friction;ball.vy*=friction;
    if(ball.y<23||ball.y>247){ball.y=clamp(ball.y,23,247);ball.vy*=-.72;}
    if(ball.x>=469){if(ball.y>109&&ball.y<160&&ball.z<26){score(0);return;}ball.x=469;ball.vx*=-.57;}
    if(ball.x<=11){if(ball.y>109&&ball.y<160&&ball.z<26){score(1);return;}ball.x=11;ball.vx*=-.57;}
    for(let i=0;i<2;i++){
      const keeper=game.keeper[i];
      if(Math.abs(ball.x-keeper.x)<10&&Math.abs(ball.y-keeper.y)<13&&ball.z<keeper.jump+10){
        ball.vx=(i===0?1:-1)*Math.max(120,Math.abs(ball.vx)*.86);
        ball.vy=(ball.y-keeper.y)*6;ball.vz=42;ball.lock=.24;
        if(i===1)say("SAVED!");
      }
    }
    if(ball.lock<=0){
      for(const [i,player] of [[0,game.user],[1,game.cpu],[2,game.mate],[3,game.rival]]){
        if(distance(player,ball)<14&&ball.z<player.jump+12){
          ball.owner=i;ball.vx=ball.vy=ball.vz=ball.spin=0;ball.intendedTarget=null;
          if(player.jump>10)say("HEADER!");
          return;
        }
      }
    }
  };
  game.draw=ctx=>drawSoccer(ctx,game);
  reset();
  return game;
}
