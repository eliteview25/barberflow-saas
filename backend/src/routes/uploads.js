const express = require('express');
const crypto = require('crypto');
const { autenticar, exigirPapel } = require('../middlewares/auth');
const { exigirRecurso } = require('../services/planos');
const { externalSignal } = require('../utils/http');

const router = express.Router();

function inspectImage(buf) {
  if (buf.length >= 24 && buf.slice(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { format: 'png', mime: 'image/png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
        return { format: 'jpg', mime: 'image/jpeg', height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
      if (len < 2) break;
      i += 2 + len;
    }
  }
  return null;
}

async function uploadImage(req,res,{folderSuffix='',transformation='c_limit,w_2400,h_1600/f_webp,q_88/fl_strip_profile'}={}){
  try {
    if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ erro: 'Selecione uma imagem JPG ou PNG de até 5MB' });
    const meta = inspectImage(req.body);
    if (!meta) return res.status(400).json({ erro: 'Arquivo não é JPG/PNG válido' });
    const declaredType=String(req.headers['content-type']||'').split(';')[0].trim().toLowerCase();
    if (declaredType !== meta.mime) return res.status(400).json({ erro: 'Tipo declarado não corresponde ao conteúdo do arquivo' });
    if (!meta.width || !meta.height || meta.width > 6000 || meta.height > 6000 || meta.width * meta.height > 20_000_000) return res.status(400).json({ erro: 'Dimensões da imagem excedem o limite' });

    const cloud = process.env.CLOUDINARY_CLOUD_NAME;
    const key = process.env.CLOUDINARY_API_KEY;
    const secret = process.env.CLOUDINARY_API_SECRET;
    if (!cloud || !key || !secret) return res.status(503).json({ erro: 'Upload ainda não configurado' });

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `barberflow/${req.usuario.barbearia_id}${folderSuffix?`/${folderSuffix}`:''}`;
    const signBase = `folder=${folder}&timestamp=${timestamp}&transformation=${transformation}${secret}`;
    const signature = crypto.createHash('sha1').update(signBase).digest('hex');
    const fd = new FormData();
    fd.append('file', new Blob([req.body], { type: meta.mime }), `imagem.${meta.format}`);
    fd.append('api_key', key);
    fd.append('timestamp', String(timestamp));
    fd.append('folder', folder);
    fd.append('transformation', transformation);
    fd.append('signature', signature);

    const r = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, { method: 'POST', body: fd, signal: externalSignal() });
    let d={}; try{d=await r.json()}catch{}
    if (!r.ok) throw new Error(d?.error?.message || 'Falha no upload');
    return res.status(201).json({ url: d.secure_url, public_id: d.public_id, width: d.width, height: d.height });
  } catch (e) {
    console.error('upload_image_failed',{request_id:req.requestId,message:e.message});
    return res.status(500).json({ erro: 'Erro ao enviar imagem', request_id:req.requestId });
  }
}

const rawImage=express.raw({ type: ['image/png', 'image/jpeg'], limit: '5mb' });
router.post('/imagem',autenticar,exigirPapel('dono','gerente'),exigirRecurso('personalizacao_publica'),rawImage,(req,res)=>uploadImage(req,res));
router.post('/produto-imagem',autenticar,exigirPapel('dono','gerente'),exigirRecurso('pdv_estoque'),rawImage,(req,res)=>uploadImage(req,res,{folderSuffix:'produtos',transformation:'c_fill,w_1000,h_1000,g_auto/f_webp,q_86/fl_strip_profile'}));

module.exports = router;
