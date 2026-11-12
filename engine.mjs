import {planPainting,TIMELINE_VERSION} from './scene-plan.mjs';
import { randomUUID } from 'node:crypto';
import {manifest,tierSpecs,shotGaps,shotCounts,timeline,wallRules,wallScale} from './v2.mjs';
import { extent,WALL_TOP,WALL_BOTTOM } from './stage-layout.mjs';

export const names=['Nét màu','Mưa màu','Pháo giấy','Chữ neon','Rồng sắc màu','Siêu VIP Pro'];
export const WALL_CAPACITY=wallRules.communityWall.hardMaxAvatars;
const rules=wallRules.communityWall,transitions=wallRules.wallTransitions.transitions;
const donorHolds=Object.values(wallRules.giftWalls.giftDisplayHoldSeconds);
export const freeEffects=['Nét tên','Nét tên neon','Bụi màu'];
export const items=[...names,'Sóng cầu vồng','Cánh phượng','Tẩy sơn','Khiên màu','Vương miện','Tia sét','Sao vàng','Cầu vồng','Portal','Tim ma thuật'];
const timingDefaults=(i)=>({life:tierSpecs[i].holdSeconds,seconds:tierSpecs[i].durationMs/1000,shots:shotCounts[i],gap:shotGaps[i],bombs:tierSpecs[i].grenades,flight:tierSpecs[i].shotFlightMs,bombFlight:tierSpecs[i].grenadeFlightMs,recoil:tierSpecs[i].weaponAnimation?.recoilDistancePx??8,skin:'auto'});
export const defaults={
  version:3,perfRevision:1,speed:1,scaleTransitions:false,fullHold:2500,wipeMs:650,slots:rules.slots.map(s=>({...s.avatarCenterPx})),peak:315,particles:35,volume:35,safe:3,top:true,flash:false,anonymous:false,teams:false,minutes:0,max:WALL_CAPACITY,
  gun:-1,grenade:-1,gunScale:.71,muzzleX:225,muzzleY:1060,showGun:true,fps:30,renderWidth:1080,previewWidth:540,topX:753,topY:1478,topWidth:292,sparks:true,glow:true,shake:false,mixSpray:false,accumulate:false,values:{},
  free:{...timingDefaults(0),effect:'Nét tên'},
  rows:tierSpecs.slice(1).map((spec,i)=>({...timingDefaults(i+1),min:spec.minimum,size:[230,300,375,450,635,850][i],effect:names[i],hold:donorHolds[i]})),
  mapping:{}
};
export function loadConfig(saved={}){
  const old=saved.rows;
  const rows=Array.isArray(old)&&old.length===8?[0,1,2,3,5,7].map(i=>old[i]):old;
  const aliases={'Bình xịt':'Nét màu','Xô màu':'Mưa màu','Mưa sơn':'Pháo giấy','Cọ neon':'Chữ neon','Sóng màu':'Sóng cầu vồng','Thần thú sắc màu':'Siêu VIP Pro'};
  const mapping=Object.fromEntries(Object.entries(saved.mapping||{}).map(([id,item])=>[id,aliases[item]??item]).filter(([,item])=>items.includes(item)));
  const {wall,tool,...stored}=saved;
  const migration=(row,i)=>{
    if(saved.version>=2||!row)return row;
    const oldSeconds=[.95,1.5,2.4,3.5,4.8,7,10],oldLife=[28,35,60,90,120,240,360];
    const next={...row};
    if(next.seconds===oldSeconds[i])delete next.seconds;
    if(next.life===oldLife[i])delete next.life;
    return next;
  };
  const quality=stored.perfRevision===1?{}:{fps:defaults.fps,particles:Math.min(defaults.particles,stored.particles??defaults.particles),shake:false};
  return {...defaults,...stored,...quality,perfRevision:1,version:3,max:[4,5,6].includes(saved.max)&&saved.version>=2.2?saved.max:WALL_CAPACITY,mapping,free:{...defaults.free,...migration(saved.free,0),shots:1,gap:0,bombs:0},
    rows:defaults.rows.map((base,i)=>{const row={...base,...migration(rows?.[i],i+1)};if(row.size===[140,210,300,410,600,830][i])row.size=base.size;
      if(row.min===[1,5,20,80,500,3000][i])row.min=base.min;return row;})};
}
export function session(){return {sessionId:randomUUID(),marks:[],scores:{},log:[],queue:[],scene:null,round:1,wallNumber:1,wallMove:null,community:{marks:[],fullAt:0,pausedAt:null},pages:[],donors:{},wallMode:'community',giftRun:0,ends:0,winners:[],seen:[],combos:{},pending:[],teams:[0,0]};}
const palette=['#29e9e6','#fb49a9','#ffbc3e','#a280ff','#87ef5a','#ff6350'];

