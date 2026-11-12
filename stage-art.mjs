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

export function wallPanPositions(progress,width=1080){
 const distance=clamp(progress)*width;
 return {outgoing:0-distance,incoming:width-distance};
}

export function impactRadius(mark,step,stepCount){
 if(mark.community)return 138*(mark.artScale??1);
 if(step.kind==='bomb')return 244;
 return stepCount<=5?232:stepCount<=12?165:132;
}

const streetPalettes={
 NEON_POP:['#f21595','#ffce28','#00d6ed','#7839fa','#ff5c39','#a4ed3d'],
 ACID_LIME:['#95ef22','#5d34e9','#ff8c27','#00c8b7','#fa2f8d','#ffdf52'],
 FIRE_ICE:['#ff5a27','#1d8dff','#ffd741','#35dbdc','#ec275d','#793eef'],
 ULTRAVIOLET:['#8d35ff','#21d5ee','#ff41a4','#ffca30','#3262ef','#68ef9e'],
 RAINBOW_STREET:['#ff325a','#ffc533','#13d4df','#853afa','#a5e929','#ff793d']
};
export function streetColors(skin,index){
 const colors=streetPalettes[skin]??streetPalettes.NEON_POP;
 return [colors[index%6],colors[(index+2)%6],colors[(index+4)%6]];
}

function splashLobe(ctx,x,y,r,color,seed){
 const mist=ctx.createRadialGradient(x,y,r*.12,x,y,r*1.25);
 mist.addColorStop(0,color+'f2');
 mist.addColorStop(.48,color+'da');
 mist.addColorStop(.77,color+'97');
 mist.addColorStop(1,color+'00');
 ctx.fillStyle=mist;ctx.beginPath();
 for(let i=0;i<36;i++){
   const angle=i*Math.PI/18,edge=r*(.68+rand(seed+i*11)*.46+(i%7===0?.19:0));
   const px=x+Math.cos(angle)*edge,py=y+Math.sin(angle)*edge;
   if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
 }
 ctx.closePath();ctx.fill();
}

export function wallPigment(ctx,colors,seed){
 const center=256,angle=rand(seed+39)*Math.PI*2;
 for(const [i,color] of colors.entries()){
   const a=angle+i*Math.PI*2/3;
   const x=center+Math.cos(a)*76,y=center+Math.sin(a)*67;
   splashLobe(ctx,x,y,143-i*7,color,seed+i*193);
   for(let j=0;j<44;j++){
     const ray=rand(seed+i*37+j*23)*Math.PI*2;
     const distance=Math.sqrt(rand(seed+i*53+j*19))*151;
     ctx.globalAlpha=(1-distance/180)*(.45+rand(seed+j*71)*.52);
     disk(ctx,x+Math.cos(ray)*distance,y+Math.sin(ray)*distance,1+rand(seed+j*43)*6,color);
   }
   ctx.globalAlpha=.74;ctx.strokeStyle=color;ctx.lineCap='round';
   for(let j=0;j<4;j++){
     const dx=x+(rand(seed+i*31+j*37)-.5)*130;
     const dy=y+42+rand(seed+i*47+j*91)*42;
     const length=20+rand(seed+i*51+j*17)*84;
     ctx.lineWidth=1+rand(seed+j*61)*4;
     ctx.beginPath();ctx.moveTo(dx,dy);ctx.quadraticCurveTo(dx+3,dy+15,dx,dy+length);ctx.stroke();
   }
   ctx.globalAlpha=1;
 }
}
