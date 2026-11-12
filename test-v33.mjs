import assert from 'node:assert/strict';
import {loadConfig,session,ingest,tick} from './engine.mjs';

const c=loadConfig({smartWall:true,idlePan:true});
const s=session();
let t=1_000_000,seq=0;
const send=(type,uid,coins)=>ingest(s,c,type,{userId:uid,msgId:String(++seq),nickname:uid,comment:'Vẽ',diamondCount:coins},t);
function until(check,timeout=25000){
 for(let end=t+timeout;t<end;t+=25){tick(s,c,t);if(check())return;}
 throw Error('Smart wall: quá hạn chờ');
}
for(let i=0;i<5;i++)send('chat','artist-'+i);
until(()=>s.marks.length===5&&s.scene);
const a=s.activeWallId;
assert(s.marks.every(m=>m.sequence.shots===2&&m.wallId===a));
assert(s.marks.every(m=>m.painting.steps[0].target[0]!==m.painting.steps[1].target[0]));
send('gift','donor',1);
send('chat','new');
until(()=>s.wallMove?.kind==='smartPan'&&s.wallMode==='gift');
assert.equal(s.marks.length,0);
assert.equal(s.pages[0].wallId,a);
assert.equal(s.pages[0].marks.length,5);
const b=s.activeWallId;
until(()=>s.scene?.coins===1);
assert(s.scene.fullMural);
assert.equal(s.scene.painting.width,1020);
until(()=>s.wallMove?.kind==='smartPan'&&s.wallMode==='community');
const next=s.activeWallId;
assert.equal(new Set([a,b,next]).size,3);
assert.equal(s.marks.length,0);
until(()=>s.marks.some(m=>m.uid==='new'));
assert(s.marks.every(m=>m.wallId===next&&m.uid==='new'&&m.artScale>2));
const count=s.pages.length;
until(()=>s.activeWallId!==next);
assert.equal(s.pages.length,count+1);
assert.equal(s.marks.length,0);
const blank=s.activeWallId;
until(()=>s.activeWallId!==blank);
assert.equal(s.pages.length,count+1);
assert.equal(s.marks.length,0);
assert.equal(s.scores.donor.coins,1);
console.log('PASS 5 bình luận → tường quà trống → tường bình luận mới; hai điểm bắn; mural 1 xu; idle không lưu tường trống.');

for(const [i,coins] of [1,5,20,100,500,1000].entries()){
 const q=session(),begin=2_000_000;
 ingest(q,c,'gift',{userId:'donor',msgId:'gift-'+i,diamondCount:coins},begin);
 for(let n=begin;!q.scene&&n<begin+6000;n+=25)tick(q,c,n);
 assert.equal(q.scene?.sequence.shots,[3,5,8,12,14,18][i]);
 assert.equal(q.scene.sequence.bombs,[0,0,1,1,2,3][i]);
 assert.equal(q.scene.painting.width,1020);
 assert.equal(q.marks[0].wallId,q.activeWallId);
}
console.log('PASS sáu bậc quà: phủ tường, số phát và bom giữ đúng mặc định.');

const {wallPanPositions,impactRadius}=await import('./stage-art.mjs');
assert.deepEqual(wallPanPositions(0),{outgoing:0,incoming:1080});
assert.deepEqual(wallPanPositions(.5),{outgoing:-540,incoming:540});
assert.deepEqual(wallPanPositions(1),{outgoing:-1080,incoming:0});
assert(impactRadius({community:true,artScale:2},{kind:'shot'},2)>impactRadius({community:true},{kind:'shot'},2));
assert(impactRadius({community:false},{kind:'bomb'},18)>impactRadius({community:false},{kind:'shot'},18));
console.log('PASS camera: tường cũ dịch trái, tường mới vào từ phải, mép hai tường cùng tọa độ.');

const {streetColors}=await import('./stage-art.mjs');
for(const skin of ['NEON_POP','ACID_LIME','FIRE_ICE','ULTRAVIOLET','RAINBOW_STREET']){
 const first=streetColors(skin,0),second=streetColors(skin,1);
 assert.equal(new Set(first).size,3);
 assert.equal(new Set([...first,...second]).size,6);
 assert.deepEqual(streetColors(skin,6),first);
}
console.log('PASS màu sơn: hai phát có sáu màu phân biệt theo bảng màu, phát lại ổn định.');
