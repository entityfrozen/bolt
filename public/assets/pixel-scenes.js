import {pixelText as text} from "./pixel-font.js?v=1";

const paint=(ctx,color,x,y,w,h)=>{
  ctx.fillStyle=color;
  ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));
};
const box=(ctx,color,x,y,w,h,edge="#1b1b1a")=>{
  paint(ctx,edge,x-1,y-1,w+2,h+2);
  paint(ctx,color,x,y,w,h);
};
const trace=(ctx,color,width,fn)=>{
  ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();fn(ctx);ctx.stroke();
};
const crowdColors=["#e4b789","#b1b7a4","#a6a1b2","#e4d0aa","#827a84"];
function crowd(ctx,upper=true){
  const top=upper?0:254;
  paint(ctx,"#161b20",0,top,480,16);
  for(let i=0;i<96;i++){
    const x=(i*37+17)%480,y=top+2+(i%3)*3;
    paint(ctx,crowdColors[i%5],x,y,3,3);
    paint(ctx,["#5b5867","#b06e62","#657d77","#997d5c"][i%4],x-1,y+3,5,4);
  }
  paint(ctx,"#514330",0,upper?14:253,480,2);
}
function ad(ctx,tag,x,y,width){
  paint(ctx,"#141b1b",x,y,width,11);
  paint(ctx,"#997953",x+2,y+2,3,7);
  text(ctx,tag,x+width/2,y+2,{size:1,color:"#d1d4b1",align:"center"});
}
function stadiumPitch(ctx){
  paint(ctx,"#141d19",0,0,480,270);
  crowd(ctx,true);crowd(ctx,false);
  // Turf wears differently in alternating mowing lanes.
  for(let n=0;n<16;n++){
    const x=16+n*28;
    paint(ctx,n%2?"#3e855e":"#397a58",x,16,28,238);
    for(let i=0;i<12;i++)
      paint(ctx,n%2?"#458e64":"#438760",x+((i*13)%26),22+i*18,2,3);
  }
  trace(ctx,"#e5ebcb",2,g=>{
    g.moveTo(18,19);g.lineTo(462,19);g.lineTo(462,251);
    g.lineTo(18,251);g.lineTo(18,19);
    g.moveTo(240,19);g.lineTo(240,251);
    g.arc(240,135,37,0,Math.PI*2);
    g.moveTo(18,84);g.lineTo(88,84);g.lineTo(88,186);g.lineTo(18,186);
    g.moveTo(462,84);g.lineTo(392,84);g.lineTo(392,186);g.lineTo(462,186);
  });
  trace(ctx,"#d9e7c8",1,g=>{
    g.moveTo(18,111);g.lineTo(46,111);g.lineTo(46,160);g.lineTo(18,160);
    g.moveTo(462,111);g.lineTo(434,111);g.lineTo(434,160);g.lineTo(462,160);
  });
  paint(ctx,"#d4e9c7",238,133,5,5);
  for(const [x,side] of [[5,1],[464,-1]]){
    paint(ctx,"#e8d8af",x,108,11,54);
    for(let y=110;y<160;y+=7)paint(ctx,"#718f88",x+1,y,9,1);
    for(let k=0;k<4;k++)paint(ctx,"#91aca5",x+3+k*2,108,1,54);
    paint(ctx,"#faf2d9",x+(side===1?10:0),108,2,54);
  }
  ad(ctx,"LIGHTNING",21,1,85);
  ad(ctx,"HOME END",372,1,81);
}
function soccerSprite(ctx,player,{shirt,trim,shorts,socks,hair="#3c2c25",number,selected=false}){
  const x=Math.round(player.x),y=Math.round(player.y),lift=player.jump||0;
  const bouncing=Math.floor(Math.sin((player.walk||0)*12)*2);
  const shadowW=lift>0?16:22;
  paint(ctx,"#182f2688",x-shadowW/2,y+10,shadowW,5);
  if(selected){
    paint(ctx,"#ffe8a0",x-4,y-26-lift*.35,8,3);
    paint(ctx,"#5b4326",x-1,y-22-lift*.35,2,3);
  }
  const sy=Math.round(y-lift*.35+bouncing);
  box(ctx,"#342820",x-7,sy-17,15,24);
  // Arms and skin are separate from the jersey so the pose reads clearly.
  paint(ctx,"#e7b388",x-10,sy-8,3,9);
  paint(ctx,"#e7b388",x+8,sy-8,3,9);
  if(player.tackle>0||player.fake>0){
    paint(ctx,"#e7b388",x+((player.dir||1)>0?9:-13),sy-2,8,3);
  }
  paint(ctx,shorts,x-6,sy+1,13,6);
  paint(ctx,shirt,x-7,sy-12,15,14);
  paint(ctx,trim,x-7,sy-12,15,3);
  paint(ctx,"#fff4d6",x-6,sy-8,2,7);
  paint(ctx,"#9e7646",x+4,sy-8,2,7);
  paint(ctx,"#e7b388",x-5,sy-19,10,8);
  paint(ctx,hair,x-5,sy-20,10,3);
  paint(ctx,socks,x-5,sy+6,4,5);
  paint(ctx,socks,x+2,sy+6,4,5);
  paint(ctx,"#252125",x-6,sy+10,5,3);
  paint(ctx,"#252125",x+2,sy+10,5,3);
  if(number!==undefined)text(ctx,String(number),x,sy-8,{size:1,color:"#332a26",align:"center"});
}
function soccerBall(ctx,ball){
  const height=ball.z||0;
  const x=Math.round(ball.x),ground=Math.round(ball.y);
  paint(ctx,"#20352888",x-6,ground+3,13,4);
  const y=Math.round(ground-height*.54);
  box(ctx,"#f9f3e4",x-5,y-5,10,10,"#283238");
  paint(ctx,"#323a3c",x-1,y-2,3,4);
  paint(ctx,"#323a3c",x-4,y+2,2,2);
  paint(ctx,"#323a3c",x+3,y-4,2,2);
  if(height>17)paint(ctx,"#fffbe5",x,y-13,2,2);
}
function soccerHud(ctx,game){
  // A quiet on-pitch line conveys who is in control without more giant panels.
  paint(ctx,"#141c19ea",166,19,148,14);
  const owner=game.ball.owner;
  const status=owner===0?"YOU":owner===2?"TEAMMATE":owner===1||owner===3?"AWAY":"LOOSE";
  text(ctx,"POSSESSION  "+status,240,23,{size:1,align:"center",color:owner===0||owner===2?"#f0d899":"#c8c2d7"});
  if(game.feedbackTime>0)
    text(ctx,game.feedback,240,45,{size:1,align:"center",color:"#fff2c9"});
  if(game.phase!=="play")eventPanel(ctx,
    game.phase==="countdown"?"KICK OFF":game.notice,
    game.over?"FINAL WHISTLE":game.phase==="countdown"?"GET READY":"BACK TO THE CENTRE");
}
function eventPanel(ctx,title,sub){
  paint(ctx,"#0e151af2",126,94,228,73);
  paint(ctx,"#d6af7c",127,94,226,3);
  text(ctx,title,240,110,{size:2,align:"center",color:"#f4d9a5"});
  text(ctx,sub,240,147,{size:1,align:"center",color:"#d0c8b2"});
}
export function drawSoccer(ctx,game){
  ctx.imageSmoothingEnabled=false;
  stadiumPitch(ctx);
  soccerSprite(ctx,game.keeper[0],{shirt:"#ead18e",trim:"#f5e8ba",shorts:"#6a5d43",socks:"#f2dd9c",number:1});
  soccerSprite(ctx,game.keeper[1],{shirt:"#adaac9",trim:"#d6d5e0",shorts:"#5d5470",socks:"#b2aecf",number:1});
  soccerSprite(ctx,game.rival,{shirt:"#b89ab7",trim:"#f7c7e7",shorts:"#5e4566",socks:"#f2e6f2",number:4});
  soccerSprite(ctx,game.cpu,{shirt:"#b89ab7",trim:"#f7c7e7",shorts:"#5e4566",socks:"#f2e6f2",number:7});
  soccerSprite(ctx,game.mate,{shirt:"#e2b577",trim:"#f6e7b1",shorts:"#6b4a2f",socks:"#f2d6ab",number:10});
  soccerSprite(ctx,game.user,{shirt:"#e2b577",trim:"#f6e7b1",shorts:"#6b4a2f",socks:"#f2d6ab",number:9,selected:true});
  soccerBall(ctx,game.ball);
  soccerHud(ctx,game);
}

