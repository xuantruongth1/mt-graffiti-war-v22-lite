import manifest from './v2/assets_manifest.json' with {type:'json'};
import config from './v2/gift_tiers_config.json' with {type:'json'};
import wallRules from './v2/wall_rules.json' with {type:'json'};
export {manifest,wallRules};
export const defaultHud={
 title:{x:35,y:46,w:1010,visible:true},
 vip:{x:282,y:157,w:516,visible:true},
 note:{x:180,y:1790,w:720,visible:true}
};
export const walls=['Sân bê tông gốc','Neon Cyberpunk','Thành cổ','Xưởng thép','Sân Tết','Thành băng','Tường thiên hà','Tường biển'];
export const wallAsset=(id,preview=false)=>id>0&&id<walls.length?'/v2/walls/wall-'+id+'.webp':preview?'/v2/lite/wall.webp':'/v2/wall.png';
export const tierSpecs=config.tiers;
export const shotGaps=tierSpecs.map(t=>t.shotIntervalMs??0);
export const shotCounts=tierSpecs.map(t=>t.shots);
export const wallScale=1080/941;
export function timeline(level,row={},speed=1){
 const spec=tierSpecs[level],shots=row.shots??shotCounts[level],gap=row.gap??shotGaps[level],bombs=row.bombs??spec.grenades;
 const steps=[],flight=row.flight??spec.shotFlightMs,bombFlight=row.bombFlight??spec.grenadeFlightMs;
 let cursor=0,shot=0,bomb=0;
 const groups=spec.gunSeq.length;
 for(let i=0;i<groups;i++){
   const prior=spec.gunSeq.slice(0,i).reduce((a,b)=>a+b,0);
   const next=prior+spec.gunSeq[i],target=Math.round(shots*next/spec.shots);
   while(shot<target){
     steps.push({kind:'shot',index:shot,at:cursor,impact:cursor+flight});
     shot++;if(shot<target)cursor+=gap;
   }
   const expected=Math.round((i+1)*bombs/(spec.grenades===groups?groups:Math.max(1,groups-1)));
   while(bomb<Math.min(bombs,expected)){
     cursor+=flight+125;
     steps.push({kind:'bomb',index:bomb,at:cursor,impact:cursor+bombFlight});
     bomb++;cursor+=bombFlight+90;
   }
 }
 const last=steps.at(-1)?.impact??0;
 const duration=Math.max(Math.round((row.seconds??spec.durationMs/1000)*1000),last+210);
 return {steps:steps.map(step=>({...step,at:step.at/speed,impact:step.impact/speed})),duration:duration/speed,shots,gap:gap/speed,bombs,speed};
}
export function gunAsset(index){return '/v2/guns/'+manifest.guns[index].id+'_OVERLAY_941x1672.png';}
export function grenadeAsset(index){return '/v2/grenades/'+manifest.grenades[index].id+'.png';}
export function fxAsset(level,index){return '/v2/fx/'+manifest.fx[level*4+(index%4)].file;}
export function v2Frame(level,skin){
 return '/v2/frames/'+manifest.frame_variants.find(f=>f.tier===level+1&&f.skin===skin).asset;
}
