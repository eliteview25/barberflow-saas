const crypto = require('crypto');
const pool = require('../config/db');
const {externalSignal}=require('../utils/http');

const BASE = 'https://api.mercadopago.com';

function encryptionKey() {
  const raw = process.env.MP_TOKEN_ENCRYPTION_KEY || process.env.APP_SECRETS_ENCRYPTION_KEY;
  if (!raw) throw new Error('Chave de criptografia das integrações não configurada');
  return crypto.createHash('sha256').update(raw).digest();
}

function encrypt(value) {
  if (!value) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${enc.toString('base64url')}`;
}

function decrypt(payload) {
  if (!payload) return null;
  const [ivB64, tagB64, encB64] = String(payload).split('.');
  if (!ivB64 || !tagB64 || !encB64) throw new Error('Token Mercado Pago armazenado em formato inválido');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivB64, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encB64, 'base64url')), decipher.final()]).toString('utf8');
}

async function oauthToken(body) {
  const resposta = await fetch(`${BASE}/oauth/token`, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(body),
    signal: externalSignal()
  });
  let data={}; try{data=await resposta.json()}catch{}
  if(!resposta.ok){
    const erro=new Error(data.message||data.error||`OAuth Mercado Pago respondeu ${resposta.status}`);
    erro.status=resposta.status; erro.data=data; throw erro;
  }
  return data;
}

function oauthConfig() {
  const clientId=process.env.MP_CLIENT_ID;
  const clientSecret=process.env.MP_CLIENT_SECRET;
  const appUrl=(process.env.APP_URL||'http://localhost:3001').replace(/\/$/,'');
  const redirectUri=process.env.MP_OAUTH_REDIRECT_URI||`${appUrl}/api/mercadopago/callback`;
  if(!clientId||!clientSecret) throw new Error('MP_CLIENT_ID/MP_CLIENT_SECRET não configurados');
  return {clientId,clientSecret,redirectUri};
}

function codeChallenge(verifier){return crypto.createHash('sha256').update(verifier).digest('base64url')}

async function criarUrlConexao(barbeariaId){
  const {clientId,redirectUri}=oauthConfig();
  const state=crypto.randomBytes(32).toString('base64url');
  const verifier=crypto.randomBytes(48).toString('base64url');
  await pool.query(`DELETE FROM oauth_states WHERE expira_em<NOW() OR (barbearia_id=$1 AND provedor='mercadopago')`,[barbeariaId]);
  await pool.query(`INSERT INTO oauth_states(barbearia_id,state,code_verifier,provedor,expira_em) VALUES($1,$2,$3,'mercadopago',NOW()+INTERVAL '10 minutes')`,[barbeariaId,state,verifier]);
  const url=new URL('https://auth.mercadopago.com/authorization');
  url.searchParams.set('client_id',clientId);
  url.searchParams.set('response_type','code');
  url.searchParams.set('platform_id','mp');
  url.searchParams.set('state',state);
  url.searchParams.set('redirect_uri',redirectUri);
  url.searchParams.set('code_challenge',codeChallenge(verifier));
  url.searchParams.set('code_challenge_method','S256');
  return url.toString();
}

async function concluirConexao({code,state}){
  const st=await pool.query(`DELETE FROM oauth_states WHERE state=$1 AND provedor='mercadopago' AND expira_em>NOW() RETURNING *`,[state]);
  if(!st.rowCount) throw new Error('Solicitação OAuth inválida ou expirada');
  const {clientId,clientSecret,redirectUri}=oauthConfig();
  const token=await oauthToken({client_id:clientId,client_secret:clientSecret,code,grant_type:'authorization_code',redirect_uri:redirectUri,code_verifier:st.rows[0].code_verifier});
  const expiresAt=token.expires_in?new Date(Date.now()+Number(token.expires_in)*1000):null;
  await pool.query(`INSERT INTO integracoes_pagamento(barbearia_id,provedor,mp_user_id,access_token_enc,refresh_token_enc,public_key,scope,expires_at,status,conectado_em,atualizado_em)
    VALUES($1,'mercadopago',$2,$3,$4,$5,$6,$7,'conectado',NOW(),NOW())
    ON CONFLICT (barbearia_id,provedor) DO UPDATE SET mp_user_id=EXCLUDED.mp_user_id,access_token_enc=EXCLUDED.access_token_enc,refresh_token_enc=EXCLUDED.refresh_token_enc,public_key=EXCLUDED.public_key,scope=EXCLUDED.scope,expires_at=EXCLUDED.expires_at,status='conectado',conectado_em=NOW(),atualizado_em=NOW()`,[
      st.rows[0].barbearia_id,String(token.user_id||''),encrypt(token.access_token),encrypt(token.refresh_token),token.public_key||null,token.scope||null,expiresAt
    ]);
  return st.rows[0].barbearia_id;
}

async function refreshIntegration(barbeariaId){
  const db=await pool.connect();
  try{
    await db.query('BEGIN');
    const q=await db.query(`SELECT * FROM integracoes_pagamento WHERE barbearia_id=$1 AND provedor='mercadopago' AND status='conectado' FOR UPDATE`,[barbeariaId]);
    if(!q.rowCount){await db.query('ROLLBACK');throw new Error('Mercado Pago não conectado para esta barbearia')}
    const row=q.rows[0],expires=row.expires_at?new Date(row.expires_at).getTime():0;
    if(!expires||expires-Date.now()>=7*24*60*60*1000){const token=decrypt(row.access_token_enc);await db.query('COMMIT');return token}
    const {clientId,clientSecret}=oauthConfig();const refreshToken=decrypt(row.refresh_token_enc);if(!refreshToken)throw new Error('Refresh token do Mercado Pago indisponível');
    const token=await oauthToken({client_id:clientId,client_secret:clientSecret,grant_type:'refresh_token',refresh_token:refreshToken});
    const expiresAt=token.expires_in?new Date(Date.now()+Number(token.expires_in)*1000):null;
    await db.query(`UPDATE integracoes_pagamento SET access_token_enc=$1,refresh_token_enc=$2,public_key=COALESCE($3,public_key),scope=COALESCE($4,scope),expires_at=$5,status='conectado',atualizado_em=NOW() WHERE id=$6`,[encrypt(token.access_token),encrypt(token.refresh_token||refreshToken),token.public_key||null,token.scope||null,expiresAt,row.id]);
    await db.query('COMMIT');return token.access_token;
  }catch(e){try{await db.query('ROLLBACK')}catch{}throw e}finally{db.release()}
}

async function getSellerAccessToken(barbeariaId){
  const r=await pool.query(`SELECT * FROM integracoes_pagamento WHERE barbearia_id=$1 AND provedor='mercadopago' AND status='conectado'`,[barbeariaId]);
  if(!r.rowCount) throw new Error('Mercado Pago não conectado para esta barbearia');
  const row=r.rows[0];
  const expires=row.expires_at?new Date(row.expires_at).getTime():0;
  if(expires && expires-Date.now()<7*24*60*60*1000) return refreshIntegration(barbeariaId);
  return decrypt(row.access_token_enc);
}

async function statusConexao(barbeariaId){
  const r=await pool.query(`SELECT mp_user_id,public_key,scope,expires_at,status,conectado_em,atualizado_em FROM integracoes_pagamento WHERE barbearia_id=$1 AND provedor='mercadopago'`,[barbeariaId]);
  if(!r.rowCount)return {conectado:false};
  return {conectado:r.rows[0].status==='conectado',...r.rows[0]};
}

async function desconectar(barbeariaId){
  await pool.query(`UPDATE integracoes_pagamento SET status='desconectado',access_token_enc=NULL,refresh_token_enc=NULL,atualizado_em=NOW() WHERE barbearia_id=$1 AND provedor='mercadopago'`,[barbeariaId]);
}

module.exports={criarUrlConexao,concluirConexao,getSellerAccessToken,statusConexao,desconectar};
