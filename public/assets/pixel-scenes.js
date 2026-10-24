// The courts are painted at the game's native resolution. The UI scales the
// canvas up with nearest-neighbor filtering, so there are no blurry pixels.

function tile(ctx, color, x, y, width, height) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
}

function caption(ctx, words, x, y, size = 9, color = "#f0ddba") {
  ctx.fillStyle = color;
  ctx.font = "bold " + size + "px monospace";
  ctx.textAlign = "center";
  ctx.fillText(words, x, y);
}

function pitchLine(ctx, draw) {
  ctx.strokeStyle = "#dce8c8";
  ctx.lineWidth = 2;
  ctx.beginPath();
  draw(ctx);
  ctx.stroke();
}

function soccerPlayer(ctx, player, shirt, shorts, number) {
  const x = Math.round(player.x);
  const y = Math.round(player.y);
  tile(ctx, "#071e1977", x-10, y+10, 22, 4);
  tile(ctx, "#e3ab87", x-4, y-17, 9, 8);
  tile(ctx, "#443126", x-4, y-19, 9, 3);
  tile(ctx, shirt, x-7, y-10, 15, 13);
  tile(ctx, shorts, x-6, y+3, 13, 5);
  tile(ctx, "#e3ab87", x-10, y-8, 3, 8);
  tile(ctx, "#e3ab87", x+8, y-8, 3, 8);
  tile(ctx, "#272522", x-5, y+8, 4, 5);
  tile(ctx, "#272522", x+3, y+8, 4, 5);
  caption(ctx, String(number), x, y+1, 7, "#291f16");
}

function soccerPitch(ctx) {
  tile(ctx, "#211d15", 0, 0, 480, 270);
  for (let i=0; i<16; i++) {
    tile(ctx, i%2 ? "#2e7955" : "#34714e", 16+i*28, 18, 28, 234);
  }
  for (let i=0; i<80; i++) {
    const x = (i*29)%480;
    tile(ctx, ["#d5b986","#8e856f","#b2a08c"][i%3], x, i%2?7:260, 4, 3);
  }

  pitchLine(ctx, g => {
    g.moveTo(18,18); g.lineTo(462,18); g.lineTo(462,250);
    g.lineTo(18,250); g.lineTo(18,18);
    g.moveTo(240,18); g.lineTo(240,250);
    g.arc(240,134,37,0,Math.PI*2);
    g.moveTo(18,87); g.lineTo(88,87); g.lineTo(88,181); g.lineTo(18,181);
    g.moveTo(462,87); g.lineTo(392,87); g.lineTo(392,181); g.lineTo(462,181);
  });

  tile(ctx,"#eee7d1",6,109,12,52);
  tile(ctx,"#eee7d1",462,109,12,52);
  for (let y=112; y<160; y+=8) {
    tile(ctx, "#94a8a2", 7,y,10,1);
    tile(ctx, "#94a8a2", 463,y,10,1);
  }
}

function basketballPlayer(ctx, player, shirt, shorts, number, time) {
  const x = Math.round(player.x);
  const foot = Math.round(222-player.jump);
  const run = Math.round(Math.sin(time*12)*Math.min(2,Math.abs(player.vx)/60));
  tile(ctx, "#352a1f99",x-12,224,25,3);
  tile(ctx, "#dca27c",x-5,foot-30,11,8);
  tile(ctx, "#372820",x-5,foot-32,11,3);
  tile(ctx, shirt,x-7,foot-22,15,13);
  tile(ctx, shorts,x-7,foot-9,15,5);
  tile(ctx, "#dca27c",x-11,foot-21,4,12);
  tile(ctx, "#dca27c",x+8,foot-21,4,12);
  tile(ctx, "#ece0ce",x-5,foot-4,4,6+run);
  tile(ctx, "#ece0ce",x+2,foot-4,4,6-run);
  tile(ctx, "#3a2d21",x-5,foot+1+run,6,2);
  tile(ctx, "#3a2d21",x+2,foot+1-run,6,2);
  caption(ctx, String(number),x,foot-12,8,"#312217");
}

function hoop(ctx, x, side) {
  const post = x+side*20;
  tile(ctx, "#a8a99c",post-4,94,8,130);
  tile(ctx, "#e2d3af",post+side*-8-6,84,13,32);
  tile(ctx, "#566c70",post+side*-8-4,89,9,20);
  tile(ctx, "#cf8b51",x-12,121,24,4);
  for (let n=0;n<5;n++) tile(ctx,"#e9e5d7",x-10+n*5,126,1,17);
  tile(ctx,"#e9e5d7",x-6,142,13,2);
}

