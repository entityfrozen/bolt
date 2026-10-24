import test from "node:test";
import assert from "node:assert/strict";
import {createSoccer} from "../public/assets/pixel-soccer.js";
import {createBasketball} from "../public/assets/pixel-basketball.js";

const keys=new Set();

test("Pixel Soccer moves, shoots, tackles and awards goals",()=>{
 const g=createSoccer({difficulty:"normal"});
 assert.equal(g.score[0],0);
 g.phase="play";g.time=100;
 const x=g.user.x;
 g.tick(.03,new Set(["d"]));
 assert.ok(g.user.x>x);
 Object.assign(g.ball,{x:g.user.x+8,y:g.user.y,vx:0,vy:0,owner:0,lock:0});
 g.action("space");
 assert.equal(g.ball.owner,-1);
 assert.ok(g.ball.vx>0,"a human player attacks the right-hand goal");
 g.cooldown=0;
 Object.assign(g.ball,{x:465,y:135,vx:210,vy:0,owner:-1,lock:1});
 g.tick(.035,keys);
 assert.equal(g.score[0],1);
 assert.equal(g.phase,"goal");
});

test("Pixel Soccer stops the clock at full time",()=>{
 const g=createSoccer();
 g.phase="play";g.time=.005;g.tick(.03,keys);
 assert.equal(g.over,true);
 assert.equal(g.time,0);
});

test("Pixel Basketball scores an actual arc into the opposite rim",()=>{
 const game=createBasketball({difficulty:"easy"});
 game.phase="play";game.time=110;
 assert.equal(game.ball.owner,0);
 game.action("space");
 assert.equal(game.ball.owner,-1);
 assert.ok(game.ball.vy<0,"shot must rise before descending");
 let ticks=0;
 while(!game.over&&game.score[0]===0&&ticks<400){
   game.tick(1/120,keys);ticks++;
 }
 assert.ok(game.score[0]>=2,"shot should pass through the right hoop");
 assert.equal(game.phase,"score");
});

test("Pixel Basketball supports running and jumping",()=>{
 const game=createBasketball();
 game.phase="play";
 const start=game.user.x;
 game.tick(.03,new Set(["d","w"]));
 assert.ok(game.user.x>start);
 assert.ok(game.user.jump>0);
});

test("Both pixel games provide a canvas renderer",()=>{
 const fake={fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},arc(){},strokeRect(){},fillText(){},get imageSmoothingEnabled(){return false},set imageSmoothingEnabled(value){}};
 for(const game of [createSoccer(),createBasketball()]){
   assert.doesNotThrow(()=>game.draw(fake));
   assert.equal(game.score.length,2);
 }
});


test("Basketball green window shrinks as distance increases",()=>{
  const game=createBasketball();
  game.user.x=365;
  const near=game.shotWindow(),nearWidth=near.end-near.start;
  game.user.x=55;
  const deep=game.shotWindow();
  assert.ok(deep.end-deep.start<nearWidth);
});

test("Basketball X hold then release controls the shot chance",()=>{
  const make=createBasketball({random:()=>.99});
  make.phase="play";
  make.press("x");
  assert.equal(make.shot.active,true);
  for(let i=0;i<180&&make.shot.progress<make.shot.greenStart;i++)make.tick(1/120,keys);
  assert.ok(make.shot.progress>=make.shot.greenStart);
  make.release("x");
  assert.equal(make.shot.active,false);
  assert.equal(make.ball.owner,-1);
  assert.equal(make.ball.make,true,"green is guaranteed when not blocked");

  const miss=createBasketball({random:()=>.99});
  miss.phase="play";
  miss.press("x");
  for(let i=0;i<26;i++)miss.tick(1/120,keys);
  const q=miss.shot.quality;
  assert.ok(q<1&&q>0,"an early non-green release still has a chance");
  miss.release("x");
  assert.equal(miss.ball.make,false,"non-green outcome uses the probability roll");
});

