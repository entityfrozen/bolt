
/* Lightning game surfaces. The server remains authoritative for every move. */
const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const icons = {K:"♔",Q:"♕",R:"♖",B:"♗",N:"♘",P:"♙",k:"♚",q:"♛",r:"♜",b:"♝",n:"♞",p:"♟"};
const timeAgo = tick => tick ? "DAY " + tick : "DAY 0";
function polygonPath(ctx, features) {
  ctx.beginPath();
  for(const f of features){
    const geometry=f.geometry || {};
    const polygons=geometry.type==="Polygon" ? [geometry.coordinates] : geometry.type==="MultiPolygon" ? geometry.coordinates : [];
    for(const poly of polygons)for(const ring of poly){
      let prev=null;
      for(const coord of ring){
        const x=(coord[0]+180)*4, y=(90-coord[1])*4;
        if(!prev || Math.abs(x-prev[0])>720)ctx.moveTo(x,y);
        else ctx.lineTo(x,y);
        prev=[x,y];
      }
      if(prev)ctx.closePath();
    }
  }
}
function drawBackground(ctx,width=1440,height=720){
  ctx.fillStyle="#1b4356";ctx.fillRect(0,0,width,height);
  const bg=ctx.createLinearGradient(0,0,0,height);
  bg.addColorStop(0,"#204b60");bg.addColorStop(.52,"#214e62");bg.addColorStop(1,"#13384d");
  ctx.fillStyle=bg;ctx.fillRect(0,0,width,height);
  ctx.lineWidth=.5;ctx.strokeStyle="#d2eaeb12";
  for(let x=0;x<=width;x+=120){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,height);ctx.stroke()}
  for(let y=0;y<=height;y+=120){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(width,y);ctx.stroke()}
}
function getRoute(w,me,tile,regions){
  if(!me||!tile)return {name:"Select a region",allowed:false};
  const x=tile.x,y=tile.y,W=w.width,H=w.height,idx=y*W+x;
  const owner=w.cells[idx];
  if(owner===-1)return {name:"Open water",allowed:false};
  if(owner===me.id)return {name:"Your territory",allowed:false};
  if(me.allies && me.allies.includes(owner))return {name:"Allied territory",allowed:false};
  if(!regions)return {name:"Checking route",allowed:false};
  const component=regions[idx],native=new Set(),nearWater=n=> {
    const cx=n%W,cy=Math.floor(n/W);
    return (cx>0&&w.cells[n-1]===-1)||(cx<W-1&&w.cells[n+1]===-1)||(cy>0&&w.cells[n-W]===-1)||(cy<H-1&&w.cells[n+W]===-1);
  };
  let coast=false;
  for(let n=0;n<w.cells.length;n++)if(w.cells[n]===me.id){native.add(regions[n]);if(nearWater(n))coast=true}
  if(native.has(component))return {name:"Land campaign",allowed:true,mode:"land",coast};
  if(coast&&nearWater(idx))return {name:"Naval landing",allowed:true,mode:"naval",coast};
  return {name:coast?"Target has no landing coast":"No coastal access",allowed:false,coast};
}
function countryRegions(w){
  const size=w.width*w.height,r=new Int32Array(size).fill(-1),W=w.width,H=w.height;
  let id=0;
  for(let i=0;i<size;i++){
    if(w.cells[i]===-1||r[i]!==-1)continue;
    r[i]=id;
    const stack=[i];
    for(let q=0;q<stack.length;q++){
      const n=stack[q],x=n%W,y=(n/W)|0;
      const next=[x>0?n-1:-1,x<W-1?n+1:-1,y>0?n-W:-1,y<H-1?n+W:-1];
      for(const a of next)if(a>=0&&w.cells[a]!==-1&&r[a]===-1){r[a]=id;stack.push(a)}
    }
    id++;
  }
  return r;
}
async function ensureGeography(hub){
  if(hub.worldGeometry) return hub.worldGeometry;
  if(!hub.geometryRequest)hub.geometryRequest=fetch("/assets/world-geography.json").then(r=>r.ok?r.json():null).then(g=>{
    hub.worldGeometry=g;
    hub.worldSurface=null;
    if(hub.view==="world") {hub.draw();hub.drawLobbyMap();}
    return g;
  }).catch(()=>null);
  return hub.geometryRequest;
}
export function installArenaPolish(Hub){
  const oldAct=Hub.prototype.act;
  const oldShow=Hub.prototype.show;
  const oldClose=Hub.prototype.close;
  const oldOnMessage=Hub.prototype.onMessage;
  Hub.prototype.show=function(page,channel){
    oldShow.call(this,page,channel);
    if(page==="world"&&this.socket?.readyState===WebSocket.OPEN)this.send({type:"worldSync"});
    if(page==="chess"&&this.chess?.id&&this.socket?.readyState===WebSocket.OPEN)this.send({type:"chessSync",id:this.chess.id});
  };
  Hub.prototype.close=function(){
    clearInterval(this.worldQueueInterval);this.worldQueueInterval=null;
    oldClose.call(this);
  };
  Hub.prototype.onMessage=function(message){
    if(message.type==="chessState"||message.type==="chessStart"){this.chessPending=false;this.chessError="";}
    if(message.type==="error"&&this.chessPending){this.chessPending=false;this.chessError=message.message||"Move rejected";if(this.view==="chess")this.chessScreen();}
    if(message.type==="worldQueueCancelled")this.worldQueueing=false;
    oldOnMessage.call(this,message);
  };
  Hub.prototype.drawLobbyMap=function(){
    const canvas=this.$("#worldLobbyMap");
    if(!canvas||!this.worldGeometry?.features)return;
    const r=canvas.getBoundingClientRect();
    if(!r.width||!r.height)return;
    const dpr=Math.min(devicePixelRatio||1,2);
    canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);
    const ctx=canvas.getContext("2d");
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.fillStyle="#0f2b37";ctx.fillRect(0,0,r.width,r.height);
    const scale=Math.max(r.width/1440,r.height/720)*1.08;
    ctx.translate((r.width-1440*scale)/2,(r.height-720*scale)/2);ctx.scale(scale,scale);
    drawBackground(ctx);
    polygonPath(ctx,this.worldGeometry.features);
    ctx.fillStyle="#879c85";ctx.fill("evenodd");
    ctx.lineWidth=.85;ctx.strokeStyle="#263e45";ctx.stroke();
    ctx.lineWidth=.5;ctx.strokeStyle="#e0e3cb36";
    for(const feature of this.worldGeometry.features){polygonPath(ctx,[feature]);ctx.stroke()}
  };
  Hub.prototype.worldScreen=function(){
    this.header("WorldPvP","The War Room · Global conquest");
    this.$("#hubContent").innerHTML="";
    const mount=this.$("#hubWorld"),me=this.world?.players?.find(p=>p.id===this.id);
    if(!this.worldActive&&!me){
      mount.innerHTML='<section class="wp-root wp-lobby"><canvas id="worldLobbyMap" class="wp-lobby-map" aria-hidden="true"></canvas><div class="wp-lobby-shade"></div><div class="wp-lobby-content"><div class="wp-eyebrow">LIGHTNING ARCADE <em>/</em> GLOBAL WARFARE</div><h1>World<span>PvP.</span></h1><p class="wp-lobby-description">The world is your battlefield. Build an empire, raise armies and fight for the continents. Face real players in a shared global war — or jump in against NPC nations.</p><div class="wp-feature-row"><span>◈ COMPLETE WORLD MAP</span><span>⚔ REAL-TIME CONQUEST</span><span>♙ NPC COMMANDERS</span></div><div class="wp-lobby-actions">'+(this.worldQueueing?'<button class="wp-primary" disabled>⌛ Searching for commanders…</button><button class="wp-secondary" data-act="worldCancel">✕ Cancel queue</button>':'<button class="wp-primary" data-act="worldQueue">⚔ QUEUE ONLINE <span>↗</span></button><button class="wp-secondary" data-act="worldBot">♟ PLAY WITH BOTS</button>')+'<button class="wp-minor" data-act="back">← Arcade</button></div>'+(this.worldQueueing?'<div class="wp-queue-box"><div class="wp-queue-top"><span><i class="wp-status-light"></i>MATCHMAKING ACTIVE</span><strong id="worldQueueClock">00:00</strong></div><div class="wp-queue-meter"><span></span></div><p>Looking for other players. If no one joins, your match starts with bot nations automatically.</p></div>':'<div class="wp-queue-box"><div class="wp-queue-top"><span><i class="wp-status-light"></i>READY TO DEPLOY</span><strong id="worldQueueCount">'+(this.world?.queued||0)+' IN QUEUE</strong></div><p>Conquer land anywhere on your connected continent. Cross oceans only after claiming a coastline.</p></div>')+'</div><footer class="wp-lobby-footer"><span><b>01.</b> ZOOM + PAN</span><span><b>02.</b> SET TROOP COMMITMENT</span><span><b>03.</b> PLAN NAVAL LANDINGS</span><span><b>04.</b> DOMINATE THE MAP</span></footer></section>';
      clearInterval(this.worldQueueInterval);
      if(this.worldQueueing){
        const clock=this.$("#worldQueueClock");
        const update=()=>{if(!clock||!clock.isConnected)return;const s=Math.floor((Date.now()-(this.worldQueuedAt||Date.now()))/1000);clock.textContent=String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0")};
        update();this.worldQueueInterval=setInterval(update,1000);
      }
      ensureGeography(this);this.drawLobbyMap();
      return;
    }
    clearInterval(this.worldQueueInterval);this.worldQueueInterval=null;
    mount.innerHTML='<section class="wp-root wp-battle"><header class="wp-top"><div class="wp-title"><strong>WORLD<span>PVP</span></strong><small>THE WAR ROOM</small></div><div class="wp-counters"><div class="wp-counter"><small>LAND CONTROL</small><strong id="hubLand">0%</strong></div><div class="wp-counter"><small>INFANTRY</small><strong id="hubTroops">0</strong></div><div class="wp-counter"><small>TREASURY</small><strong id="hubGold">0</strong></div><div class="wp-counter"><small>EMPIRES</small><strong id="hubNations">0</strong></div><div class="wp-counter"><small>CAMPAIGN</small><strong id="hubWorldDay">0</strong></div></div><span class="hub-spacer"></span><span class="wp-online">● LIVE</span><button class="wp-exit" data-act="worldLeave">Leave match ↗</button></header><div class="wp-field"><canvas id="hubWorldCanvas" tabindex="0" aria-label="World map. Drag to pan, scroll to zoom, select territories to command."></canvas><div class="wp-center-label">THE WORLD IS YOURS TO CONQUER</div><aside class="wp-overlay wp-left"><div class="wp-panel-head"><strong>WORLD POWERS</strong><small>RANK / LAND</small></div><div id="hubWorldLegend" class="hub-world-legend"></div></aside><aside class="wp-overlay wp-right"><div class="wp-panel-head"><strong>TACTICAL INTEL</strong><small>◈ MAP CELL</small></div><div class="wp-right-info"><div id="hubWorldInfo" class="hub-world-tooltip"><b>Planet Earth</b><small>Choose a region to see your options.</small></div><div class="wp-orders"><div class="wp-order-head"><strong>ISSUE ORDERS</strong><small class="hub-label">LIVE</small></div><button id="hubAttack" class="wp-attack" data-act="attack" disabled>⚔ SELECT AN ENEMY</button><div class="wp-order-grid"><button data-act="build" data-kind="city">⌂ City · 170</button><button data-act="build" data-kind="factory">⚒ Factory · 230</button><button data-act="build" data-kind="port">⚓ Port · 160</button><button data-act="build" data-kind="fort">⬟ Fort · 130</button><button data-act="ally">🤝 Alliance</button><button data-act="nuke">☢ Strike · 1800</button></div><p class="wp-order-note">Select your own land to build. Select a rival or neutral region to attack. Coastal access is required to cross water.</p></div></div><div class="wp-commander"><span>ARMY COMMITMENT</span><select id="hubRatio" aria-label="Army commitment"><option value=".2">20%</option><option value=".4" selected>40%</option><option value=".65">65%</option><option value=".9">90%</option></select></div><div id="hubNavy" class="wp-navy">NAVAL STATUS <b>CHECKING</b></div></aside><div class="wp-controls"><button data-act="zoomOut" aria-label="Zoom out">−</button><span id="hubZoom">100%</span><button data-act="zoomIn" aria-label="Zoom in">+</button><button data-act="centerMap" aria-label="Show entire world" title="Show entire world">⌖</button></div><div class="wp-footer"><span class="wp-help"><strong>DRAG</strong> MAP</span><span>SCROLL / PINCH TO ZOOM</span><span>CLICK LAND TO TARGET</span><span>DOUBLE CLICK TO ZOOM</span></div></div></section>';
    const canvas=this.$("#hubWorldCanvas");
    this.pointers=new Map();this.lastPinchDist=null;
    canvas.addEventListener("wheel",event=>{
      event.preventDefault();
      const r=canvas.getBoundingClientRect();
      this.zoomMap(event.deltaY<0?1.22:1/1.22,event.clientX-r.left,event.clientY-r.top);
    },{passive:false});
    canvas.addEventListener("dblclick",event=>{
      event.preventDefault();const r=canvas.getBoundingClientRect();
      this.zoomMap(1.7,event.clientX-r.left,event.clientY-r.top);
    });
    canvas.addEventListener("pointerdown",event=>{
      if(event.pointerType==="mouse"&&event.button!==0)return;
      canvas.setPointerCapture(event.pointerId);
      this.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY,downX:event.clientX,downY:event.clientY,moved:false});
      canvas.focus({preventScroll:true});
    });
    canvas.addEventListener("pointermove",event=>{
      const p=this.pointers.get(event.pointerId);if(!p)return;
      const dx=event.clientX-p.x,dy=event.clientY-p.y;
      if(Math.hypot(event.clientX-p.downX,event.clientY-p.downY)>6)p.moved=true;
      p.x=event.clientX;p.y=event.clientY;
      if(this.pointers.size===1){this.camera.x+=dx;this.camera.y+=dy;this.clampCamera();this.draw()}
      else if(this.pointers.size===2){
        const points=[...this.pointers.values()];
        const distance=Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y);
        if(this.lastPinchDist && distance>0){
          const r=canvas.getBoundingClientRect();
          this.zoomMap(distance/this.lastPinchDist,(points[0].x+points[1].x)/2-r.left,(points[0].y+points[1].y)/2-r.top);
        }
        this.lastPinchDist=distance;points.forEach(t=>t.moved=true);
      }
    });
    const release=event=>{
      const p=this.pointers.get(event.pointerId);if(!p)return;
      this.pointers.delete(event.pointerId);
      if(this.pointers.size<2)this.lastPinchDist=null;
      if(!p.moved&&!this.pointers.size){
        const r=canvas.getBoundingClientRect(),tile=this.mapCell(event.clientX-r.left,event.clientY-r.top);
        if(tile){this.tile=tile;this.worldInfo();this.draw()}
      }
    };
    canvas.addEventListener("pointerup",release);canvas.addEventListener("pointercancel",release);
    canvas.addEventListener("keydown",e=>{
      if(e.key==="+"||e.key==="="){e.preventDefault();this.zoomMap(1.25)}
      else if(e.key==="-"){e.preventDefault();this.zoomMap(.8)}
      else if(e.key==="0"){e.preventDefault();this.camera={zoom:1,x:0,y:0};this.draw()}
      else if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key)){
        e.preventDefault();
        this.camera.x+=e.key==="ArrowRight"?-65:e.key==="ArrowLeft"?65:0;
        this.camera.y+=e.key==="ArrowDown"?-65:e.key==="ArrowUp"?65:0;
        this.clampCamera();this.draw();
      }
    });
    ensureGeography(this);this.worldUpdate();
  };
  Hub.prototype.worldInfo=function(){
    const el=this.$("#hubWorldInfo"),w=this.world;
    if(!el)return;
    const attack=this.$("#hubAttack");
    if(!w||!this.tile){
      el.innerHTML='<b>Planet Earth</b><small>Explore the complete world map. Tap a nation or unclaimed region to inspect it and give orders.</small>';
      if(attack){attack.disabled=true;attack.textContent="⚔ SELECT A TERRITORY";}
      return;
    }
    const tile=this.tile,idx=tile.y*w.width+tile.x,owner=w.cells[idx],player=w.players.find(p=>p.id===owner),me=w.players.find(p=>p.id===this.id),structure=w.structures.find(s=>s.i===idx)?.kind||"None";
    if(!this.worldRegions||this.worldRegionWidth!==w.width||this.worldRegionHeight!==w.height){
      this.worldRegions=countryRegions(w);this.worldRegionWidth=w.width;this.worldRegionHeight=w.height;
    }
    const route=getRoute(w,me,tile,this.worldRegions);
    const lat=90-(tile.y+.5)*180/w.height,lon=-180+(tile.x+.5)*360/w.width;
    const country=this.countryAt(lon,lat);
    const title=owner===-1?"Open ocean":owner===""?"Unclaimed territory":player?.name||"Unknown nation";
    const territory=country||"Uncharted territory";
    const mode=owner===me?.id?"YOUR LAND":route.allowed?route.name.toUpperCase():route.name.toUpperCase();
    el.innerHTML='<b>'+esc(title)+'</b><small>'+esc(territory)+' · '+Math.abs(lat).toFixed(1)+'°'+(lat>=0?"N":"S")+' / '+Math.abs(lon).toFixed(1)+'°'+(lon>=0?"E":"W")+'<br>Structure: '+esc(structure)+'<br><strong class="'+(route.allowed?"":"wp-intel-off")+'">'+esc(mode)+'</strong></small>';
    if(attack){attack.disabled=!route.allowed||!this.worldActive;attack.textContent=route.allowed?(route.mode==="naval"?"⚓ LAUNCH NAVAL ASSAULT":"⚔ ATTACK TERRITORY"):"⚔ NO VALID ATTACK ROUTE";}
  };
  Hub.prototype.worldUpdate=function(){
    const w=this.world;
    if(!w||this.view!=="world")return;
    const me=w.players.find(p=>p.id===this.id);
    if(me&&!this.worldActive){this.worldActive=true;this.worldQueueing=false;this.worldScreen();return}
    if(!me&&!this.worldActive){const el=this.$("#worldQueueCount");if(el)el.textContent=(w.queued||0)+" IN QUEUE";return}
    if(!this.$("#hubWorldCanvas"))return;
    const set=(id,val)=>{const el=this.$(id);if(el)el.textContent=String(val)};
    set("#hubLand",((me?.land||0)/(w.landTotal||1)*100).toFixed(2)+"%");
    set("#hubTroops",(me?.troops||0).toLocaleString());
    set("#hubGold",(me?.gold||0).toLocaleString());
    set("#hubNations",w.players.filter(p=>p.land>0).length);
    set("#hubWorldDay",timeAgo(w.tick));
    const legend=this.$("#hubWorldLegend");
    if(legend)legend.innerHTML=w.players.slice().sort((a,b)=>b.land-a.land).slice(0,12).map((p,i)=>'<div class="wp-rank"><b>'+String(i+1).padStart(2,"0")+'</b><span class="wp-rank-dot" style="background:'+esc(p.color)+'"></span><span class="wp-rank-label">'+esc(p.name)+(p.bot?' <small>AI</small>':p.id===this.id?' <small>YOU</small>':'')+'</span><span class="wp-rank-count">'+Number(p.land).toLocaleString()+'</span></div>').join("");
    if(me){
      if(!this.worldRegions||this.worldRegionWidth!==w.width||this.worldRegionHeight!==w.height){
        this.worldRegions=countryRegions(w);this.worldRegionWidth=w.width;this.worldRegionHeight=w.height;
      }
      const ownsCoast=w.cells.some((id,i)=>id===me.id&&(
        (i%w.width>0&&w.cells[i-1]===-1)||(i%w.width<w.width-1&&w.cells[i+1]===-1)||
        (i>=w.width&&w.cells[i-w.width]===-1)||(i<w.width*(w.height-1)&&w.cells[i+w.width]===-1)));
      const navy=this.$("#hubNavy");
      if(navy)navy.innerHTML=ownsCoast?'⚓ NAVAL ACCESS <b>AVAILABLE</b>':'⚓ NAVAL ACCESS <b class="wp-intel-off">LANDLOCKED</b>';
    }
    this.worldInfo();this.draw();
  };
  Hub.prototype.buildWorldSurface=function(w,detail){
    const W=w.width,H=w.height,tw=1440/W,th=720/H,image=document.createElement("canvas");
    image.width=1440;image.height=720;
    const ctx=image.getContext("2d"),features=this.worldGeometry?.features;
    drawBackground(ctx);
    if(features){
      polygonPath(ctx,features);
      ctx.fillStyle="#a3ad8f";ctx.fill("evenodd");
      ctx.save();polygonPath(ctx,features);ctx.clip("evenodd");
    }
    const palette=new Map(w.players.map(p=>[p.id,p.color]));
    ctx.globalAlpha=.91;
    for(let y=0;y<H;y++)for(let x=0;x<W;){
      const owner=w.cells[y*W+x];
      if(owner===-1){x++;continue}
      let end=x+1;
      while(end<W&&w.cells[y*W+end]===owner)end++;
      ctx.fillStyle=palette.get(owner)||(["#9cab8b","#a6b494","#afbb9a","#98aa85"][(x*17+y*3)%4]);
      ctx.fillRect(x*tw,y*th,(end-x)*tw+.15,th+.15);
      x=end;
    }
    ctx.globalAlpha=1;
    if(features){
      ctx.restore();
      for(const feature of features){
        polygonPath(ctx,[feature]);
        ctx.lineWidth=.52;ctx.strokeStyle="#283b426f";ctx.stroke();
      }
      polygonPath(ctx,features);ctx.lineWidth=.8;ctx.strokeStyle="#d0c9a47a";ctx.stroke();
    }
    if(detail){
      ctx.lineWidth=.42;ctx.strokeStyle="#0d30396e";
      for(let y=0;y<H;y++)for(let x=0;x<W;x++){
        const i=y*W+x,owner=w.cells[i];if(owner===-1)continue;
        if(x<W-1&&w.cells[i+1]!==owner){ctx.beginPath();ctx.moveTo((x+1)*tw,y*th);ctx.lineTo((x+1)*tw,(y+1)*th);ctx.stroke()}
        if(y<H-1&&w.cells[i+W]!==owner){ctx.beginPath();ctx.moveTo(x*tw,(y+1)*th);ctx.lineTo((x+1)*tw,(y+1)*th);ctx.stroke()}
      }
      ctx.textAlign="center";ctx.font="bold 8px system-ui";
      for(const s of w.structures.slice(0,350)){
        const x=s.i%W,y=Math.floor(s.i/W);
        ctx.fillStyle="#102d3d";ctx.fillText(({city:"⌂",factory:"⚒",port:"⚓",fort:"◆"})[s.kind]||"",(x+.5)*tw,(y+.75)*th);
      }
    }
    const centers=new Map(w.players.map(p=>[p.id,{x:0,y:0,n:0}]));
    for(let i=0;i<w.cells.length;i++){
      const point=centers.get(w.cells[i]);
      if(point){point.x+=(i%W+.5)*tw;point.y+=((i/W|0)+.5)*th;point.n++}
    }
    this.worldSurface={data:w,geometry:this.worldGeometry,detail,image,centroids:centers};
  };
  Hub.prototype.draw=function(){
    const canvas=this.$("#hubWorldCanvas"),w=this.world;
    if(!canvas||!w||this.view!=="world")return;
    const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;
    const dpr=Math.min(devicePixelRatio||1,2),width=Math.max(1,Math.round(r.width*dpr)),height=Math.max(1,Math.round(r.height*dpr));
    if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height}
    const detail=this.camera.zoom>2.4,cache=this.worldSurface;
    if(!cache||cache.data!==w||cache.geometry!==this.worldGeometry||cache.detail!==detail)this.buildWorldSurface(w,detail);
    const ctx=canvas.getContext("2d",{alpha:false}),scale=this.mapFit()*this.camera.zoom;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.fillStyle="#163a50";ctx.fillRect(0,0,r.width,r.height);
    this.clampCamera();
    const originX=r.width/2+this.camera.x,originY=r.height/2+this.camera.y;
    ctx.translate(originX,originY);ctx.scale(scale,scale);ctx.translate(-720,-360);
    ctx.drawImage(this.worldSurface.image,0,0);
    if(this.tile){
      const tw=1440/w.width,th=720/w.height;
      ctx.strokeStyle="#fff5b5";ctx.lineWidth=Math.max(.6,2.2/scale);
      ctx.strokeRect(this.tile.x*tw+.2,this.tile.y*th+.2,tw-.4,th-.4);
    }
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.textAlign="center";ctx.font="800 11px system-ui";ctx.lineWidth=4;
    for(const p of w.players){
      const c=this.worldSurface.centroids.get(p.id);if(!c?.n)continue;
      const x=originX+((c.x/c.n)-720)*scale,y=originY+((c.y/c.n)-360)*scale;
      if(x<0||y<0||x>r.width||y>r.height)continue;
      ctx.strokeStyle="#12252aca";ctx.strokeText(p.name,x,y);
      ctx.fillStyle="#fff3d6";ctx.fillText(p.name,x,y);
    }
    const indicator=this.$("#hubZoom");if(indicator)indicator.textContent=Math.round(this.camera.zoom*100)+"%";
  };
  Hub.prototype.chessScreen=function(){
    this.header("Chess","The Chess Club · Legal moves verified live");
    const host=this.$("#hubContent"),game=this.chess;
    if(!game){
      host.innerHTML='<section class="hub-game-area hub-chess-lobby"><span class="hub-label">LIGHTNING CHESS CLUB</span><h2>Play real chess.</h2><p>Get paired with a member, invite someone directly, or learn against the bot. Click a piece, then a highlighted square. You can also drag pieces on desktop.</p><div class="hub-actions"><button class="hub-btn primary" data-act="chessQueue">⚔ Queue for a match</button><button class="hub-btn" data-act="chessBot">♟ Play against bot</button></div><div class="hub-actions"><input id="hubDuelId" placeholder="Opponent user ID"><button class="hub-btn" data-act="chessDuel">Invite player</button></div><button class="hub-btn" data-act="back">← All games</button></section>';
      return;
    }
    const board=game.fen.split(" ")[0].split("/").map(row=>{
      const squares=[];for(const c of row)if(/[1-8]/.test(c))for(let n=0;n<Number(c);n++)squares.push("");else squares.push(c);
      return squares;
    });
    const order=game.color==="b"?[7,6,5,4,3,2,1,0]:[0,1,2,3,4,5,6,7];
    const myTurn=!game.over&&game.turn===game.color;
    const legal=myTurn?(game.legal||[]):[];
    const destinations=new Set(legal.filter(m=>m.from===this.selectedSquare).map(m=>m.to));
    const fromSquares=new Set(legal.map(m=>m.from));
    let squares="";
    for(const y of order)for(const x of order){
      const square="abcdefgh"[x]+(8-y),piece=board[y]?.[x]||"";
      const classes=["hub-square",(x+y)%2?"dark":"light",this.selectedSquare===square?"selected":"",destinations.has(square)?"target":"",fromSquares.has(square)?"available":""].filter(Boolean).join(" ");
      squares+='<button type="button" class="'+classes+'" data-act="square" data-square="'+square+'" title="'+esc(square)+'" aria-label="'+esc(square+' '+(piece||"empty"))+'" '+(myTurn?'':'disabled')+'><span draggable="'+(fromSquares.has(square)?"true":"false")+'">'+(icons[piece]||"")+'</span></button>';
    }
    const opp=game.players?.[game.color==="w"?1:0]||"Opponent";
    const hint=game.over?(game.result||"Game finished"):this.chessPending?"Submitting your move…":this.chessError||(!myTurn?"Waiting for "+opp+"…":!legal.length?"Move list unavailable. Refresh the board.":this.selectedSquare?"Choose any green highlighted square.":"Your turn · Select a piece");
    const badge=game.over?"GAME FINISHED":myTurn?"YOUR MOVE":"WAITING";
    host.innerHTML='<section class="hub-chess-layout arena-chess"><div class="hub-chess-panel"><div class="hub-chess-status"><span class="hub-label">MATCH '+esc(game.id.slice(0,7).toUpperCase())+'</span><strong>'+esc(badge)+'</strong></div><div class="hub-chess-board"><div class="hub-chess" id="hubChessBoard" role="grid" aria-label="Chess board">'+squares+'</div></div></div><aside class="hub-chess-sidebar"><span class="hub-label">THE CHESS CLUB</span><h2>Make your move.</h2><p>You are playing <b>'+ (game.color==="w"?"White ♙":"Black ♟")+'</b> against <b>'+esc(opp)+'</b></p><p class="hub-chess-hint '+(myTurn?"arena-turn-hint":"")+'">'+esc(hint)+'</p><div class="hub-chess-card">Last move <strong>'+esc(game.last||"Opening position")+'</strong></div><div class="hub-chess-card">Moves available <strong>'+legal.length+'</strong></div><div class="arena-chess-controls"><button class="hub-btn primary" data-act="chessRefresh">↻ Refresh board</button><button class="hub-btn" data-act="back">← Arcade</button>'+(game.over?'<button class="hub-btn" data-act="chessBot">New bot game</button>':'')+'</div><p class="arena-chess-help"><code>TIP</code> Click or drag a piece to move. The green markers are legal destinations. Refresh if your connection gets interrupted.</p></aside></section>';
    const boardEl=this.$("#hubChessBoard");
    boardEl.addEventListener("dragstart",event=>{
      const button=event.target.closest("[data-square]");
      if(!button||!fromSquares.has(button.dataset.square))return event.preventDefault();
      event.dataTransfer.setData("text/plain",button.dataset.square);
      event.dataTransfer.effectAllowed="move";
    });
    boardEl.addEventListener("dragover",event=>{if(event.target.closest("[data-square]"))event.preventDefault()});
    boardEl.addEventListener("drop",event=>{
      event.preventDefault();
      const button=event.target.closest("[data-square]");if(!button)return;
      const from=event.dataTransfer.getData("text/plain");
      if(from)this.moveChess(from,button.dataset.square);
    });
  };
  Hub.prototype.moveChess=function(from,to){
    const g=this.chess;
    if(!g||g.over||g.turn!==g.color)return this.flash("Wait for your turn.");
    if(this.chessPending)return;
    const legal=(g.legal||[]).filter(m=>m.from===from&&m.to===to);
    if(!legal.length){this.chessError="That move is not legal.";this.chessScreen();return}
    const promotion=legal.find(m=>m.promotion==="q")?.promotion||legal[0].promotion||"q";
    this.selectedSquare=null;this.chessPending=true;this.chessError="";
    if(!this.send({type:"chessMove",id:g.id,from,to,promotion})){this.chessPending=false;return}
    this.chessScreen();
  };
  Hub.prototype.updates=function(){
    this.header("Updates","Lightning · What's new");
    const releases=[
      {version:"2.2",tag:"WAR ROOM UPDATE",date:"October 2026",title:"The world, at war.",desc:"A redesigned WorldPvP lobby, a full interactive world map, commander intel and a faster route from queue to battle.",items:["WorldPvP queue and instant NPC battles","Drag, pinch, mousewheel and keyboard navigation","Better world borders and tactical targeting","Chess board interaction and refresh controls","A rebuilt update log"]},
      {version:"2.1",tag:"WORLD EXPANSION",date:"October 2026",title:"Every nation has a story.",desc:"Global conquest came online with AI empires, economy and territorial combat.",items:["World-wide conquest system","NPC opponents and strategic buildings","Coastal access and naval landing rules"]},
      {version:"2.0",tag:"SOCIAL & MULTIPLAYER",date:"October 2026",title:"A whole new arcade.",desc:"The first multiplayer games and community spaces launched inside Lightning.",items:["Channels, messaging and feature suggestions","Chess matchmaking and Rock Paper Scissors","Game rooms and live opponent updates"]},
      {version:"1.9",tag:"LIGHTNING BROWSER",date:"Earlier",title:"Built for browsing.",desc:"A new identity, an integrated browser, and the first Lightning AI experiences.",items:["Obsidian-and-gold UI","Browsing and music","AI tools"]}
    ];
    this.$("#hubContent").innerHTML='<section class="hub-release-scroll arena-releases"><div class="hub-release-hero"><span class="hub-label">LIGHTNING / THE RELEASE JOURNAL</span><h1>Every update.<br><em>Another level.</em></h1><p>What changed, why it matters, and what you can play right now.</p><div class="hub-release-badges"><span>✦ LATEST · VERSION 2.2</span><span>◈ WORLDPVP WAR ROOM</span><span>⚡ LIVE ARCADE</span></div></div><div class="hub-release-list">'+releases.map((p,i)=>'<article class="hub-release"><div class="hub-release-meta"><span class="hub-release-version">'+esc(p.version)+'</span><div><span class="hub-label">'+esc(p.tag)+'</span><small>'+esc(p.date)+'</small></div></div><div class="hub-release-body"><span class="hub-release-number">0'+(i+1)+'</span><h2>'+esc(p.title)+'</h2><p>'+esc(p.desc)+'</p><div class="hub-release-items">'+p.items.map(x=>'<div><span>↗</span> '+esc(x)+'</div>').join("")+'</div></div></article>').join("")+'</div></section>';
  };
  Hub.prototype.act=function(action,button){
    if(action==="worldView"){this.show("world");return}
    if(action==="worldQueue"||action==="worldBot"){
      this.worldQueueing=true;this.worldQueuedAt=Date.now();this.worldScreen();
      if(!this.send({type:action==="worldBot"?"worldPractice":"worldQueue"})){this.worldQueueing=false;this.worldScreen()}
      return;
    }
    if(action==="worldCancel"){
      this.worldQueueing=false;this.world=null;this.worldScreen();this.send({type:"worldCancel"});return;
    }
    if(action==="worldLeave"){
      this.send({type:"worldLeave"});this.worldActive=false;this.worldQueueing=false;this.world=null;this.tile=null;
      this.camera={zoom:1,x:0,y:0};this.show("games");return;
    }
    if(action==="chessRefresh"){
      if(this.chess?.id){this.chessPending=false;this.chessError="";this.send({type:"chessSync",id:this.chess.id})}
      return;
    }
    if(action==="square"){
      const g=this.chess;if(!g||g.over||g.turn!==g.color)return;
      const square=button.dataset.square,legal=g.legal||[];
      if(this.chessPending)return;
      if(this.selectedSquare===square){this.selectedSquare=null;this.chessScreen();return}
      if(this.selectedSquare&&legal.some(m=>m.from===this.selectedSquare&&m.to===square)){
        this.moveChess(this.selectedSquare,square);return;
      }
      if(legal.some(m=>m.from===square)){this.selectedSquare=square;this.chessError="";this.chessScreen();return}
      this.chessError="Select one of your pieces first.";this.chessScreen();return;
    }
    return oldAct.call(this,action,button);
  };
}
