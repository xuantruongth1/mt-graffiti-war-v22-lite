import {paintPalettes,paintRecipes} from './paint-recipes.mjs';
import {frameGeometry,drawFrame} from './asset-layout.mjs';
import {manifest,v2Frame,timeline,walls,wallAsset,gunAsset} from './v2.mjs';
import {palette} from './stage-layout.mjs';
import {paintStamp} from './stage-art.mjs';
const $=id=>document.getElementById(id);
const names=['Nét màu','Mưa màu','Pháo giấy','Chữ neon','Rồng sắc màu','Siêu VIP Pro','Sóng cầu vồng','Cánh phượng','Tẩy sơn','Khiên màu','Vương miện','Tia sét','Sao vàng','Cầu vồng','Portal','Tim ma thuật'];
const freeEffects=['Nét tên','Nét tên neon','Bụi màu'];
const values=['particles','volume','safe','minutes','gun','grenade','gunScale','muzzleX','muzzleY','fps','wallTheme','renderWidth','previewWidth','max','fullHold','wipeMs','peak','speed'],flags=['drawViewers','idlePan','gunRotate','scaleTransitions','flash','anonymous','top','teams','showGun','sparks','shake','glow','mixSpray','accumulate'];
const tabs={overview:'Tổng quan & Điều khiển LIVE',gifts:'Quà & vật phẩm',props:'Skin & bom sơn',fx:'Hiệu ứng & bố cục',round:'Vòng chơi & TOP',test:'Phòng thử hiệu ứng',gallery:'Thư viện tường',support:'Hướng dẫn & hỗ trợ',log:'Nhật ký phiên'};
let current,liveState,demoState,audio=false,settingsLoaded=false,timer;
function el(tag,text){const x=document.createElement(tag);if(text!=null)x.textContent=text;return x;}
function notice(text){clearTimeout(timer);$('feedback').textContent=text;timer=setTimeout(()=>$('feedback').textContent='',5500);}
const serverOffline='Mất kết nối với máy chủ game. Mở lại MT Graffiti War V3.4.exe và giữ cửa sổ launcher mở.';
function showDemoConnection(connected){
 $('test-timeline').textContent=connected?'Phòng thử đã kết nối.':serverOffline;
}
async function action(action,params={},message='Đã cập nhật'){
 let response;
 try{
   response=await fetch('/api/action',{
     method:'POST',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({action,...params}),signal:AbortSignal.timeout(10000)
   });
 }catch(error){
   notice(error.name==='TimeoutError'?'Máy chủ phản hồi quá chậm. Kiểm tra hàng chờ trước khi bấm lại.':serverOffline);
   return false;
 }
 try{
   const result=await response.json();
   if(!response.ok)throw Error(result.error||'Yêu cầu không thành công.');
   notice(message);return result;
 }catch(error){notice(error instanceof SyntaxError?'Máy chủ trả về phản hồi không hợp lệ. Mở Studio từ launcher.':error.message);return false;}
}
let gallerySource=null,previewSource='live',frameReady=false,studioOnline=false;
function updatePreview(){
 const label=$('preview-label');
 const kind=gallerySource?'gallery':previewSource;
 label.dataset.source=kind;
 label.textContent={gallery:'Thư viện',demo:'DEMO · Không phải LIVE',live:'LIVE · Màn trình diễn'}[kind];
 $('preview-placeholder').hidden=studioOnline&&frameReady;
 $('preview-panel').setAttribute('aria-busy',String(studioOnline&&!frameReady));
 $('source').disabled=previewSource!=='demo';
 $('preview-placeholder').textContent=studioOnline?'Đang tải màn trình diễn…':serverOffline;
}
function showPreview(next,reload=false){
 if(!gallerySource&&!reload&&previewSource===next)return;
 previewSource=next;gallerySource=null;frameReady=false;
 $('frame').src='/overlay.html?preview=1'+(next==='demo'?'&source=demo':'');
 updatePreview();
}
function tab(name){
 if(name==='test')showPreview('demo');
 else if(name!=='gallery')showPreview('live');
 $('live-controls').hidden=name!=='overview';
 for(const key of Object.keys(tabs))$(key).hidden=key!==name;
 for(const b of document.querySelectorAll('[data-tab]')){
   const selected=b.dataset.tab===name;
   b.classList.toggle('active',selected);
   if(selected)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
 }
 $('page-title').textContent=tabs[name];
 if(name==='gallery')void refreshGallery();
}
for(const b of document.querySelectorAll('[data-tab],[data-open]'))b.onclick=()=>tab(b.dataset.tab||b.dataset.open);
if(location.hash.startsWith('#guide-')){
 tab('support');
 document.getElementById(location.hash.slice(1))?.scrollIntoView();
}
const compactNav=matchMedia('(max-width: 920px)');
function updateMenu(){
 const toggled=document.body.classList.contains('nav-hidden');
 $('menu').setAttribute('aria-expanded',String(compactNav.matches?toggled:!toggled));
 $('nav-scrim').hidden=!(compactNav.matches&&toggled);
}
function closeDrawer(){
 if(compactNav.matches){document.body.classList.remove('nav-hidden');updateMenu();$('menu').focus();}
}
$('menu').onclick=()=>{document.body.classList.toggle('nav-hidden');updateMenu();if(!$('nav-scrim').hidden)$('close-menu').focus();};
$('close-menu').onclick=closeDrawer;
$('nav-scrim').onclick=closeDrawer;
$('studio-nav').addEventListener('click',event=>{if(event.target.closest('[data-tab]'))closeDrawer();});
addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('nav-scrim').hidden)closeDrawer();});
compactNav.addEventListener('change',()=>{document.body.classList.remove('nav-hidden');updateMenu();});
updateMenu();
const glyphs={
 overview:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
 gifts:'M3 8h18v4H3z M5 12v9h14v-9 M12 8v13 M12 8c-7 0-7-7-3-5l3 5c7 0 7-7 3-5z',
 props:'M4 20 19 5 M14 5h5v5 M4 14v6h6 M7 4v6 M4 7h6',
 fx:'M4 6h16 M4 12h16 M4 18h16 M8 4v4 M15 10v4 M10 16v4',
 round:'M8 3h8v5a4 4 0 0 1-8 0z M8 5H4v2a4 4 0 0 0 4 4 M16 5h4v2a4 4 0 0 1-4 4 M12 12v7 M8 21h8',
 test:'M8 5l11 7-11 7z',
 gallery:'M3 4h18v16H3z M3 16l6-5 4 3 3-3 5 5 M8 8h.01',
 log:'M5 4h14v16H5z M8 8h8 M8 12h8 M8 16h5',
 support:'M4 5h7a3 3 0 0 1 3 3v12a4 4 0 0 0-4-3H4z M14 8a3 3 0 0 1 3-3h3v12h-2a4 4 0 0 0-4 3',
 menu:'M4 6h16 M4 12h16 M4 18h16',
 copy:'M8 8h12v12H8z M4 16V4h12',
 screen:'M3 4h18v13H3z M8 21h8 M12 17v4',
 refresh:'M20 7v5h-5 M20 12a8 8 0 1 0-2 5',
 link:'M8 12h8 M10 8H7a4 4 0 0 0 0 8h3 M14 8h3a4 4 0 0 1 0 8h-3',
 unlink:'M9 15l6-6 M10 7H7a4 4 0 0 0 0 8 M14 17h3a4 4 0 0 0 0-8',
 trash:'M4 7h16 M9 7V4h6v3 M7 7l1 13h8l1-13 M10 10v7 M14 10v7'
};
function addIcon(node,name){
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
 svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');
 svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.7');
 svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');
 svg.setAttribute('aria-hidden','true');svg.classList.add('icon');
 const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',glyphs[name]);svg.append(path);node.prepend(svg);
}
for(const button of document.querySelectorAll('[data-tab]')){
 const label=button.textContent.trim();
 button.title=label;button.setAttribute('aria-label',label);
 const text=el('span',label);button.replaceChildren(text);addIcon(button,button.dataset.tab);
 if(button.classList.contains('active'))button.setAttribute('aria-current','page');
}
for(const [id,glyph] of [['menu','menu'],['copy','copy'],['open-live','screen'],['preview-title','screen'],['refresh','refresh'],['disconnect','unlink'],['reset','trash']])addIcon($(id),glyph);
addIcon($('connect-form').querySelector('button[type=submit]')??$('connect-form').querySelector('button'),'link');
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText(location.origin+'/overlay.html?renderer=obs');notice('Đã sao chép link OBS');}catch{notice(location.origin+'/overlay.html?renderer=obs');}};
$('frame').onload=()=>{if(audio)$('frame').contentWindow.postMessage({audio},location.origin);};
addEventListener('message',event=>{
 if(event.origin!==location.origin||event.source!==$('frame').contentWindow||typeof event.data?.graffitiReady!=='boolean')return;
 frameReady=event.data.graffitiReady;updatePreview();
});
$('preview-audio').onclick=()=>{
 audio=!audio;
 $('frame').contentWindow.postMessage({audio},location.origin);
 $('preview-audio').textContent=audio?'Tắt tiếng':'Bật tiếng';
};
$('refresh').onclick=()=>showPreview(previewSource,true);
$('source').onclick=async()=>{await action('clear-demo',{},'Đã kết thúc lượt thử');showPreview('live');};
$('open-live').onclick=()=>{showPreview('live');$('preview-panel').scrollIntoView({block:'nearest',behavior:'smooth'});};
$('connect-form').onsubmit=e=>{e.preventDefault();action('connect',{username:$('username').value},'Đang yêu cầu kết nối…');};
$('disconnect').onclick=()=>action('disconnect');
const resetDialog=$('reset-dialog');
$('reset').onclick=()=>{resetDialog.returnValue='';resetDialog.showModal();};
resetDialog.addEventListener('close',()=>{if(resetDialog.returnValue==='reset')void action('reset');});
$('next-round').onclick=()=>action('round',{source:'live'},'Đã chốt vòng LIVE');
$('burst-fast').onclick=()=>action('burst',{rate:10},'Đang gửi 100 lượt thử trong 10 giây');
$('test-viewer').onclick=()=>action('test-viewer',{count:1},'Đã đưa người vào xem vào hàng chờ thử');
$('clear').onclick=()=>action('clear-demo');$('burst').onclick=()=>action('burst',{},'Đang gửi 100 lượt thử trong 30 giây');
for(const [count,title] of Array.from({length:7},(_,i)=>[i+1,i===0?'Thử bình luận':(i+1)+' bình luận'])){
 const b=el('button',title);b.onclick=()=>action('test-chat',{count},'Đã đưa bình luận vào hàng chờ thử');$('test-buttons').append(b);
}
function showTestGifts(){
 for(const b of $('test-buttons').querySelectorAll('[data-test-gift]'))b.remove();
 for(const row of current.rows){
  const b=el('button',row.min.toLocaleString('vi-VN')+' xu');
  b.dataset.testGift='1';b.onclick=()=>action('test',{coins:row.min},'Đã đưa quà vào hàng chờ thử');
  $('test-buttons').append(b);
 }
}
for(const name of names){const o=el('option',name);$('item').append(o);}
fetch('/api/catalog').then(r=>r.json()).then(data=>{for(const x of data){if(!x.tiktokGiftId)continue;const o=el('option',(x.name||x.label||x.tiktokGiftId)+' · '+(x.coins??x.coinLabel??'—')+' xu');o.value=x.tiktokGiftId;o.dataset.icon=x.src?.split('/').pop()||'';$('catalog').append(o);}}).catch(()=>{});
$('catalog').onchange=()=>{
 const select=$('catalog');$('gift-id').value=select.value;
 const option=select.selectedOptions[0],preview=$('selected-gift');preview.replaceChildren();
 if(!select.value)return;
 if(option.dataset.icon){const img=el('img');img.src='/gift-icon/'+encodeURIComponent(option.dataset.icon);img.alt='';preview.append(img);}
 preview.append(el('span',option.textContent));
};
function read(){
 const config={...current,gunPool:[...$('gun-pool').querySelectorAll('input:checked')].map(x=>Number(x.value)),mapping:{...current.mapping},values:{...current.values}};
 for(const key of values)config[key]=Number($(key).value);
 for(const key of flags)config[key]=$(key).checked;
 config.cameraPace=$('camera-pace').value;
 for(const key of ['paintPalette','paintRecipe','paintIntensity'])config[key]=$(key).value;
 const rows=Array.from($('tiers').children,row=>Object.fromEntries(Array.from(row.querySelectorAll('input,select'),i=>[i.name,i.type==='number'?Number(i.value):i.value])));
 config.free={...current.free,...rows[0]};
 config.rows=rows.slice(1).map((row,i)=>({...current.rows[i],...row}));
 config.slots=Array.from($('slot-settings').children,g=>({x:Number(g.querySelector('[data-axis=x]').value),y:Number(g.querySelector('[data-axis=y]').value)}));
 return config;
}
async function save(change){
 if(!current)return;
 const config=read();change?.(config);
 if(!change){
   const short=[config.free,...config.rows].flatMap((row,level)=>{
     const duration=timeline(level,row).duration;
     return row.seconds*1000+1<duration?[{level,row,required:Math.ceil(duration/100)/10}]:[];
   });
   if(short.length){
     const detail=short.map(({level,required})=>'Bậc '+(level+1)+': '+required+' giây').join(', ');
     if(!confirm('Chuỗi hiệu ứng cần thêm thời gian. Tự giãn thời lượng? '+detail))return;
     for(const {row,required} of short)row.seconds=required;
   }
   if(config.particles>80&&config.fps===60&&config.renderWidth===1080&&!confirm('Thiết lập 1080p · 60 FPS · trên 80% hạt có thể tăng tải. Vẫn áp dụng?'))return;
 }
 if(await action('preview-settings',{config},'Đã cập nhật bản nháp trong DEMO')){
   if(change){history.push(current);current=config;showConfig(false);}
   refreshDraft();
   if(gallerySource)showPreview('live');
   return true;
 }
 return false;
}
let applied,revision=0;
const history=[];
function changes(config){
 return Object.keys(config).filter(k=>JSON.stringify(config[k])!==JSON.stringify(applied?.[k]));
}
function refreshDraft(){
 if(!applied)return;
 const count=changes(read()).length;
 $('draft-status').textContent=count?count+' nhóm thay đổi chưa áp dụng':'Đang dùng cấu hình LIVE';
 $('apply-live').disabled=!count;
 $('undo-draft').disabled=!count&&!history.length;
}
function restoreDraft(config){
 current=structuredClone(config);
 $('tiers').replaceChildren();$('slot-settings').replaceChildren();
 showConfig(true);refreshDraft();
}
document.querySelector('main').addEventListener('input',refreshDraft);
addEventListener('beforeunload',event=>{if(applied&&changes(read()).length){event.preventDefault();event.returnValue='';}});
$('apply-live').onclick=async()=>{
 if(!applied)return;
 const config=read(),diff=changes(config);
 if(!diff.length||!confirm('Áp dụng '+diff.length+' nhóm thay đổi lên LIVE?'))return;
 if(!await action('preview-settings',{config},'Đã kiểm tra bản nháp'))return;
 const result=await action('apply-settings',{config,revision},'Đã áp dụng lên LIVE');
 if(result){history.push(applied);applied=structuredClone(config);revision=result.revision;restoreDraft(config);}
};
$('undo-draft').onclick=()=>{if(applied)restoreDraft(history.pop()??applied);};
$('test-draft').onclick=async()=>{if(await save())await action('test-chat',{count:1},'Đã gửi bình luận thử vào DEMO');};
for(const b of document.querySelectorAll('[data-save]')){b.textContent='Lưu bản nháp';b.onclick=()=>save();}
for(const [id,actionName] of [['pause-live','pause-presentation'],['resume-live','resume-presentation'],['skip-live','skip-current-visual']]){
 $(id).onclick=()=>action(actionName);
}
$('map-add').onclick=()=>{const id=$('gift-id').value.trim();if(!/^\d{1,15}$/.test(id)){notice('Nhập ID quà dạng số');return;}save(c=>{c.mapping[id]=$('item').value;const value=Number($('gift-value').value);if(value>0)c.values[id]=value;else delete c.values[id];});};
const thumbObserver=new IntersectionObserver(entries=>{
 for(const {target,isIntersecting} of entries){
   if(!isIntersecting)continue;
   thumbObserver.unobserve(target);
   const level=Number(target.dataset.level),r=level?current.rows[level-1]:current.free;
   const url=v2Frame(level,r.skin==='auto'?manifest.skins[0]:r.skin);
   const image=new Image();
   image.onload=()=>{
     const geometry=frameGeometry(level,level?r.size:181),ctx=target.getContext('2d');
     const scale=Math.min(38/(geometry.left+geometry.right),40/(geometry.top+geometry.bottom));
     ctx.scale(scale,scale);ctx.translate(geometry.left+1/scale,geometry.top+1/scale);drawFrame(ctx,image,geometry);
   };
   image.src='/v2/lite/'+url.split('/').at(-1).replace(/\.png$/,'.webp');
 }
});
function showConfig(first){
 if(first){
  for(const [i,slot] of current.slots.entries()){
    const group=el('div');group.className='slot-fields';group.append(el('strong','Ô '+(i+1)));
    for(const axis of ['x','y']){const label=el('label',axis.toUpperCase()),input=el('input');input.type='number';input.dataset.axis=axis;input.value=slot[axis];label.append(input);group.append(label);}
    document.getElementById('slot-settings').append(group);
  }for(const key of values)$(key).value=current[key];for(const key of flags)$(key).checked=current[key];
 $('camera-pace').value=current.cameraPace??'natural';
 for(const key of ['paintPalette','paintRecipe','paintIntensity'])$(key).value=current[key];
 showSwatches();
 for(const input of $('gun-pool').querySelectorAll('input'))input.checked=(current.gunPool??[]).includes(Number(input.value));
 updateWallSelection();
 [current.free,...current.rows].forEach((r,i)=>{
   const row=el('div');row.className='tier';row.dataset.level=i;
   const heading=el('div');heading.className='tier-heading';
   const thumb=el('canvas');thumb.width=40;thumb.height=42;thumb.className='tier-thumb';
   thumb.dataset.level=i;thumbObserver.observe(thumb);
   heading.append(thumb);heading.append(el('strong',i===0?'Bình luận':i===6?'Siêu VIP Pro':'Quà · Bậc '+i),el('small',i===0?'Miễn phí':'Từ '+r.min.toLocaleString('vi-VN')+' xu'));
   const play=el('button','Xem thử');
   play.onclick=()=>{tab('test');$('test-buttons').querySelectorAll('button')[i?6+i:0]?.focus();};
   heading.append(play);row.append(heading);
   const fields=el('div');fields.className='tier-fields';
   const labels=i?[['min','Từ xu'],['size','Cỡ (px)'],['seconds','Vẽ (giây)'],['hold','Vinh danh (giây)'],['shots','Số phát'],['gap','Cách phát (ms)'],['bombs','Bom sơn'],['flight','Bay sơn (ms)'],['bombFlight','Bay bom (ms)'],['recoil','Giật nòng (px)']]:[['seconds','Vẽ (giây)'],['flight','Bay sơn (ms)'],['recoil','Giật nòng (px)']];
   for(const [key,title] of labels){
     const l=el('label',title),input=el('input');input.type='number';input.name=key;input.step=key==='seconds'?'.05':'1';input.value=r[key];l.append(input);fields.append(l);
   }
   const l=el('label','Hiệu ứng'),select=el('select');select.name='effect';
   for(const name of i?names:freeEffects)select.append(el('option',name));
   select.value=r.effect;l.append(select);fields.append(l);
   const skinLabel=el('label','Bảng màu'),skin=el('select');skin.name='skin';
   for(const id of ['auto',...manifest.skins]){const o=el('option',id==='auto'?'Tự động':id.replaceAll('_',' '));o.value=id;skin.append(o);}
   skin.value=r.skin;skinLabel.append(skin);fields.append(skinLabel);
   const detail=el('details'),summary=el('summary','Thông số nâng cao');
   detail.append(summary,fields);row.append(detail);$('tiers').append(row);
 });
 }
 for(const [i,row] of Array.from($('tiers').children).slice(1).entries())row.querySelector('small').textContent='Từ '+current.rows[i].min.toLocaleString('vi-VN')+' xu';
 showTestGifts();
 $('mappings').replaceChildren(...Object.entries(current.mapping).map(([id,item])=>{const row=el('div');const img=el('canvas');img.width=32;img.height=32;paintStamp(img.getContext('2d'),16,15,12,palette[Math.min(6,names.indexOf(item)+1)],71,1);const b=el('button','Bỏ gán');b.onclick=()=>save(c=>delete c.mapping[id]);row.append(img,el('span',id+' · '+item),b);return row;}));
}
const listKeys=new Map();
function renderList(id,items,format){
 const key=JSON.stringify(items);
 if(listKeys.get(id)===key)return;
 listKeys.set(id,key);
 $(id).replaceChildren(...items.map(item=>el('li',format(item))));
}
function render(){
 if(!liveState)return;const s=liveState;
 $('status').textContent=s.status;
 const connectionState=s.connection?.state??'idle';
 $('status').dataset.state=connectionState;
 const badge=$('header-live-status');
 badge.dataset.state=connectionState;
 const shortStatus={idle:'Chưa kết nối',connecting:'Đang kết nối',waiting:'Đã kết nối',connected:'Đang LIVE',retry:'Đang thử lại',offline:'LIVE đã kết thúc',error:'Lỗi kết nối'}[connectionState]??'Chưa kết nối';
 if(badge.textContent!==shortStatus)badge.textContent=shortStatus;
 $('pause-live').disabled=s.paused;$('resume-live').disabled=!s.paused;
 $('m-marks').textContent=s.communityCount+' / '+s.config.max;$('m-queue').textContent=s.queue;$('m-round').textContent=s.round;
 renderList('top-list',s.top,x=>x.name+' · '+x.coins.toLocaleString('vi-VN')+' xu');
 renderLiveMetrics(s.liveMetrics);
 const selected=$('log-source').value==='demo'?demoState:liveState;
 const logs=selected?.log||[];
 const pending=selected?.pending??[],connection=selected?.connection;
 renderList('pending-list',pending,x=>(x.gift||'Quà chưa rõ ID')+' · ×'+x.count+' · '+(x.reason??'Chưa xác nhận')+' · '+new Date(x.at).toLocaleTimeString('vi-VN'));
 $('retry-pending').disabled=!pending.length;
 $('connection-info').textContent=connection?'Kết nối lại '+connection.reconnects+' lượt · '+connection.errors+' lỗi'+(connection.latencyMs===null?'':' · '+connection.latencyMs+' ms')+(connection.lastEventAt?' · Nhận gần nhất '+new Date(connection.lastEventAt).toLocaleTimeString('vi-VN'):''):'';
 $('queue-wait').textContent=selected?.queueWaitMs==null?'':'Lượt hiện tại đã chờ '+selected.queueWaitMs+' ms';

 renderList('log-list',logs.slice(0,35),x=>new Date(x.at).toLocaleTimeString('vi-VN')+' · '+x.name+' · '+x.item+' · '+x.coins+' xu'+(x.gift?' · ID '+x.gift:''));
}
function renderLiveMetrics(samples=[]){
 const active=samples.filter(x=>Date.now()-x.at<10000);
 const select=$('renderer-choice'),previous=select.value;
 const key=active.map(x=>x.id).join(',');
 if(select.dataset.key!==key){
   select.dataset.key=key;
   const options=active.map(x=>{const o=el('option',x.label+' '+x.id.slice(0,6));o.value=x.id;return o;});
   select.replaceChildren(...options);
   select.value=active.some(x=>x.id===previous)?previous:(active.find(x=>x.label==='OBS')??active[0])?.id??'';
 }
 select.hidden=active.length<2;
 const live=active.find(x=>x.id===select.value);
 $('live-metrics').textContent=live&&Date.now()-live.at<10000&&live.active?live.fps+' FPS · '+live.width+' × '+live.height+' · P95 '+live.p95+' ms · rớt '+live.dropRate+'%':'Chưa có mẫu LIVE đang vẽ';
}
$('renderer-choice').onchange=()=>renderLiveMetrics(liveState?.liveMetrics);
setInterval(()=>renderLiveMetrics(liveState?.liveMetrics),2500);
$('log-source').onchange=render;
$('retry-pending').onclick=async()=>{
 try{
   const response=await fetch('/api/action?source='+$('log-source').value,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'retry-pending'})});
   const result=await response.json();
   if(!response.ok)throw Error(result.error);
   notice('Đã kiểm tra lại danh sách quà chờ.');
 }catch(error){notice(error.message);}
};
for(const which of ['live','demo']){
 const stream=new EventSource('/api/events?view=studio&source='+which);
 if(which==='demo')stream.onerror=()=>showDemoConnection(false);
 else stream.onerror=()=>{studioOnline=false;updatePreview();};
 stream.onmessage=e=>{
   const s=JSON.parse(e.data);
   if(which==='live'){
     const reconnect=!studioOnline;studioOnline=true;
     liveState=s;
     if(reconnect&&!frameReady&&settingsLoaded)showPreview(previewSource,true);
     updatePreview();
     if(!settingsLoaded){settingsLoaded=true;applied=structuredClone(s.config);revision=s.configRevision;restoreDraft(s.config);}
   }else{
     demoState=s;
     showDemoConnection(true);updatePreview();
   }
   render();
 };
}


