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
