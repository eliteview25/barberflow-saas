const crypto=require('crypto');
function key(){const raw=process.env.APP_SECRETS_ENCRYPTION_KEY||process.env.MP_TOKEN_ENCRYPTION_KEY;if(!raw)throw new Error('APP_SECRETS_ENCRYPTION_KEY não configurado');return crypto.createHash('sha256').update(raw).digest();}
function encrypt(v){if(!v)return null;const iv=crypto.randomBytes(12);const c=crypto.createCipheriv('aes-256-gcm',key(),iv);const enc=Buffer.concat([c.update(String(v),'utf8'),c.final()]);return [iv.toString('base64url'),c.getAuthTag().toString('base64url'),enc.toString('base64url')].join('.');}
function decrypt(v){if(!v)return null;const [i,t,e]=String(v).split('.');const d=crypto.createDecipheriv('aes-256-gcm',key(),Buffer.from(i,'base64url'));d.setAuthTag(Buffer.from(t,'base64url'));return Buffer.concat([d.update(Buffer.from(e,'base64url')),d.final()]).toString('utf8');}
module.exports={encrypt,decrypt};
