import {manifest} from './v2.mjs';
const anchors=manifest.tiers;

const bounds=[
 [357,648,224,231],[288,618,341,283],[317,595,384,310],[231,579,462,343],
 [137,598,618,343],[108,571,710,369],[0,384,941,770]
];
const openings=[
 [472,741,57,54],[464,742,62,56],[491,738,80,63],[490,730,89,75],
 [458,731,89,76],[462,714,91,84],[462,713,80,75]
];
const originalSizes=[181,230,300,375,450,635,850];
const radii=[51,59,71,86,128,151,171];
const walls=[[390,320],[486,360],[605,425],[778,510],[907,600],[1026,805]];

function axis(begin,end,center,radius,span,scale){
 const inner=radius*1.17;
 const source=[begin,center-inner,center+inner,end];
 const used=2*inner*scale,left=span==null?(center-begin-inner)*scale:(span-used)*(center-begin-inner)/(end-begin-2*inner);
 const right=span==null?(end-center-inner)*scale:span-used-left;
 const points=[-left-inner*scale,-inner*scale,inner*scale,inner*scale+right];
 const project=v=>{
   const i=v<source[1]?0:v<source[2]?1:2;
   return points[i]+(v-source[i])*(points[i+1]-points[i])/(source[i+1]-source[i]);
 };
 return {source,points,project};
}
export function frameGeometry(level,size){
 const {avatar:a,username:n}=anchors[level], [sx,sy,sw,sh]=bounds[level];
 const scale=radii[level]/a.radius*Math.min(level>=4?1.12:1.6,size/originalSizes[level]);
 const [baseWidth,baseHeight]=walls[level-1]??[];
 const ratio=Math.max(.57,Math.min(1.13,size/originalSizes[level]));
 const width=level?Math.min(1060,baseWidth*ratio):undefined;
 const height=level?Math.min(810,baseHeight*ratio):undefined;
 const x=axis(sx,sx+sw,a.center_x,a.radius,width,scale);
 const y=axis(sy,sy+sh,a.center_y,a.radius,height,scale);
 const [cx,cy,rx,ry]=openings[level];
 const x0=x.project(cx-rx),x1=x.project(cx+rx),y0=y.project(cy-ry),y1=y.project(cy+ry);
 return {
   portrait:{x:(x0+x1)/2,y:(y0+y1)/2,rx:(x1-x0)/2,ry:(y1-y0)/2},
   x,y,radius:a.radius*scale,left:-x.points[0],right:x.points[3],top:-y.points[0],bottom:y.points[3],
   nameX:x.project(n.center_x),nameY:y.project(n.center_y),
   nameWidth:x.project(n.center_x+n.max_width/2)-x.project(n.center_x-n.max_width/2),
   nameFont:Math.min(60,Math.max(20,Math.round(23*scale)))
 };
}
export function drawFrame(ctx,image,g){
 for(let i=0;i<3;i++)for(let j=0;j<3;j++){
   const x=g.x,y=g.y;
   ctx.drawImage(image,x.source[i],y.source[j],x.source[i+1]-x.source[i],y.source[j+1]-y.source[j],
     x.points[i],y.points[j],x.points[i+1]-x.points[i],y.points[j+1]-y.points[j]);
 }
}
