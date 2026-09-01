const crypto=require('crypto');
const ALPH='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Encode(buf){let bits='',out='';for(const b of buf)bits+=b.toString(2).padStart(8,'0');for(let i=0;i<bits.length;i+=5){const c=bits.slice(i,i+5).padEnd(5,'0');out+=ALPH[parseInt(c,2)]}return out}
function base32Decode(s){s=String(s||'').toUpperCase().replace(/[^A-Z2-7]/g,'');let bits='';for(const c of s)bits+=ALPH.indexOf(c).toString(2).padStart(5,'0');const arr=[];for(let i=0;i+8<=bits.length;i+=8)arr.push(parseInt(bits.slice(i,i+8),2));return Buffer.from(arr)}
function generateSecret(){return base32Encode(crypto.randomBytes(20))}
function hotp(secret,counter){const key=base32Decode(secret);const buf=Buffer.alloc(8);buf.writeBigUInt64BE(BigInt(counter));const h=crypto.createHmac('sha1',key).update(buf).digest();const off=h[h.length-1]&15;const n=(h.readUInt32BE(off)&0x7fffffff)%1000000;return String(n).padStart(6,'0')}
function totp(secret,time=Date.now()){return hotp(secret,Math.floor(time/30000))}
function matchingTotpStep(secret,code,window=1,time=Date.now()){const c=String(code||'').replace(/\D/g,'');if(c.length!==6)return null;const base=Math.floor(time/30000);for(let i=-window;i<=window;i++){const step=base+i,x=hotp(secret,step),a=Buffer.from(x),b=Buffer.from(c);if(a.length===b.length&&crypto.timingSafeEqual(a,b))return step}return null}
function verifyTotp(secret,code,window=1){return matchingTotpStep(secret,code,window)!==null}
function otpauthUri({secret,email,issuer='BarberFlow'}){return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`}
module.exports={generateSecret,verifyTotp,matchingTotpStep,otpauthUri};
