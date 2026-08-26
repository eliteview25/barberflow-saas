const crypto=require('crypto');

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
function strongPassword(v){const s=String(v||'');return s.length>=12&&/[A-Z]/.test(s)&&/[a-z]/.test(s)&&/\d/.test(s)&&/[^A-Za-z0-9]/.test(s)}
async function verifyTurnstile(token,ip,{action=null}={}){
  const secret=process.env.TURNSTILE_SECRET_KEY;
  if(!secret){if(process.env.NODE_ENV==='production'&&process.env.REQUIRE_TURNSTILE!=='false')return false;return true;}
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

module.exports={parseCookies,randomToken,sha256,otpHash,timingSafeText,sessionCookie,csrfCookie,clearSession,validateCsrf,isMutating,normalizePhone,validEmail,strongPassword,verifyTurnstile};
