import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadConfig,session,ingest,tick} from './engine.mjs';
import {walls,wallAsset} from './v2.mjs';

const config=loadConfig({version:3,wallTheme:4,gunRotate:true,gunPool:[3,7,9]});
const state=session(),start=1_000_000;
const add=(uid,type='chat',extra={})=>ingest(state,config,type,{
  userId:uid,msgId:'v32-'+uid,nickname:uid,comment:'Xin chào',...extra
},start);
state.presentationPaused=true;
for(let i=0;i<6;i++)add('artist-'+i);
tick(state,config,start+2000);
assert.equal(state.queue.length,6);
assert.equal(state.marks.length,0);
state.presentationPaused=false;
for(let time=start+2500;time<start+15000;time+=50)tick(state,config,time);
assert.deepEqual(state.marks.map(x=>x.gunSkin),[3,7,9,3,7,9]);
assert(state.marks.every(x=>x.wallTheme===4&&x.sequence.shots===1));
assert.equal(state.wallNumber,1);
add('no-final-marker','gift',{giftType:1,diamondCount:5,giftId:'1'});
add('no-final-marker','gift',{giftType:1,diamondCount:5,giftId:'1'});
assert.equal(state.scores['no-final-marker'].coins,5);
add('unknown-price','gift',{giftType:1,giftId:'333'});
assert.equal(state.pending[0].gift,'333');
assert.equal(walls.length,8);
for(let i=0;i<walls.length;i++){
 const bytes=await readFile(new URL('.'+wallAsset(i),import.meta.url));
 assert(bytes.length>50000);
}
console.log('PASS V3.2: pause và tiếp tục, đổi skin, lưu tường, quà thiếu repeatEnd, dedupe, pending và 8 ảnh nền.');
