import assert from 'node:assert/strict';
import {timeline,manifest,shotCounts,shotGaps} from './v2.mjs';
import {defaults,session,ingest,tick} from './engine.mjs';
for(let i=0;i<7;i++){
 const t=timeline(i),shots=t.steps.filter(s=>s.kind==='shot'),bombs=t.steps.filter(s=>s.kind==='bomb');
 assert.equal(shots.length,shotCounts[i]);assert.equal(bombs.length,[0,0,0,1,1,2,3][i]);
 for(let j=1;j<t.steps.length;j++)if(t.steps[j].kind==='shot'&&t.steps[j-1].kind==='shot')assert.equal(t.steps[j].at-t.steps[j-1].at,shotGaps[i]);
}
const s=session(),now=Date.now(),gift={userId:'uid-1',giftId:'5',groupId:'g',giftType:1,diamondCount:5};
ingest(s,defaults,'gift',{...gift,repeatCount:2,repeatEnd:false,msgId:'a'},now);
ingest(s,defaults,'gift',{...gift,repeatCount:5,repeatEnd:true,msgId:'a'},now);
ingest(s,defaults,'gift',{...gift,repeatCount:5,repeatEnd:true,msgId:'b'},now);
assert.equal(s.scores['uid-1'].coins,25);assert.equal(s.queue.length,1);
ingest(s,defaults,'gift',{userId:'uid-2',giftId:'9',msgId:'m'},now);assert.equal(s.pending.length,1);
ingest(s,defaults,'chat',{userId:'c',comment:'Hi'},now);ingest(s,defaults,'chat',{userId:'c',comment:'again'},now+10000);
assert.equal(s.queue.filter(x=>x.uid==='c').length,1);
const load=session();
for(let i=0;i<100;i++)ingest(load,defaults,'gift',{userId:'load'+i,giftId:'1',diamondCount:1,msgId:'load'+i},now);
assert.equal(load.queue.length,100);
for(let n=0;n<700000;n+=100)tick(load,defaults,now+n);
assert.equal(load.queue.length,0);
assert.equal(manifest.frame_variants.length,35);
console.log('PASS timeline, combo, pending, cooldown, 100 quà và manifest.');
