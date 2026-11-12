import {faceRadius,isMural,palette,tierLevel,WALL_TOP,WALL_BOTTOM} from './stage-layout.mjs';
import {clamp,mix,rand,disk,paintStamp,makeMural} from './stage-art.mjs';
import {frameGeometry,drawFrame} from './asset-layout.mjs';
import {manifest,tierSpecs,timeline,v2Frame,gunAsset,grenadeAsset,fxAsset,wallScale,wallRules} from './v2.mjs';

const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d',{alpha:false});
const params=new URLSearchParams(location.search),preview=params.has('preview'),source=params.get('source')==='demo'?'demo':'live';
const button=document.querySelector('#sound'),background=new Image();background.src='/v2/lite/wall.webp';
let state,audio,enabled=false,lastFrame=0,frames=0,sampleAt=performance.now(),lastWall=1;
const images=new Map(),murals=new Map(),heard=new Set(),floor=[];
const assets=new Map(),paintCache=new Map(),nameCache=new Map();
let dirty=true,nextIdle=0,wasMoving=false;
const low=()=>preview||state?.config.fps!==60;
const liteUrl=url=>'/v2/lite/'+url.split('/').at(-1).replace(/\.png$/,'.webp');
background.onload=()=>{dirty=true;};
function remember(cache,key,value,max){
 cache.set(key,value);
 if(cache.size>max)cache.delete(cache.keys().next().value);
 return value;
}
function asset(url){
 if(!assets.has(url)){
   const img=new Image();
   img.onload=()=>{dirty=true;};
   remember(assets,url,img,24);
   img.src=url;
   img.onerror=()=>console.warn('Không tải được asset',url);

 }
 const img=assets.get(url);return img.complete&&img.naturalWidth?img:null;
}
const segmenter=new Intl.Segmenter('vi',{granularity:'grapheme'});
button.hidden=preview;
function sound(on){
 enabled=on;
 if(on){audio??=new AudioContext();void audio.resume().catch(()=>{});}
 button.hidden=preview||on;
}
button.onclick=()=>sound(true);
addEventListener('message',e=>{if(preview&&e.origin===location.origin&&e.source===parent&&typeof e.data?.audio==='boolean')sound(e.data.audio);});
let noise;
function soundCue(kind,tier,volume){
 if(!enabled||audio?.state!=='running'||!volume)return;
 const t=audio.currentTime,level=volume/100;
 if(!noise){
   noise=audio.createBuffer(1,Math.ceil(audio.sampleRate*.55),audio.sampleRate);
   const data=noise.getChannelData(0);
   for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
 }
 function texture(from,to,length,amount){
   const src=audio.createBufferSource(),band=audio.createBiquadFilter(),gain=audio.createGain();
   src.buffer=noise;band.type='bandpass';band.Q.value=.72;
   band.frequency.setValueAtTime(from,t);band.frequency.exponentialRampToValueAtTime(to,t+length);
   gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(amount*level,t+.013);gain.gain.exponentialRampToValueAtTime(.0001,t+length);
   src.connect(band).connect(gain).connect(audio.destination);src.start(t);src.stop(t+length);
 }
 function tone(from,to,length,amount,delay=0){
   const osc=audio.createOscillator(),gain=audio.createGain(),start=t+delay;
   osc.type='sine';osc.frequency.setValueAtTime(from,start);osc.frequency.exponentialRampToValueAtTime(to,start+length);
   gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(amount*level,start+.025);gain.gain.exponentialRampToValueAtTime(.0001,start+length);
   osc.connect(gain).connect(audio.destination);osc.start(start);osc.stop(start+length);
 }
 if(kind==='shot'){texture(3600+tier*160,740,.19,.33);tone(300+tier*24,105,.13,.16);}
 else if(kind==='hit'){texture(970,380,.22,.30);tone(145,58,.25,.18);}
 else if(kind==='frame'){[523,659,784,1046].slice(0,tier>=4?4:2).forEach((f,i)=>tone(f,f*.98,.44,.085,i*.067));}
 else if(kind==='toss'){texture(1100,2600,.31,.17);tone(240,480,.29,.11);}
 else if(kind==='paint-burst'){texture(1650,340,.52,.43);tone(124,47,.42,.28);tone(590,883,.43,.08,.16);}
 else if(kind==='wall'){texture(270,2100,.53,.34);tone(95,152,.53,.09);}
}


