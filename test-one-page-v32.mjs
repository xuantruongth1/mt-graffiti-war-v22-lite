import assert from 'node:assert/strict';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const {chromium}=await import(process.env.GRAFFITI_PLAYWRIGHT||'playwright');
const data=await mkdtemp(join(tmpdir(),'graffiti-one-page-'));
const adapter=join(data,'adapter.mjs');
await writeFile(adapter,`import {EventEmitter} from 'node:events';
export class DirectLive extends EventEmitter{
 connect(){this.emit('status',{state:'connected',message:'Adapter kiểm thử'});this.timer=setTimeout(()=>this.emit('event',{event:'chat',data:{userId:'real-uid',msgId:'real-event',nickname:'Khách thật',comment:'Xin chào'}}),2400);}
 disconnect(){clearTimeout(this.timer);}
}`);
process.env.GRAFFITI_DATA=data;
process.env.GRAFFITI_PORT='0';
process.env.GRAFFITI_CONNECTOR=adapter;
const {server}=await import('./server.mjs');
await new Promise(r=>server.listening?r():server.once('listening',r));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:process.env.GRAFFITI_CHROME,args:['--disable-crashpad','--disable-crash-reporter']});
async function snapshot(view='full'){
 const r=await fetch(base+'/api/events?source=live&view='+view),reader=r.body.getReader();
 const {value}=await reader.read();await reader.cancel();
 return JSON.parse(new TextDecoder().decode(value).split('data: ')[1]);
}
async function wait(fn,view='full'){
 for(let n=0;n<130;n++){const state=await snapshot(view);if(fn(state))return state;await new Promise(r=>setTimeout(r,100));}
 throw Error('Hết thời gian chờ trạng thái '+view);
}
try{
 const context=await browser.newContext({viewport:{width:1366,height:768}});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);
 const frame=page.frameLocator('#frame');
 await page.locator('#preview-placeholder').waitFor({state:'hidden'});
 const stableUrl=await page.locator('#frame').getAttribute('src');
 await page.locator('#username').fill('demo');
 await page.getByRole('button',{name:'Kết nối LIVE',exact:true}).click();
 await page.getByText('Adapter kiểm thử',{exact:true}).waitFor();
 await page.locator('[data-tab=test]').click();
 await page.getByRole('button',{name:'6 bình luận',exact:true}).click();
 await page.getByText('LIVE · Đang trình diễn thử',{exact:true}).waitFor();
 await wait(s=>s.showTest&&s.scene?.community,'overlay');
 assert.equal(await page.locator('#frame').getAttribute('src'),stableUrl);
 assert.equal(await frame.locator('canvas').count(),1);
 const realQueued=await wait(s=>s.showTest&&s.queue===1&&s.marks.length===0);
 assert.equal(realQueued.log[0].name,'Khách thật');
 await page.screenshot({path:join(data,'thu-live.png')});
 await page.locator('#source').click();
 const real=await wait(s=>!s.showTest&&s.marks.some(x=>x.uid==='real-uid'),'overlay');
 assert.equal(real.marks.length,1);
 await page.getByRole('button',{name:'Thử bình luận',exact:true}).click();
 await wait(s=>s.showTest&&s.scene?.community,'overlay');
 const resumed=await wait(s=>!s.showTest&&s.marks.some(x=>x.uid==='real-uid'),'overlay');
 assert.equal(resumed.marks.length,1);

 await page.locator('[data-tab=support]').click();
 await page.getByRole('link',{name:'QR hỗ trợ'}).click();
 assert.equal(context.pages().length,1);
 assert(await page.locator('#guide-support').isVisible());
 assert.equal(await page.locator('#frame').getAttribute('src'),stableUrl);
 await page.screenshot({path:join(data,'huong-dan.png')});
 await page.setViewportSize({width:390,height:844});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 const broken=route=>route.abort();
 await page.route('**/overlay.html?preview=1',broken);
 await page.locator('#refresh').click();
 await page.locator('#preview-placeholder').waitFor();
 await page.unroute('**/overlay.html?preview=1',broken);
 await page.locator('#refresh').click();
 await page.locator('#preview-placeholder').waitFor({state:'hidden'});
 assert.equal(context.pages().length,1);
 assert.deepEqual(errors,[]);
 console.log('PASS: một tab, thử hiện trên nguồn LIVE, giữ và tiếp tục sự kiện thật, hướng dẫn inline, mobile, iframe lỗi tự che và tải lại.');
}finally{await browser.close();server.closeAllConnections();server.close();}
