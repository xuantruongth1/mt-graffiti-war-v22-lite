import {manifest} from './v2.mjs';
const bounds=[
 [350,640,235,242],[280,610,355,300],[309,586,400,328],[220,570,484,365],
 [125,581,640,381],[95,552,736,409],[0,384,941,770]
];
const openings=[
 [472,741,57,54],[464,742,62,56],[491,738,80,63],[490,730,89,75],
 [458,731,89,76],[462,714,91,84],[462,713,80,75]
];
const originalSizes=[181,230,300,375,450,635,850];
const widths=[260,390,486,605,778,907,1026];
export function frameGeometry(level,size){
 const {avatar:a,username:n}=manifest.tiers[level];
 const [sx,sy,sw,sh]=bounds[level],scale=Math.min(widths[level]*size/originalSizes[level]/sw,1026/sw,810/sh);
 const [cx,cy,rx,ry]=openings[level];
 return {
   source:[sx,sy,sw,sh],scale,
   portrait:{x:(cx-a.center_x)*scale,y:(cy-a.center_y)*scale,rx:rx*scale,ry:ry*scale},
   radius:a.radius*scale,left:(a.center_x-sx)*scale,right:(sx+sw-a.center_x)*scale,
   top:(a.center_y-sy)*scale,bottom:(sy+sh-a.center_y)*scale,
   nameX:(n.center_x-a.center_x)*scale,nameY:(n.center_y-a.center_y)*scale,
   nameWidth:n.max_width*scale,nameFont:Math.min(60,Math.max(20,Math.round(23*scale)))
 };
}
export function drawFrame(ctx,image,g){
 const [x,y,w,h]=g.source;
 const sx=image.naturalWidth/941,sy=image.naturalHeight/1672;
 ctx.drawImage(image,x*sx,y*sy,w*sx,h*sy,-g.left,-g.top,w*g.scale,h*g.scale);
}