const galleryKind=params.get('kind'),galleryId=params.get('id');
function receive(next){
 state=next;dirty=true;
 if(state.wallNumber===1&&lastWall>1)floor.length=0;
 lastWall=state.wallNumber;
}
if(galleryKind&&galleryId){
 const query=new URLSearchParams({source,kind:galleryKind,id:galleryId,replay:params.get('replay')??'0'});
 fetch('/api/gallery?'+query).then(r=>{if(!r.ok)throw Error('Không còn tường này.');return r.json();}).then(receive).catch(e=>console.warn(e.message));
}else{
 const stream=new EventSource('/api/events?source='+source);
 stream.onmessage=e=>receive(JSON.parse(e.data));
}
function cue(id,name,level){
 const key=id+'|'+name;if(heard.has(key))return false;
 heard.add(key);if(heard.size>400)heard.delete(heard.values().next().value);
 soundCue(name,level,state.config.volume);return true;
}
function label(m){
 const name=state.config.anonymous?'Họa sĩ':m.name||'Họa sĩ';
 return nameCache.get(name)??remember(nameCache,name,Array.from(segmenter.segment(name),x=>x.segment).slice(0,26).join(''),96);
}
const hash=id=>Array.from(id).reduce((a,b)=>a+b.charCodeAt(0),0);
const baseLevel=m=>tierLevel(m.coins,m.tier);
function text(s,x,y,size,color='#fff',align='center'){
 ctx.font='850 '+size+'px system-ui';ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(s,x,y);
}
function box(x,y,w,h,r,fill){
 ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();
}
function avatar(m,x,y,rx,ry){
 const url=state.config.anonymous?'':m.avatar;
 if(url&&!images.has(url)){
   const img=new Image();img.referrerPolicy='no-referrer';img.onload=()=>{dirty=true;};img.src=url;images.set(url,img);
   if(images.size>24)images.delete(images.keys().next().value);
 }
 const img=images.get(url);
 ctx.save();ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.clip();
 if(img?.complete&&img.naturalWidth){
   const s=Math.max(rx*2/img.naturalWidth,ry*2/img.naturalHeight),w=img.naturalWidth*s,h=img.naturalHeight*s;
   ctx.drawImage(img,x-w/2,y-h/2,w,h);
 }else{
   const g=ctx.createLinearGradient(x-rx,y-ry,x+rx,y+ry);
   g.addColorStop(0,'#68637e');g.addColorStop(1,'#2c284b');ctx.fillStyle=g;ctx.fillRect(x-rx,y-ry,2*rx,2*ry);
   disk(ctx,x,y-ry*.23,Math.min(rx,ry)*.32,'#d6d4e4');
   ctx.fillStyle='#d6d4e4';ctx.beginPath();ctx.ellipse(x,y+ry*.73,rx*.68,ry*.54,0,0,Math.PI*2);ctx.fill();
 }
 ctx.restore();
}
function paintTile(m,width,height){
 const key='paint:'+m.uid+':'+m.color;
 if(paintCache.has(key))return paintCache.get(key);
 const tile=document.createElement('canvas');
 tile.width=Math.ceil(width);tile.height=Math.ceil(height*1.25);
 const g=tile.getContext('2d');g.translate(tile.width/2,tile.height*.43);
 paintStamp(g,0,0,width*.35,[m.color,'#f22fa1','#28dcff'],hash(m.uid),2);
 return remember(paintCache,key,tile,24);
}
function frameTile(url,image,g){
 const key=url+':'+g.radius;
 if(paintCache.has(key))return paintCache.get(key);
 const tile=document.createElement('canvas'),scale=low()?.65:1;
 tile.width=Math.ceil((g.left+g.right)*scale);tile.height=Math.ceil((g.top+g.bottom)*scale);
 const ctx=tile.getContext('2d');ctx.scale(scale,scale);ctx.translate(g.left,g.top);
 drawFrame(ctx,image,g);
 return remember(paintCache,key,tile,24);
}
function commentTag(m,progress,opacity){
 const slot=wallRules.communityWall.slots[m.slot],p=clamp(progress);
 const width=slot.finalPaintBoundingBoxPx.width*wallScale,h=slot.finalPaintBoundingBoxPx.height*wallScale;
 const splash=asset(fxAsset(hash(m.id)%7,hash(m.uid)%4)),tile=paintTile(m,width,h);
 const spread=.66+.34*p,r=slot.avatarDiameterPx*wallScale/2;
 ctx.save();ctx.globalAlpha=opacity;ctx.translate(m.x,m.y);
 ctx.drawImage(tile,-tile.width*spread/2,-tile.height*.43*spread,tile.width*spread,tile.height*spread);
 if(splash){ctx.save();ctx.rotate((hash(m.uid)%31-15)*Math.PI/180);ctx.drawImage(splash,-width*spread/2,-h*spread/2,width*spread,h*spread);ctx.restore();}
 const face=clamp((p-.29)/.58);
 if(face>0){
   ctx.globalAlpha=opacity*face;
   disk(ctx,0,0,r+5,'#241729');disk(ctx,0,0,r+2,'#fff4ed');avatar(m,0,0,r,r);
 }
 const letters=clamp((p-.72)/.28);
 if(letters>0){
   const name=label(m),max=slot.nicknameMaxWidthPx*wallScale;
   const y=m.nameY-m.y;
   ctx.globalAlpha=opacity*letters;
   box(-max/2-3,y-18,max+6,37,9,'#1d1424e9');
   ctx.font='italic 900 30px system-ui';
   const size=Math.max(20,Math.min(30,30*max/Math.max(1,ctx.measureText(name).width)));
   ctx.font='italic 900 '+size+'px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
   ctx.lineWidth=3*wallScale;ctx.strokeStyle='#111420';ctx.strokeText(name,0,y,max);
   ctx.fillStyle='#fff';ctx.fillText(name,0,y,max);
 }
 ctx.restore();
}
function tag(m,progress,opacity){
 if(m.community){commentTag(m,progress,opacity);return;}
 const level=baseLevel(m),g=frameGeometry(level,m.size),original=v2Frame(level,m.skin||manifest.skins[0]);
 const url=low()?liteUrl(original):original,image=asset(url);
 const p=clamp(progress),scale=.73+.27*p;
 if(p<=0)return;
 ctx.save();ctx.translate(m.x,m.y);ctx.scale(scale,scale);ctx.globalAlpha=opacity;
 const {x,y,rx,ry}=g.portrait;
 avatar(m,x,y,rx,ry);
 if(image)ctx.drawImage(frameTile(url,image,g),-g.left,-g.top,g.left+g.right,g.top+g.bottom);
 const name=label(m);
 ctx.font='italic 950 '+g.nameFont+'px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
 ctx.lineWidth=Math.max(2,g.nameFont*.12);ctx.strokeStyle='#211027';ctx.strokeText(name,g.nameX,g.nameY,g.nameWidth);
 ctx.fillStyle='#fff8fd';ctx.fillText(name,g.nameX,g.nameY,g.nameWidth);
 ctx.restore();
}
function plan(m){return m.sequence??timeline(baseLevel(m));}
function target(m,i){
 if(m.community)return [m.x,m.y];
 if(isMural(m.coins,m.tier)){
   const x=[515,126,931,929,145,533,550,80,1000],y=[817,568,1145,557,1140,486,1290,903,905];
   return [x[i%x.length],Math.max(WALL_TOP+30,Math.min(WALL_BOTTOM-26,y[i%y.length]))];
 }
 const r=faceRadius(m.coins,m.tier,m.size);
 return [m.x+(i%3-1)*r*.58,m.y+(i%2?.28:-.31)*r];
}
function paintWall(m,now,opacity=1){
 const level=baseLevel(m),q=plan(m),elapsed=now-m.drawStart;
 if(elapsed<=0)return;
 if(!murals.has(level))murals.set(level,makeMural(level,true));
 ctx.save();ctx.beginPath();ctx.rect(0,WALL_TOP,1080,WALL_BOTTOM-WALL_TOP);ctx.clip();
 ctx.globalAlpha=[.80,.86,.91][level-4]*opacity;
 if(now<m.land){
   ctx.beginPath();
   for(const step of q.steps){
     const t=elapsed-step.impact;if(t<=0)continue;
     const [x,y]=target(m,step.index+(step.kind==='bomb'?3:0)),r=mix(65,350+level*17,1-Math.pow(1-clamp(t/440),3));
     ctx.moveTo(x+r,y);ctx.arc(x,y,r,0,Math.PI*2);
   }
   ctx.clip();
 }
 const share=wallRules.giftWalls.stageSizeByTierPercentOfPaintableWall['tier'+(level+1)]/100;
 const w=1080*share,h=(WALL_BOTTOM-WALL_TOP)*Math.min(1,share+.08);
 const left=(1080-w)/2,top=(WALL_TOP+WALL_BOTTOM-h)/2;
 ctx.beginPath();ctx.roundRect(left,top,w,h,38);ctx.clip();
 ctx.drawImage(murals.get(level),left,top,w,h);
 ctx.restore();
}
function backgroundAndFloor(now){
 const wall=low()?background:asset('/v2/wall.png')||background;
 if(wall.complete&&wall.naturalWidth)ctx.drawImage(wall,0,0,1080,1920);
 else {ctx.fillStyle='#4e4544';ctx.fillRect(0,0,1080,1920);}
 for(const s of floor){
   if(now>=s.until)continue;
   ctx.save();ctx.globalAlpha=.64*clamp((s.until-now)/2400);
   const colors=palette[s.level];
   for(let i=0;i<5;i++){
     ctx.fillStyle=colors[i%3];ctx.beginPath();
     ctx.ellipse(clamp((s.x+(rand(s.seed+i)-.5)*230)/1080)*1080,1430+rand(s.seed+i*37)*208,12+s.level*4+i*3,5+s.level*2,.08*i,0,Math.PI*2);ctx.fill();
   }
   ctx.restore();
 }
}
function paintLayer(marks,now,opacity=1){
 if(!opacity)return;
 ctx.save();ctx.beginPath();ctx.rect(0,WALL_TOP,1080,WALL_BOTTOM-WALL_TOP);ctx.clip();
 const mural=marks.find(m=>isMural(m.coins,m.tier));if(mural)paintWall(mural,now,opacity);
 for(const m of marks){
   if(now<m.land)continue;
   tag(m,1,opacity);
 }
 ctx.restore();
}
function ribbon(x,y,tx,ty,p,colors,level){
 const dx=tx-x,dy=ty-y,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;
 const width=20+level*7;
 for(let i=0;i<3;i++){
   const t=Math.max(0,p-(.70+i*.11)),offset=(i-1)*width*.31,w=width*(.33+i*.11);
   const a=[x+dx*t,y+dy*t],b=[x+dx*p,y+dy*p];
   ctx.fillStyle=colors[i];ctx.beginPath();ctx.moveTo(a[0],a[1]);
   ctx.quadraticCurveTo(mix(a[0],b[0],.52)+nx*(offset+w),mix(a[1],b[1],.52)+ny*(offset+w),b[0]+nx*offset,b[1]+ny*offset);
   ctx.quadraticCurveTo(mix(a[0],b[0],.48)+nx*(offset-w),mix(a[1],b[1],.48)+ny*(offset-w),a[0],a[1]);ctx.fill();
 }
 disk(ctx,x+dx*p,y+dy*p,8+level*2,'#fff2d6');
}
function weapon(m,now,render){
 const c=state.config,level=m?baseLevel(m):0;
 const index=c.gun>=0?c.gun:Math.max(0,manifest.guns.findIndex(g=>g.id===tierSpecs[level].weapon));
 const prop=render&&c.showGun?asset(low()?liteUrl(gunAsset(index)):gunAsset(index)):null,scale=c.gunScale??.71,shift=1080*(1-scale),top=1920*(1-scale);
 const recoil=m?Math.max(0,...plan(m).steps.filter(s=>s.kind==='shot').map(s=>1-Math.abs(now-m.drawStart-s.at-27)/75))*(m.recoil??10):0;
  const anchorX=1060,anchorY=1860,ox=shift+(c.muzzleX??225)*wallScale*scale,oy=top+(c.muzzleY??1060)*wallScale*scale+recoil;
 const next=m?plan(m).steps.find(step=>step.kind==='shot'&&step.impact>=now-m.drawStart):null;
 const point=next?target(m,next.index):null,angle=point?Math.max(-.15,Math.min(.15,(point[0]-540)*.00035)):0;
 if(render&&c.showGun&&prop){
   ctx.save();ctx.translate(anchorX,anchorY);ctx.rotate(angle);ctx.translate(shift-anchorX,top+recoil-anchorY);
   ctx.drawImage(prop,0,0,1080*scale,1920*scale);ctx.restore();
 }
 const dx=ox-anchorX,dy=oy-anchorY;
 return c.showGun?[anchorX+dx*Math.cos(angle)-dy*Math.sin(angle),anchorY+dx*Math.sin(angle)+dy*Math.cos(angle)]:[220,1710];
}
function sprayCan(m,now){
 const elapsed=now-m.drawStart,last=plan(m).steps.at(-1)?.impact??0,r=faceRadius(m.coins,m.tier,m.size);
 const p=clamp((elapsed-last)/Math.max(1,plan(m).duration-last));
 if(p<=0||now>=m.land)return;
 cue(m.id,'shot',m.tier);
 ctx.save();ctx.strokeStyle=palette[baseLevel(m)][0];ctx.lineWidth=12;ctx.lineCap='round';
 ctx.beginPath();ctx.arc(m.x,m.y,r+17,-Math.PI/2,-Math.PI/2+p*Math.PI*2);ctx.stroke();
 for(let i=0;i<Math.floor(p*8);i++){
   const angle=-Math.PI/2+i*Math.PI/4;
   disk(ctx,m.x+Math.cos(angle)*(r+24),m.y+Math.sin(angle)*(r+24)+p*15,5,palette[baseLevel(m)][0]);
 }
 ctx.restore();
}
function spray(m,now){
 const q=plan(m),elapsed=now-m.drawStart,level=baseLevel(m),speed=q.speed??1;
 if(elapsed<0||now>=m.end)return;
 const spec=tierSpecs[level],colors=palette[level],seed=hash(m.id),quality=state.config.particles/100;
 const [ox,oy]=weapon(m,now,false),budget=low()||state.giftQueued>=15?45:240;
 if(m.canSpray)sprayCan(m,now);
 for(const step of q.steps){
   const dt=elapsed-step.at,after=elapsed-step.impact;
   if(dt<0||after>(step.kind==='shot'?spec.impactExpandMs:spec.grenadeBloomMs)/speed)continue;
   const isShot=step.kind==='shot',i=step.index,[x,y]=target(m,i+(isShot?0:3)),p=clamp(dt/(step.impact-step.at));
   if(after<0){
     cue(m.id+'-'+step.kind+i,isShot?'shot':'toss',m.tier);
     if(isShot){
       ribbon(ox,oy,x,y,p,colors,level);
       if(state.config.glow&&dt<spec.muzzleFlashMs)disk(ctx,ox,oy,13*(1-dt/spec.muzzleFlashMs),colors[1]);
     }else{
       const icon=asset(grenadeAsset(state.config.grenade>=0?state.config.grenade:(seed+i+level)%10));
       const ax=mix(330,x,p),ay=mix(1630,y,p)-390*4*p*(1-p),size=96+level*5;
       ctx.save();ctx.translate(ax,ay);ctx.rotate(p*8);
       if(icon)ctx.drawImage(icon,-size/2,-size/2,size,size);
       else disk(ctx,0,0,size/3,colors[0]);
       ctx.restore();
     }
     continue;
   }
   if(cue(m.id+'-'+step.kind+i,isShot?'hit':'paint-burst',m.tier)&&(i===q.shots-1||!isShot)){
     floor.push({x,level,seed:seed+i,wall:state.wallNumber,until:now+12000});if(floor.length>23)floor.shift();
   }
   const settle=clamp(after*speed/(isShot?spec.impactExpandMs:spec.grenadeBloomMs));
   const r=m.community?(state.config.peak??315)*wallScale/2.4*(.07+.93*Math.sin(Math.PI/2*clamp(settle*2.7))):spec.damageRadius*wallScale*(isShot?1:2.15)*(.35+.65*clamp(settle*4));
   const fx=asset(fxAsset(m.community?seed%7:level,i+(isShot?0:2)));
   ctx.save();ctx.beginPath();ctx.rect(0,WALL_TOP,1080,WALL_BOTTOM-WALL_TOP);ctx.clip();ctx.globalAlpha=(1-settle)*.90;
   if(!isShot&&state.config.shake&&after<135)ctx.translate(Math.sin(after/11)*7*(1-after/135),Math.sin(after/8)*4*(1-after/135));
   if(!isShot&&state.config.flash&&after<120){ctx.fillStyle=colors[1];ctx.globalAlpha=.12*(1-after/120);ctx.fillRect(0,WALL_TOP,1080,WALL_BOTTOM-WALL_TOP);ctx.globalAlpha=(1-settle)*.90;}
   if(fx)ctx.drawImage(fx,x-r*1.2,y-r*1.2,r*2.4,r*2.4);
   if(state.config.sparks)for(let j=0;j<Math.min(Math.floor((isShot?9:23)*quality),Math.floor(budget/10));j++){
     const a=j*2.39996,d=r*(.37+rand(seed+j*73)*1.5)*(.25+.85*settle);
     disk(ctx,x+Math.cos(a)*d,y+Math.sin(a)*d+settle*settle*42,3+rand(seed+j*13)*8*(1-settle),colors[(j+i)%3]);
   }
   ctx.restore();
 }
 if(now>=m.land&&now-m.land<200&&m.coins)cue(m.id,'frame',m.tier);
 if(level>=4&&now>=m.land&&now-m.land<1450){
   const age=now-m.land,p=clamp(age/320);
   ctx.save();ctx.globalAlpha=clamp((1450-age)/350);ctx.translate(690+(1-p)*270,1173);ctx.rotate(-.09);
   box(-113,-26,226,52,14,'#23154cda');text('THANK YOU',0,0,24,'#fcddff');ctx.restore();
 }
 const threshold=m.community?.47:spec.rendering?.showAvatarOnlyAfterPaintProgress??.65;
 if(now<m.land&&elapsed/q.duration>threshold){
   const p=clamp((elapsed/q.duration-threshold)/(1-threshold));
   ctx.save();ctx.beginPath();ctx.rect(0,WALL_TOP,1080,WALL_BOTTOM-WALL_TOP);ctx.clip();tag(m.art??m,p,p);ctx.restore();
 }
}
let editingTop=false,dragTop=null,localTop=null;
function topGeometry(){
 if(localTop)return localTop;
 const w=state.config.topWidth??292,x=Math.max(0,Math.min(1080-w,state.config.topX??753));
 return {x,y:state.config.topY??1478,w};
}
addEventListener('message',event=>{
 if(!preview||event.origin!==location.origin||event.source!==parent||typeof event.data?.topEditing!=='boolean')return;
 editingTop=event.data.topEditing;dirty=true;canvas.style.touchAction=editingTop?'none':'';
});
const pointer=e=>{const rect=canvas.getBoundingClientRect();return {x:(e.clientX-rect.left)*1080/rect.width,y:(e.clientY-rect.top)*1920/rect.height};};
canvas.addEventListener('pointerdown',e=>{
 if(!editingTop||!state)return;
 const p=pointer(e),g=topGeometry(),h=49+Math.max(1,state.top.length)*38;
 if(p.x<g.x||p.x>g.x+g.w||p.y<g.y||p.y>g.y+h)return;
 dragTop={p,g,resize:p.x>g.x+g.w-60&&p.y>g.y+h-65};canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove',e=>{
 if(!dragTop)return;
 const p=pointer(e),{g,resize}=dragTop,dx=p.x-dragTop.p.x,dy=p.y-dragTop.p.y;
 const w=resize?Math.min(600,1080-g.x,Math.max(220,g.w+dx)):g.w;
 dirty=true;localTop={w,x:resize?g.x:Math.max(0,Math.min(1080-w,g.x+dx)),y:resize?g.y:Math.max(130,Math.min(1610,g.y+dy))};
});
canvas.addEventListener('pointerup',()=>{
 if(dragTop&&localTop)parent.postMessage({topLayout:localTop},location.origin);
 dragTop=null;setTimeout(()=>{if(!dragTop){localTop=null;dirty=true;}},800);
});
canvas.addEventListener('pointercancel',()=>{dragTop=null;localTop=null;dirty=true;});
function draw(time){
 requestAnimationFrame(draw);
 const now=Date.now(),move=state?.wallMove,wall=state?.wallNumber??1;
 const active=state?.scene;
 const moving=Boolean((move&&now<move.end)||(active&&now<Math.min(active.end,active.land+(active.coins?1450:0)))||dragTop);
 if(!dirty&&!moving&&!wasMoving&&time<nextIdle)return;
 if(time-lastFrame<(low()?29:14))return;
 const width=preview?360:low()?540:1080,height=width*16/9;
 if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
 ctx.setTransform(width/1080,0,0,height/1920,0,0);
 lastFrame=time;frames++;
 if(time-sampleAt>=1000){
   if(preview)parent.postMessage({graffitiFps:Math.round(frames*1000/(time-sampleAt)),graffitiIdle:!moving},location.origin);
   sampleAt=time;frames=0;
 }
 dirty=false;wasMoving=moving;
 nextIdle=floor.some(s=>now<s.until+250)?time+250:Infinity;
 backgroundAndFloor(now);
 if(move&&now<move.end){
   const p=clamp((now-move.start)/(move.fadeEnd-move.start));
   if(p<.28)cue('wall-'+move.start,'wall',0);
   if(move.kind==='communityFullToBlank'){
     ctx.save();ctx.beginPath();ctx.rect(1080*p,WALL_TOP,1080*(1-p),WALL_BOTTOM-WALL_TOP);ctx.clip();
     paintLayer(move.oldMarks,now,1);ctx.restore();
   }else{
     paintLayer(move.oldMarks,now,1-clamp(p*2));
     paintLayer(state.marks,now,clamp((p-.5)*2));
   }
 }else{
   if(state?.scene?.before&&now<state.scene.land){
     const progress=clamp((now-state.scene.drawStart)/(state.scene.land-state.scene.drawStart));
     paintLayer([state.scene.before],now,1-clamp((progress-.54)/.46));
   }
   paintLayer(state?.marks??[],now,1);
 }
 const shade=ctx.createLinearGradient(0,1420,0,1920);
 shade.addColorStop(0,'#0b132500');shade.addColorStop(1,'#0a1021bd');ctx.fillStyle=shade;ctx.fillRect(0,1420,1080,500);
 box(35,46,1010,81,22,'#151021db');
 text('MAI TRƯỜNG  /  GRAFFITI WAR',62,88,29,'#fff3ee','left');text(state?.wallMode==='gift'?'VINH DANH':'TƯỜNG '+wall,1014,88,24,'#9ce9ff','right');
 if(!state)return;
 const scene=state.scene&&now<state.scene.end?state.scene:null;
 if(scene){
   for(const member of scene.members??[scene])spray(member,now);
   const level=baseLevel(scene);
   if(level>=4){
     box(282,157,516,56,18,'#21112bdd');
     text(level===6?'SIÊU VIP PRO':'BẬC '+(level+1)+' · '+scene.item.toUpperCase(),540,185,25,level===6?'#ffe0a0':'#ffe1f5');
   }
 }
 const switching=scene&&(scene.members??[scene]).some(m=>m.canSpray&&now>=m.drawStart+(plan(m).steps.at(-1)?.impact??0)&&now<m.land);
 if(!switching)weapon(scene,now,true);
 else if(state.config.showGun){
   const x=832,y=1545;
   ctx.save();ctx.translate(x,y);ctx.rotate(.23);
   box(-48,-79,96,224,25,'#171831');box(-45,-60,90,185,20,'#754cff');
   box(-34,-91,68,34,10,'#d8e7fb');box(-16,-109,32,21,5,'#10102a');text('MT',0,23,32,'#f8e6ff');
   ctx.restore();
 }
 if(state.config.teams){box(330,146,420,48,17,'#141228d8');text('ĐỎ '+state.teams[0]+' · '+state.teams[1]+' XANH',540,171,22);}
 if(editingTop||state.config.top&&state.top.length){
   const {x,y,w}=topGeometry(),h=49+Math.max(1,state.top.length)*38;
   box(x,y,w,h,16,'#131126dc');text('TOP HỌA SĨ',x+16,y+24,19,'#ffe2a4','left');
   if(editingTop)box(x+w-26,y+h-26,22,22,5,'#78d8ff');
   state.top.forEach((m,i)=>{text((i+1)+'  '+label(m).slice(0,14),x+15,y+55+i*38,17,'#fff','left');text(m.coins.toLocaleString('vi-VN'),x+w-14,y+55+i*38,16,'#96deff','right');});
 }
 const note=scene?(scene.members??[scene]).map(m=>label(m).slice(0,17)).join(' · '):move&&now<move.end?'Đổi lớp sơn':state.giftQueued?'Đang chờ '+state.giftQueued+' lượt quà':state.winners.length||state.winningTeam?'Vinh danh · '+(state.winningTeam||label(state.winners[0])):'Bình luận để vẽ avatar';
 box(180,1790,720,63,18,'#141125d9');text(note,540,1822,27,'#fff2f8');
 if(source==='demo')text('PHÒNG THỬ',540,1890,16,'#bcddfb');
}
requestAnimationFrame(draw);