export function ingest(s,c,type,d,now=Date.now()){
  const uid=String(d.userId||'').slice(0,90);
  if(!uid||!['gift','chat'].includes(type))return;
  if(type==='chat'&&!String(d.comment||'').trim())return;
  if(type==='gift'&&d.giftType==1&&d.repeatEnd===false)return;
  if(type==='gift'&&d.giftType==1&&d.repeatEnd==null&&!(d.comboId||d.groupId||d.group_id))return;
  const key=d.msgId&&d.msgId!=='0'?type+'|'+d.msgId:'';
  if(key&&s.seen.includes(key))return;
  const prior=Object.hasOwn(s.scores,uid)?s.scores[uid]:null;
  if(type!=='gift'&&prior?.free&&now-prior.free<rules.commentCooldownSeconds*1000){
    if(key){s.seen.push(key);if(s.seen.length>12000)s.seen.shift();}
    return;
  }
  const count=Math.trunc(Number(d.repeatCount??1)),giftId=String(d.giftId||'');
  const reported=Number(d.diamondCount);
  const unit=Number.isSafeInteger(reported)&&reported>0?reported:Number(Object.hasOwn(c.values,giftId)?c.values[giftId]:0);
  let coins=0,comboTotal=0;
  if(type==='gift'){
    if(!Number.isSafeInteger(unit)||unit<1||!Number.isSafeInteger(count)||count<1){
      s.pending??=[];if(!key||!s.pending.some(p=>p.eventKey===key)){
        s.pending.unshift({gift:giftId,uid,at:now,count:Number.isFinite(count)?count:0,eventKey:key,
          event:{userId:uid,msgId:d.msgId,giftId,repeatCount:count,giftType:d.giftType,repeatEnd:d.repeatEnd,
            comboId:d.comboId||d.groupId||d.group_id,nickname:String(d.nickname||'').slice(0,100),profilePictureUrl:String(d.profilePictureUrl||'').slice(0,2048)}});
        s.pending.length=Math.min(1000,s.pending.length);
      }
      return;
    }
    const group=d.comboId||d.groupId||d.group_id;
    const combo=group?JSON.stringify([uid,giftId,String(group)]):'';
    const previous=combo?s.combos[combo]?.count??0:0;
    coins=Math.min(1e9,unit*Math.max(0,count-previous));
    comboTotal=Math.min(1e9,unit*count);
    if(combo){
      s.combos[combo]={count:Math.max(previous,count),at:now};
      const keys=Object.keys(s.combos);
      if(keys.length>4000)delete s.combos[keys[0]];
    }
  }
  if(key){s.seen.push(key);if(s.seen.length>12000)s.seen.shift();}
  if(type==='gift'&&key&&s.pending?.some(p=>p.eventKey===key))s.pending=s.pending.filter(p=>p.eventKey!==key);
  if(type==='gift'&&!coins)return;
  const name=Array.from(String(d.nickname||'Họa sĩ').replace(/[\x00-\x1f]/g,'')).slice(0,32).join('');
  let avatar='';
  try{const u=new URL(d.profilePictureUrl);if(u.protocol==='https:'&&!u.username&&!u.password&&/(^|\.)(tiktokcdn[^.]*\.com|tiktokcdn\.net|tiktokv\.com|byteoversea\.com|ibytedtos\.com)$/i.test(u.hostname))avatar=u.href;}catch{}
  const team=/^đỏ$/i.test(d.comment||'')?0:/^xanh$/i.test(d.comment||'')?1:prior?.team??(uid.codePointAt(0)%2);
  Object.defineProperty(s.scores,uid,{enumerable:true,configurable:true,writable:true,value:{uid,name,coins:(prior?.coins||0)+coins,round:(prior?.round||0)+coins,team,free:coins?prior?.free||0:now}});
  s.teams[team]+=coins||1;
  const pending=coins?s.queue.findLast(p=>p.uid===uid&&p.coins&&now-p.at<=500):null;
  const total=coins+(pending?.coins||0);
  const ranked=coins?(c.accumulate?(prior?.coins||0)+coins:Math.max(total,comboTotal)):0;
  const tier=coins?Math.max(0,c.rows.findLastIndex(row=>ranked>=row.min)):0;
  const item=coins?(Object.hasOwn(c.mapping,d.giftId)?c.mapping[d.giftId]:c.rows[tier].effect):c.free.effect;
  const job={id:randomUUID(),uid,name,avatar,eventId:key||undefined,coins:total,ranked,tier,item,at:now,team,color:c.teams?(team?'#31a8ff':'#ff4d78'):palette[Math.floor(Math.random()*palette.length)]};
  if(pending)Object.assign(pending,job);else if(coins||!s.queue.some(p=>p.uid===uid&&!p.coins))s.queue.push(job);
  s.log.unshift({name,coins,item,at:now,gift:String(d.giftId||''),count:d.repeatCount??1});
  s.log.length=Math.min(150,s.log.length);
}
export function retryPending(s,c,now=Date.now()){
 const backlog=s.pending??[];s.pending=[];
 let resolved=0,expired=0;
 for(const row of backlog.slice().reverse()){
   if(now-row.at>86400000){expired++;continue;}
   if(!row.event||!Object.hasOwn(c.values,row.gift)||row.count<1){s.pending.unshift(row);continue;}
   ingest(s,c,'gift',row.event,now);resolved++;
 }
 return {resolved,expired};
}
export function initWalls(s,c,now=Date.now()){
  s.sessionId??=randomUUID();
  if(s.community)return;
  const legacy=s.marks??[];
  s.community={marks:[],fullAt:0,pausedAt:null};s.pages=[];s.donors={};s.wallMode='community';s.giftRun=0;
  for(const mark of legacy){
    if(mark.coins){
      s.donors[mark.uid]={uid:mark.uid,name:mark.name,tier:mark.tier,wallId:randomUUID(),mark:{...mark,until:Number.MAX_SAFE_INTEGER}};
    }else if(s.community.marks.length<c.max){
      const slot=s.community.marks.length;
      s.community.marks.push({...mark,...slotPosition(slot,c),slot,community:true,land:Math.min(mark.land,now),until:Number.MAX_SAFE_INTEGER});
    }
  }
  s.marks=s.community.marks;s.scene=null;s.wallMove=null;
  if(s.marks.length>=c.max)s.community.fullAt=now;
}
function slotPosition(slot,c){
  const original=rules.slots[slot],p=c.slots[slot];
  return {x:p.x*wallScale,y:p.y*wallScale,nameX:p.x*wallScale,
    nameY:(p.y+original.nicknameCenterPx.y-original.avatarCenterPx.y)*wallScale};
}
function transition(s,c,kind,marks,now){
  const spec=transitions[kind],duration=(kind==='communityFullToBlank'?c.wipeMs:spec.durationMs)/(c.scaleTransitions?c.speed:1);
  const blank=(spec.showBlankWallBrieflyMs??0)/(c.scaleTransitions?c.speed:1);
  s.wallMove={kind,oldMarks:s.marks,start:now,fadeEnd:now+duration,end:now+duration+blank};
  s.marks=marks;
}
function restoreCommunity(s,c,now){
  transition(s,c,'giftToCommunity',s.community.marks,now);
  if(s.community.pausedAt!==null&&s.community.fullAt)s.community.fullAt+=s.wallMove.end-s.community.pausedAt;
  s.community.pausedAt=null;s.wallMode='community';s.donorUid=null;s.giftRun=-1;
}
function displayJob(s,c,job,now){
  const donor=job.coins?Object.hasOwn(s.donors,job.uid)?s.donors[job.uid]:null:null;
  const old=job.coins?donor?.mark:s.community.marks.find(m=>m.uid===job.uid);
  const level=job.coins?job.tier+1:0,setting=job.coins?c.rows[job.tier]:c.free;
  const seed=Array.from(job.id).reduce((sum,x)=>sum+x.charCodeAt(0),0);
  const sequence=timeline(level,setting,c.speed);
  const start=now,drawStart=now+(job.coins?220:90)/c.speed;
  let land=drawStart+sequence.duration;
  const hold=job.coins?(s.queue.length>=15?1:setting.hold??donorHolds[job.tier])*1000:0;

  const skin=manifest.skins.includes(setting.skin)?setting.skin:manifest.skins[seed%manifest.skins.length];
  const common={...job,sessionId:s.sessionId,sceneId:job.id,eventTier:level,timelineVersion:TIMELINE_VERSION,start,drawStart,skin,sequence,until:Number.MAX_SAFE_INTEGER,avatar:job.avatar||old?.avatar||'',
    recoil:setting.recoil,canSpray:c.mixSpray&&level>0&&level<3&&seed%5===0};
  if(job.coins){
    const tier=Math.max(job.tier,donor?.tier??0);
    const wallId=donor?.wallId??randomUUID();
    const size=c.rows[tier].size,frame=extent(job.coins,tier,size);
    const mark={...common,tier,size,wallId,skin:tier>job.tier?old.skin:skin,
      x:540+(frame.left-frame.right)/2,y:(WALL_TOP+WALL_BOTTOM+frame.top-frame.bottom)/2};
    mark.wallTier=tier+1;mark.presentationTier=tier+1;
    mark.painting=planPainting(mark,sequence);
    land=Math.max(land,drawStart+mark.painting.nameAt+210/c.speed);
    Object.assign(mark,{land,end:land+hold});
    Object.defineProperty(s.donors,job.uid,{enumerable:true,configurable:true,writable:true,value:{uid:job.uid,name:job.name,tier,wallId,mark}});
    s.marks=[mark];s.donorUid=job.uid;s.giftRun++;
    s.scene={...common,land,end:mark.end,wallTier:mark.wallTier,presentationTier:mark.presentationTier,painting:mark.painting,x:mark.x,y:mark.y,size,wallId,art:mark,before:old??null};
  }else{
    const slot=old?.slot??s.community.marks.length;
    const mark={...common,...slotPosition(slot,c),slot,community:true,size:181};
    mark.painting=planPainting(mark,sequence);
    land=Math.max(land,drawStart+mark.painting.nameAt+210/c.speed);
    Object.assign(mark,{land,end:land});
    s.community.marks=old?s.community.marks.map(m=>m.uid===job.uid?mark:m):[...s.community.marks,mark];
    if(!old&&s.community.marks.length>=c.max)s.community.fullAt=land;
    s.marks=s.community.marks;s.scene={...mark,before:old??null};
  }
  s.queue.splice(s.queue.indexOf(job),1);
}
export function tick(s,c,now=Date.now()){
  initWalls(s,c,now);
  s.wallNumber??=1;
  if(s.wallMove){
    if(now<s.wallMove.end)return;
    s.wallMove=null;
  }
  if(s.scene&&now<s.scene.end)return;
  if(c.minutes&&!s.ends)s.ends=now+c.minutes*60000;
  if(s.ends&&now>=s.ends){
    s.winners=Object.values(s.scores).filter(p=>p.round>0).sort((a,b)=>b.round-a.round).slice(0,5);
    for(const p of Object.values(s.scores))p.round=0;
    s.winningTeam=c.teams&&s.teams[0]!==s.teams[1]?(s.teams[0]>s.teams[1]?'Đội Đỏ':'Đội Xanh'):'';
    s.teams=[0,0];s.scene=null;s.round++;s.ends=c.minutes?now+c.minutes*60000:0;
  }
  s.scene=null;
  const gift=s.queue.filter(j=>j.coins&&now-j.at>=500).sort((a,b)=>b.tier-a.tier||a.at-b.at)[0];
  const comment=s.queue.find(j=>!j.coins);
  if(s.wallMode==='gift'){
    if(!gift||(comment&&s.giftRun>=3)){
      restoreCommunity(s,c,now);return;
    }
    const prior=s.donorUid;
    if(prior!==gift.uid){
      const next=Object.hasOwn(s.donors,gift.uid)?s.donors[gift.uid]?.mark:null;
      transition(s,c,'giftToNextGift',next?[next]:[],now);
      s.donorUid=gift.uid;return;
    }
    displayJob(s,c,gift,now);return;
  }
  if(gift&&!(comment&&s.giftRun<0)){
    s.community.pausedAt=now;
    const prior=Object.hasOwn(s.donors,gift.uid)?s.donors[gift.uid]?.mark:null;
    transition(s,c,'communityToGiftWall',prior?[prior]:[],now);
    s.wallMode='gift';s.donorUid=gift.uid;return;
  }
  if(!comment){if(s.giftRun<0)s.giftRun=0;return;}
  const exists=s.community.marks.some(m=>m.uid===comment.uid);
  if(!exists&&s.community.marks.length>=c.max){
    if(now<(s.community.fullAt||0)+c.fullHold)return;
    s.pages.unshift({number:s.wallNumber,marks:s.community.marks});
    s.pages.length=Math.min(s.pages.length,rules.newWallPolicy.preserveLastPages);
    transition(s,c,'communityFullToBlank',[],now);
    s.wallNumber++;s.community={marks:[],fullAt:0,pausedAt:null};return;
  }
  if(s.giftRun<0)s.giftRun=0;
  displayJob(s,c,comment,now);
}
