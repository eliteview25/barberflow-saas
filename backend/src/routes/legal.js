const express=require('express');
const {getSupportSettings}=require('../services/platformSettings');
const router=express.Router();

function clean(v,max=240){const s=String(v||'').trim();return s?s.slice(0,max):null}
function phone(v){const s=String(v||'').replace(/\D/g,'');return s.length>=10&&s.length<=15?s:null}

router.get('/config',async(req,res)=>{
  try{
    const support=await getSupportSettings();
    res.json({
      legal_version:'2026-09-01',
      entity_name:clean(process.env.LEGAL_ENTITY_NAME,180),
      cnpj:clean(process.env.LEGAL_CNPJ,30),
      address:clean(process.env.LEGAL_ADDRESS,300),
      privacy_email:clean(process.env.PRIVACY_EMAIL||support.email,180),
      privacy_whatsapp:phone(process.env.PRIVACY_WHATSAPP||support.whatsapp),
      dpo_name:clean(process.env.DPO_NAME,160)
    });
  }catch(e){
    console.error('legal_config_failed',e.message);
    res.json({legal_version:'2026-09-01'});
  }
});

module.exports=router;
