const API='/api';
function token(){return document.cookie.includes('bf_csrf=')?'cookie-session':''}
function csrfToken(){const m=document.cookie.match(/(?:^|; )bf_csrf=([^;]+)/);return m?decodeURIComponent(m[1]):''}
function currentUser(){try{return JSON.parse(localStorage.getItem('bf_user')||'{}')}catch{return {}}}
function currentSubscription(){try{return JSON.parse(localStorage.getItem('bf_assinatura')||'{}')}catch{return {}}}
function hasFeature(f){const a=currentSubscription();return Array.isArray(a.recursos)?a.recursos.includes(f):true}
function planLabel(p){return ({starter:'Starter',pro:'Pro',premium:'Premium'})[p]||p||'-'}
function authHeaders(extra={}){const h={'Content-Type':'application/json',...extra};const c=csrfToken();if(c)h['X-CSRF-Token']=c;return h}
function money(v){return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
function dateBR(v){if(!v)return '-';const s=String(v).slice(0,10).split('-');return `${s[2]}/${s[1]}/${s[0]}`}
function timeBR(v){return String(v||'').slice(0,5)}
function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function roleLabel(p){return ({super_admin:'Master',dono:'Dono',gerente:'Gerente',recepcao:'Recepção',barbeiro:'Barbeiro'})[p]||p||''}
function hasRole(...roles){return roles.includes(currentUser().papel)}
function ensureSecurityChallengeModal(){
  let root=document.getElementById('bfSecurityChallenge');
  if(root)return root;
  root=document.createElement('div');
  root.id='bfSecurityChallenge';
  root.className='modal-backdrop security-challenge-backdrop hidden';
  root.setAttribute('role','dialog');
  root.setAttribute('aria-modal','true');
  root.setAttribute('aria-labelledby','bfSecurityTitle');
  root.innerHTML=`<div class="security-challenge-card">
    <div class="security-challenge-head"><div class="security-challenge-icon">🔐</div><div><span>VERIFICAÇÃO DE SEGURANÇA</span><h2 id="bfSecurityTitle">Confirme sua identidade</h2><p id="bfSecuritySubtitle"></p></div><button type="button" class="modal-close" id="bfSecurityClose" aria-label="Fechar">×</button></div>
    <form id="bfSecurityForm" novalidate>
      <div id="bfSecuritySecretBox" class="security-secret-box hidden"><small>CHAVE DO AUTENTICADOR</small><div><code id="bfSecuritySecret"></code><button type="button" class="btn btn-secondary" id="bfSecurityCopySecret">Copiar</button></div><p>Adicione esta chave no Google Authenticator, Microsoft Authenticator, Authy, 1Password, Bitwarden, Aegis ou outro app TOTP.</p></div>
      <div id="bfSecurityError" class="notice error hidden"></div>
      <div class="field"><label id="bfSecurityLabel" for="bfSecurityInput">Código de autenticação</label><input id="bfSecurityInput" autocomplete="one-time-code"></div>
      <label id="bfSecurityShowPasswordWrap" class="show-password-check hidden"><input id="bfSecurityShowPassword" type="checkbox"> <span>Ver senha</span></label>
      <div class="security-challenge-note" id="bfSecurityNote"></div>
      <div class="security-challenge-actions"><button type="button" class="btn btn-secondary" id="bfSecurityCancel">Cancelar</button><button type="submit" class="btn btn-dark" id="bfSecurityConfirm">Confirmar</button></div>
    </form>
  </div>`;
  document.body.appendChild(root);
  return root;
}
function securityChallenge({mode='totp',title='Confirme sua identidade',subtitle='',secret='',confirmLabel='Confirmar',note='',onConfirm}){
  return new Promise((resolve,reject)=>{
    const root=ensureSecurityChallengeModal(),form=root.querySelector('#bfSecurityForm'),input=root.querySelector('#bfSecurityInput'),error=root.querySelector('#bfSecurityError'),titleEl=root.querySelector('#bfSecurityTitle'),subtitleEl=root.querySelector('#bfSecuritySubtitle'),label=root.querySelector('#bfSecurityLabel'),showWrap=root.querySelector('#bfSecurityShowPasswordWrap'),show=root.querySelector('#bfSecurityShowPassword'),confirm=root.querySelector('#bfSecurityConfirm'),secretBox=root.querySelector('#bfSecuritySecretBox'),secretEl=root.querySelector('#bfSecuritySecret'),noteEl=root.querySelector('#bfSecurityNote'),cancel=root.querySelector('#bfSecurityCancel'),close=root.querySelector('#bfSecurityClose'),copy=root.querySelector('#bfSecurityCopySecret');
    const previous=document.activeElement;let finished=false;
    titleEl.textContent=title;subtitleEl.textContent=subtitle||'';subtitleEl.classList.toggle('hidden',!subtitle);noteEl.textContent=note||'';noteEl.classList.toggle('hidden',!note);confirm.textContent=confirmLabel;error.classList.add('hidden');error.textContent='';
    const isPassword=mode==='password';label.textContent=isPassword?'Senha atual':'Código de 6 dígitos';input.type=isPassword?'password':'text';input.value='';input.inputMode=isPassword?'text':'numeric';input.autocomplete=isPassword?'current-password':'one-time-code';input.maxLength=isPassword?128:6;input.placeholder=isPassword?'Digite sua senha':'000000';input.classList.toggle('totp-input',!isPassword);showWrap.classList.toggle('hidden',!isPassword);show.checked=false;
    secretBox.classList.toggle('hidden',!secret);secretEl.textContent=secret||'';
    root.classList.remove('hidden');document.body.classList.add('modal-open');
    const cleanup=(ok,value)=>{if(finished)return;finished=true;root.classList.add('hidden');document.body.classList.remove('modal-open');form.onsubmit=null;cancel.onclick=null;close.onclick=null;root.onclick=null;document.removeEventListener('keydown',onKey);show.onchange=null;copy.onclick=null;setTimeout(()=>previous?.focus?.(),0);ok?resolve(value):reject(new Error('Confirmação cancelada'));};
    const onKey=e=>{if(e.key==='Escape')cleanup(false)};document.addEventListener('keydown',onKey);
    show.onchange=()=>{input.type=show.checked?'text':'password'};
    if(!isPassword)input.oninput=()=>{input.value=String(input.value||'').replace(/\D/g,'').slice(0,6)};else input.oninput=null;
    copy.onclick=async()=>{try{await navigator.clipboard.writeText(secret||'');copy.textContent='Copiado';setTimeout(()=>copy.textContent='Copiar',1300)}catch{}};
    cancel.onclick=()=>cleanup(false);close.onclick=()=>cleanup(false);root.onclick=e=>{if(e.target===root)cleanup(false)};
    form.onsubmit=async e=>{e.preventDefault();const value=isPassword?String(input.value||''):String(input.value||'').replace(/\D/g,'').slice(0,6);if((isPassword&&!value)||(!isPassword&&value.length!==6)){error.textContent=isPassword?'Digite sua senha atual.':'Digite o código completo de 6 dígitos.';error.classList.remove('hidden');input.focus();return}confirm.disabled=true;confirm.textContent='Verificando...';error.classList.add('hidden');try{const result=await onConfirm(value);cleanup(true,result)}catch(err){error.textContent=err?.message||'Não foi possível confirmar sua identidade.';error.classList.remove('hidden');input.select?.();input.focus()}finally{if(!finished){confirm.disabled=false;confirm.textContent=confirmLabel}}};
    setTimeout(()=>input.focus(),40);
  });
}
async function requestStepUp(){
  let mfa=!!currentUser().mfa_enabled;
  try{const mr=await fetch('/api/auth/me',{credentials:'same-origin',headers:authHeaders()});if(mr.ok){const me=await mr.json();mfa=!!me.mfa_enabled;const u={...currentUser(),mfa_enabled:mfa};localStorage.setItem('bf_user',JSON.stringify(u));}}catch{}
  return securityChallenge({
    mode:mfa?'totp':'password',
    title:'Confirme esta alteração',
    subtitle:mfa?'Use o código atual do seu aplicativo autenticador.':'Por segurança, confirme sua senha atual para continuar.',
    note:mfa?'O código é usado somente para esta verificação e nunca é armazenado.':'A senha é enviada com segurança apenas para validar esta ação.',
    onConfirm:async value=>{
      const body=mfa?{mfa_code:value}:{senha:value};
      const r=await fetch('/api/auth/step-up',{method:'POST',credentials:'same-origin',headers:authHeaders(),body:JSON.stringify(body)});
      let d={};try{d=await r.json()}catch{}
      if(!r.ok)throw new Error(d.erro||'Falha na confirmação de segurança');
      return true;
    }
  });
}
async function api(path,opts={},retried=false){
  let r;try{r=await fetch(`${API}${path}`,{...opts,credentials:'same-origin',headers:authHeaders(opts.headers||{})})}catch{throw new Error('Não foi possível conectar ao BarberFlow. Verifique sua internet e tente novamente.')}
  let d={};try{d=await r.json()}catch{}
  if(r.status===401){await logout(false);throw new Error('Sessão expirada')}
  if(r.status===428&&d.step_up_required&&!retried){await requestStepUp();return api(path,opts,true)}
  if(r.status===402&&['ASSINATURA_INATIVA','SEM_ASSINATURA'].includes(d.codigo)){localStorage.setItem('bf_subscription_blocked','1');if(!location.pathname.endsWith('/assinatura.html')&&!location.pathname.endsWith('/suporte.html'))location.replace('/pages/assinatura.html?bloqueada=1');throw new Error(d.erro||'Assinatura inativa')}
  if(!r.ok){const code=d.request_id?` (código ${d.request_id})`:'';throw new Error((d.erro||'Erro na operação')+code)}
  mostrarPaginaProtegida();return d
}
async function syncSubscription(){if(!currentUser().id||currentUser().papel==='super_admin')return;try{const r=await fetch('/api/assinatura/recursos',{credentials:'same-origin',headers:authHeaders()});if(r.ok){const a=await r.json();localStorage.setItem('bf_assinatura',JSON.stringify(a));}}catch{}}
async function logout(redirect=true){try{await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin',headers:authHeaders()})}catch{}localStorage.removeItem('bf_user');localStorage.removeItem('bf_barbearia');localStorage.removeItem('bf_assinatura');sessionStorage.clear();if(redirect)location.replace('/login.html')}
function mostrarPaginaProtegida(){document.body.classList.remove('auth-checking');document.body.classList.add('auth-ready')}
function requireAuth(roles=null){const u=currentUser();if(!u.id){location.replace('/login.html');return false}if(Array.isArray(roles)&&!roles.includes(u.papel)){location.replace(u.papel==='super_admin'?'/master.html':'/');return false}mostrarPaginaProtegida();document.querySelectorAll('[data-user-name]').forEach(e=>e.textContent=u.nome||'Usuário');document.querySelectorAll('[data-user-role]').forEach(e=>e.textContent=roleLabel(u.papel));setTimeout(syncSubscription,0);return true}
function flash(el,msg,type='success'){el.textContent=msg;el.className=`notice ${type}`;el.classList.remove('hidden');setTimeout(()=>el.classList.add('hidden'),4000)}

function toggleMobileMenu(force){
  const sidebar=document.querySelector('.sidebar');
  const backdrop=document.querySelector('.sidebar-backdrop');
  if(!sidebar)return;
  const open=typeof force==='boolean'?force:!sidebar.classList.contains('mobile-open');
  sidebar.classList.toggle('mobile-open',open);
  backdrop?.classList.toggle('show',open);
  document.body.classList.toggle('menu-open',open);
}
function closeMobileMenu(){toggleMobileMenu(false)}

function enhanceResponsiveTable(table){
  if(!table||table.dataset.responsiveReady==='1')return;
  table.dataset.responsiveReady='1';
  const apply=()=>{
    const headers=[...table.querySelectorAll('thead th')].map(th=>th.textContent.trim());
    table.querySelectorAll('tbody tr').forEach(tr=>{
      const cells=[...tr.children];
      if(cells.length===1&&cells[0].colSpan>1){cells[0].dataset.label='';return}
      cells.forEach((td,i)=>td.dataset.label=headers[i]||'');
    });
  };
  apply();
  const tbody=table.querySelector('tbody');
  if(tbody)new MutationObserver(apply).observe(tbody,{childList:true,subtree:true});
}
function initResponsiveTables(){document.querySelectorAll('.table').forEach(enhanceResponsiveTable)}
document.addEventListener('DOMContentLoaded',()=>setTimeout(initResponsiveTables,0));

function renderShell(active){
  const u=currentUser();const role=u.papel;
  if(role==='super_admin'){return `
    <div class="mobile-appbar master-mobile-appbar"><button class="icon-btn" data-click="toggleMobileMenu()">☰</button><a class="mobile-logo" href="/master.html">Barber<span>Flow</span></a><div class="mobile-avatar">MA</div></div>
    <div class="sidebar-backdrop" data-click="closeMobileMenu()"></div>
    <aside class="sidebar master-sidebar-v2">
      <div class="sidebar-mobile-head"><div class="master-brand-v2"><div class="master-brand-mark">BF</div><div><strong>BarberFlow</strong><span>SUPERMASTER</span></div></div><button class="close-drawer" data-click="closeMobileMenu()">×</button></div>
      <div class="master-brand-v2 desktop-logo"><div class="master-brand-mark">BF</div><div><strong>BarberFlow</strong><span>SUPERMASTER</span></div></div>
      <div class="master-sidebar-label">NAVEGAÇÃO</div>
      <nav class="menu master-side-menu">
        <button type="button" class="master-side-link master-tab active" data-section="visao" data-click="closeMobileMenu()"><span class="master-side-icon">⌂</span><span>Visão geral</span></button>
        <button type="button" class="master-side-link master-tab" data-section="barbearias-sec" data-click="closeMobileMenu()"><span class="master-side-icon">▦</span><span>Barbearias</span></button>
        <button type="button" class="master-side-link master-tab" data-section="financeiro-sec" data-click="closeMobileMenu()"><span class="master-side-icon">↗</span><span>Financeiro SaaS</span></button>
        <button type="button" class="master-side-link master-tab" data-section="pagamentos-master-sec" data-click="closeMobileMenu()"><span class="master-side-icon">💳</span><span>Pagamentos</span></button>
        <button type="button" class="master-side-link master-tab" data-section="suporte-sec" data-click="closeMobileMenu()"><span class="master-side-icon">🛟</span><span>Suporte</span></button>
        <button type="button" class="master-side-link master-tab" data-section="seguranca-master-sec" data-click="closeMobileMenu()"><span class="master-side-icon">🔐</span><span>Segurança / 2FA</span></button>
        <button type="button" class="master-side-link master-tab" data-section="perfil-sec" data-click="closeMobileMenu()"><span class="master-side-icon">◎</span><span>Meu perfil</span></button>
      </nav>
      <div class="master-sidebar-label master-sidebar-system-label">SISTEMA</div>
      <div class="master-system-card"><div><i></i><span>Ambiente</span></div><strong>Produção</strong></div>
      <div class="sidebar-bottom master-sidebar-bottom-v2">
        <div class="sidebar-user master-user-v2"><div class="master-user-avatar-v2">${esc((u.nome||'MA').slice(0,2).toUpperCase())}</div><div><strong>${esc(u.nome||'Master')}</strong><span>Super Admin</span></div></div>
        <a href="#" data-click="logout()" class="master-logout-v2"><span class="menu-icon">↪</span><span>Sair</span></a>
      </div>
    </aside>`}
  const params=new URLSearchParams(location.search);
  const section=params.get('secao')||'';
  const origin=params.get('origem')||'';
  const links=[
    ['dashboard','/','🏠','Dashboard',['dono','gerente','recepcao','barbeiro']],
    ['agendamentos','/pages/agendamentos.html','📅','Agenda',['dono','gerente','recepcao','barbeiro']],
    ['clientes','/pages/clientes.html','👥','Clientes',['dono','gerente','recepcao']],
    ['barbeiros','/pages/barbeiros.html','💈','Barbeiros',['dono','gerente']],
    ['servicos','/pages/servicos.html','✂️','Serviços',['dono','gerente']],
    ['pagina-publica','/pages/configuracoes.html?secao=pagina-publica','🌐','Página pública',['dono','gerente']],
    ['loja-config','/pages/loja.html?secao=configuracoes','🎨','Configurações',['dono','gerente'],'loja_publica'],
    ['loja-produtos','/pages/gestao.html?secao=estoque&origem=loja','📦','Produtos',['dono','gerente'],'loja_publica'],
    ['loja-frete','/pages/loja.html?secao=frete','🚚','Frete e retirada',['dono','gerente'],'loja_publica'],
    ['loja-checkout','/pages/loja.html?secao=checkout','💳','Checkout',['dono','gerente'],'loja_publica'],
    ['loja-pedidos','/pages/loja.html?secao=pedidos','🧾','Pedidos',['dono','gerente'],'loja_publica'],
    ['financeiro','/pages/financeiro.html','💰','Financeiro',['dono','gerente'],'financeiro_basico'],
    ['marketing-resumo','/pages/marketing.html?secao=resumo','📈','Visão geral',['dono','gerente'],'marketing'],
    ['marketing-campanhas','/pages/marketing.html?secao=campanhas','📣','Campanhas',['dono','gerente'],'marketing'],
    ['marketing-publicos','/pages/marketing.html?secao=publicos','🎯','Públicos',['dono','gerente'],'marketing'],
    ['marketing-cupons','/pages/marketing.html?secao=cupons','🏷️','Cupons',['dono','gerente'],'marketing'],
    ['marketing-indicacoes','/pages/marketing.html?secao=indicacoes','🤝','Indicações',['dono','gerente'],'marketing'],
    ['marketing-links','/pages/marketing.html?secao=links','🔗','Links rastreáveis',['dono','gerente'],'marketing'],
    ['marketing-modelos','/pages/marketing.html?secao=modelos','💬','Modelos WhatsApp',['dono','gerente'],'marketing'],
    ['gestao-pdv','/pages/gestao.html?secao=pdv','🧾','Caixa / PDV',['dono','gerente','recepcao'],'pdv_estoque'],
    ['gestao-comissoes','/pages/gestao.html?secao=comissoes','💈','Comissões',['dono','gerente'],'comissoes'],
    ['gestao-fila','/pages/gestao.html?secao=fila','⏱️','Fila de espera',['dono','gerente'],'fila_espera'],
    ['gestao-crm','/pages/gestao.html?secao=crm','👤','CRM',['dono','gerente'],'crm_avancado'],
    ['gestao-fidelidade','/pages/gestao.html?secao=fidelidade','🎁','Fidelidade',['dono','gerente'],'fidelidade'],
    ['gestao-avaliacoes','/pages/gestao.html?secao=avaliacoes','⭐','Avaliações',['dono','gerente'],'avaliacoes'],
    ['gestao-relatorios','/pages/gestao.html?secao=relatorios','📊','Relatórios',['dono','gerente'],'relatorios_avancados'],
    ['gestao-dados','/pages/gestao.html?secao=dados','⬇️','Exportar dados',['dono','gerente'],'exportacao_dados'],
    ['pagamentos','/pages/pagamentos.html','💳','Pagamentos',['dono','gerente']],
    ['equipe','/pages/equipe.html','🔐','Equipe',['dono','gerente'],'equipe'],
    ['automacoes','/pages/automacoes.html','🤖','Automações',['dono','gerente'],'automacoes'],
    ['seguranca','/pages/configuracoes.html?secao=seguranca','🛡️','Segurança',['dono','gerente']],
    ['perfil','/pages/configuracoes.html?secao=perfil','👤','Perfil',['dono','gerente']],
    ['suporte','/pages/suporte.html','🛟','Suporte',['dono','gerente','recepcao','barbeiro']],
    ['assinatura','/pages/assinatura.html','💳','Assinatura',['dono']]
  ];
  const allowed=links.filter(x=>x[4].includes(role)&&(!x[5]||hasFeature(x[5])));
  const byKey=Object.fromEntries(allowed.map(x=>[x[0],x]));
  const marketingKeys={resumo:'marketing-resumo',campanhas:'marketing-campanhas',publicos:'marketing-publicos',cupons:'marketing-cupons',indicacoes:'marketing-indicacoes',links:'marketing-links',modelos:'marketing-modelos'};
  const marketingActive=active==='marketing'?(marketingKeys[section||'resumo']||'marketing-resumo'):'';
  const gestaoKeys={pdv:'gestao-pdv',comissoes:'gestao-comissoes',fila:'gestao-fila',crm:'gestao-crm',fidelidade:'gestao-fidelidade',avaliacoes:'gestao-avaliacoes',relatorios:'gestao-relatorios',dados:'gestao-dados'};
  const lojaKeys={configuracoes:'loja-config',frete:'loja-frete',checkout:'loja-checkout',pedidos:'loja-pedidos'};
  const lojaActive=active==='loja'?(lojaKeys[section||'configuracoes']||'loja-config'):(active==='gestao'&&section==='estoque'&&origin==='loja'?'loja-produtos':'');
  const gestaoActive=active==='gestao'&&origin!=='loja'?(gestaoKeys[section||'pdv']||'gestao-pdv'):'';
  const isActive=k=>active===k||k===gestaoActive||k===lojaActive||k===marketingActive||(active==='config'&&((k==='pagina-publica'&&section==='pagina-publica')||(k==='seguranca'&&section==='seguranca')||(k==='perfil'&&(!section||section==='perfil'))));
  const linkHtml=x=>x?`<a class="${isActive(x[0])?'active':''}" href="${x[1]}"><span class="menu-icon">${x[2]}</span><span>${x[3]}</span></a>`:'';
  const groupHtml=(id,icon,label,keys)=>{
    const items=keys.map(k=>byKey[k]).filter(Boolean);
    if(!items.length)return '';
    const open=items.some(x=>isActive(x[0]));
    return `<div class="menu-group ${open?'open':''}" data-menu-group="${id}">
      <button class="menu-group-toggle ${open?'active':''}" type="button" aria-expanded="${open?'true':'false'}"><span class="menu-icon">${icon}</span><span>${label}</span><span class="menu-group-chevron">⌄</span></button>
      <div class="menu-submenu">${items.map(linkHtml).join('')}</div>
    </div>`;
  };
  const lojaGroupHtml=()=>{
    const items=['loja-config','loja-produtos','loja-frete','loja-checkout','loja-pedidos'].map(k=>byKey[k]).filter(Boolean);
    if(!items.length)return '';
    const open=items.some(x=>isActive(x[0]));
    return `<div class="menu-group nested-menu-group ${open?'open':''}" data-menu-group="loja">
      <button class="menu-group-toggle ${open?'active':''}" type="button" aria-expanded="${open?'true':'false'}"><span class="menu-icon">🛍️</span><span>Loja</span><span class="menu-group-chevron">⌄</span></button>
      <div class="menu-submenu">${items.map(linkHtml).join('')}</div>
    </div>`;
  };
  const barbeariaGroupHtml=()=>{
    const direct=['agendamentos','clientes','barbeiros','servicos','pagina-publica'].map(k=>byKey[k]).filter(Boolean);
    const store=['loja-config','loja-produtos','loja-frete','loja-checkout','loja-pedidos'].map(k=>byKey[k]).filter(Boolean);
    const open=[...direct,...store].some(x=>isActive(x[0]));
    return `<div class="menu-group ${open?'open':''}" data-menu-group="barbearia">
      <button class="menu-group-toggle ${open?'active':''}" type="button" aria-expanded="${open?'true':'false'}"><span class="menu-icon">💈</span><span>Barbearia</span><span class="menu-group-chevron">⌄</span></button>
      <div class="menu-submenu">${direct.map(linkHtml).join('')}${lojaGroupHtml()}</div>
    </div>`;
  };
  const menu=[
    linkHtml(byKey.dashboard),
    barbeariaGroupHtml(),
    linkHtml(byKey.financeiro),
    groupHtml('marketing','📣','Marketing',['marketing-resumo','marketing-campanhas','marketing-publicos','marketing-cupons','marketing-indicacoes','marketing-links','marketing-modelos']),
    groupHtml('gestao','🧰','Gestão',['gestao-pdv','gestao-comissoes','gestao-fila','gestao-crm','gestao-fidelidade','gestao-avaliacoes','gestao-relatorios','gestao-dados']),
    groupHtml('configuracoes','⚙️','Configurações',['pagamentos','equipe','automacoes','seguranca','perfil']),
    linkHtml(byKey.suporte),
    linkHtml(byKey.assinatura)
  ].join('');
  return `
    <div class="mobile-appbar">
      <button class="icon-btn" type="button" data-click="toggleMobileMenu()" aria-label="Abrir menu">☰</button>
      <a class="mobile-logo" href="/">Barber<span>Flow</span></a>
      <div class="mobile-avatar">${esc((u.nome||'BF').slice(0,2).toUpperCase())}</div>
    </div>
    <div class="sidebar-backdrop" data-click="closeMobileMenu()"></div>
    <aside class="sidebar">
      <div class="sidebar-mobile-head"><div class="logo">Barber<span>Flow</span></div><button class="close-drawer" data-click="closeMobileMenu()">×</button></div>
      <div class="logo desktop-logo">Barber<span>Flow</span></div>
      <nav class="menu">${menu}</nav>
      <div class="sidebar-bottom">
        <div class="sidebar-user"><strong>${esc(u.nome||'Usuário')}</strong><span>${esc(roleLabel(role))}</span></div>
        <a href="#" data-click="logout()"><span class="menu-icon">↪</span><span>Sair</span></a>
      </div>
    </aside>`
}



document.addEventListener('click',e=>{const toggle=e.target.closest('.menu-group-toggle');if(!toggle)return;const group=toggle.closest('.menu-group');const open=!group.classList.contains('open');group.classList.toggle('open',open);toggle.classList.toggle('active',open);toggle.setAttribute('aria-expanded',String(open))});

document.addEventListener('click',e=>{const link=e.target.closest('.sidebar .menu a[href]');if(link)closeMobileMenu()});

document.addEventListener('click',e=>{const el=e.target.closest('[data-click]');if(!el)return;const expr=el.getAttribute('data-click')||'';const m=expr.match(/^([A-Za-z_$][\w$]*)\((.*)\)$/);if(!m)return;const fn=window[m[1]]||globalThis[m[1]];if(typeof fn!=='function')return;const href=el.tagName==='A'?String(el.getAttribute('href')||''):'';const navigates=el.tagName==='A'&&href&&href!=='#'&&!href.toLowerCase().startsWith('javascript:');if(!navigates)e.preventDefault();let args=[];const raw=m[2].trim();if(raw){args=raw.split(',').map(x=>{x=x.trim();if(x==='true')return true;if(x==='false')return false;if(x==='null')return null;if(/^[-+]?\d+(\.\d+)?$/.test(x))return Number(x);return x.replace(/^['\"]|['\"]$/g,'')})}fn(...args)});
