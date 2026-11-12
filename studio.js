import {frameGeometry,drawFrame} from './asset-layout.mjs';
import {manifest,v2Frame} from './v2.mjs';
import {palette} from './stage-layout.mjs';
import {paintStamp} from './stage-art.mjs';
const $=id=>document.getElementById(id);
const names=['Nét màu','Mưa màu','Pháo giấy','Chữ neon','Rồng sắc màu','Siêu VIP Pro','Sóng cầu vồng','Cánh phượng','Tẩy sơn','Khiên màu','Vương miện','Tia sét','Sao vàng','Cầu vồng','Portal','Tim ma thuật'];
const freeEffects=['Nét tên','Nét tên neon','Bụi màu'];
const values=['particles','volume','safe','minutes','gun','grenade','gunScale','muzzleX','muzzleY','fps','max','fullHold','wipeMs','peak','speed'],flags=['flash','anonymous','top','teams','showGun','sparks','shake','glow','mixSpray','accumulate'];
const tabs={overview:'Tổng quan & Điều khiển LIVE',gifts:'Quà & vật phẩm',props:'Skin & bom sơn',fx:'Hiệu ứng & bố cục',round:'Vòng chơi & TOP',test:'Phòng thử hiệu ứng',gallery:'Thư viện tường',log:'Nhật ký phiên'};
let current,liveState,demoState,source='live',audio=false,settingsLoaded=false,timer;
function el(tag,text){const x=document.createElement(tag);if(text!=null)x.textContent=text;return x;}
function notice(text){clearTimeout(timer);$('feedback').textContent=text;timer=setTimeout(()=>$('feedback').textContent='',5500);}
async function action(action,params={},message='Đã cập nhật'){
 try{const response=await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...params})});const result=await response.json();if(!response.ok)throw Error(result.error);notice(message);return true;}catch(error){notice(error.message);return false;}
}
let gallerySource=null;
function setSource(next){gallerySource=null;source=next;$('preview-label').textContent='Đang tải…';$('frame').src='/overlay.html?preview=1'+(next==='demo'?'&source=demo':'');$('source').textContent=next==='demo'?'Xem LIVE thật':'Xem phòng thử';}
function tab(name){for(const key of Object.keys(tabs))$(key).hidden=key!==name;for(const b of document.querySelectorAll('[data-tab]'))b.classList.toggle('active',b.dataset.tab===name);$('page-title').textContent=tabs[name];if(name==='test'&&(source!=='demo'||gallerySource))setSource('demo');if(name==='gallery')void refreshGallery();}
for(const b of document.querySelectorAll('[data-tab],[data-open]'))b.onclick=()=>tab(b.dataset.tab||b.dataset.open);
$('menu').onclick=()=>document.body.classList.toggle('nav-hidden');
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText(location.origin+'/overlay.html');notice('Đã sao chép link LIVE');}catch{notice(location.origin+'/overlay.html');}};
$('frame').onload=()=>{$('preview-label').textContent=source==='demo'?'Phòng thử · dữ liệu riêng':'Nguồn LIVE · '+(audio?'có tiếng':'im lặng');if(audio)$('frame').contentWindow.postMessage({audio},location.origin);};
$('preview-audio').onclick=()=>{audio=!audio;$('frame').contentWindow.postMessage({audio},location.origin);$('preview-audio').textContent=audio?'Tắt tiếng xem trước':'Bật tiếng xem trước';};
$('refresh').onclick=()=>setSource(source);$('source').onclick=()=>setSource(source==='demo'?'live':'demo');
$('connect-form').onsubmit=e=>{e.preventDefault();action('connect',{username:$('username').value},'Đang yêu cầu kết nối…');};
$('disconnect').onclick=()=>action('disconnect');$('reset').onclick=()=>{if(confirm('Xóa tường, TOP và nhật ký LIVE để bắt đầu phiên mới?'))action('reset');};
$('next-round').onclick=()=>action('round',{source:'live'},'Đã chốt vòng LIVE');
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
 const config={...current,mapping:{...current.mapping},values:{...current.values}};
 for(const key of values)config[key]=Number($(key).value);
 for(const key of flags)config[key]=$(key).checked;
 const rows=Array.from($('tiers').children,row=>Object.fromEntries(Array.from(row.querySelectorAll('input,select'),i=>[i.name,i.type==='number'?Number(i.value):i.value])));
 config.free={...current.free,...rows[0]};
 config.rows=rows.slice(1).map((row,i)=>({...current.rows[i],...row}));
 config.slots=Array.from($('slot-settings').children,g=>({x:Number(g.querySelector('[data-axis=x]').value),y:Number(g.querySelector('[data-axis=y]').value)}));
 return config;
}
async function save(change){if(!current)return;const config=read();change?.(config);if(await action('settings',{config},'Đã lưu thiết lập')){current=config;showConfig(false);}}
for(const b of document.querySelectorAll('[data-save]'))b.onclick=()=>save();
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
 [current.free,...current.rows].forEach((r,i)=>{
   const row=el('div');row.className='tier';row.dataset.level=i;
   const heading=el('div');heading.className='tier-heading';
   const thumb=el('canvas');thumb.width=40;thumb.height=42;thumb.className='tier-thumb';
   thumb.dataset.level=i;thumbObserver.observe(thumb);
   heading.append(thumb);heading.append(el('strong',i===0?'Bình luận':i===6?'Siêu VIP Pro':'Quà · Bậc '+i),el('small',i===0?'Miễn phí':'Từ '+r.min.toLocaleString('vi-VN')+' xu'));
   row.append(heading);
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
   skin.value=r.skin;skinLabel.append(skin);fields.append(skinLabel);row.append(fields);$('tiers').append(row);
 });
 }
 for(const [i,row] of Array.from($('tiers').children).slice(1).entries())row.querySelector('small').textContent='Từ '+current.rows[i].min.toLocaleString('vi-VN')+' xu';
 showTestGifts();
 $('mappings').replaceChildren(...Object.entries(current.mapping).map(([id,item])=>{const row=el('div');const img=el('canvas');img.width=32;img.height=32;paintStamp(img.getContext('2d'),16,15,12,palette[Math.min(6,names.indexOf(item)+1)],71,1);const b=el('button','Bỏ gán');b.onclick=()=>save(c=>delete c.mapping[id]);row.append(img,el('span',id+' · '+item),b);return row;}));
}
let topKey='',logKey='';
function render(){
 if(!liveState)return;const s=liveState;
 $('status').textContent=s.status;$('m-marks').textContent=s.communityCount+' / '+s.config.max;$('m-queue').textContent=s.queue;$('m-round').textContent=s.round;
 $('top-list').replaceChildren(...s.top.map(x=>el('li',x.name+' · '+x.coins.toLocaleString('vi-VN')+' xu')));
 const logs=($('log-source').value==='demo'?demoState:liveState)?.log||[];
 $('log-list').replaceChildren(...logs.slice(0,35).map(x=>el('li',new Date(x.at).toLocaleTimeString('vi-VN')+' · '+x.name+' · '+x.item+' · '+x.coins+' xu'+(x.gift?' · ID '+x.gift:''))));
}
$('log-source').onchange=render;
for(const which of ['live','demo']){const stream=new EventSource('/api/events?source='+which);stream.onmessage=e=>{const s=JSON.parse(e.data);if(which==='live'){liveState=s;if(!settingsLoaded){settingsLoaded=true;current=s.config;showConfig(true);}}else demoState=s;render();};}


