import {planPainting} from './scene-plan.mjs';
import weapons from './v2/weapon-anchors.json' with {type:'json'};
import {faceRadius,palette,tierLevel,WALL_TOP,WALL_BOTTOM} from './stage-layout.mjs';
import {clamp,mix,rand,disk,paintStamp} from './stage-art.mjs';
import {frameGeometry,drawFrame} from './asset-layout.mjs';
import {manifest,tierSpecs,timeline,v2Frame,gunAsset,grenadeAsset,fxAsset,wallScale,wallRules} from './v2.mjs';

const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d',{alpha:false});
const params=new URLSearchParams(location.search),preview=params.has('preview'),source=params.get('source')==='demo'?'demo':'live';
const button=document.querySelector('#sound'),background=new Image();background.src=preview?'/v2/lite/wall.webp':'/v2/wall.png';
let state,audio,enabled=false,lastFrame=0,frames=0,sampleAt=performance.now(),lastWall=1;
const images=new Map(),recipes=new Map(),heard=new Set(),floor=[];
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
 else if(kind==='hiss'){texture(5100,1600,.55,.16);}
 else if(kind==='click'){tone(980,470,.07,.09);}
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
 const streetColors={
   NEON_POP:[m.color,'#f22fa1','#28dcff'],
   ACID_LIME:['#a9ff42','#29c56d','#dfff84'],
   FIRE_ICE:['#ff5029','#ffba49','#4ecfff'],
   ULTRAVIOLET:['#853cff','#dd62ff','#584cfb'],
   RAINBOW_STREET:['#ff3c93','#fed544','#41efa4']
 };
 const key='paint:'+m.uid+':'+m.color+':'+m.skin+':'+width+':'+height;
 if(paintCache.has(key))return paintCache.get(key);
 const tile=document.createElement('canvas');
 tile.width=Math.ceil(width);tile.height=Math.ceil(height*1.25);
 const g=tile.getContext('2d');g.translate(tile.width/2,tile.height*.43);
 paintStamp(g,0,0,width*.35,streetColors[m.skin]??streetColors.NEON_POP,hash(m.uid),2);
 return remember(paintCache,key,tile,24);
}
function frameTile(url,image,g){
 const key=url+':'+g.radius;
 if(paintCache.has(key))return paintCache.get(key);
 const tile=document.createElement('canvas'),scale=preview?.75:1;
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
function plan(m){return m.sequence??timeline(baseLevel(m));}
function recipe(m){
 return m.painting??recipes.get(m.id)??remember(recipes,m.id,planPainting(m,plan(m)),32);
}
function sceneKey(){
 return state?.wallMode==='gift'?'gift:'+(state.marks[0]?.wallId??'blank'):'page:'+(state?.wallNumber??1);
}
function coverage(m,now){
 const art=recipe(m),elapsed=now-m.drawStart;
 if(now>=m.land)return art;
 const w=art.width/art.cols,h=art.height/art.rows;
 ctx.beginPath();
 for(const cell of art.cells){
   const p=clamp((elapsed-cell.at-cell.jitter)/100);
   if(!p)continue;
   const x=art.left-m.x+cell.x*w,y=art.top-m.y+cell.y*h;
   if(p===1){ctx.rect(x-.65,y-.65,w+1.3,h+1.3);continue;}
   const t=w*p;
   ctx.moveTo(x,y);ctx.lineTo(x+t,y);ctx.lineTo(x+t*.81,y+h*.46);
   ctx.lineTo(x+t*.93,y+h);ctx.lineTo(x,y+h);ctx.closePath();
 }
 ctx.clip();
 return art;
}
function tag(m,now,opacity){
 const elapsed=now-m.drawStart;
 if(m.community){
   const shot=plan(m).steps[0];
   if(elapsed>=shot.impact)commentTag(m,now>=m.land?1:clamp((elapsed-shot.impact)/Math.max(1,m.land-m.drawStart-shot.impact)),opacity);
   return;
 }
 const level=baseLevel(m),g=frameGeometry(level,m.size),original=v2Frame(level,m.skin||manifest.skins[0]);
 const image=asset(preview?liteUrl(original):original);
 const art=recipe(m),finished=now>=m.land;
 if(!finished&&elapsed<art.steps[0].impact)return;
 ctx.save();ctx.translate(m.x,m.y);ctx.globalAlpha=opacity;
 const {x,y,rx,ry}=g.portrait,face=finished?1:clamp((elapsed-art.avatarAt)/220);
 if(face){ctx.save();ctx.globalAlpha=opacity*face;avatar(m,x,y,rx,ry);ctx.restore();}
 if(image){
   ctx.save();coverage(m,now);
   ctx.drawImage(frameTile(preview?liteUrl(original):original,image,g),-g.left,-g.top,g.left+g.right,g.top+g.bottom);
   ctx.restore();
 }
 const nameProgress=finished?1:clamp((elapsed-art.nameAt)/210);
 if(nameProgress){
   ctx.save();ctx.beginPath();ctx.rect(g.nameX-g.nameWidth/2-3,g.nameY-g.nameFont,g.nameWidth*nameProgress+6,g.nameFont*2);ctx.clip();
   const name=label(m);
   ctx.font='italic 950 '+g.nameFont+'px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
   ctx.lineWidth=Math.max(2,g.nameFont*.12);ctx.strokeStyle='#211027';ctx.strokeText(name,g.nameX,g.nameY,g.nameWidth);
   ctx.fillStyle='#fff8fd';ctx.fillText(name,g.nameX,g.nameY,g.nameWidth);
   ctx.restore();
 }
 ctx.restore();
}
function backgroundAndFloor(now){
 const wall=background;
 if(wall.complete&&wall.naturalWidth)ctx.drawImage(wall,0,0,1080,1920);
 else {ctx.fillStyle='#4e4544';ctx.fillRect(0,0,1080,1920);}
 for(const s of floor){
   if(now>=s.until||s.scene!==sceneKey()||state?.wallMove&&now<state.wallMove.end)continue;
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
 for(const m of marks)tag(m,now,opacity);
 ctx.restore();
}
function paintBolt(origin,target,p,colors,seed,level){
 const [x,y]=origin,[tx,ty]=target,bend=(seed%15)-7;
 const point=t=>[mix(x,tx,t)+Math.sin(t*Math.PI)*bend,mix(y,ty,t)-Math.sin(t*Math.PI)*18];
 const distance=Math.hypot(tx-x,ty-y),trail=Math.min(.30,100/Math.max(100,distance));
 const head=point(p),tail=point(Math.max(0,p-trail)),size=6+level*.8;
 ctx.save();ctx.lineCap='round';ctx.strokeStyle=colors[0];ctx.lineWidth=size*1.55;
 ctx.beginPath();ctx.moveTo(...tail);ctx.lineTo(...head);ctx.stroke();
 disk(ctx,...head,size,colors[1]);disk(ctx,...head,size*.44,'#fff2d6');
 for(let i=1;i<=3;i++){
   const [dx,dy]=point(Math.max(0,p-i*.09));disk(ctx,dx+(seed%7-3)*i,dy+i*3,Math.max(1,size-i*1.5),colors[i%3]);
 }
 ctx.restore();
}
function weapon(m,now,render,firingStep){
 const c=state.config,level=m?baseLevel(m):0;
 const index=c.gun>=0?c.gun:Math.max(0,manifest.guns.findIndex(g=>g.id===tierSpecs[level].weapon));
 const url=gunAsset(index),prop=render&&c.showGun?asset(low()?liteUrl(url):url):null,scale=c.gunScale??.71;
 const anchor=weapons[manifest.guns[index].id],unit=wallScale*scale;
 const shift=1080*(1-scale),top=1920*(1-scale);
 const elapsed=m?now-m.drawStart:0,steps=m?recipe(m).steps:[];
 const next=firingStep??steps.find(s=>s.kind==='shot'&&s.at>=elapsed)??steps.findLast(s=>s.kind==='shot');
 const bomb=steps.find(s=>s.kind==='bomb'&&elapsed>=s.at-210&&elapsed<=s.impact+150);
 const lastShot=firingStep??steps.findLast(s=>s.kind==='shot'&&s.at<=elapsed);
 const age=firingStep?0:elapsed-(lastShot?.at??-1000),kick=age<42?clamp(age/42):1-clamp((age-42)/80);
 const recoil=(m?.recoil??8)*kick;
 const down=bomb?220*Math.min(clamp((elapsed-bomb.at+210)/180),clamp((bomb.impact+150-elapsed)/150)):0;
 const px=shift+anchor.pivot[0]*unit,py=top+anchor.pivot[1]*unit;
 const localX=(anchor.muzzle[0]+c.muzzleX-225-anchor.pivot[0])*unit;
 const localY=(anchor.muzzle[1]+c.muzzleY-1060-anchor.pivot[1])*unit;
 const target=next?.target;
 const aim=target?Math.atan2(target[1]-(py+localY),target[0]-(px+localX))-anchor.axis:0;
 const angle=Math.max(-anchor.limit,Math.min(anchor.limit,aim));
 const ox=px+localX*Math.cos(angle)-localY*Math.sin(angle)+recoil*.52;
 const oy=py+localX*Math.sin(angle)+localY*Math.cos(angle)+recoil+down;
 if(render&&prop){
   ctx.save();ctx.translate(px+recoil*.52,py+recoil+down);ctx.rotate(angle);
   ctx.drawImage(prop,shift-px,top-py,1080*scale,1920*scale);ctx.restore();
 }
 if(render&&bomb&&c.showGun){
   const hand=asset('/v2/'+manifest.v3_hands.toss);
   const lift=Math.sin(Math.PI*clamp((elapsed-bomb.at+210)/(bomb.impact-bomb.at+360)));
   if(hand){
     ctx.save();ctx.translate(330,1630+180*(1-lift));ctx.rotate(-.40*lift);
     ctx.drawImage(hand,-110,-108,360,335);
     if(elapsed<bomb.at){
       const held=asset(grenadeAsset(c.grenade>=0?c.grenade:(hash(m.id)+bomb.index+level)%10));
       if(held)ctx.drawImage(held,-41,-63,83,83);
     }
     ctx.restore();
   }
 }
 return c.showGun?[ox,oy]:[220,1710];
}
function sprayCan(m,now){
 const elapsed=now-m.drawStart,last=plan(m).steps.at(-1)?.impact??0,r=faceRadius(m.coins,m.tier,m.size);
 const p=clamp((elapsed-last)/Math.max(1,plan(m).duration-last));
 if(p<=0||now>=m.land)return;
 cue(m.id,'hiss',m.tier);
 if(p>.93)cue(m.id,'click',m.tier);
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
 const budget=low()||state.giftQueued>=15?45:240;
 if(m.canSpray)sprayCan(m,now);
 for(const step of recipe(m).steps){
   const dt=elapsed-step.at,after=elapsed-step.impact;
   if(dt<0||after>(step.kind==='shot'?spec.impactExpandMs:spec.grenadeBloomMs)/speed)continue;
   const isShot=step.kind==='shot',i=step.index,[x,y]=step.target,p=clamp(dt/(step.impact-step.at));
   if(after<0){
     cue(m.id+'-'+step.kind+i,isShot?'shot':'toss',m.tier);
     if(isShot){
       const [ox,oy]=weapon(m,m.drawStart+step.at,false,step);
       paintBolt([ox,oy],[x,y],p,colors,step.seed,level);
       if(state.config.glow&&dt<spec.muzzleFlashMs)disk(ctx,ox,oy,13*(1-dt/spec.muzzleFlashMs),colors[1]);
     }else{
       const icon=asset(grenadeAsset(state.config.grenade>=0?state.config.grenade:(seed+i+level)%10));
       const ax=mix(330,x,p),ay=mix(1630,y,p)-390*4*p*(1-p),size=(96+level*5)*(1-.48*p);
       ctx.save();ctx.translate(ax,ay);ctx.rotate(p*Math.PI*4);
       if(icon)ctx.drawImage(icon,-size/2,-size/2,size,size);
       else disk(ctx,0,0,size/3,colors[0]);
       ctx.restore();
     }
     continue;
   }
   if(cue(m.id+'-'+step.kind+i,isShot?'hit':'paint-burst',m.tier)&&(i===q.shots-1||!isShot)){
     floor.push({x,level,seed:seed+i,scene:sceneKey(),until:now+12000});if(floor.length>23)floor.shift();
   }
   const settle=clamp(after*speed/(isShot?spec.impactExpandMs:spec.grenadeBloomMs));
   const r=m.community?(state.config.peak??315)*wallScale/2.4*(.07+.93*Math.sin(Math.PI/2*clamp(settle*2.7))):spec.damageRadius*wallScale*(isShot?1:2.15)*(.35+.65*clamp(settle*4));
   const fx=asset(fxAsset(m.community?seed%7:level,i+(isShot?0:2)));
   ctx.save();ctx.beginPath();ctx.rect(0,WALL_TOP,1080,WALL_BOTTOM-WALL_TOP);ctx.clip();ctx.globalAlpha=(1-settle)*.90;
   if(!isShot&&state.config.shake&&after<135)ctx.translate(Math.sin(after/11)*7*(1-after/135),Math.sin(after/8)*4*(1-after/135));
   if(!isShot&&state.config.flash&&after<120){ctx.fillStyle=colors[1];ctx.globalAlpha=.12*(1-after/120);ctx.fillRect(0,WALL_TOP,1080,WALL_BOTTOM-WALL_TOP);ctx.globalAlpha=(1-settle)*.90;}
   if(fx)ctx.drawImage(fx,x-r*1.2,y-r*1.2,r*2.4,r*2.4);
   if(settle<.24)disk(ctx,x,y,Math.max(1,r*.23*(1-settle*4)),colors[1]);
   ctx.strokeStyle=colors[0];ctx.lineWidth=2+level*.4;ctx.lineCap='round';
   for(let d=0;d<(low()?2:4);d++){
     const dx=x+(rand(step.seed+d)*2-1)*r*.70;
     ctx.beginPath();ctx.moveTo(dx,y+r*.30);ctx.quadraticCurveTo(dx+3,y+r*.45,dx,y+r*(.34+.59*settle));ctx.stroke();
   }
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
   ctx.font='italic 900 47px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
   ctx.strokeStyle='#361034';ctx.lineWidth=11;ctx.lineJoin='round';
   ctx.strokeText('THANK YOU',0,0);ctx.fillStyle='#fff0b5';ctx.fillText('THANK YOU',0,0);ctx.restore();
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
 const width=preview?540:1080,height=width*16/9;
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
 canvas.dataset.ready='true';
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
   const hand=asset('/v2/'+manifest.v3_hands.spray);
   if(hand)ctx.drawImage(hand,580,1425,474,484);
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