function basketballArena(ctx){
  paint(ctx,"#131a22",0,0,480,270);
  for(let row=0;row<6;row++){
    paint(ctx,row%2?"#27303a":"#30343c",0,row*17,480,17);
    for(let n=0;n<37;n++){
      const x=(n*19+row*7)%480,y=row*17+2;
      paint(ctx,crowdColors[(row+n)%5],x,y,5,6);
      paint(ctx,["#58717a","#b86e63","#958a64","#6a587b"][n%4],x-1,y+6,7,7);
    }
  }
  paint(ctx,"#d2a05d",0,102,480,3);
  paint(ctx,"#263038",0,105,480,12);
  ad(ctx,"LIGHTNING",18,106,89);
  ad(ctx,"HOME COURT",370,106,95);
  for(let n=0;n<20;n++){
    paint(ctx,n%2?"#c3945f":"#b78453",n*24,117,24,111);
    paint(ctx,"#9f734c",n*24,117,1,111);
    for(let row=0;row<4;row++)
      paint(ctx,"#d8ad7b",n*24+4+row*3,135+row*20,7,1);
  }
  trace(ctx,"#efdaad",2,g=>{
    g.moveTo(240,117);g.lineTo(240,226);
    g.arc(240,226,43,Math.PI,0);
    g.moveTo(14,153);g.lineTo(111,153);g.lineTo(111,227);
    g.moveTo(466,153);g.lineTo(369,153);g.lineTo(369,227);
    g.arc(60,224,82,Math.PI*1.05,Math.PI*1.94);
    g.arc(420,224,82,Math.PI*1.05,Math.PI*1.94);
  });
  paint(ctx,"#453427",0,226,480,3);
  paint(ctx,"#171c22",0,229,480,41);
  for(let i=0;i<13;i++)paint(ctx,"#665743",i*40,236,25,2);
}
function basket(ctx,x,side){
  const mount=x+side*25;
  box(ctx,"#b8b8a4",mount-4,88,8,136,"#5a5c60");
  paint(ctx,"#faf0d5",mount-12,81,19,37);
  paint(ctx,"#486b71",mount-9,86,13,27);
  paint(ctx,"#edf1da",mount-6,90,8,19);
  paint(ctx,"#d98d53",x-12,121,24,4);
  paint(ctx,"#9e492d",x-13,122,26,2);
  for(let n=0;n<6;n++){
    paint(ctx,"#fff0d6",x-10+n*4,126,1,17);
  }
  paint(ctx,"#e7d9c3",x-7,142,15,2);
}
function basketballSprite(ctx,player,shirt,shorts,number,clock,selected=false){
  const x=Math.round(player.x),floor=Math.round(222-player.jump);
  const running=Math.abs(player.vx)>16;
  const gait=running?Math.round(Math.sin(clock*15)*3):0;
  paint(ctx,"#34241a77",x-15,224,31,4);
  if(selected){paint(ctx,"#ffe0a0",x-6,floor-46,13,3);}
  const lean=player.crossover>0?player.face*5:player.stumble>0?-player.face*3:0;
  const sy=floor-28;
  box(ctx,"#33261e",x-8+lean,sy-3,17,27);
  paint(ctx,"#e6b28b",x-5+lean,sy-8,11,9);
  paint(ctx,"#3b3027",x-5+lean,sy-10,11,4);
  paint(ctx,shirt,x-8+lean,sy+1,17,14);
  paint(ctx,"#eee4bf",x-8+lean,sy+1,17,2);
  paint(ctx,shorts,x-8+lean,sy+15,17,7);
  paint(ctx,"#d39b73",x-12+lean,sy+2,4,13);
  paint(ctx,"#d39b73",x+9+lean,sy+2,4,13);
  if(player.steal>0){
    const side=player.face||1;
    paint(ctx,"#f5c498",x+lean+side*12,sy+6,14,4);
    paint(ctx,"#fff3cc",x+lean+side*24,sy+5,3,4);
  }
  if(player.crossover>0)paint(ctx,"#fee1a7",x-12+lean,sy+18,9,3);
  paint(ctx,"#f1e6cb",x-6,sy+22,5,10+gait);
  paint(ctx,"#f1e6cb",x+2,sy+22,5,10-gait);
  paint(ctx,"#372a26",x-8,sy+31+gait,8,3);
  paint(ctx,"#372a26",x+2,sy+31-gait,8,3);
  text(ctx,String(number),x+lean,sy+6,{size:1,color:"#422b1e",align:"center"});
}
function basketballBall(ctx,game){
  const b=game.ball;
  const x=Math.round(b.x),y=Math.round(b.y);
  if(b.owner===-1&&Math.abs(b.vx)>30)
    paint(ctx,"#b9765080",x-b.vx*.04-4,y-b.vy*.04-3,8,7);
  box(ctx,"#e9954f",x-5,y-5,11,11,"#603c29");
  paint(ctx,"#7d4b2b",x-1,y-5,2,11);
  paint(ctx,"#7d4b2b",x-5,y-1,11,2);
  paint(ctx,"#fed49b",x-4,y-4,2,2);
}
export function drawBasketball(ctx,game){
  ctx.imageSmoothingEnabled=false;
  basketballArena(ctx);
  basket(ctx,60,-1);basket(ctx,420,1);
  basketballSprite(ctx,game.cpu,"#a8a3c7","#534c75",8,game.clock);
  basketballSprite(ctx,game.user,"#e7b779","#7b4b2c",11,game.clock,true);
  basketballBall(ctx,game);
  paint(ctx,"#17222aea",172,117,136,13);
  text(ctx,game.ball.owner===0?"HOME BALL":game.ball.owner===1?"AWAY BALL":"LOOSE BALL",240,120,
    {size:1,color:game.ball.owner===0?"#f7d49d":"#c8c0d4",align:"center"});
  if(game.feedbackTime>0)text(ctx,game.feedback,240,45,{size:1,align:"center",color:"#ffe0a1"});
  if(game.phase!=="play")eventPanel(ctx,game.phase==="countdown"?"TIP OFF":game.notice,
    game.over?"FINAL SCORE":game.phase==="countdown"?"GET READY":"NEXT POSSESSION");
}
