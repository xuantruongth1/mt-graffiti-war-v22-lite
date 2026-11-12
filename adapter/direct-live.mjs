import {EventEmitter} from 'node:events';

export function liveUsername(value){
 let name=String(value??'').trim();
 if(/^https?:\/\//i.test(name)){
  let url;try{url=new URL(name);}catch{throw Error('Đường dẫn TikTok không hợp lệ.');}
  if(!/^(www\.)?tiktok\.com$/i.test(url.hostname))throw Error('Nhập @username hoặc link LIVE TikTok.');
  name=url.pathname.match(/^\/@([^/]+)(?:\/live)?\/?$/)?.[1]||'';
 }
 name=name.replace(/^@/,'');
 if(!/^[a-zA-Z0-9_.]{2,40}$/.test(name))throw Error('Nhập @username TikTok hợp lệ, ví dụ: @ten_cua_ban.');
 return name;
}

// Keep raw gift unit value, count, streak state and message ID. Each tool's
// existing event processor remains responsible for its own business rules.
export function livePayload(data={}){
 const u=data.user||data,g=data.giftDetails||data.gift||{};
 return {...data,user:{...u,userId:String(u.userId||u.idStr||u.id||u.uniqueId||'')},
  userId:String(u.userId||u.idStr||u.id||u.uniqueId||''),nickname:u.nickname||u.uniqueId,
  profilePictureUrl:u.profilePictureUrl||u.profilePicture?.urls?.[0]||u.avatarThumb?.urlList?.[0]||'',
  msgId:String(data.msgId||data.common?.msgId||''),comment:data.comment??data.content??'',
  giftId:String(data.giftId||g.id||''),giftName:data.giftName||g.name||g.giftName,
  giftType:g.giftType??g.type??data.giftType,
  diamondCount:g.diamondCount??data.extendedGiftInfo?.diamond_count??data.diamondCount,
  repeatCount:data.repeatCount??1,
  repeatEnd:data.repeatEnd==null?data.repeatEnd:[true,1,'1','true'].includes(data.repeatEnd)};
}

export function connectionProblem(error){
 if(error?.code==='ERR_MODULE_NOT_FOUND')return {retry:false,message:'Gói chạy thiếu thư viện TikTok. Mở bản portable đã build đầy đủ.'};
 const text=String(error?.message||error?.info||error||'Không kết nối được TikTok LIVE');
 if(/offline|not.?live|UserOffline/i.test(text))return {retry:true,message:'Tài khoản chưa LIVE. Đang chờ phòng phát sóng…'};
 if(/rate.?limit|too many|429/i.test(text))return {retry:true,message:'TikTok hoặc dịch vụ kết nối đang giới hạn lượt. Sẽ thử lại sau.'};
 if(/business plan|requires.*plan|purchase.*plan|PremiumFeature/i.test(text))return {retry:false,message:'Dịch vụ kết nối từ chối thao tác vì yêu cầu gói Business. Đây là giới hạn của dịch vụ, không phải lỗi ID TikTok. Liên hệ chủ tool để kiểm tra bộ kết nối.'};
 if(/captcha|challenge|verify you are human/i.test(text))return {retry:false,message:'TikTok yêu cầu xác minh hoặc đang chặn yêu cầu kết nối. Kiểm tra phòng LIVE trên trình duyệt rồi thử lại.'};
 if(/premium|business plan|requires.*plan|purchase.*plan|api.?key|unauthori[sz]ed|forbidden|captcha|signature|sign.?api|403|401/i.test(text))return {retry:false,message:'TikTok hoặc dịch vụ ký kết nối từ chối yêu cầu. Kiểm tra tài khoản LIVE và cấu hình EULER_API_KEY của tool; sau đó bấm Kết nối lại.'};
 return {retry:true,message:'Mất kết nối TikTok LIVE. Đang thử kết nối lại…'};
}

export class DirectLive extends EventEmitter{
 constructor(username,{factory,retryMs=5000}={}){super();this.username=liveUsername(username);this.factory=factory;this.retryMs=retryMs;this.generation=0;this.attempts=0;this.seen=new Set();this.closed=false;}
 status(state,message,extra={}){this.emit('status',{state,message,username:this.username,roomId:this.roomId||'',mode:'direct',...extra});}
 async connect(){this.closed=false;return this.open(++this.generation);}
 async release(){const old=this.client;this.client=null;if(old){old.removeAllListeners();try{await old.disconnect();}catch{}}}
 async open(token){
  if(this.closed||token!==this.generation)return;
  await this.release();if(this.closed||token!==this.generation)return;
  this.lastProblem=null;this.status('connecting','Đang kết nối LIVE @'+this.username+'…');
  try{
   let factory=this.factory;
   // Match Trà Đá: read gift metadata from each live event. The optional
   // room gift catalog can require a paid endpoint and must not gate LIVE.
   if(!factory){const {TikTokLiveConnection}=await import('tiktok-live-connector');factory=(name)=>new TikTokLiveConnection(name,{processInitialData:false,fetchRoomInfoOnConnect:false,enableExtendedGiftInfo:false,...(process.env.EULER_API_KEY?{signApiKey:process.env.EULER_API_KEY}:{})});}
   if(this.closed||token!==this.generation)return;
   const c=factory(this.username);this.client=c;
   const active=()=>!this.closed&&token===this.generation&&this.client===c;
   for(const event of ['member','chat','gift','like','follow','share','leave','userLeave','memberLeave'])c.on(event,data=>{
    if(!active())return;const d=livePayload(data),id=d.msgId;
    const key=event+'|'+id+(event==='gift'?'|'+d.repeatCount+'|'+d.repeatEnd:'');
    if(id&&id!=='0'){if(this.seen.has(key))return;this.seen.add(key);if(this.seen.size>10000)this.seen.delete(this.seen.values().next().value);}
    this.attempts=0;this.status('connected','Đã kết nối TikTok thành công · @'+this.username+' · Đang nhận tương tác LIVE');
    this.emit('event',{event,data:d});
   });
   c.on('error',e=>{if(active())this.lastProblem=connectionProblem(e?.exception||e);});
   c.on('disconnected',()=>{if(active())this.retry(token,this.lastProblem);});
   c.on('streamEnd',()=>{if(active()){this.closed=true;clearTimeout(this.timer);void this.release();this.status('offline','Phiên LIVE đã kết thúc.');}});
   const state=await c.connect();if(!active()){try{await c.disconnect();}catch{}return;}
   clearTimeout(this.timer);this.timer=null;this.lastProblem=null;this.roomId=String(state?.roomId||c.roomId||'');this.attempts=0;
   this.status('waiting','Đã kết nối TikTok thành công · @'+this.username+' · Chờ tương tác LIVE');
  }catch(error){if(!this.closed&&token===this.generation)this.retry(token,this.lastProblem||connectionProblem(error?.exception||error));}
 }
 retry(token,problem={retry:true,message:'Mất kết nối TikTok LIVE.'}){
  if(this.closed||token!==this.generation||this.timer)return;
  problem=problem||{retry:true,message:'Mất kết nối TikTok LIVE.'};
  if(!problem.retry){this.status('error',problem.message);void this.release();return;}
  const delay=Math.min(60000,this.retryMs*2**Math.min(this.attempts++,4));
  this.status('retry',problem.message+' Thử lại sau '+Math.ceil(delay/1000)+' giây.');
  this.timer=setTimeout(()=>{this.timer=null;void this.open(token);},delay);this.timer.unref?.();
 }
 async disconnect(){this.closed=true;++this.generation;clearTimeout(this.timer);this.timer=null;await this.release();}
}