addEventListener('message',event=>{if(event.origin===location.origin&&event.source===document.getElementById('frame').contentWindow&&Number.isInteger(event.data?.graffitiFps))$('preview-fps').textContent=event.data.graffitiIdle?'Đang chờ':event.data.graffitiFps+' FPS';});













for(const [key,list] of [['gun',manifest.guns],['grenade',manifest.grenades]]){
 const automatic=el('option','Theo bậc / tự động');automatic.value=-1;$(key).append(automatic);
 list.forEach((item,i)=>{const o=el('option',item.display_name||item.name);o.value=i;$(key).append(o);});
}
$('combo5').onclick=()=>action('test-combo',{count:5});
$('combo10').onclick=()=>action('test-combo',{count:10});
$('export-config').onclick=()=>{
 if(!current)return;
 const url=URL.createObjectURL(new Blob([JSON.stringify(read(),null,2)],{type:'application/json'}));
 const a=el('a');a.href=url;a.download='mt-graffiti-v2-config.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),500);
};
$('import-config').onchange=async()=>{
 try{
   const config=JSON.parse(await $('import-config').files[0].text());
   const next={...read(),...config};
   if(await action('preview-settings',{config:next},'Đã nạp cấu hình vào bản nháp')){history.push(read());restoreDraft(next);}
 }catch(e){notice(e.message);}
};


