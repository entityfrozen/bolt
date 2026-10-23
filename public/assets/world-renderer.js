
/* Canvas layers are built when the map changes, never on mouse movement.
   The active view uses cheap image blits, so dragging and zooming stay smooth. */
function atlasPath(ctx, features, scale) {
  ctx.beginPath();
  for(const feature of features){
    const g=feature.geometry;
    if(!g)continue;
    const polys=g.type==="Polygon"?[g.coordinates]:g.type==="MultiPolygon"?g.coordinates:[];
    for(const poly of polys)for(const ring of poly){
      let previous=null;
      for(const point of ring){
        const x=(point[0]+180)*4*scale,y=(90-point[1])*4*scale;
        if(!previous||Math.abs(x-previous[0])>700*scale)ctx.moveTo(x,y);
        else ctx.lineTo(x,y);
        previous=[x,y];
      }
      if(previous)ctx.closePath();
    }
  }
}
function atlasBase(geometry){
  // Pre-render high-resolution vector geography once per session.
  const canvas=document.createElement("canvas");
  const width=window.innerWidth>1000?2304:1536;
  canvas.width=width;canvas.height=width/2;
  const ctx=canvas.getContext("2d",{alpha:false});
  const scale=width/1440;
  const sea=ctx.createLinearGradient(0,0,0,canvas.height);
  sea.addColorStop(0,"#276080");sea.addColorStop(.55,"#336c84");sea.addColorStop(1,"#21526e");
  ctx.fillStyle=sea;ctx.fillRect(0,0,width,canvas.height);
  ctx.lineWidth=.3*scale;ctx.strokeStyle="#c8dadd17";
  for(let y=0;y<=720;y+=30){ctx.beginPath();ctx.moveTo(0,y*scale);ctx.lineTo(width,y*scale);ctx.stroke()}
  for(let x=0;x<=1440;x+=40){ctx.beginPath();ctx.moveTo(x*scale,0);ctx.lineTo(x*scale,canvas.height);ctx.stroke()}
  if(geometry?.features){
    atlasPath(ctx,geometry.features,scale);
    ctx.fillStyle="#b5bc91";ctx.fill("evenodd");
    ctx.lineWidth=.9*scale;ctx.strokeStyle="#decd9e";ctx.stroke();
    for(const feature of geometry.features){
      atlasPath(ctx,[feature],scale);
      ctx.lineWidth=.48*scale;ctx.strokeStyle="#536f65b0";ctx.stroke();
    }
  }
  return canvas;
}
function color(hex){
  const match=/^#([a-f0-9]{6})$/i.exec(hex||"");
  if(!match)return [207,152,103];
  const v=parseInt(match[1],16);
  return [(v>>16)&255,(v>>8)&255,v&255];
}
function ownershipOverlay(w){
  const overlay=document.createElement("canvas");
  overlay.width=w.width;overlay.height=w.height;
  const ctx=overlay.getContext("2d");
  const data=ctx.createImageData(w.width,w.height);
  const palette=new Map(w.players.map(p=>[p.id,color(p.color)]));
  for(let i=0;i<w.cells.length;i++){
    const rgb=palette.get(w.cells[i]);if(!rgb)continue;
    const offset=i*4;
    data.data[offset]=rgb[0];data.data[offset+1]=rgb[1];
    data.data[offset+2]=rgb[2];data.data[offset+3]=224;
  }
  ctx.putImageData(data,0,0);
  const centers=new Map(w.players.map(p=>[p.id,{x:0,y:0,n:0}]));
  for(let i=0;i<w.cells.length;i++){
    const c=centers.get(w.cells[i]);if(!c)continue;
    c.x+=(i%w.width+.5)*1440/w.width;
    c.y+=((i/w.width|0)+.5)*720/w.height;c.n++;
  }
  return {canvas:overlay,centers};
}
export function installWorldRenderer(Hub){
  Hub.prototype.draw=function(){
    if(this.worldDrawPending)return;
    this.worldDrawPending=requestAnimationFrame(()=>{
      this.worldDrawPending=null;
      this.renderWorldFrame();
    });
  };
  Hub.prototype.renderWorldFrame=function(){
    const canvas=this.$("#hubWorldCanvas"),w=this.world;
    if(!canvas||!w||this.view!=="world")return;
    const rect=canvas.getBoundingClientRect();
    if(rect.width<1||rect.height<1)return;
    const dpr=Math.min(window.devicePixelRatio||1,2);
    const pw=Math.max(1,Math.round(rect.width*dpr)),ph=Math.max(1,Math.round(rect.height*dpr));
    if(canvas.width!==pw||canvas.height!==ph){canvas.width=pw;canvas.height=ph}
    if(!this.worldBase||this.worldBaseGeometry!==this.worldGeometry){
      this.worldBase=atlasBase(this.worldGeometry);
      this.worldBaseGeometry=this.worldGeometry;
    }
    if(!this.worldTerritories||this.worldTerritoriesData!==w){
      this.worldTerritories=ownershipOverlay(w);
      this.worldTerritoriesData=w;
    }
    const ctx=canvas.getContext("2d",{alpha:false});
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.fillStyle="#234f66";ctx.fillRect(0,0,rect.width,rect.height);
    this.clampCamera();
    const scale=this.mapFit()*this.camera.zoom;
    const ox=rect.width/2+this.camera.x,oy=rect.height/2+this.camera.y;
    ctx.translate(ox,oy);ctx.scale(scale,scale);ctx.translate(-720,-360);
    ctx.imageSmoothingEnabled=true;
    ctx.drawImage(this.worldBase,0,0,1440,720);
    // The game grid stays fixed while the underlying atlas remains detailed.
    ctx.drawImage(this.worldTerritories.canvas,0,0,1440,720);
    if(this.tile){
      const tw=1440/w.width,th=720/w.height;
      ctx.strokeStyle="#fff6bc";ctx.lineWidth=Math.max(.5,1.9/scale);
      ctx.strokeRect(this.tile.x*tw+.16,this.tile.y*th+.16,tw-.32,th-.32);
    }
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.font="750 11px system-ui";ctx.textAlign="center";ctx.lineWidth=3;
    for(const p of w.players){
      const center=this.worldTerritories.centers.get(p.id);
      if(!center?.n)continue;
      const x=ox+(center.x/center.n-720)*scale,y=oy+(center.y/center.n-360)*scale;
      if(x<0||y<0||x>rect.width||y>rect.height)continue;
      ctx.strokeStyle="#112e38";ctx.strokeText(p.name,x,y);
      ctx.fillStyle="#fff4db";ctx.fillText(p.name,x,y);
    }
    if(Array.isArray(w.attacks)){
      // One small icon per campaign; no per-tick thousand-tile animations.
      ctx.font="bold 12px system-ui";ctx.textAlign="center";
      for(const attack of w.attacks){
        const tx=attack.target%w.width,ty=Math.floor(attack.target/w.width);
        const x=ox+((tx+.5)*1440/w.width-720)*scale;
        const y=oy+((ty+.5)*720/w.height-360)*scale;
        if(x<0||y<0||x>rect.width||y>rect.height)continue;
        ctx.fillStyle="#f9dc92";ctx.strokeStyle="#122b31";ctx.lineWidth=3;
        ctx.strokeText("⚔",x,y);ctx.fillText("⚔",x,y);
      }
    }
    const zoom=this.$("#hubZoom");
    if(zoom)zoom.textContent=Math.round(this.camera.zoom*100)+"%";
  };
}
