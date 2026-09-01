const crypto=require('crypto');

const JWT_ISSUER='barberflow';
const JWT_AUDIENCE='barberflow-web';

function parseCookies(req){
  const out={};
  for(const part of String(req.headers.cookie||'').split(';')){
    const i=part.indexOf('='); if(i<0)continue;
    const k=decodeURIComponent(part.slice(0,i).trim()); const v=decodeURIComponent(part.slice(i+1).trim());
    if(k)out[k]=v;
  }
  return out;
}
function randomToken(bytes=32){return crypto.randomBytes(bytes).toString('base64url')}
function sha256(v){return crypto.createHash('sha256').update(String(v||'')).digest('hex')}

function otpPepperKey(){
  const root=String(process.env.BOOKING_OTP_PEPPER||process.env.APP_SECRETS_ENCRYPTION_KEY||process.env.JWT_SECRET||'');
  if(!root&&process.env.NODE_ENV==='production')throw new Error('Segredo de OTP não configurado');
  return crypto.createHmac('sha256',root||'barberflow-dev-only').update('barberflow:booking-otp:v2').digest();
}
function otpHash(code){return crypto.createHmac('sha256',otpPepperKey()).update(String(code||'')).digest('hex')}

function timingSafeText(a,b){
  const aa=Buffer.from(String(a||''));const bb=Buffer.from(String(b||''));
  return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb);
}
function sessionCookie(res,token){
  res.cookie('bf_session',token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:12*60*60*1000});
}
function csrfCookie(res,token){
  res.cookie('bf_csrf',token,{httpOnly:false,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:12*60*60*1000});
}
function clearSession(res){
  const opts={secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/'};
  res.clearCookie('bf_session',{...opts,httpOnly:true});res.clearCookie('bf_csrf',{...opts,httpOnly:false});res.clearCookie('bf_stepup',{...opts,httpOnly:true});
}
function isMutating(method){return !['GET','HEAD','OPTIONS'].includes(String(method||'GET').toUpperCase())}
function validateCsrf(req){
  if(!isMutating(req.method))return true;
  const cookies=parseCookies(req); if(!cookies.bf_session)return true; // bearer/API clients use authorization instead
  return !!cookies.bf_csrf && timingSafeText(cookies.bf_csrf,req.headers['x-csrf-token']);
}
function normalizePhone(v){return String(v||'').replace(/\D/g,'').slice(-15)}
function validEmail(v){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||'').trim())}
function strongPassword(v){const s=String(v||''),bytes=Buffer.byteLength(s,'utf8');return s.length>=12&&bytes<=72&&/[A-Z]/.test(s)&&/[a-z]/.test(s)&&/\d/.test(s)&&/[^A-Za-z0-9]/.test(s)}
function publicError(error,fallback='Não foi possível concluir a operação',{allowClient=false}={}){
  const status=Number(error?.status),message=String(error?.message||'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,220);
  if(allowClient&&status>=400&&status<500&&message&&!/(authorization|bearer|token\s+[a-z0-9._-]{12,}|secret|senha_hash|stack|select\s|insert\s|update\s|delete\s|postgres|relation\s|column\s)/i.test(message))return message;
  return fallback;
}
function signAppToken(payload,options={}){const jwt=require('jsonwebtoken');return jwt.sign({...payload,jti:crypto.randomUUID()},process.env.JWT_SECRET,{algorithm:'HS256',issuer:JWT_ISSUER,audience:JWT_AUDIENCE,...options})}
function verifyAppToken(token){const jwt=require('jsonwebtoken');return jwt.verify(token,process.env.JWT_SECRET,{algorithms:['HS256'],issuer:JWT_ISSUER,audience:JWT_AUDIENCE})}
function verifyTimestampedHmac({secret,timestamp,signature,rawBody,maxAgeSeconds=300}){
  if(!secret||!/^\d{10,13}$/.test(String(timestamp||''))||!/^sha256=[a-fA-F0-9]{64}$/.test(String(signature||'')))return false;
  let ts=Number(timestamp);if(ts>1e12)ts=Math.floor(ts/1000);
  if(!Number.isFinite(ts)||Math.abs(Math.floor(Date.now()/1000)-ts)>Math.max(30,Math.min(3600,Number(maxAgeSeconds)||300)))return false;
  const body=Buffer.isBuffer(rawBody)?rawBody:Buffer.from(String(rawBody||''));
  const expected=crypto.createHmac('sha256',secret).update(String(timestamp)).update('.').update(body).digest();
  const received=Buffer.from(String(signature).slice(7),'hex');
  return received.length===expected.length&&crypto.timingSafeEqual(received,expected);
}
async function verifyTurnstile(token,ip,{action=null}={}){
  const secret=process.env.TURNSTILE_SECRET_KEY;
  if(!secret){if(process.env.NODE_ENV==='production')return false;return true;}
  if(!token||String(token).length>2048)return false;
  const body=new URLSearchParams({secret,response:String(token)});if(ip)body.set('remoteip',String(ip));
  try{
    const r=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body,signal:AbortSignal.timeout(8000)});
    if(!r.ok)return false;const d=await r.json();if(d.success!==true)return false;
    if(action&&d.action!==action)return false;
    if(process.env.NODE_ENV==='production'&&process.env.APP_URL&&d.hostname){try{if(new URL(process.env.APP_URL).hostname!==d.hostname)return false}catch{return false}}
    return true;
  }catch{return false;}
}

module.exports={parseCookies,randomToken,sha256,otpHash,timingSafeText,sessionCookie,csrfCookie,clearSession,validateCsrf,isMutating,normalizePhone,validEmail,strongPassword,publicError,verifyTurnstile,signAppToken,verifyAppToken,verifyTimestampedHmac,JWT_ISSUER,JWT_AUDIENCE};