addEventListener('message',event=>{if(event.origin===location.origin&&event.source===document.getElementById('frame').contentWindow&&Number.isInteger(event.data?.graffitiFps))document.getElementById('fps').textContent=event.data.graffitiIdle?'Đang chờ':event.data.graffitiFps+' FPS';});













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
   if(await action('settings',{config},'Đã khôi phục cấu hình'))location.reload();
 }catch(e){notice(e.message);}
};


let topEditing=false;
$('edit-top').onclick=()=>{
 topEditing=!topEditing;
 $('edit-top').setAttribute('aria-pressed',String(topEditing));
 $('frame').contentWindow.postMessage({topEditing},location.origin);
 notice(topEditing?'Kéo bảng TOP hoặc kéo góc dưới phải trong preview.':'Đã thoát chỉnh bố cục');
};
$('frame').addEventListener('load',()=>{
 if(topEditing)$('frame').contentWindow.postMessage({topEditing},location.origin);
});
addEventListener('message',event=>{
 if(!topEditing||event.origin!==location.origin||event.source!==$('frame').contentWindow||!event.data?.topLayout)return;
 const layout=event.data.topLayout;
 if([layout.x,layout.y,layout.w].every(Number.isFinite))void save(c=>{c.topX=layout.x;c.topY=layout.y;c.topWidth=layout.w;});
});
$('quality-preset').onchange=()=>{
 const choice=$('quality-preset').value;
 if(!choice)return;
 $('fps').value=choice==='low'?30:60;
 $('particles').value={low:35,medium:65,high:100}[choice];
 $('glow').checked=choice!=='low';$('shake').checked=choice==='high';
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
     gallerySource=selected;
     $('frame').src='/overlay.html?'+new URLSearchParams({preview:1,source:selected,kind,id,replay:replay?'1':'0'});
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
$('gallery-exit').onclick=()=>{setSource(gallerySource??source);gallerySource=null;};