test("Basketball steal has a reach frame and recovery on a miss",()=>{
  const game=createBasketball();
  game.phase="play";
  game.cpu.x=400;game.action("z");
  assert.ok(game.user.steal>0);
  assert.ok(game.user.stumble>0);
  assert.equal(game.ball.owner,0);
});

test("Soccer fake cancels the meter and slows the defender",()=>{
  const game=createSoccer();
  game.phase="play";
  game.press("x");
  game.tick(.03,keys);
  game.fake();
  assert.equal(game.shot.active,false);
  assert.equal(game.ball.owner,0,"a fake keeps possession");
  assert.ok(game.cpu.hesitate>0);
});

test("Soccer chip uses height, curve alters flight, jump counters high balls",()=>{
  const game=createSoccer({random:()=>.5});
  game.phase="play";
  game.press("x");
  game.action("c");
  assert.equal(game.shot.lob,true);
  for(let i=0;i<55;i++)game.tick(1/120,new Set(["d"]));
  assert.ok(game.shot.curve>0);
  game.release("x");
  assert.ok(game.ball.vz>100,"chip creates an airborne ball");
  assert.ok(game.ball.spin>0,"directional input adds bend");
  const y=game.ball.y;
  for(let i=0;i<5;i++)game.tick(.03,keys);
  assert.ok(game.ball.z>0&&game.ball.y!==y,"curve changes lateral velocity over multiple steps");
  game.action("c");
  assert.ok(game.user.jump>0||game.user.vz>0);
});

test("Soccer sprint consumes stamina and later recovers",()=>{
  const game=createSoccer();
  game.phase="play";
  for(let i=0;i<100;i++)game.tick(.02,new Set(["d","shift"]));
  assert.ok(game.user.sprint<100);
  const low=game.user.sprint;
  for(let i=0;i<50;i++)game.tick(.02,keys);
  assert.ok(game.user.sprint>low);
});


test("Basketball defender can force a turnover and the ball becomes loose",()=>{
  const game=createBasketball({random:()=>0});
  game.phase="play";game.cpu.x=game.user.x+18;
  game.cpu.defenseCooldown=0;
  game.tick(.03,keys);
  assert.equal(game.ball.owner,-1);
  assert.equal(game.turnovers,1);
  assert.equal(game.feedback,"STRIPPED!");
});

test("Basketball crossover creates space and stuns a nearby defender",()=>{
  const game=createBasketball({random:()=>0});
  game.phase="play";game.cpu.x=game.user.x+31;
  const oldX=game.user.x;
  game.action("c");
  assert.ok(game.user.x>oldX);
  assert.ok(game.cpu.stumble>0);
  assert.equal(game.ball.owner,0);
  assert.ok(game.crossoverCooldown>0);
});

test("Soccer now has a teammate, a second defender and passing",()=>{
  const game=createSoccer({random:()=>.99});
  game.phase="play";
  assert.ok(game.mate&&game.rival);
  game.cpu.x=430;game.cpu.y=40;
  game.rival.x=420;game.rival.y=40;
  game.action("v");
  assert.equal(game.ball.owner,-1);
  assert.equal(game.ball.intendedTarget,2);
  assert.equal(game.feedback,"PASS");
});

test("Soccer defenders challenge possession instead of only following it",()=>{
  const game=createSoccer({random:()=>0});
  game.phase="play";
  game.cpu.x=game.user.x+12;game.cpu.y=game.user.y;
  game.cpu.stealCooldown=0;
  game.rival.x=450;game.rival.y=220;
  game.tick(.03,keys);
  assert.equal(game.ball.owner,-1);
  assert.equal(game.feedback,"TACKLED!");
});

test("Pixel scenes use crisp custom bitmap lettering",()=>{
  const calls=[];
  const fake={fillRect(...args){calls.push(args)},beginPath(){},moveTo(){},lineTo(){},stroke(){},arc(){},strokeRect(){},fillText(){throw Error("Canvas text should not blur pixel labels")}};
  for(const game of [createSoccer(),createBasketball()]){
    game.phase="play";
    game.draw(fake);
  }
  assert.ok(calls.length>500,"full pixel scene should be drawn in pixel primitives");
});
