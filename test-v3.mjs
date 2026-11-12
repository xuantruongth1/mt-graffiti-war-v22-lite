import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { defaults, ingest, loadConfig, retryPending, session, tick } from './engine.mjs';
import { manifest, timeline, v2Frame, gunAsset, grenadeAsset, fxAsset } from './v2.mjs';
import { planPainting, TIMELINE_VERSION } from './scene-plan.mjs';

const t = 1_000_000;
const coins = [0, 1, 5, 20, 100, 500, 1000];
const shots = [1, 3, 5, 8, 12, 14, 18];
const bombs = [0, 0, 0, 1, 1, 2, 3];
const gift = (uid, value, id=uid) => ({userId:uid, msgId:id, diamondCount:value, repeatCount:1});
const advance = (state, start, end, config=defaults) => {
  for(let now=start;now<=end;now+=50)tick(state,config,now);
};
const assetUrls = ['/v2/wall.png', '/v2/'+manifest.v3_weapon_anchors, ...Object.values(manifest.v3_hands).map(x=>'/v2/'+x)];
for(let level=0;level<coins.length;level++){
  for(const skin of manifest.skins)assetUrls.push(v2Frame(level,skin));
  for(let i=0;i<4;i++)assetUrls.push(fxAsset(level,i));
  const state=session();
  ingest(state,defaults,level?'gift':'chat',{...gift('user',coins[level]),comment:'Vẽ'},t);
  for(let now=t;!state.scene&&now<t+5000;now+=50)tick(state,defaults,now);
  const scene=state.scene,mark=state.marks[0],plan=scene.painting;
  assert.equal(scene.timelineVersion,TIMELINE_VERSION);
  assert.equal(scene.eventTier,level);
  assert.equal(scene.sessionId,state.sessionId);
  assert.equal(plan.steps.filter(x=>x.kind==='shot').length,shots[level]);
  assert.equal(plan.steps.filter(x=>x.kind==='bomb').length,bombs[level]);
  assert(plan.steps.every(x=>x.impact>x.at&&x.target.every(Number.isFinite)));
  assert(plan.nameAt>plan.avatarAt);
  assert.deepEqual(planPainting(mark,mark.sequence),plan);
  if(level>=4)assert(new Set(plan.cells.map(c=>c.at)).size>=3);
}
assert.equal(loadConfig({version:2.2,max:5}).max,5);
assert.equal(loadConfig({version:3,max:4}).max,4);
assert.equal(timeline(6,{},.5).gap,180);

const pending=session();
const unknown={giftId:'new-gift',userId:'u',msgId:'event',repeatCount:1};
ingest(pending,defaults,'gift',unknown,t);
assert.equal(pending.pending.length,1);
const resumed=JSON.parse(JSON.stringify(pending));
const mapped=loadConfig({values:{'new-gift':20}});
retryPending(resumed,mapped,t+200);
assert.equal(resumed.pending.length,0);
assert.equal(resumed.scores.u.coins,20);
ingest(resumed,mapped,'gift',unknown,t+300);
assert.equal(resumed.scores.u.coins,20);
advance(resumed,t+300,t+20000,mapped);
assert.equal(resumed.queue.length,0);
assert.equal(resumed.donors.u.tier,2);

for(let i=0;i<manifest.guns.length;i++)assetUrls.push(gunAsset(i));
for(let i=0;i<manifest.grenades.length;i++)assetUrls.push(grenadeAsset(i));
for(const url of assetUrls)assert((await readFile(new URL('.'+url,import.meta.url))).length>0,url);
console.log('PASS V3 timeline, deterministic coverage, recovery of pending gift and '+assetUrls.length+' assets.');
