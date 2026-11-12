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
