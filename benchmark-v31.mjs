import assert from 'node:assert/strict';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {cpus,totalmem,release,tmpdir} from 'node:os';
const {chromium}=await import(process.env.GRAFFITI_PLAYWRIGHT||'playwright');
process.env.GRAFFITI_PORT='0';
process.env.GRAFFITI_DATA=await mkdtemp(resolve(tmpdir(),'graffiti-benchmark-'));
const {server}=await import('./server.mjs');
await new Promise(r=>server.listening?r():server.once('listening',r));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:process.env.GRAFFITI_CHROME,args:['--disable-crashpad','--disable-crash-reporter']});
const report={cpu:cpus()[0].model,ramMiB:Math.round(totalmem()/1048576),windows:release(),chrome:browser.version(),samples:[]};
const act=async(action,params={})=>{
 const response=await fetch(base+'/api/action',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,...params})});
 assert.equal(response.status,200,await response.text());
};
async function snapshot(source='demo',view='full'){
 const response=await fetch(base+'/api/events?source='+source+'&view='+view);
 const rd=response.body.getReader(),{value}=await rd.read();
 await rd.cancel();
 return JSON.parse(new TextDecoder().decode(value).split('data: ')[1]);
}
try{
 const context=await browser.newContext({viewport:{width:1200,height:900}});
 const studio=await context.newPage(),demo=await context.newPage(),live=await context.newPage(),errors=[];
 for(const page of [studio,demo,live]){
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
 }
 await demo.addInitScript(()=>{window.samples=[];addEventListener('graffiti-render',e=>window.samples.push(e.detail));});
 await studio.goto(base);await studio.locator('[data-tab=fx]').click();
 await demo.goto(base+'/overlay.html?source=demo&diagnostics=1');
 await live.goto(base+'/overlay.html?clean=1');
 assert(await live.locator('#sound').isHidden());
 await demo.bringToFront();
 const cdp=await context.newCDPSession(demo);
 await cdp.send('Runtime.enable');
 const config=(await snapshot()).config;
 assert.equal(config.fps,30);assert.equal(config.renderWidth,1080);
 const views=await Promise.all([snapshot('demo','studio'),snapshot('demo','overlay')]);
 assert(!('marks' in views[0]));assert(!('log' in views[1]));
 for(const [fps,width] of [[30,1080],[60,720]]){
   await act('settings',{config:{...config,fps,renderWidth:width}});
   for(const page of [demo,live])await page.waitForFunction(w=>document.querySelector('canvas').width===w,width);
   await act('clear-demo');await demo.evaluate(()=>window.samples=[]);
   await act('test-chat',{count:6});
   await demo.waitForTimeout(6500);
   const start=Date.now();
   await act('burst',{rate:10});
   let total=0,maxQueue=0;
   while(Date.now()-start<13500){
    const s=await snapshot(),gallery=await fetch(base+'/api/gallery?source=demo').then(x=>x.json());
    total=s.giftQueued+gallery.donors.length;maxQueue=Math.max(s.giftQueued,maxQueue);
    if(total===100&&Date.now()-start>=10000)break;
    await demo.waitForTimeout(500);
   }
   assert.equal(total,100);
   const samples=(await demo.evaluate(()=>window.samples)).filter(s=>s.active);
   assert(samples.some(s=>s.width===width&&s.fps>0));
   report.samples.push({targetFPS:fps,width,height:width*16/9,burstMs:Date.now()-start,total,maxQueue,heap:await cdp.send('Runtime.getHeapUsage'),samples});
 }
 await act('render-metrics',{sample:{fps:30,p50:33.3,p95:34,p99:35,drawP95:3,assetP95:0,dropRate:0,width:1080,height:1920,active:true}});
 await studio.getByText('30 FPS · 1080 × 1920 · P95 34 ms · rớt 0%',{exact:true}).waitFor();
 assert.deepEqual(errors,[]);
 await writeFile(process.argv[2]||'performance-v31.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}finally{await browser.close();server.closeAllConnections();server.close();}
