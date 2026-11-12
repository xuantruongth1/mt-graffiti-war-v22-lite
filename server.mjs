import {manifest} from './v2.mjs';
import http from 'node:http';
import { readFile,writeFile,mkdir,rename } from 'node:fs/promises';
import { dirname,join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';
import { WALL_CAPACITY,initWalls,session,ingest,tick,items,freeEffects,loadConfig } from './engine.mjs';

const root=dirname(fileURLToPath(import.meta.url));
const data=process.env.GRAFFITI_DATA||join(process.env.LOCALAPPDATA||root,'MT-Graffiti');
await mkdir(data,{recursive:true});
const file=join(data,'studio.json');
let saved={};
try{saved=JSON.parse(await readFile(file,'utf8'));}catch(error){if(error.code!=='ENOENT')console.error('Không đọc được phiên đã lưu:',error.message);}
let config=loadConfig(saved.config),live=saved.live||session(),demo=session(),connector,burst;
initWalls(live,config);
let demoScenario=null,scenarioGeneration=0;
let status='Chưa kết nối',persist=Promise.resolve(),dirty=false,sequence=0;
const clients=new Map();

const localConnector='E:/ChatGPT/Tiktok/shared/tiktok-live/direct-live.mjs';
const localCatalog='E:/ChatGPT/Tiktok/shared/tiktok-gift-icons/catalog.json';
const catalogPath=process.env.GRAFFITI_CATALOG||localCatalog;
let catalog=[];
try{const raw=JSON.parse(await readFile(catalogPath,'utf8'));catalog=Array.isArray(raw)?raw:raw.icons||raw.gifts||raw.items||[];}catch{}
function state(which){
 const s=which==='demo'?demo:live;
 return {config,marks:s.marks,scene:s.scene,pending:s.pending??[],wallMode:s.wallMode,communityCount:s.community.marks.length,giftQueued:s.queue.filter(x=>x.coins).length,top:Object.values(s.scores).filter(x=>x.coins).sort((a,b)=>b.coins-a.coins).slice(0,5),log:s.log,queue:s.queue.length,wallNumber:s.wallNumber??1,wallMove:s.wallMove??null,round:s.round,ends:s.ends,winners:s.winners,winningTeam:s.winningTeam,teams:s.teams,status};
}
function broadcast(){
 const cache={};
 for(const [res,which] of clients){
  if(res.writableLength>512000){res.end();clients.delete(res);continue;}
  cache[which]??='data: '+JSON.stringify(state(which))+'\n\n';
  res.write(cache[which]);
 }
}
function save(){
 if(!dirty)return;
 dirty=false;
 const snapshot=JSON.stringify({config,live});
 persist=persist.then(async()=>{await writeFile(file+'.tmp',snapshot);await rename(file+'.tmp',file);}).catch(e=>{dirty=true;console.error('Lưu phiên:',e.message);});
}
let last='';
setInterval(()=>{
 tick(live,config);tick(demo,config);
 if(demoScenario&&demo.community.marks.length===3&&!demo.scene&&demo.wallMode==='community'){
   const type=demoScenario;demoScenario=null;
   if(type==='donors'){testGift(100,101);testGift(500,102);}
   else if(type==='upgrade'){testGift(1,101);const token=scenarioGeneration;setTimeout(()=>{if(token===scenarioGeneration)testGift(100,101);},5500);}
   else testGift(20,101);
 }
 const tag=JSON.stringify([live.scene?.id,demo.scene?.id,live.marks.length,demo.marks.length,live.round,demo.round,live.wallMove?.start,demo.wallMove?.start,live.wallMode,demo.wallMode,live.wallNumber,demo.wallNumber]);
 if(tag!==last){last=tag;dirty=true;broadcast();}
},100).unref();
setInterval(save,1000).unref();
const testNames=['Linh Neon','Minh Cọ','Bảo Lam','An Màu','Hà Pixel','Mai Trường','Vy Hồng','Trúc Vàng'];
function testGift(coins,index=sequence){
 const userId='demo-'+index;
 ingest(demo,config,'gift',{userId,nickname:testNames[index%testNames.length],diamondCount:coins,repeatCount:1,msgId:'demo-'+(++sequence)});
 broadcast();
}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.json':'application/json; charset=utf-8'};
const json=(res,x,code=200)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(x));};
const server=http.createServer(async(req,res)=>{
 try{
 const url=new URL(req.url,'http://127.0.0.1');
 const which=url.searchParams.get('source')==='demo'?'demo':'live';
 if(req.method==='GET'&&url.pathname==='/api/events'){
  res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache'});res.write('data: '+JSON.stringify(state(which))+'\n\n');
  clients.set(res,which);res.on('close',()=>clients.delete(res));return;
 }
 if(req.method==='GET'&&url.pathname==='/api/gallery'){
  const data=which==='demo'?demo:live;
  const kind=url.searchParams.get('kind'),id=url.searchParams.get('id');
  if(kind==='donor'||kind==='page'){
   const entry=kind==='donor'?Object.values(data.donors).find(x=>x.wallId===id):data.pages.find(x=>String(x.number)===id);
   if(!entry)return json(res,{error:'Không còn tường này.'},404);
   const now=Date.now(),mark=entry.mark;
   const result={...state(which),wallMode:kind==='donor'?'gift':'community',wallNumber:entry.number??data.wallNumber,
      marks:mark?[mark]:entry.marks,scene:null,wallMove:null,top:[],winners:[],winningTeam:'',communityCount:entry.marks?.length??0};
   if(mark&&url.searchParams.get('replay')==='1'){
    const duration=mark.sequence?.duration??850,drawStart=now+500;
    const animated={...mark,id:'replay-'+now,start:now,drawStart,land:drawStart+duration,end:drawStart+duration+4500};
    result.scene={...animated,art:animated};result.marks=[animated];
   }
   return json(res,result);
  }
  return json(res,{
    pages:data.pages.map(p=>({number:p.number,count:p.marks.length})),
    donors:Object.values(data.donors).map(({uid,name,wallId,tier})=>({uid,name:config.anonymous?'Họa sĩ':name,wallId,tier,coins:Object.hasOwn(data.scores,uid)?data.scores[uid].coins:0})).sort((a,b)=>b.coins-a.coins)
  });
 }
 if(req.method==='GET'&&url.pathname==='/api/catalog')return json(res,catalog);
 if(req.method==='POST'&&url.pathname==='/api/action'){
  if(req.headers.origin&&req.headers.origin!=='http://'+req.headers.host)return json(res,{error:'Nguồn yêu cầu không hợp lệ.'},403);
  if(!req.headers['content-type']?.startsWith('application/json'))return json(res,{error:'Cần dữ liệu JSON.'},415);
  let body='';for await(const chunk of req){body+=chunk;if(body.length>32000)throw Error('Dữ liệu quá lớn.');}
  const a=JSON.parse(body);
  if(a.action==='connect'){
   const {DirectLive}=await import(pathToFileURL(process.env.GRAFFITI_CONNECTOR||localConnector).href);
   const next=new DirectLive(a.username);
   const old=connector;connector=next;
   void old?.disconnect();
   next.on('status',x=>{if(connector!==next)return;status=x.message;broadcast();});
   next.on('event',({event,data:d})=>{if(connector!==next)return;ingest(live,config,event,d);dirty=true;broadcast();});
   void next.connect();
  }else if(a.action==='disconnect'){
   const old=connector;connector=null;void old?.disconnect();status='Đã ngắt kết nối';
  }else if(a.action==='test'){
   const n=Number(a.coins);if(!Number.isInteger(n)||n<1||n>1000000)throw Error('Số xu không hợp lệ.');
   testGift(n);
  }else if(a.action==='test-combo'){
   const count=a.count===10?10:5,id='combo-'+(++sequence);
   for(let i=1;i<=count;i++)ingest(demo,config,'gift',{
     userId:id,nickname:'Họa sĩ Combo',giftId:'demo',groupId:id,msgId:id+'-'+i,giftType:1,repeatEnd:i===count,repeatCount:i,diamondCount:5
   });
  }else if(a.action==='test-scenario'){
   if(!['resume','donors','upgrade','repeat'].includes(a.scenario))throw Error('Kịch bản không hợp lệ.');
   clearInterval(burst);scenarioGeneration++;demo=session();
   demoScenario=a.scenario==='repeat'?null:a.scenario;
   for(let i=0;i<(a.scenario==='repeat'?10:3);i++){
    const index=sequence++;
    ingest(demo,config,'chat',{userId:a.scenario==='repeat'?'repeat-user':'scenario-'+index,nickname:testNames[i%testNames.length],comment:'Vẽ tên',msgId:'scenario-'+index});
   }
  }else if(a.action==='test-chat'){
   const count=Number.isInteger(a.count)&&a.count>=1&&a.count<=7?a.count:1;
   for(let i=0;i<count;i++){
    const index=sequence++;
    ingest(demo,config,'chat',{userId:'chat-'+index,nickname:testNames[index%testNames.length],comment:'Chào mọi người',msgId:'chat-'+index});
   }
  }else if(a.action==='burst'){
   clearInterval(burst);let n=0;burst=setInterval(()=>{testGift(config.rows[n%config.rows.length].min);if(++n>=100)clearInterval(burst);},300);
  }else if(a.action==='clear-demo'){clearInterval(burst);scenarioGeneration++;demoScenario=null;demo=session();}
  else if(a.action==='reset'){live=session();dirty=true;}
  else if(a.action==='round'){(a.source==='demo'?demo:live).ends=Date.now();dirty=true;}
  else if(a.action==='settings'){
   const v=a.config||{};
   const number=(key,min,max)=>{const n=Number(v[key]);if(!Number.isFinite(n)||n<min||n>max)throw Error('Giá trị không hợp lệ: '+key);return n;};
   const tier=(r={})=>({min:Number(r.min),size:Number(r.size),life:Number(r.life),seconds:Number(r.seconds),effect:r.effect,shots:Number(r.shots),gap:Number(r.gap),bombs:Number(r.bombs),skin:r.skin,flight:Number(r.flight),bombFlight:Number(r.bombFlight),recoil:Number(r.recoil),hold:Number(r.hold)});
   const rows=(v.rows||[]).map(tier);
   const {min:_min,size:_size,...free}=tier(v.free);
   Object.assign(free,{shots:1,gap:0,bombs:0});
   if([free,...rows].some(r=>!Number.isInteger(r.shots)||r.shots<1||r.shots>30||!Number.isInteger(r.gap)||r.gap<0||r.gap>1000||!Number.isInteger(r.bombs)||r.bombs<0||r.bombs>5||!['auto',...manifest.skins].includes(r.skin)||!Number.isFinite(r.flight)||r.flight<80||r.flight>600||!Number.isFinite(r.bombFlight)||r.bombFlight<250||r.bombFlight>1000||!Number.isFinite(r.recoil)||r.recoil<0||r.recoil>25))throw Error('Kiểm tra số phát, khoảng cách, số bom sơn và bảng màu.');
   if(!Number.isInteger(free.life)||free.life<5||free.life>1800||!Number.isFinite(free.seconds)||free.seconds<.4||free.seconds>12||!freeEffects.includes(free.effect))throw Error('Kiểm tra lại hiệu ứng và thời gian mức bình luận.');
   if(rows.length!==6||rows[0].min!==1||rows.some((r,i)=>!Number.isInteger(r.min)||r.min>1e8||!Number.isInteger(r.size)||r.size<90||r.size>850||!Number.isInteger(r.life)||r.life<5||r.life>1800||!Number.isFinite(r.seconds)||r.seconds<.4||r.seconds>24||!items.includes(r.effect)||(i&&(r.min<=rows[i-1].min||r.size<=rows[i-1].size||r.seconds<=rows[i-1].seconds))))throw Error('Cần 6 bậc quà. Ngưỡng, kích thước và thời gian vẽ phải tăng dần.');
   const mapping=Object.fromEntries(Object.entries(v.mapping||{}).filter(([id,item])=>/^\d{1,15}$/.test(id)&&items.includes(item)));
   const minutes=number('minutes',0,60);
   if(minutes!==config.minutes){live.ends=0;demo.ends=0;}
   const values=Object.fromEntries(Object.entries(v.values||{}).filter(([id,n])=>/^\d{1,15}$/.test(id)&&Number.isSafeInteger(n)&&n>0&&n<=1e6));
   const slots=v.slots;
   if(!Array.isArray(slots)||slots.length!==6||slots.some(p=>!Number.isFinite(p.x)||p.x<155||p.x>786||!Number.isFinite(p.y)||p.y<600||p.y>944)||slots.some((p,i)=>slots.slice(0,i).some(q=>Math.abs(p.x-q.x)<275&&Math.abs(p.y-q.y)<260)))throw Error('Các ô phải nằm trên tường và có khoảng cách an toàn.');
   if(rows.some(r=>!Number.isFinite(r.hold)||r.hold<1||r.hold>20))throw Error('Kiểm tra thời gian vinh danh.');
   config={version:2.2,perfRevision:1,slots,fullHold:number('fullHold',2500,15000),wipeMs:number('wipeMs',300,1600),peak:number('peak',290,315),speed:number('speed',.5,2),rows,free,mapping,values,minutes,gun:Math.trunc(number('gun',-1,9)),grenade:Math.trunc(number('grenade',-1,9)),gunScale:number('gunScale',.35,1),muzzleX:number('muzzleX',0,941),muzzleY:number('muzzleY',0,1672),fps:Number(v.fps)===30?30:60,topWidth:number('topWidth',220,600),topX:number('topX',0,1080),topY:number('topY',130,1610),showGun:!!v.showGun,sparks:!!v.sparks,shake:!!v.shake,glow:!!v.glow,mixSpray:!!v.mixSpray,accumulate:!!v.accumulate,particles:number('particles',0,100),volume:number('volume',0,100),safe:number('safe',0,10),max:[4,5,6].includes(Number(v.max))?Number(v.max):WALL_CAPACITY,top:!!v.top,flash:!!v.flash,teams:!!v.teams,anonymous:!!v.anonymous};dirty=true;
  }else throw Error('Lệnh không hợp lệ.');
  broadcast();save();return json(res,{ok:true});
 }
 const icon=url.pathname.match(/^\/gift-icon\/([a-zA-Z0-9_-]+\.png)$/);
 if(req.method==='GET'&&icon){
  const bytes=await readFile(join(dirname(catalogPath),'icons',icon[1]));
  res.writeHead(200,{'Content-Type':'image/png','X-Content-Type-Options':'nosniff','Cache-Control':'public,max-age=3600'});return res.end(bytes);
 }
 const name=url.pathname==='/'?'index.html':url.pathname.slice(1);
 if(req.method!=='GET'||!/^(?:index\.html|overlay\.html|studio\.js|overlay\.js|stage-layout\.mjs|stage-art\.mjs|courtyard\.jpg|asset-layout\.mjs|v2\.mjs|v2\/(?:lite\/[A-Z0-9_a-z]+\.webp|[a-z_]+\.json|wall\.png|(?:frames|guns|grenades|fx)\/[A-Z0-9_a-z]+\.png)|vi_tri_avatar_va_ten\.json|(?:01_Binh_Luan|02_1_Xu|03_5_Xu|04_20_Xu|05_100_Xu|06_500_Xu|07_1000_Xu_VIP_PRO)\.png|studio\.css)$/.test(name))return json(res,{error:'Không tìm thấy.'},404);
 const contents=await readFile(join(root,name));
 res.writeHead(200,{'Content-Type':mime[name.slice(name.lastIndexOf('.'))],'X-Content-Type-Options':'nosniff','Cache-Control':name.startsWith('v2/lite/')?'public,max-age=86400':'no-cache'});
 res.end(contents);
 }catch(e){if(!res.headersSent)json(res,{error:e.code==='ERR_MODULE_NOT_FOUND'?'Thiếu bộ kết nối TikTok LIVE trên máy.':e.message},400);else res.end();}
});
server.listen(process.env.GRAFFITI_PORT===undefined?3197:Number(process.env.GRAFFITI_PORT),'127.0.0.1',()=>{
 const address=server.address();console.log('MT Graffiti Studio · '+JSON.stringify(address));
 if(process.env.GRAFFITI_READY_FILE)void writeFile(process.env.GRAFFITI_READY_FILE,'http://127.0.0.1:'+address.port).catch(e=>console.error(e.message));
});
async function shutdown(){
 save();await persist;process.exit(0);
}
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,shutdown);
if(process.env.GRAFFITI_LAUNCHER_PIPE==='1'){
 process.stdin.once('end',shutdown);
 process.stdin.resume();
}


















export {server};
