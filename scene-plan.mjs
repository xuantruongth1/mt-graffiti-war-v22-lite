import {frameGeometry} from './asset-layout.mjs';
import {tierLevel,WALL_TOP,WALL_BOTTOM} from './stage-layout.mjs';

export const TIMELINE_VERSION=3;
export const ART_REGIONS=['underpaint','left','right','crown','lower','portrait','signature'];
const order=[0,1,2,3,4,5,6];
const anchors=[[.45,.44],[.18,.43],[.82,.43],[.49,.16],[.51,.81],[.5,.5],[.5,.68]];

export function planPainting(mark,sequence){
 const level=tierLevel(mark.coins,mark.tier),g=mark.community?null:frameGeometry(level,mark.size);
 const width=mark.fullMural?1020:g?g.left+g.right:315,height=mark.fullMural?WALL_BOTTOM-WALL_TOP-44:g?g.top+g.bottom:300;
 const left=mark.fullMural?30:g?mark.x-g.left:mark.x-width/2,top=mark.fullMural?WALL_TOP+22:g?mark.y-g.top:mark.y-height/2;
 const seed=Array.from(mark.eventId||mark.id).reduce((n,ch)=>Math.imul(n,31)+ch.codePointAt(0)>>>0,2166136261);
 const cols=16,rows=12,cells=[],steps=sequence.steps.map((step,index)=>{
   const region=order[Math.min(order.length-1,Math.floor(index*order.length/sequence.steps.length))];
   const [u,v]=mark.fullMural&&sequence.steps.length===3?[[.46,.48],[.20,.44],[.80,.55]][index]:anchors[region];
   const target=mark.community?[mark.x+(mark.smartWall?(index?20:-20):0),mark.y+(mark.smartWall?(index?9:-9):0)]:region===5?[mark.x+g.portrait.x,mark.y+g.portrait.y]:region===6?[mark.x+g.nameX,mark.y+g.nameY]:[left+width*u,top+height*v];
   return {...step,region:ART_REGIONS[region],target,seed:(seed+index*977)>>>0};
 });
 for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
   const px=left+width*(x+.5)/cols,py=top+height*(y+.5)/rows;
   const last=steps.at(-1);
   const finalDetail=g&&steps.length>1&&y>=rows-2&&Math.abs(x-(cols-1)/2)<2;
   const step=finalDetail?last:steps.reduce((best,s)=>{
     const score=t=>Math.hypot((px-t.target[0])/width,(py-t.target[1])/height)/(t.kind==='bomb'?1.65:1);
     return score(s)<score(best)?s:best;
   });
   cells.push({x,y,at:step.impact,jitter:(seed+x*73+y*151)%48});
 }
 const coveredAt=(x,y,rx,ry)=>{
   const times=cells.filter(c=>Math.abs(left+width*(c.x+.5)/cols-x)<rx&&Math.abs(top+height*(c.y+.5)/rows-y)<ry).map(c=>c.at+c.jitter).sort((a,b)=>a-b);
   return (times[Math.floor(times.length*.70)]??steps.at(-1).impact)+110;
 };
 const avatarAt=g?coveredAt(mark.x+g.portrait.x,mark.y+g.portrait.y,g.portrait.rx,g.portrait.ry):steps.at(-1).impact+140;
 const nameAt=g?Math.max(avatarAt+120,coveredAt(mark.x+g.nameX,mark.y+g.nameY,g.nameWidth*.5,g.nameFont)):avatarAt+175;
 return {version:TIMELINE_VERSION,left,top,width,height,cols,rows,cells,steps,avatarAt,nameAt};
}