function basketballCourt(ctx) {
  tile(ctx, "#201d1a",0,0,480,270);
  for (let row=0;row<5;row++) {
    tile(ctx,row%2?"#2a2724":"#352f29",0,row*20,480,19);
    for (let n=0;n<32;n++) {
      const x=(n*17+row*8)%480;
      tile(ctx,["#bb9b7a","#c2baa8","#9f8b75","#c9a874"][n%4],x,row*20+6,5,6);
      tile(ctx,"#63574e",x-1,row*20+12,7,5);
    }
  }
  tile(ctx,"#5d4d3e",0,101,480,16);
  for(let i=0;i<18;i++){
    tile(ctx,i%2?"#bd8955":"#c79660",i*28,117,28,111);
    tile(ctx,"#aa7647",i*28,117,1,111);
  }
  tile(ctx,"#362b22",0,228,480,42);
  pitchLine(ctx,g=>{
    g.moveTo(240,117);g.lineTo(240,227);
    g.arc(240,227,43,Math.PI,0);
    g.moveTo(8,157);g.lineTo(113,157);g.lineTo(113,226);
    g.moveTo(472,157);g.lineTo(367,157);g.lineTo(367,226);
  });
  hoop(ctx,60,-1);
  hoop(ctx,420,1);
}

function ball(ctx,x,y,basketball) {
  const X=Math.round(x), Y=Math.round(y);
  tile(ctx,"#2b201b",X-5,Y-5,11,11);
  tile(ctx,basketball?"#e5a15a":"#f0ede1",X-5,Y-5,10,10);
  tile(ctx,basketball?"#805130":"#33352f",X-1,Y-5,2,10);
  tile(ctx,basketball?"#805130":"#33352f",X-5,Y-1,10,2);
  tile(ctx,basketball?"#f6cf88":"#f7f7df",X-4,Y-4,2,2);
}

function eventPanel(ctx, title, subtitle) {
  tile(ctx,"#191811",128,93,224,71);
  tile(ctx,"#c1a06e",129,93,222,2);
  caption(ctx,title,240,126,18,"#ecd4a9");
  caption(ctx,subtitle,240,146,9,"#b6a88f");
}

export function drawSoccer(ctx, state) {
  ctx.imageSmoothingEnabled=false;
  soccerPitch(ctx);
  soccerPlayer(ctx,state.keeper[0],"#efd599","#60563e",1);
  soccerPlayer(ctx,state.keeper[1],"#cec0ce","#645364",1);
  // Animated fake and tackle frames are drawn separately from possession.
  if(state.user.fake>0){
    tile(ctx,"#efcc93",state.user.x+state.user.dir*12-3,state.user.y+6,13,3);
    caption(ctx,"FAKE",state.user.x,state.user.y-24,8,"#f6d7a3");
  }
  if(state.user.tackle>0)tile(ctx,"#f4c789",state.user.x+state.user.dir*10,state.user.y+4,14,4);
  soccerPlayer(ctx,state.cpu,"#b0a4c6","#574e6d",7);
  soccerPlayer(ctx,state.user,"#e2ad6a","#60472c",9);
  if(state.ball.z>0){
    tile(ctx,"#12281987",state.ball.x-6,state.ball.y+1,13,4);
    ball(ctx,state.ball.x,state.ball.y-state.ball.z*.52,false);
    if(state.ball.z>14)caption(ctx,"LOB",state.ball.x,state.ball.y-state.ball.z*.52-10,7,"#f3d8a5");
  }else ball(ctx,state.ball.x,state.ball.y,false);
  if(state.user.jump>0)caption(ctx,"JUMP",state.user.x,state.user.y-state.user.jump*.4-21,7,"#f3e4b6");
  if(state.feedbackTime>0&&state.feedback)
    caption(ctx,state.feedback,240,47,10,"#ffe2a0");
  if(state.phase!=="play"){
    const line=state.over?"FINAL SCORE":state.phase==="goal"?"NEXT KICK OFF":"STARTS IN "+Math.max(1,Math.ceil(state.countdown));
    eventPanel(ctx,state.over||state.phase==="goal"?state.notice:"KICK OFF",line);
  }
}

export function drawBasketball(ctx, state) {
  ctx.imageSmoothingEnabled=false;
  basketballCourt(ctx);
  if(state.user.steal>0){
    const reach=state.user.face*19;
    tile(ctx,"#f1c79d",state.user.x+reach-3,203-state.user.jump,14,4);
    tile(ctx,"#f8deab",state.user.x+reach+8,203-state.user.jump,4,4);
  }
  if(state.user.stumble>0)
    caption(ctx,"RECOVER",state.user.x,170-state.user.jump,8,"#f7bf9c");
  basketballPlayer(ctx,state.cpu,"#a9a0bc","#655978",8,state.clock);
  basketballPlayer(ctx,state.user,"#e2b174","#815732",11,state.clock);
  // Motion echoes make the ball path and live dribble easier to follow.
  if(state.ball.owner===-1){
    tile(ctx,"#8f5c3788",state.ball.x-state.ball.vx*.025-3,state.ball.y-state.ball.vy*.025-3,6,6);
  }
  ball(ctx,state.ball.x,state.ball.y,true);
  if(state.feedbackTime>0&&state.feedback)
    caption(ctx,state.feedback,240,54,10,"#ffe0a0");
  if(state.phase!=="play"){
    const line=state.over?"FINAL SCORE":state.phase==="score"?"NEXT POSSESSION":"STARTS IN "+Math.max(1,Math.ceil(state.countdown));
    eventPanel(ctx,state.over||state.phase==="score"?state.notice:"TIP OFF",line);
  }
}