let topEditing=false;
function sendEditor(){
 $('frame').contentWindow.postMessage({editBox:topEditing?$('layout-box').value:null},location.origin);
}
$('edit-top').onclick=async()=>{
 if(!topEditing&&!await save())return;
 topEditing=!topEditing;
 $('edit-top').setAttribute('aria-pressed',String(topEditing));sendEditor();
};
$('layout-box').onchange=sendEditor;
$('toggle-box').onclick=()=>{
 const key=$('layout-box').value;
 if(key==='top'){
   $('top').checked=!$('top').checked;
   return save();
 }
 return save(c=>{c.hud={...c.hud,[key]:{...c.hud[key],visible:!c.hud[key].visible}};});
};
$('frame').addEventListener('load',sendEditor);
addEventListener('message',event=>{
 if(!topEditing||event.origin!==location.origin||event.source!==$('frame').contentWindow)return;
 const layout=event.data?.boxLayout;
 if(!layout||layout.key!==$('layout-box').value||![layout.x,layout.y,layout.w].every(Number.isFinite))return;
 void save(c=>{
   const {key,x,y,w}=layout;
   if(key==='top'){c.topX=x;c.topY=y;c.topWidth=w;}
   else c.hud={...c.hud,[key]:{...c.hud[key],x,y,w}};
 });
});
$('quality-preset').onchange=()=>{
 const choice=$('quality-preset').value;
 if(!choice)return;
 $('fps').value=choice==='high'?60:30;
 $('renderWidth').value=choice==='low'?720:1080;
 $('previewWidth').value=choice==='low'?360:540;
 $('particles').value={low:35,medium:65,high:100}[choice];
 $('glow').checked=choice!=='low';$('shake').checked=choice==='high';
 refreshDraft();
};

