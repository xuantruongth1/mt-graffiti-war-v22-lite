import {palette,WALL_TOP,WALL_BOTTOM} from './stage-layout.mjs';

export const mix=(a,b,t)=>a+(b-a)*t;
export const clamp=(t)=>Math.max(0,Math.min(1,t));
export const rand=(i)=>{const v=Math.sin(i*127.1+311.7)*43758.5453;return v-Math.floor(v);};
export function disk(ctx,x,y,r,color){
 if(r<=0)return;ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
}
export function paintStamp(ctx,x,y,r,colors,seed,detail){
 ctx.save();ctx.translate(x,y);
 for(let layer=colors.length-1;layer>=0;layer--){
   const rr=r*(1.04-layer*.14),shift=layer===0?0:(layer===1?-.32:.32);
   ctx.fillStyle=colors[layer];ctx.beginPath();
   for(let i=0;i<44;i++){
     const a=i*Math.PI/22,dr=rr*(.66+rand(seed+i*7+layer*92)*.32+(i%6===0?.28:0));
     const px=Math.cos(a)*dr+shift*r,py=Math.sin(a)*dr+(layer?.14*r:0);
     if(i)ctx.lineTo(px,py);else ctx.moveTo(px,py);
   }
   ctx.closePath();ctx.fill();
   ctx.lineCap='round';ctx.strokeStyle=colors[layer];
   for(let i=0;i<4+detail;i++){
     const dx=(rand(seed+i*8+layer)-.5)*rr*1.7+shift*r,top=Math.sqrt(Math.max(0,rr*rr-dx*dx))*.66;
     const len=rr*(.18+rand(seed+i*19+layer)*.52);
     ctx.lineWidth=rr*(.016+rand(seed+i*41)*.033);
     ctx.beginPath();ctx.moveTo(dx,top);ctx.quadraticCurveTo(dx+rr*.035,top+len*.45,dx+rr*.012,top+len);ctx.stroke();
   }
   for(let i=0;i<16+detail*4;i++){
     const a=rand(seed+i*13+layer*76)*Math.PI*2,d=rr*(.70+rand(seed+i*53+layer*19)*.67);
     disk(ctx,Math.cos(a)*d+shift*r,Math.sin(a)*d,rr*(.008+rand(seed+i*63)*.031),colors[layer]);
   }
 }
 ctx.restore();
}
export function makeMural(level,lite=false){
 const h=WALL_BOTTOM-WALL_TOP,art=document.createElement('canvas');const scale=lite?.5:1;art.width=1080*scale;art.height=Math.ceil(h*scale);
 const g=art.getContext('2d');g.scale(scale,scale);const p=palette[level],b=g.createLinearGradient(0,0,1080,h);
 b.addColorStop(0,'#231247');b.addColorStop(.48,level===4?'#512775':'#301257');b.addColorStop(1,'#18193e');
 g.fillStyle=b;g.fillRect(0,0,1080,h);
 for(let i=0;i<20;i++){
   const column=i%5,row=Math.floor(i/5),x=column*248-25+rand(i*13)*120,y=row*272-20+rand(i*27)*151;
   g.globalAlpha=.69+rand(i*23)*.24;
   paintStamp(g,x,y,105+rand(i*11)*151,[p[i%3],p[(i+1)%3],p[(i+2)%3]],i+level*83,level);
 }
 g.globalAlpha=1;
 const mid=g.createRadialGradient(540,h*.47,150,540,h*.47,520);
 mid.addColorStop(0,'#160829ac');mid.addColorStop(1,'#16082900');g.fillStyle=mid;g.fillRect(0,0,1080,h);
 for(let i=0;i<(lite?300:1100);i++){
   const x=rand(i*3+level)*1080,y=rand(i*9+level)*h;
   g.globalAlpha=.13+rand(i*17)*.45;disk(g,x,y,.3+rand(i*5)*2.5,i%3?p[i%3]:'#ffe5ff');
 }
 g.globalAlpha=1;
 return art;
}
