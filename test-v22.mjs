import assert from 'node:assert/strict';
import {defaults,session,ingest,tick,loadConfig} from './engine.mjs';
import {timeline,wallRules,wallScale} from './v2.mjs';
const start=1000000;
const send=(s,kind,id,at,coins=0,seq='')=>ingest(s,defaults,kind,{userId:id,msgId:id+seq,nickname:'Họa sĩ '+id,comment:'Vẽ',diamondCount:coins},at);
function advance(s,from,to){for(let t=from;t<=to;t+=50)tick(s,defaults,t);}
const layout=session();
for(let i=1;i<=6;i++)send(layout,'chat','c'+i,start);
advance(layout,start,start+15000);
assert.equal(layout.marks.length,6);
assert.equal(layout.wallNumber,1);
assert.deepEqual(layout.marks.map(m=>[m.x/wallScale,m.y/wallScale].map(Math.round)),wallRules.communityWall.slots.map(s=>[s.avatarCenterPx.x,s.avatarCenterPx.y]));
send(layout,'chat','c7',start+15000);
tick(layout,defaults,start+15001);
assert.equal(layout.wallMove.fadeEnd-layout.wallMove.start,650);
assert.equal(layout.wallNumber,2);
advance(layout,start+15050,start+17100);
assert.equal(layout.marks.length,1);
assert.equal(layout.marks[0].slot,0);
assert.equal(layout.pages[0].marks.length,6);
const hold=session();
for(let i=1;i<=7;i++)send(hold,'chat','h'+i,start);
let sawFull=false;
for(let t=start;t<start+12000;t+=50){
 tick(hold,defaults,t);
 if(hold.marks.length===6){sawFull=true;if(t<hold.community.fullAt+2500)assert.equal(hold.wallNumber,1);}
}
assert(sawFull);assert.equal(hold.wallNumber,2);
const resume=session();
for(let i=1;i<=3;i++)send(resume,'chat','r'+i,start);
advance(resume,start,start+5000);
const saved=resume.marks;
send(resume,'gift','A',start+5000,100);
send(resume,'gift','B',start+5000,500);
const visits=new Set();
for(let t=start+5000;t<=start+35000;t+=50){
 tick(resume,defaults,t);
 if(resume.wallMode==='gift'){assert(resume.marks.length<=1);if(resume.scene)visits.add(resume.scene.uid);}
}
assert.deepEqual([...visits],['B','A']);
assert.equal(resume.wallMode,'community');
assert.deepEqual(resume.marks,saved);
assert.equal(resume.wallNumber,1);
const first=resume.donors.A.wallId;
send(resume,'gift','A',start+35001,1000,'upgrade');
advance(resume,start+35050,start+56000);
assert.equal(resume.donors.A.wallId,first);
assert.equal(resume.donors.A.tier,5);
send(resume,'gift','A',start+56001,1,'small');
advance(resume,start+56050,start+64000);
assert.equal(resume.donors.A.tier,5);
assert.equal(resume.marks.length,3);
const repeat=session();
for(let i=0;i<10;i++)send(repeat,'chat','same',start+i,0,String(i));
advance(repeat,start,start+3000);
assert.equal(repeat.marks.length,1);
send(repeat,'chat','same',start+26000,0,'refresh');
advance(repeat,start+26000,start+29000);
assert.equal(repeat.marks.length,1);
assert.equal(repeat.marks[0].slot,0);
const stress=session();
for(let i=0;i<100;i++)send(stress,'gift','load'+i,start,1);
advance(stress,start,start+700000);
assert.equal(stress.queue.length,0);assert.equal(Object.keys(stress.donors).length,100);
assert.equal(loadConfig({version:2,max:5}).max,6);
assert.equal(timeline(6,{},2).gap,45);
assert.equal(timeline(6).steps.filter(x=>x.kind==='bomb').length,3);
console.log('PASS 6 ô, giữ trang, người thứ 7, spam, donor A/B, nâng bậc, khôi phục 3/6, tải 100, nhịp V2.1.');