const scenarios={repeat:'Một người bình luận 10 lần',resume:'Quà khi tường đang 3/6',donors:'Hai người tặng cùng lúc',upgrade:'Tặng lại để nâng tường'};
for(const [scenario,title] of Object.entries(scenarios)){
 const b=el('button',title);b.onclick=()=>action('test-scenario',{scenario},'Đang chạy kịch bản');$('scenario-buttons').append(b);
}

async function refreshGallery(){
 const selected=$('gallery-source').value;
 try{
   const response=await fetch('/api/gallery?source='+selected);if(!response.ok)throw Error('Không đọc được thư viện.');
   const data=await response.json();
   function view(kind,id,replay=false){
     gallerySource=selected;frameReady=false;updatePreview();
     $('frame').src='/overlay.html?'+new URLSearchParams({preview:1,export:1,source:selected,kind,id,replay:replay?'1':'0'});
   }
   $('gallery-pages').replaceChildren(...(data.pages.length?data.pages.map(p=>{
     const b=el('button','Tường '+p.number+' · '+p.count+' người');b.onclick=()=>view('page',p.number);return b;
   }):[el('small','Chưa có trang đã lưu.')]));
   $('gallery-donors').replaceChildren(...(data.donors.length?data.donors.map(p=>{
     const row=el('div');row.className='actions wrap gallery-row';
     const desc=el('strong',p.name+' · '+p.coins.toLocaleString('vi-VN')+' xu · Bậc '+(p.tier+2));
     const b=el('button','Xem tường'),replay=el('button','Phát lại');
     b.onclick=()=>view('donor',p.wallId);replay.onclick=()=>view('donor',p.wallId,true);
     row.append(desc,b,replay);return row;
   }):[el('small','Chưa có tường người tặng.')]));
 }catch(e){notice(e.message);}
}
$('gallery-source').onchange=refreshGallery;
$('gallery-refresh').onclick=refreshGallery;
$('gallery-png').onclick=()=>{
 if(!gallerySource){notice('Chọn tường đã lưu để tải ảnh.');return;}
 const doc=$('frame').contentDocument;
 const canvas=doc?.querySelector('canvas[data-ready=true]');
 if(!canvas||!doc.location.search.includes('kind=')){notice('Đang tải tường.');return;}
 try{
   canvas.toBlob(blob=>{
     if(!blob){notice('Không tạo được ảnh tường.');return;}
     const url=URL.createObjectURL(blob),link=el('a');
     link.href=url;link.download='MT-Graffiti-tuong.png';link.click();
     setTimeout(()=>URL.revokeObjectURL(url),1000);
   },'image/png');
 }catch{notice('Ảnh đại diện từ nguồn ngoài không cho phép xuất PNG.');}
};
$('gallery-exit').onclick=()=>showPreview('live');
const wallPicker=$('wall-picker');
for(const [id,name] of walls.entries()){
 const option=el('option',name);option.value=id;$('wallTheme').append(option);
 const tile=el('button'),img=el('img');img.src=wallAsset(id,true);img.alt='';img.loading='lazy';
 tile.dataset.wall=id;tile.append(img,el('span',name));
 tile.onclick=()=>{$('wallTheme').value=id;updateWallSelection();refreshDraft();};
 wallPicker.append(tile);
}
function updateWallSelection(){
 for(const tile of wallPicker.children)tile.setAttribute('aria-pressed',String(tile.dataset.wall===$('wallTheme').value));
}
for(const [index,item] of manifest.guns.entries()){
 const label=el('label'),img=el('img'),check=el('input');
 img.src='/v2/lite/'+gunAsset(index).split('/').at(-1).replace(/\.png$/,'.webp');
 img.alt='';img.loading='lazy';check.type='checkbox';check.value=index;
 label.append(img,check,el('span',item.display_name||item.name||item.id));$('gun-pool').append(label);
}

for(const [id,items] of [['paintPalette',paintPalettes],['paintRecipe',paintRecipes]]){
 for(const item of items){const option=el('option',item.id+' · '+item.name);option.value=item.id;$(id).append(option);}
}
function showSwatches(){
 const palette=paintPalettes.find(x=>x.id===$('paintPalette').value);
 $('paint-swatches').replaceChildren(...(palette?.colors??[]).map(color=>{
   const chip=el('span');chip.style.backgroundColor=color;chip.title=color;return chip;
 }));
}
$('paintPalette').addEventListener('change',showSwatches);
