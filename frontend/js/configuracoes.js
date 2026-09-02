if(requireAuth(['dono','gerente'])){
  document.querySelectorAll('input[type="password"]').forEach(x=>x.maxLength=72);
  document.getElementById('shell').innerHTML=renderShell('config');
  const ids=['nome','telefone','email','endereco','cidade','estado','logo_url','banner_url','cor_primaria','cor_secundaria','cor_botao','cor_fundo','tema','descricao_publica','texto_boas_vindas','instagram','whatsapp_publico','mostrar_whatsapp_publico','mostrar_mapa_publico','mostrar_precos','mostrar_duracao','politica_cancelamento'];
  const el=Object.fromEntries(ids.map(id=>[id,document.getElementById(id)]));
  const user=currentUser();
  const perfilEls={foto:document.getElementById('perfilFotoPreview'),nome:document.getElementById('perfilNomeUsuario'),telefone:document.getElementById('perfilTelefoneUsuario'),url:document.getElementById('perfilFotoUrl'),file:document.getElementById('perfilFotoFile'),upload:document.getElementById('perfilEnviarFoto'),remove:document.getElementById('perfilRemoverFoto'),save:document.getElementById('salvarPerfilUsuario')};
  function perfilInitials(nome){return String(nome||'EF').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'EF'}
  function renderPerfilFoto(){if(!perfilEls.foto)return;const url=previewHttpUrl(perfilEls.url?.value);perfilEls.foto.innerHTML=url?`<img src="${esc(url)}" alt="Foto do perfil">`:`<span>${esc(perfilInitials(perfilEls.nome?.value||user.nome))}</span>`;perfilEls.remove?.classList.toggle('hidden',!url)}
  async function loadPerfilUsuario(){if(!perfilEls.nome)return;try{const p=await api('/perfil');perfilEls.nome.value=p.nome||'';perfilEls.telefone.value=p.telefone||'';perfilEls.url.value=p.foto_url||'';const session={...currentUser(),nome:p.nome,telefone:p.telefone||null,foto_url:p.foto_url||null};localStorage.setItem('bf_user',JSON.stringify(session));renderPerfilFoto()}catch(e){console.error('perfil',e)}}
  async function uploadPerfilFoto(file){if(!file)return;if(!['image/png','image/jpeg'].includes(file.type))throw new Error('Use uma foto JPG ou PNG');if(file.size>5*1024*1024)throw new Error('A foto deve ter no máximo 5MB');const r=await fetch('/api/uploads/perfil-imagem',{method:'POST',credentials:'same-origin',headers:{'Content-Type':file.type,'X-CSRF-Token':csrfToken()},body:file});let d={};try{d=await r.json()}catch{}if(!r.ok)throw new Error(d.erro||'Erro ao enviar foto');perfilEls.url.value=d.url;renderPerfilFoto();return d.url}
  if(perfilEls.nome){perfilEls.nome.addEventListener('input',renderPerfilFoto);perfilEls.upload.onclick=()=>perfilEls.file.click();perfilEls.file.onchange=async()=>{try{perfilEls.upload.disabled=true;perfilEls.upload.textContent='Enviando...';await uploadPerfilFoto(perfilEls.file.files[0]);flash(msg,'Foto enviada. Salve seu perfil.')}catch(e){flash(msg,e.message,'error')}finally{perfilEls.file.value='';perfilEls.upload.disabled=false;perfilEls.upload.textContent='Alterar foto'}};perfilEls.remove.onclick=()=>{perfilEls.url.value='';renderPerfilFoto()};perfilEls.save.onclick=async()=>{try{perfilEls.save.disabled=true;const p=await api('/perfil',{method:'PATCH',body:JSON.stringify({nome:perfilEls.nome.value,telefone:perfilEls.telefone.value,foto_url:perfilEls.url.value})});localStorage.setItem('bf_user',JSON.stringify({...currentUser(),nome:p.nome,telefone:p.telefone||null,foto_url:p.foto_url||null}));renderPerfilFoto();flash(msg,'Seu perfil foi atualizado. A foto já aparece no EliteFlow.');setTimeout(()=>location.reload(),500)}catch(e){flash(msg,e.message,'error')}finally{perfilEls.save.disabled=false}}}
  const configSection=new URLSearchParams(location.search).get('secao')||'perfil';
  const sectionMeta={
    perfil:['Perfil','Dados da barbearia','Identidade e dados principais da sua barbearia.'],
    seguranca:['Segurança','Segurança da conta','Senha e autenticação em dois fatores.'],
    'pagina-publica':['Página pública','Página pública','Personalize a experiência de agendamento dos seus clientes.']
  };
  const sectionKey=sectionMeta[configSection]?configSection:'perfil';
  document.querySelectorAll('[data-config-section]').forEach(x=>x.classList.toggle('hidden',x.dataset.configSection!==sectionKey));
  const sm=sectionMeta[sectionKey];document.getElementById('configPageTitle').textContent=sm[1];document.getElementById('configPageSubtitle').textContent=sm[2];
  const saveMain=document.getElementById('salvar');if(saveMain)saveMain.classList.toggle('hidden',sectionKey==='seguranca');
  const securityEls={
    status:document.getElementById('mfaStatus'),
    senhaAtual:document.getElementById('senhaAtual'),
    novaSenha:document.getElementById('novaSenha'),
    confirmarNovaSenha:document.getElementById('confirmarNovaSenha'),
    mfaSenhaField:document.getElementById('mfaSenhaField'),
    mfaSenhaCode:document.getElementById('mfaSenhaCode'),
    alterarSenha:document.getElementById('alterarSenha'),
    off:document.getElementById('mfaOffBox'),
    setup:document.getElementById('mfaSetupBox'),
    on:document.getElementById('mfaOnBox'),
    setupPassword:document.getElementById('mfaSetupPassword'),
    iniciar:document.getElementById('iniciarMfa'),
    secret:document.getElementById('mfaSecret'),
    copiar:document.getElementById('copiarMfaSecret'),
    abrir:document.getElementById('abrirAuthenticator'),
    confirmCode:document.getElementById('mfaConfirmCode'),
    confirmar:document.getElementById('confirmarMfa'),
    cancelar:document.getElementById('cancelarMfaSetup'),
    disablePassword:document.getElementById('mfaDisablePassword'),
    disableCode:document.getElementById('mfaDisableCode'),
    desativar:document.getElementById('desativarMfa')
  };
  const tenantDeleteEls={
    zone:document.getElementById('tenantDangerZone'),open:document.getElementById('openTenantDelete'),modal:document.getElementById('tenantDeleteModal'),close:document.getElementById('closeTenantDelete'),cancel:document.getElementById('cancelTenantDelete'),aware:document.getElementById('tenantDeleteAware'),confirmText:document.getElementById('tenantDeleteConfirm'),confirm:document.getElementById('confirmTenantDelete'),error:document.getElementById('tenantDeleteError')
  };
  function tenantDeleteReady(){return tenantDeleteEls.aware?.checked===true&&tenantDeleteEls.confirmText?.value==='EXCLUIR'}
  function updateTenantDeleteButton(){if(tenantDeleteEls.confirm)tenantDeleteEls.confirm.disabled=!tenantDeleteReady()}
  function closeTenantDelete(){tenantDeleteEls.modal?.classList.add('hidden');document.body.classList.remove('modal-open');if(tenantDeleteEls.aware)tenantDeleteEls.aware.checked=false;if(tenantDeleteEls.confirmText)tenantDeleteEls.confirmText.value='';tenantDeleteEls.error?.classList.add('hidden');updateTenantDeleteButton()}
  function openTenantDelete(){if(user.papel!=='dono')return;tenantDeleteEls.modal?.classList.remove('hidden');document.body.classList.add('modal-open');tenantDeleteEls.error?.classList.add('hidden');setTimeout(()=>tenantDeleteEls.aware?.focus(),40)}
  if(user.papel==='dono')tenantDeleteEls.zone?.classList.remove('hidden');
  tenantDeleteEls.open?.addEventListener('click',openTenantDelete);
  tenantDeleteEls.close?.addEventListener('click',closeTenantDelete);
  tenantDeleteEls.cancel?.addEventListener('click',closeTenantDelete);
  tenantDeleteEls.modal?.addEventListener('click',e=>{if(e.target===tenantDeleteEls.modal)closeTenantDelete()});
  tenantDeleteEls.aware?.addEventListener('change',updateTenantDeleteButton);
  tenantDeleteEls.confirmText?.addEventListener('input',()=>{tenantDeleteEls.confirmText.value=tenantDeleteEls.confirmText.value.toUpperCase().replace(/[^A-Z]/g,'').slice(0,7);updateTenantDeleteButton()});
  tenantDeleteEls.confirm?.addEventListener('click',async()=>{
    if(!tenantDeleteReady())return;
    tenantDeleteEls.error?.classList.add('hidden');tenantDeleteEls.confirm.disabled=true;tenantDeleteEls.confirm.textContent='Interrompendo cobrança...';
    try{
      const result=await api('/conta/barbearia',{method:'DELETE',body:JSON.stringify({confirmacao:'EXCLUIR',ciente:true})});
      localStorage.removeItem('bf_user');localStorage.removeItem('bf_barbearia');localStorage.removeItem('bf_assinatura');sessionStorage.clear();
      location.replace(`/conta-excluida.html?emails=${Number(result.emails_recuperacao_enviados||0)}&total=${Number(result.emails_recuperacao_total||0)}`);
    }catch(e){tenantDeleteEls.error.textContent=e.message;tenantDeleteEls.error.classList.remove('hidden');tenantDeleteEls.confirm.disabled=false;tenantDeleteEls.confirm.textContent='Excluir e encerrar acessos'}
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!tenantDeleteEls.modal?.classList.contains('hidden'))closeTenantDelete()});
  let mfaEnabled=false,mfaPendingPassword='',mfaRawSecret='';
  function digits6(v){return String(v||'').replace(/\D/g,'').slice(0,6)}
  function formatSecret(v){return String(v||'').replace(/\s/g,'').match(/.{1,4}/g)?.join(' ')||''}
  function renderMfaState(enabled){
    mfaEnabled=!!enabled;
    securityEls.status.textContent=mfaEnabled?'2FA ativo':'2FA desativado';
    securityEls.status.className=`badge ${mfaEnabled?'status-concluido':'status-cancelado'}`;
    securityEls.mfaSenhaField.classList.toggle('hidden',!mfaEnabled);
    securityEls.off.classList.toggle('hidden',mfaEnabled);
    securityEls.on.classList.toggle('hidden',!mfaEnabled);
    if(mfaEnabled)securityEls.setup.classList.add('hidden');
  }
  async function copyText(text){
    if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(text);return}
    const t=document.createElement('textarea');t.value=text;t.style.position='fixed';t.style.opacity='0';document.body.appendChild(t);t.select();document.execCommand('copy');t.remove();
  }
  async function loadSecurity(){
    try{const d=await api('/auth/security-status');renderMfaState(d.mfa_enabled)}catch(e){securityEls.status.textContent='Indisponível';securityEls.status.className='badge status-cancelado';console.error(e)}
  }
  [securityEls.mfaSenhaCode,securityEls.confirmCode,securityEls.disableCode].forEach(input=>input?.addEventListener('input',()=>{input.value=digits6(input.value)}));
  securityEls.alterarSenha.onclick=async()=>{
    const atual=securityEls.senhaAtual.value,nova=securityEls.novaSenha.value,confirmacao=securityEls.confirmarNovaSenha.value,code=digits6(securityEls.mfaSenhaCode.value);
    if(!atual)return flash(msg,'Informe sua senha atual','error');
    if(nova!==confirmacao)return flash(msg,'A confirmação da nova senha não confere','error');
    if(mfaEnabled&&code.length!==6)return flash(msg,'Informe o código de 6 dígitos do autenticador','error');
    try{securityEls.alterarSenha.disabled=true;securityEls.alterarSenha.textContent='Alterando...';await api('/auth/change-password',{method:'POST',body:JSON.stringify({senha_atual:atual,nova_senha:nova,mfa_code:code})});securityEls.senhaAtual.value='';securityEls.novaSenha.value='';securityEls.confirmarNovaSenha.value='';securityEls.mfaSenhaCode.value='';flash(msg,'Senha alterada. As outras sessões da sua conta foram revogadas.')}catch(e){flash(msg,e.message,'error')}finally{securityEls.alterarSenha.disabled=false;securityEls.alterarSenha.textContent='Alterar senha'}
  };
  securityEls.iniciar.onclick=async()=>{
    const senha=securityEls.setupPassword.value;
    if(!senha)return flash(msg,'Confirme sua senha atual para configurar o 2FA','error');
    try{securityEls.iniciar.disabled=true;securityEls.iniciar.textContent='Preparando...';const d=await api('/auth/mfa/enroll',{method:'POST',body:JSON.stringify({senha})});mfaPendingPassword=senha;mfaRawSecret=d.secret;securityEls.secret.textContent=formatSecret(d.secret);securityEls.abrir.href=d.otpauth_uri;securityEls.off.classList.add('hidden');securityEls.setup.classList.remove('hidden');securityEls.confirmCode.focus();flash(msg,'Chave 2FA criada. Adicione ao seu aplicativo e confirme o código.')}catch(e){flash(msg,e.message,'error')}finally{securityEls.iniciar.disabled=false;securityEls.iniciar.textContent='Configurar 2FA'}
  };
  securityEls.copiar.onclick=async()=>{try{await copyText(mfaRawSecret);securityEls.copiar.textContent='Copiado';setTimeout(()=>securityEls.copiar.textContent='Copiar chave',1400)}catch{flash(msg,'Não foi possível copiar automaticamente. Selecione a chave manualmente.','error')}};
  securityEls.cancelar.onclick=()=>{mfaPendingPassword='';mfaRawSecret='';securityEls.secret.textContent='—';securityEls.confirmCode.value='';securityEls.abrir.href='#';securityEls.setup.classList.add('hidden');securityEls.off.classList.remove('hidden')};
  securityEls.confirmar.onclick=async()=>{
    const code=digits6(securityEls.confirmCode.value);
    if(!mfaPendingPassword)return flash(msg,'Reinicie a configuração e confirme sua senha','error');
    if(code.length!==6)return flash(msg,'Digite o código de 6 dígitos do aplicativo','error');
    try{securityEls.confirmar.disabled=true;securityEls.confirmar.textContent='Ativando...';await api('/auth/mfa/enable',{method:'POST',body:JSON.stringify({senha:mfaPendingPassword,code})});mfaPendingPassword='';mfaRawSecret='';securityEls.setupPassword.value='';securityEls.confirmCode.value='';securityEls.secret.textContent='—';securityEls.abrir.href='#';renderMfaState(true);flash(msg,'Autenticação em dois fatores ativada com sucesso.')}catch(e){flash(msg,e.message,'error')}finally{securityEls.confirmar.disabled=false;securityEls.confirmar.textContent='Ativar 2FA'}
  };
  securityEls.desativar.onclick=async()=>{
    const senha=securityEls.disablePassword.value,code=digits6(securityEls.disableCode.value);
    if(!senha||code.length!==6)return flash(msg,'Informe sua senha e o código atual do autenticador','error');
    if(!confirm('Desativar a autenticação em dois fatores desta conta?'))return;
    try{securityEls.desativar.disabled=true;securityEls.desativar.textContent='Desativando...';await api('/auth/mfa/disable',{method:'POST',body:JSON.stringify({senha,code})});securityEls.disablePassword.value='';securityEls.disableCode.value='';securityEls.setupPassword.value='';renderMfaState(false);flash(msg,'Autenticação em dois fatores desativada.')}catch(e){flash(msg,e.message,'error')}finally{securityEls.desativar.disabled=false;securityEls.desativar.textContent='Desativar 2FA'}
  };
  async function uploadImagem(file,target){if(!file)return;if(!['image/png','image/jpeg'].includes(file.type))throw new Error('Use uma imagem JPG ou PNG');if(file.size>5*1024*1024)throw new Error('A imagem deve ter no máximo 5MB');const r=await fetch('/api/uploads/imagem',{method:'POST',credentials:'same-origin',headers:{'Content-Type':file.type,'X-CSRF-Token':csrfToken()},body:file});const d=await r.json();if(!r.ok)throw new Error(d.erro||'Erro no upload');el[target].value=d.url;preview();return d.url}
  if(document.getElementById('uploadLogo')){uploadLogo.onclick=()=>logo_file.click();logo_file.onchange=async()=>{try{uploadLogo.disabled=true;uploadLogo.textContent='Enviando...';await uploadImagem(logo_file.files[0],'logo_url');flash(msg,'Logo enviada. Clique em Salvar configurações.')}catch(e){flash(msg,e.message,'error')}finally{uploadLogo.disabled=false;uploadLogo.textContent='Enviar logo'}}}
  if(document.getElementById('uploadBanner')){uploadBanner.onclick=()=>banner_file.click();banner_file.onchange=async()=>{try{uploadBanner.disabled=true;uploadBanner.textContent='Enviando...';await uploadImagem(banner_file.files[0],'banner_url');flash(msg,'Banner enviado. Clique em Salvar configurações.')}catch(e){flash(msg,e.message,'error')}finally{uploadBanner.disabled=false;uploadBanner.textContent='Enviar banner'}}}
  function previewHttpUrl(value){try{const u=new URL(String(value||'').trim(),location.origin);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null}catch{return null}}
  function publicAddressText(){return [el.endereco?.value,el.cidade?.value,el.estado?.value].map(x=>String(x||'').trim()).filter(Boolean).join(', ')}
  function updateMapPreview(){const address=publicAddressText(),label=document.getElementById('configMapAddress'),search=document.getElementById('configMapSearch'),directions=document.getElementById('configMapDirections');if(label)label.textContent=address||'Preencha endereço, cidade e UF.';const ready=!!address,q=encodeURIComponent(address);if(search){search.href=ready?`https://www.google.com/maps/search/?api=1&query=${q}`:'#';search.classList.toggle('disabled-link',!ready)}if(directions){directions.href=ready?`https://www.google.com/maps/dir/?api=1&destination=${q}`:'#';directions.classList.toggle('disabled-link',!ready)}}
  function preview(){updateMapPreview();const dark=el.tema.value==='escuro';publicPreview.style.background=el.cor_fundo.value||'#f7f7f8';publicPreview.style.color=dark?'#f9fafb':'#18202b';const banner=previewHttpUrl(el.banner_url.value),logo=previewHttpUrl(el.logo_url.value);prevBanner.style.backgroundImage=banner?`url(${JSON.stringify(banner)})`:'';prevBanner.classList.toggle('empty',!banner);prevLogo.replaceChildren();if(logo){const img=document.createElement('img');img.src=logo;img.alt='Logo';img.referrerPolicy='no-referrer';prevLogo.appendChild(img)}else prevLogo.textContent='✂';prevNome.textContent=el.nome.value||'Barbearia';prevWelcome.textContent=el.texto_boas_vindas.value||'Seu estilo começa aqui';prevDesc.textContent=el.descricao_publica.value||'Descrição da barbearia';prevMeta.textContent=[el.mostrar_duracao.checked?'30 min':'',el.mostrar_precos.checked?'R$ 35,00':''].filter(Boolean).join(' • ');prevMeta.style.display=(el.mostrar_duracao.checked||el.mostrar_precos.checked)?'':'none';prevButton.style.background=el.cor_botao.value||el.cor_primaria.value||'#f59e0b';prevButton.style.color='#111';publicPreview.style.setProperty('--preview-primary',el.cor_primaria.value||'#f59e0b')}
  ids.forEach(id=>{if(el[id])el[id].addEventListener(el[id].type==='checkbox'?'change':'input',preview)});el.tema.addEventListener('change',preview);
  async function load(){try{const c=await api('/configuracoes');const b=c.barbearia;const recursos=c.assinatura?.recursos||[];const podePublico=recursos.includes('pagina_publica_simples');const podePremium=recursos.includes('personalizacao_publica');for(const id of ids){if(!el[id])continue;if(el[id].type==='checkbox')el[id].checked=!!b[id];else if(b[id]!==null&&b[id]!==undefined)el[id].value=b[id]}el.cor_primaria.value=b.cor_primaria||'#f59e0b';el.cor_secundaria.value=b.cor_secundaria||'#111827';el.cor_botao.value=b.cor_botao||'#f59e0b';el.cor_fundo.value=b.cor_fundo||'#f7f7f8';el.tema.value=b.tema||'claro';preview();linkPublico.href=`/agendar/${b.slug}`;linkPublico.classList.toggle('hidden',!podePublico);const publicIds=['descricao_publica','whatsapp_publico','mostrar_whatsapp_publico','mostrar_mapa_publico','endereco','cidade','estado'];const premiumIds=['logo_url','banner_url','cor_primaria','cor_secundaria','cor_botao','cor_fundo','tema','texto_boas_vindas','instagram','mostrar_precos','mostrar_duracao','politica_cancelamento'];if(!podePublico){[...publicIds,...premiumIds].forEach(id=>{if(el[id])el[id].disabled=true});document.querySelector('.public-config-grid')?.insertAdjacentHTML('beforebegin','<div class="upgrade-card"><strong>🔒 Página pública</strong><p>Incluída no Starter, Pro e Premium.</p><a class="btn btn-primary" href="/pages/assinatura.html">Ver planos</a></div>')}else if(!podePremium){premiumIds.forEach(id=>{if(el[id])el[id].disabled=true});document.querySelector('.public-config-grid')?.insertAdjacentHTML('beforebegin','<div class="upgrade-card"><strong>🔒 Personalização Premium</strong><p>No Pro sua página pública usa o visual padrão. Logo, banner, cores, tema e opções avançadas ficam disponíveis no Premium.</p><a class="btn btn-primary" href="/pages/assinatura.html">Conhecer Premium</a></div>')}}catch(e){flash(msg,e.message,'error')}}
  salvar.onclick=async()=>{try{const body={};for(const id of ids)body[id]=el[id].type==='checkbox'?el[id].checked:el[id].value;body.estado=body.estado.toUpperCase();await api('/configuracoes',{method:'PUT',body:JSON.stringify(body)});flash(msg,'Configurações e página pública salvas')}catch(e){flash(msg,e.message,'error')}};

  el.endereco?.addEventListener('input',preview);el.cidade?.addEventListener('input',preview);el.estado?.addEventListener('input',preview);
  load();
  loadPerfilUsuario();
  loadSecurity();
}
