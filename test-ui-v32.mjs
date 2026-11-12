import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
const {chromium}=await import(process.env.GRAFFITI_PLAYWRIGHT||'playwright');
process.env.GRAFFITI_DATA=await mkdtemp(join(tmpdir(),'graffiti-v32-'));
delete process.env.GRAFFITI_CONNECTOR;
const output=process.argv[2]??join(process.env.GRAFFITI_DATA,'screenshots');
await mkdir(output,{recursive:true});
process.env.GRAFFITI_PORT='0';
const {server}=await import('./server.mjs');
await new Promise(r=>server.listening?r():server.once('listening',r));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:process.env.GRAFFITI_CHROME,args:['--disable-crashpad','--disable-crash-reporter']});
async function snapshot(source='live'){
 const r=await fetch(base+'/api/events?source='+source),reader=r.body.getReader();
 const {value}=await reader.read();await reader.cancel();
 return JSON.parse(new TextDecoder().decode(value).split('data: ')[1]);
}
async function wait(fn,source='demo',ms=20000){
 const start=Date.now();while(Date.now()-start<ms){const state=await snapshot(source);if(fn(state))return state;await new Promise(r=>setTimeout(r,150));}
 throw Error('Hết thời gian chờ trạng thái');
}
async function act(action,params={},source='live',status=200){
 const r=await fetch(base+'/api/action?source='+source,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,...params})});
 const out=await r.json();assert.equal(r.status,status,JSON.stringify(out));return out;
}
try{
 const page=await browser.newPage({viewport:{width:1366,height:768}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
 page.on('dialog',d=>d.accept());
 await page.goto(base);
 await page.locator('#draft-status').getByText('Đang dùng cấu hình LIVE').waitFor();
 await page.screenshot({path:join(output,'v32-studio-1366.png')});
 await page.setViewportSize({width:1920,height:1080});
 await page.screenshot({path:join(output,'v32-studio-1920.png')});
 await page.locator('[data-tab=support]').click();
 for(const img of await page.locator('#support img').all())assert(await img.evaluate(x=>x.complete&&x.naturalWidth>0));
 assert.equal((await fetch(base+'/guide.html')).status,200);
 await page.screenshot({path:join(output,'v32-support.png')});
 await page.locator('[data-tab=fx]').click();
 assert.equal(await page.locator('#wall-picker button').count(),8);
 for(let i=1;i<8;i++)assert.equal((await fetch(base+'/v2/walls/wall-'+i+'.webp')).status,200);
 await page.locator('[data-wall="6"]').click();
 await page.locator('#test-draft').click();
 await wait(s=>s.config.wallTheme===6);
 assert.equal((await snapshot()).config.wallTheme,0);
 await page.locator('[data-tab=props]').click();
 assert.equal(await page.locator('#gun-pool input').count(),10);
 await page.locator('#gunRotate').check();
 await page.locator('#apply-live').click();
 const applied=await wait(s=>s.config.wallTheme===6&&s.config.gunRotate,'live');
 await act('apply-settings',{config:applied.config,revision:applied.configRevision-1},'live',409);
 await page.locator('#test-draft').click();
 await wait(s=>s.config.gunRotate);
 await page.locator('[data-tab=round]').click();
 await page.locator('#layout-box').selectOption('title');
 await page.locator('#edit-top').click();
 const preview=page.frameLocator('iframe').locator('canvas');
 await preview.scrollIntoViewIfNeeded();
 const rect=await preview.boundingBox();
 await page.mouse.move(rect.x+rect.width*200/1080,rect.y+rect.height*80/1920);
 await page.mouse.down();
 await page.mouse.move(rect.x+rect.width*204/1080,rect.y+rect.height*144/1920,{steps:6});
 await page.mouse.up();
 await wait(s=>s.config.hud.title.y>46);
 assert.equal((await snapshot()).config.hud.title.y,46);
 await page.locator('#edit-top').click();
 const missing=await act('connect',{username:'demo'},'live',400);
 assert.match(missing.error,/Thiếu adapter/);

 await act('clear-demo');
 await act('pause-presentation',{},'demo');
 await act('test-chat',{count:6});
 const paused=await wait(s=>s.queue===6&&s.paused);
 assert.equal(paused.marks.length,0);
 await act('resume-presentation',{},'demo');
 const six=await wait(s=>s.marks.length===6&&!s.scene);
 assert.equal(new Set(six.marks.map(m=>m.gunSkin)).size,6);
 await page.frameLocator('iframe').locator('canvas[data-ready=true]').waitFor();
 await page.frameLocator('iframe').locator('canvas').screenshot({path:join(output,'v32-wall-six.png')});
 await act('test-chat',{count:1});
 await wait(s=>s.wallNumber===2&&s.marks.length===1&&!s.scene);
 await act('test',{coins:100});
 await wait(s=>s.scene?.coins===100);
 await act('skip-current-visual',{},'demo');
 await page.locator('[data-tab=gallery]').click();
 await page.locator('#gallery-source').selectOption('demo');
 await page.getByRole('button',{name:'Xem tường',exact:true}).click();
 const canvas=page.frameLocator('iframe').locator('canvas[data-ready=true]');
 await canvas.waitFor();
 assert.deepEqual(await canvas.evaluate(c=>[c.width,c.height]),[1080,1920]);
 const pending=page.waitForEvent('download');
 await page.locator('#gallery-png').click();
 const png=await readFile(await (await pending).path());
 assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],[1080,1920]);
 assert.deepEqual(errors,[]);
 console.log('PASS 1366/1920, QR/HDSD, 8 bối cảnh, 10 skin, DEMO/draft, revision, pause/resume, 6+1, skip và PNG 1080 × 1920.');
}finally{await browser.close();server.closeAllConnections();server.close();}
