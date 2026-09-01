(()=>{
  const q=s=>document.querySelectorAll(s);
  const text=(sel,value)=>q(sel).forEach(el=>{if(value){el.textContent=value;el.closest('[data-legal-row]')?.classList.remove('hidden')}else el.closest('[data-legal-row]')?.classList.add('hidden')});
  const mail=(sel,value)=>q(sel).forEach(el=>{if(value){el.textContent=value;el.href=`mailto:${value}`;el.closest('[data-legal-row]')?.classList.remove('hidden')}else el.closest('[data-legal-row]')?.classList.add('hidden')});
  const wa=(sel,value)=>q(sel).forEach(el=>{if(value){el.textContent=value;el.href=`https://wa.me/${String(value).replace(/\D/g,'')}`;el.closest('[data-legal-row]')?.classList.remove('hidden')}else el.closest('[data-legal-row]')?.classList.add('hidden')});
  fetch('/api/legal/config',{headers:{Accept:'application/json'}}).then(r=>r.ok?r.json():{}).then(d=>{
    text('[data-legal-entity]',d.entity_name);text('[data-legal-cnpj]',d.cnpj);text('[data-legal-address]',d.address);text('[data-legal-dpo]',d.dpo_name);mail('[data-legal-email]',d.privacy_email);wa('[data-legal-whatsapp]',d.privacy_whatsapp);
    if(!d.privacy_email&&!d.privacy_whatsapp)q('[data-legal-contact-fallback]').forEach(el=>el.classList.remove('hidden'));
  }).catch(()=>q('[data-legal-contact-fallback]').forEach(el=>el.classList.remove('hidden')));
})();
