function intId(value){
  const n=Number(value);
  return Number.isSafeInteger(n)&&n>0?n:null;
}
function isoDate(value){
  const s=String(value||'').trim();
  const m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return null;
  const d=new Date(`${s}T12:00:00Z`);
  return Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==s?null:s;
}
function hhmm(value){
  const s=String(value||'').trim();const m=s.match(/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/);if(!m)return null;
  return `${m[1]}:${m[2]}:00`;
}
function dateWithinBookingWindow(value,{allowToday=true,maxDays=Number(process.env.MAX_BOOKING_DAYS||120)}={}){
  const s=isoDate(value);if(!s)return false;
  const today=new Date();today.setHours(0,0,0,0);const d=new Date(`${s}T00:00:00`);const diff=Math.floor((d-today)/86400000);
  return diff>=(allowToday?0:1)&&diff<=Math.max(1,Math.min(Number(maxDays)||120,365));
}
function cleanText(value,max=160,{required=false}={}){
  const s=String(value??'').trim().replace(/[\u0000-\u001F\u007F]/g,' ');
  if(required&&!s)return null;return s.slice(0,max);
}
function emailOrNull(value,validEmail){const s=String(value||'').trim().toLowerCase();if(!s)return null;return validEmail(s)?s:null;}
function finiteMoney(value,{min=0,max=1000000}={}){const n=Number(value);return Number.isFinite(n)&&n>=min&&n<=max?Math.round(n*100)/100:null;}
function finiteQty(value,{integer=false,max=10000}={}){const n=Number(value);if(!Number.isFinite(n)||n<=0||n>max)return null;if(integer&&!Number.isInteger(n))return null;return n;}
function finitePercent(value,{min=0,max=100}={}){const n=Number(value);return Number.isFinite(n)&&n>=min&&n<=max?Math.round(n*100)/100:null;}
function safeColor(value,fallback=null){const s=String(value||'').trim();return /^#[0-9a-fA-F]{6}$/.test(s)?s:fallback;}
function safeHttpUrl(value,{allowEmpty=true}={}){
  const s=String(value||'').trim();if(!s)return allowEmpty?null:false;
  try{const u=new URL(s);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)return false;if(process.env.NODE_ENV==='production'&&u.protocol!=='https:')return false;return u.href}catch{return false}
}
function safeCsvCell(value){
  let s=String(value??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,' ');
  // Evita CSV/Formula Injection ao abrir no Excel/LibreOffice.
  if(/^[\s]*[=+\-@]/.test(s))s=`'${s}`;
  return s;
}
function csvQuote(value){return `"${safeCsvCell(value).replace(/"/g,'""')}"`;}
module.exports={intId,isoDate,hhmm,dateWithinBookingWindow,cleanText,emailOrNull,finiteMoney,finiteQty,finitePercent,safeColor,safeHttpUrl,safeCsvCell,csvQuote};
