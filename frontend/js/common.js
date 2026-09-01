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
function iconSVG(name,size=18){const paths={home:'<path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',scissors:'<circle cx="6" cy="7" r="3"/><circle cx="6" cy="17" r="3"/><path d="m8.6 8.5 11-5.5M8.6 15.5l11 5.5M8.6 8.5 13 11M8.6 15.5 13 13"/>',globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>',wallet:'<path d="M3 6a2 2 0 0 1 2-2h14v16H5a2 2 0 0 1-2-2z"/><path d="M16 10h5v4h-5a2 2 0 0 1 0-4z"/>',chart:'<path d="M4 19V9M10 19V5M16 19v-7M22 19V3"/>',megaphone:'<path d="m3 11 15-6v14L3 13z"/><path d="M6 14l2 6h4l-2-7"/>',target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',tag:'<path d="M20 13 11 22l-9-9V4h9z"/><circle cx="7" cy="9" r="1"/>',link:'<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',sparkle:'<path d="m12 3 1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',receipt:'<path d="M5 3h14v18l-3-2-4 2-4-2-3 2z"/><path d="M8 8h8M8 12h8M8 16h5"/>',clipboard:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 9h6M9 13h6"/>',package:'<path d="m3 7 9-4 9 4-9 4z"/><path d="M3 7v10l9 4 9-4V7M12 11v10"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',gift:'<rect x="3" y="9" width="18" height="12"/><path d="M12 9v12M3 13h18M7.5 9C4 9 4 4 7 4c2.5 0 5 5 5 5M16.5 9C20 9 20 4 17 4c-2.5 0-5 5-5 5"/>',repeat:'<path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"/>',file:'<path d="M6 2h8l4 4v16H6z"/><path d="M14 2v5h5M9 13h6M9 17h6"/>',star:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/>',download:'<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',card:'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',shield:'<path d="M12 3 4 6v5c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10V6z"/><path d="m9 12 2 2 4-4"/>',support:'<path d="M4 13a8 8 0 0 1 16 0"/><path d="M4 13v5h4v-6H4M20 13v5h-4v-6h4M16 19c0 2-2 3-4 3"/>',settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21h-4v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H3v-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1L7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V3h4v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9A1.7 1.7 0 0 0 21 10h.1v4H21a1.7 1.7 0 0 0-1.6 1z"/>',message:'<path d="M21 15a4 4 0 0 1-4 4H8l-5 3 1.5-4.5A8 8 0 1 1 21 15z"/>',search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',plus:'<path d="M12 5v14M5 12h14"/>',logout:'<path d="M10 17l5-5-5-5M15 12H3M14 3h6a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-6"/>',building:'<path d="M4 21V5l8-3 8 3v16M8 8h2M14 8h2M8 12h2M14 12h2M9 21v-5h6v5"/>',trend:'<path d="m3 17 6-6 4 4 8-9"/><path d="M15 6h6v6"/>',whatsapp:'<path d="M20.5 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.6-4.7A8.5 8.5 0 1 1 20.5 11.5z"/><path d="M8.2 7.7c.2-.4.4-.4.7-.4h.5c.2 0 .4.1.5.4l.8 1.8c.1.3.1.5-.1.7l-.7.8c-.2.2-.2.4-.1.6.5 1.1 1.4 2 2.5 2.5.2.1.4.1.6-.1l.9-1c.2-.2.4-.3.7-.1l1.8.8c.3.1.4.3.4.5v.5c0 .3 0 .5-.4.7-.5.3-1.5.6-2.3.4-1.1-.2-2.5-.8-4.2-2.3-1.4-1.3-2.4-2.8-2.7-4-.3-1 .2-2 .5-2.5z"/>'};return `<svg class="bf-icon" width="${Number(size)||18}" height="${Number(size)||18}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.home}</svg>`}
function roleLabel(p){return ({super_admin:'Master',dono:'Dono',gerente:'Gerente',recepcao:'Recepção',barbeiro:'Barbeiro'})[p]||p||''}
function brandLockup(extra=''){return `<span class="bf-brand-lockup ${extra}"><img src="/favicon.svg?v=20260830-v332" alt=""><span class="bf-brand-word">Barber<span>Flow</span></span></span>`}
function safeClientUrl(v){try{const u=new URL(String(v||''),location.origin);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)return '';if(location.protocol==='https:'&&u.protocol!=='https:')return '';return u.href}catch{return ''}}
function safeMercadoPagoUrl(v){const x=safeClientUrl(v);if(!x)return '';try{const h=new URL(x).hostname.toLowerCase();return h==='mercadopago.com'||h.endsWith('.mercadopago.com')||h==='mercadopago.com.br'||h.endsWith('.mercadopago.com.br')?x:''}catch{return ''}}
function userAvatarHtml(u=currentUser(),extra=''){const photo=safeClientUrl(u?.foto_url);const initials=String(u?.nome||'BF').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'BF';return `<span class="bf-user-avatar ${extra}">${photo?`<img src="${esc(photo)}" alt="Foto de ${esc(u?.nome||'usuário')}">`:`<span>${esc(initials)}</span>`}</span>`}
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
    <div class="security-challenge-head"><div class="security-challenge-icon">${iconSVG('shield',20)}</div><div><span>VERIFICAÇÃO DE SEGURANÇA</span><h2 id="bfSecurityTitle">Confirme sua identidade</h2><p id="bfSecuritySubtitle"></p></div><button type="button" class="modal-close" id="bfSecurityClose" aria-label="Fechar">×</button></div>
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
function requireAuth(roles=null){const u=currentUser();if(!u.id){location.replace('/login.html');return false}if(Array.isArray(roles)&&!roles.includes(u.papel)){location.replace(u.papel==='super_admin'?'/master.html':'/');return false}document.body.dataset.role=u.papel||'';mostrarPaginaProtegida();document.querySelectorAll('[data-user-name]').forEach(e=>e.textContent=u.nome||'Usuário');document.querySelectorAll('[data-user-role]').forEach(e=>e.textContent=roleLabel(u.papel));setTimeout(syncSubscription,0);return true}
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
function hydrateIcons(root=document){root.querySelectorAll('[data-bf-icon]').forEach(el=>{if(el.dataset.bfIconReady==='1')return;el.innerHTML=iconSVG(el.dataset.bfIcon||'home',Number(el.dataset.bfIconSize||18));el.dataset.bfIconReady='1'})}
async function refreshCurrentUserChrome(){
  const u=currentUser();if(!u.id||u.papel==='super_admin')return u;
  try{const r=await fetch('/api/auth/me',{credentials:'same-origin',headers:authHeaders()});if(!r.ok)return u;const d=await r.json();const fresh=d.usuario||d.user||d;if(!fresh?.id)return u;const merged={...u,...fresh};localStorage.setItem('bf_user',JSON.stringify(merged));document.querySelectorAll('[data-user-name]').forEach(e=>e.textContent=merged.nome||'Usuário');return merged}catch{return u}
}
function decoratePremiumTopbar(){
  const bar=document.querySelector('.topbar');const u=currentUser();if(!bar||u.papel==='super_admin'||bar.dataset.premiumReady==='1')return;
  bar.dataset.premiumReady='1';bar.classList.add('bf-premium-topbar');
  const search=document.createElement('div');search.className='bf-topbar-search';search.innerHTML=`${iconSVG('search',17)}<input type="search" id="bfGlobalSearch" autocomplete="off" placeholder="Buscar clientes, agenda, recursos..." aria-label="Buscar no BarberFlow"><span class="bf-search-shortcut">⌘ K</span><div class="bf-search-results hidden" id="bfGlobalSearchResults"></div>`;
  const account=document.createElement('a');account.className='bf-topbar-account';account.href=['dono','gerente'].includes(u.papel)?'/pages/configuracoes.html?secao=perfil':'/';account.innerHTML=`${userAvatarHtml(u,'top')}<span><strong>${esc(u.nome||'Usuário')}</strong><small>${esc(roleLabel(u.papel))}</small></span><b>⌄</b>`;
  const bell=document.createElement('button');bell.type='button';bell.className='bf-topbar-bell';bell.setAttribute('aria-label','Notificações');bell.setAttribute('aria-expanded','false');bell.innerHTML=`${iconSVG('bell',18)}<span class="bf-notification-count hidden" aria-hidden="true">0</span>`;
  const action=bar.querySelector('.topbar-create,.topbar-actions,.actions');
  if(action)bar.insertBefore(search,action);else bar.appendChild(search);
  if(action)bar.insertBefore(bell,action);else bar.appendChild(bell);
  bar.appendChild(account);
  const input=search.querySelector('input'),results=search.querySelector('.bf-search-results');
  const run=()=>{const q=String(input.value||'').trim().toLowerCase();if(!q){results.classList.add('hidden');results.innerHTML='';return}const seen=new Set(),items=[...document.querySelectorAll('.sidebar .menu a[href]')].map(a=>({href:a.getAttribute('href'),label:a.textContent.trim()})).filter(x=>x.href&&x.label&&!seen.has(x.href)&&(seen.add(x.href),true)).filter(x=>x.label.toLowerCase().includes(q)).slice(0,7);results.innerHTML=items.length?items.map(x=>`<a href="${esc(x.href)}">${iconSVG('search',14)}<span>${esc(x.label)}</span><b>↗</b></a>`).join(''):`<div class="bf-search-empty">Nenhum recurso encontrado</div>`;results.classList.remove('hidden')};
  input.addEventListener('input',run);input.addEventListener('keydown',e=>{if(e.key==='Escape'){input.value='';run();input.blur()}if(e.key==='Enter'){const a=results.querySelector('a');if(a)location.href=a.href}});
  document.addEventListener('click',e=>{if(!search.contains(e.target))results.classList.add('hidden')});
}
function updateChromeUser(u){if(!u?.id)return;document.querySelectorAll('.bf-topbar-account,.bf-sidebar-profile').forEach(el=>{const img=el.querySelector('.bf-user-avatar');if(img)img.outerHTML=userAvatarHtml(u,img.classList.contains('top')?'top':img.classList.contains('sm')?'sm':'')});const mobile=document.getElementById('mobileOwnerAvatar');if(mobile)mobile.innerHTML=userAvatarHtml(u,'mobile-owner');const account=document.querySelector('.bf-topbar-account');if(account){const strong=account.querySelector('strong'),small=account.querySelector('small');if(strong)strong.textContent=u.nome||'Usuário';if(small)small.textContent=roleLabel(u.papel)}}

let bfNotificationState={items:[],unread:0,open:false,loading:false};
function notificationTime(value){const date=new Date(value),diff=Date.now()-date.getTime();if(!Number.isFinite(date.getTime()))return '';if(diff<60000)return'Agora';if(diff<3600000)return`Há ${Math.max(1,Math.floor(diff/60000))} min`;if(diff<86400000)return`Há ${Math.max(1,Math.floor(diff/3600000))} h`;if(diff<604800000)return`Há ${Math.max(1,Math.floor(diff/86400000))} d`;return date.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})}
function notificationIcon(type){return ({agenda:'calendar',pagamento:'wallet',assinatura:'card',suporte:'support',barbearia:'building',sistema:'shield'})[type]||'bell'}
function safeNotificationLink(value){try{const u=new URL(String(value||''),location.origin);return u.origin===location.origin&&u.pathname.startsWith('/')?`${u.pathname}${u.search}${u.hash}`:''}catch{return''}}
function ensureNotificationCenter(){
  let root=document.getElementById('bfNotificationCenter');if(root)return root;
  root=document.createElement('div');root.id='bfNotificationCenter';root.className='bf-notification-center hidden';root.innerHTML=`<button class="bf-notification-backdrop" type="button" aria-label="Fechar notificações"></button><aside class="bf-notification-panel" role="dialog" aria-modal="true" aria-labelledby="bfNotificationTitle"><header><div><span>CENTRAL</span><h2 id="bfNotificationTitle">Notificações</h2></div><button class="bf-notification-close" type="button" aria-label="Fechar">×</button></header><div class="bf-notification-toolbar"><span id="bfNotificationSummary">Carregando…</span><button id="bfNotificationReadAll" type="button">Marcar todas como lidas</button></div><div id="bfNotificationList" class="bf-notification-list" aria-live="polite"></div><footer>Atualização automática a cada minuto</footer></aside>`;
  document.body.appendChild(root);root.querySelector('.bf-notification-backdrop').onclick=closeNotificationCenter;root.querySelector('.bf-notification-close').onclick=closeNotificationCenter;root.querySelector('#bfNotificationReadAll').onclick=markAllNotificationsRead;return root;
}
function updateNotificationButtons(){
  const unread=Math.max(0,Number(bfNotificationState.unread)||0),label=unread>99?'99+':String(unread);
  document.querySelectorAll('.bf-topbar-bell,.mobile-bell,.master-notification-bell').forEach(button=>{let count=button.querySelector('.bf-notification-count');if(!count){count=document.createElement('span');count.className='bf-notification-count hidden';count.setAttribute('aria-hidden','true');button.appendChild(count)}count.textContent=label;count.classList.toggle('hidden',unread===0);button.classList.toggle('has-unread',unread>0);button.setAttribute('aria-label',unread?`Notificações: ${unread} não lida${unread===1?'':'s'}`:'Notificações');button.setAttribute('aria-expanded',String(bfNotificationState.open))});
}
function renderNotificationCenter(){
  const root=ensureNotificationCenter(),list=root.querySelector('#bfNotificationList'),summary=root.querySelector('#bfNotificationSummary'),readAll=root.querySelector('#bfNotificationReadAll');const items=bfNotificationState.items||[];
  summary.textContent=bfNotificationState.unread?`${bfNotificationState.unread} não lida${bfNotificationState.unread===1?'':'s'}`:'Tudo em dia';readAll.disabled=!bfNotificationState.unread;
  list.innerHTML=items.length?items.map(item=>`<button type="button" class="bf-notification-item ${item.lida?'':'unread'} level-${esc(item.nivel||'info')}" data-notification-id="${Number(item.id)}" data-notification-link="${esc(safeNotificationLink(item.link))}"><span class="bf-notification-icon">${iconSVG(notificationIcon(item.tipo),17)}</span><span class="bf-notification-copy"><strong>${esc(item.titulo)}</strong><span>${esc(item.mensagem)}</span><small>${esc(notificationTime(item.criado_em))}</small></span><i aria-hidden="true"></i></button>`).join(''):`<div class="bf-notification-empty">${iconSVG('bell',25)}<strong>Nenhuma notificação</strong><span>Novos agendamentos, pagamentos e alertas aparecerão aqui.</span></div>`;
  list.querySelectorAll('[data-notification-id]').forEach(item=>item.onclick=()=>openNotificationItem(item));updateNotificationButtons();
}
async function loadNotifications({silent=false}={}){
  if(bfNotificationState.loading||!currentUser().id)return;bfNotificationState.loading=true;
  try{const data=await api('/notificacoes?limit=30');bfNotificationState.items=Array.isArray(data.items)?data.items:[];bfNotificationState.unread=Number(data.nao_lidas||0);renderNotificationCenter()}catch(e){if(!silent&&bfNotificationState.open){const list=ensureNotificationCenter().querySelector('#bfNotificationList');list.innerHTML=`<div class="bf-notification-empty error"><strong>Não foi possível carregar</strong><span>${esc(e.message)}</span></div>`}}finally{bfNotificationState.loading=false}
}
function openNotificationCenter(){bfNotificationState.open=true;const root=ensureNotificationCenter();root.classList.remove('hidden');document.body.classList.add('notifications-open');updateNotificationButtons();loadNotifications();setTimeout(()=>root.querySelector('.bf-notification-close')?.focus(),30)}
function closeNotificationCenter(){bfNotificationState.open=false;document.getElementById('bfNotificationCenter')?.classList.add('hidden');document.body.classList.remove('notifications-open');updateNotificationButtons()}
async function openNotificationItem(element){const id=Number(element.dataset.notificationId),link=safeNotificationLink(element.dataset.notificationLink);try{if(element.classList.contains('unread')){await api(`/notificacoes/${id}/lida`,{method:'PATCH',body:'{}'});element.classList.remove('unread');const item=bfNotificationState.items.find(x=>Number(x.id)===id);if(item)item.lida=true;bfNotificationState.unread=Math.max(0,bfNotificationState.unread-1);renderNotificationCenter()}}catch{}if(!link)return;if(currentUser().papel==='super_admin'&&location.pathname==='/master.html'){const u=new URL(link,location.origin),section=u.searchParams.get('secao');if(section&&typeof window.openMasterSection==='function'){closeNotificationCenter();window.openMasterSection(section);history.replaceState(null,'',`/master.html?secao=${encodeURIComponent(section)}`);return}}location.href=link}
async function markAllNotificationsRead(){try{await api('/notificacoes/ler-todas',{method:'POST',body:'{}'});bfNotificationState.items.forEach(x=>x.lida=true);bfNotificationState.unread=0;renderNotificationCenter()}catch(e){const summary=ensureNotificationCenter().querySelector('#bfNotificationSummary');summary.textContent=e.message}}
function initNotificationCenter(){
  if(!currentUser().id)return;const buttons=[...document.querySelectorAll('.bf-topbar-bell,.mobile-bell,.master-notification-bell')];if(!buttons.length)return;
  buttons.forEach(button=>{if(button.dataset.notificationReady==='1')return;button.dataset.notificationReady='1';button.onclick=e=>{e.stopPropagation();bfNotificationState.open?closeNotificationCenter():openNotificationCenter()}});ensureNotificationCenter();updateNotificationButtons();loadNotifications({silent:true});
  const timer=setInterval(()=>{if(!document.hidden)loadNotifications({silent:true})},60000);window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&bfNotificationState.open)closeNotificationCenter()});
}
document.addEventListener('DOMContentLoaded',()=>{setTimeout(initResponsiveTables,0);hydrateIcons();decoratePremiumTopbar();initNotificationCenter();refreshCurrentUserChrome().then(updateChromeUser)});

function renderShell(active){
  const u=currentUser();const role=u.papel;
  if(role==='super_admin'){return `
    <div class="mobile-appbar master-mobile-appbar"><button class="icon-btn" data-click="toggleMobileMenu()">☰</button><a class="mobile-logo" href="/master.html">${brandLockup('compact')}</a><button class="mobile-bell master-notification-bell" type="button" aria-label="Notificações" aria-expanded="false">${iconSVG('bell',20)}<span class="bf-notification-count hidden" aria-hidden="true">0</span></button></div>
    <div class="sidebar-backdrop" data-click="closeMobileMenu()"></div>
    <aside class="sidebar master-sidebar-v2">
      <div class="sidebar-mobile-head"><div class="master-brand-v2">${brandLockup('master')}<div class="master-brand-meta"><span>SUPERMASTER</span></div></div><button class="close-drawer" data-click="closeMobileMenu()">×</button></div>
      <div class="master-brand-v2 desktop-logo">${brandLockup('master')}<div class="master-brand-meta"><span>SUPERMASTER</span></div></div>
      <div class="master-sidebar-label">NAVEGAÇÃO</div>
      <nav class="menu master-side-menu">
        <button type="button" class="master-side-link master-tab active" data-section="visao" data-click="closeMobileMenu()"><span class="master-side-icon">${iconSVG('home',16)}</span><span>Visão geral</span></button>
        <button type="button" class="master-side-link master-tab" data-section="barbearias-sec" data-click="closeMobileMenu()"><span class="master-side-icon">${iconSVG('building',16)}</span><span>Barbearias</span></button>
        <button type="button" class="master-side-link master-tab" data-section="financeiro-sec" data-click="closeMobileMenu()"><span class="master-side-icon">${iconSVG('trend',16)}</span><span>Financeiro SaaS</span></button>
        <button type="button" class="master-side-link master-tab" data-section="pagamentos-master-sec" data-click="closeMobileMenu()"><span class="master-side-icon">${iconSVG('card',16)}</span><span>Pagamentos</span></button>
        <button type="button" class="master-side-link master-tab" data-section="suporte-sec" data-click="closeMobileMenu()"><span class="master-side-icon">${iconSVG('support',16)}</span><span>Suporte</span></button>
        <button type="button" class="master-side-link master-tab" data-section="seguranca-master-sec" data-click="closeMobileMenu()"><span class="master-side-icon">${iconSVG('shield',16)}</span><span>Segurança / 2FA</span></button>
        <button type="button" class="master-side-link master-tab" data-section="perfil-sec" data-click="closeMobileMenu()"><span class="master-side-icon">${iconSVG('user',16)}</span><span>Meu perfil</span></button>
      </nav>
      <div class="master-sidebar-label master-sidebar-system-label">SISTEMA</div>
      <div class="master-system-card"><div><i></i><span>Ambiente</span></div><strong>Produção</strong></div>
      <div class="sidebar-bottom master-sidebar-bottom-v2">
        <div class="sidebar-user master-user-v2"><div class="master-user-avatar-v2">${esc((u.nome||'MA').slice(0,2).toUpperCase())}</div><div><strong>${esc(u.nome||'Master')}</strong><span>Super Admin</span></div></div>
        <a href="#" data-click="logout()" class="master-logout-v2"><span class="menu-icon">${iconSVG('logout')}</span><span>Sair</span></a>
      </div>
    </aside>`}
  const params=new URLSearchParams(location.search);
  const section=params.get('secao')||'';
  const origin=params.get('origem')||'';
  const links=[
    ['dashboard','/','home','Dashboard',['dono','gerente','recepcao','barbeiro']],
    ['agendamentos','/pages/agendamentos.html','calendar','Agenda',['dono','gerente','recepcao','barbeiro']],
    ['clientes','/pages/clientes.html','users','Clientes',['dono','gerente','recepcao']],
    ['barbeiros','/pages/barbeiros.html','scissors','Barbeiros',['dono','gerente']],
    ['servicos','/pages/servicos.html','scissors','Serviços',['dono','gerente']],
    ['pagina-publica','/pages/configuracoes.html?secao=pagina-publica','globe','Página pública',['dono','gerente']],
    ['financeiro','/pages/financeiro.html','wallet','Financeiro',['dono','gerente'],'financeiro_basico'],
    ['marketing-resumo','/pages/marketing.html?secao=resumo','trend','Visão geral',['dono','gerente'],'marketing'],
    ['marketing-campanhas','/pages/marketing.html?secao=campanhas','megaphone','Campanhas',['dono','gerente'],'marketing'],
    ['marketing-publicos','/pages/marketing.html?secao=publicos','target','Públicos',['dono','gerente'],'marketing'],
    ['marketing-cupons','/pages/marketing.html?secao=cupons','tag','Cupons',['dono','gerente'],'marketing'],
    ['marketing-indicacoes','/pages/marketing.html?secao=indicacoes','users','Indicações',['dono','gerente'],'marketing'],
    ['marketing-links','/pages/marketing.html?secao=links','link','Links rastreáveis',['dono','gerente'],'marketing'],
    ['marketing-modelos','/pages/marketing.html?secao=modelos','message','Modelos WhatsApp',['dono','gerente'],'marketing'],
    ['marketing-oportunidades','/pages/gestao.html?secao=oportunidades','sparkle','Oportunidades',['dono','gerente'],'marketing_inteligente'],
    ['gestao-pdv','/pages/gestao.html?secao=pdv','receipt','Caixa / PDV',['dono','gerente','recepcao'],'pdv_estoque'],
    ['gestao-vendas','/pages/gestao.html?secao=vendas','receipt','Histórico de vendas',['dono','gerente','recepcao'],'pdv_estoque'],
    ['gestao-comandas','/pages/gestao.html?secao=comandas','clipboard','Comandas',['dono','gerente','recepcao'],'comandas'],
    ['gestao-produtos','/pages/gestao.html?secao=estoque','package','Produtos & Estoque',['dono','gerente','recepcao'],'pdv_estoque'],
    ['gestao-comissoes','/pages/gestao.html?secao=comissoes','scissors','Comissões',['dono','gerente'],'comissoes'],
    ['gestao-fila','/pages/gestao.html?secao=fila','clock','Fila de espera',['dono','gerente'],'fila_espera'],
    ['gestao-crm','/pages/gestao.html?secao=crm','user','CRM',['dono','gerente'],'crm_avancado'],
    ['gestao-fidelidade','/pages/gestao.html?secao=fidelidade','gift','Fidelidade & Pacotes',['dono','gerente'],'fidelidade'],
    ['gestao-clube','/pages/gestao.html?secao=clube','repeat','Clube de Assinaturas',['dono','gerente'],'clube_assinaturas'],
    ['gestao-fiscal','/pages/gestao.html?secao=fiscal','receipt','Fiscal / NFS-e',['dono','gerente'],'fiscal_nfse'],
    ['gestao-bi','/pages/gestao.html?secao=bi','chart','BI Gerencial',['dono','gerente'],'bi_avancado'],
    ['gestao-avaliacoes','/pages/gestao.html?secao=avaliacoes','star','Avaliações',['dono','gerente'],'avaliacoes'],
    ['gestao-relatorios','/pages/gestao.html?secao=relatorios','chart','Relatórios',['dono','gerente'],'relatorios_avancados'],
    ['gestao-dados','/pages/gestao.html?secao=dados','download','Exportar dados',['dono','gerente'],'exportacao_dados'],
    ['pagamentos','/pages/pagamentos.html','card','Pagamentos',['dono','gerente']],
    ['equipe','/pages/equipe.html','shield','Permissões',['dono','gerente'],'equipe'],
    ['automacoes','/pages/automacoes.html','message','WhatsApp & Automações',['dono','gerente'],'automacoes'],
    ['seguranca','/pages/configuracoes.html?secao=seguranca','shield','Segurança',['dono','gerente']],
    ['perfil','/pages/configuracoes.html?secao=perfil','user','Perfil',['dono','gerente']],
    ['suporte','/pages/suporte.html','support','Suporte',['dono','gerente','recepcao','barbeiro']],
    ['assinatura','/pages/assinatura.html','card','Assinatura',['dono']]
  ];
  const allowed=links.filter(x=>x[4].includes(role)&&(!x[5]||hasFeature(x[5])));
  const byKey=Object.fromEntries(allowed.map(x=>[x[0],x]));
  const marketingKeys={resumo:'marketing-resumo',campanhas:'marketing-campanhas',publicos:'marketing-publicos',cupons:'marketing-cupons',indicacoes:'marketing-indicacoes',links:'marketing-links',modelos:'marketing-modelos'};
  const marketingActive=active==='marketing'?(marketingKeys[section||'resumo']||'marketing-resumo'):'';
  const gestaoKeys={pdv:'gestao-pdv',vendas:'gestao-vendas',comandas:'gestao-comandas',estoque:'gestao-produtos',comissoes:'gestao-comissoes',fila:'gestao-fila',crm:'gestao-crm',fidelidade:'gestao-fidelidade',clube:'gestao-clube',fiscal:'gestao-fiscal',bi:'gestao-bi',oportunidades:'marketing-oportunidades',avaliacoes:'gestao-avaliacoes',relatorios:'gestao-relatorios',dados:'gestao-dados'};
  const gestaoActive=active==='gestao'?(gestaoKeys[section||'pdv']||'gestao-pdv'):'';
  const isActive=k=>active===k||k===gestaoActive||k===marketingActive||(active==='config'&&((k==='pagina-publica'&&section==='pagina-publica')||(k==='seguranca'&&section==='seguranca')||(k==='perfil'&&(!section||section==='perfil'))));
  const linkHtml=x=>x?`<a class="${isActive(x[0])?'active':''}" href="${x[1]}"><span class="menu-icon">${iconSVG(x[2])}</span><span>${x[3]}</span></a>`:'';
  const groupHtml=(id,icon,label,keys)=>{
    const items=keys.map(k=>byKey[k]).filter(Boolean);
    if(!items.length)return '';
    const open=items.some(x=>isActive(x[0]));
    return `<div class="menu-group ${open?'open':''}" data-menu-group="${id}">
      <button class="menu-group-toggle ${open?'active':''}" type="button" aria-expanded="${open?'true':'false'}"><span class="menu-icon">${iconSVG(icon)}</span><span>${label}</span><span class="menu-group-chevron">⌄</span></button>
      <div class="menu-submenu">${items.map(linkHtml).join('')}</div>
    </div>`;
  };
  const primaryKeys=['dashboard','agendamentos','clientes','barbeiros','servicos','gestao-comandas','financeiro','automacoes','marketing-resumo'];
  const primaryLinks=primaryKeys.map(k=>byKey[k]).filter(Boolean);
  const primaryHtml=primaryLinks.map(x=>{const label=x[0]==='gestao-comandas'?'Comandas':x[0]==='automacoes'?'WhatsApp':x[0]==='marketing-resumo'?'Marketing':x[3];const ic=x[0]==='automacoes'?'whatsapp':x[0]==='marketing-resumo'?'megaphone':x[0]==='gestao-comandas'?'clipboard':x[2];return `<a class="${isActive(x[0])?'active':''}" href="${x[1]}"><span class="menu-icon">${iconSVG(ic)}</span><span>${esc(label)}</span></a>`}).join('');
  const configLink=byKey.perfil?`<a class="${active==='config'?'active':''}" href="/pages/configuracoes.html?secao=perfil"><span class="menu-icon">${iconSVG('settings')}</span><span>Configurações</span></a>`:'';
  const used=new Set([...primaryKeys,'perfil']);
  const moreKeys=['gestao-pdv','gestao-vendas','gestao-produtos','pagina-publica','gestao-comissoes','gestao-crm','marketing-oportunidades','marketing-campanhas','marketing-publicos','marketing-cupons','marketing-indicacoes','marketing-links','marketing-modelos','gestao-fidelidade','gestao-clube','gestao-fila','gestao-bi','gestao-relatorios','gestao-avaliacoes','gestao-dados','gestao-fiscal','pagamentos','seguranca','equipe','suporte'];
  const moreItems=moreKeys.map(k=>byKey[k]).filter(Boolean).filter(x=>!used.has(x[0]));
  const moreHtml=moreItems.length?`<div class="menu-group bf-more-group ${moreItems.some(x=>isActive(x[0]))?'open':''}"><button class="menu-group-toggle ${moreItems.some(x=>isActive(x[0]))?'active':''}" type="button" aria-expanded="${moreItems.some(x=>isActive(x[0]))?'true':'false'}"><span class="menu-icon">${iconSVG('plus')}</span><span>Mais recursos</span><span class="menu-group-chevron">⌄</span></button><div class="menu-submenu">${moreItems.map(linkHtml).join('')}</div></div>`:'';
  const menu=primaryHtml+configLink+moreHtml;
  const plan=currentSubscription();
  const planName=planLabel(plan?.plano_efetivo||plan?.plano||'starter');
  const planCard=role==='dono'?`<div class="sidebar-plan-card"><div class="sidebar-plan-title">${iconSVG('star',16)}<strong>Plano ${esc(planName)}</strong></div><p>Mais recursos para sua barbearia crescer.</p><a href="/pages/assinatura.html">${String(planName).toLowerCase()==='premium'?'Gerenciar plano':'Upgrade agora'}</a></div>`:'';
  const bottomItems=role==='barbeiro'?[['/','home','Início'],['/pages/agendamentos.html','calendar','Agenda'],['/pages/suporte.html','support','Suporte']]:role==='recepcao'?[['/','home','Início'],['/pages/agendamentos.html','calendar','Agenda'],['/pages/clientes.html','users','Clientes'],['/pages/gestao.html?secao=comandas','receipt','Comandas']]:[['/','home','Início'],['/pages/clientes.html','users','Clientes'],['/pages/financeiro.html','wallet','Financeiro'],['/pages/agendamentos.html','calendar','Agenda']];
  const bottomNav=`<nav class="mobile-bottom-nav" aria-label="Navegação rápida">${bottomItems.map(([href,ic,label])=>`<a href="${href}" class="${(href==='/'&&active==='dashboard')||(href.includes('agendamentos')&&active==='agendamentos')||(href.includes('clientes')&&active==='clientes')||(href.includes('financeiro')&&active==='financeiro')?'active':''}">${iconSVG(ic,20)}<span>${label}</span></a>`).join('')}<button type="button" data-click="toggleMobileMenu()">${iconSVG('settings',20)}<span>Mais</span></button></nav>`;
  return `
    <div class="mobile-appbar">
      <button class="icon-btn" type="button" data-click="toggleMobileMenu()" aria-label="Abrir menu">${iconSVG('menu',22)}</button>
      <a class="mobile-logo" href="/">${brandLockup('compact')}</a>
      <button class="mobile-bell" type="button" aria-label="Notificações" aria-expanded="false">${iconSVG('bell',20)}<span class="bf-notification-count hidden" aria-hidden="true">0</span></button>
    </div>
    ${bottomNav}
    <div class="sidebar-backdrop" data-click="closeMobileMenu()"></div>
    <aside class="sidebar">
      <div class="sidebar-mobile-head"><div class="logo">${brandLockup()}</div><button class="close-drawer" data-click="closeMobileMenu()">×</button></div>
      <div class="logo desktop-logo">${brandLockup()}</div>
      <nav class="menu bf-primary-menu">${menu}</nav>
      <div class="sidebar-bottom">
        ${planCard}
        <div class="sidebar-user bf-sidebar-profile">${userAvatarHtml(u,'sm')}<div><strong>${esc(u.nome||'Usuário')}</strong><span>${esc(roleLabel(role))}</span></div></div>
        <a href="#" data-click="logout()"><span class="menu-icon">${iconSVG('logout')}</span><span>Sair</span></a>
      </div>
    </aside>`
}



document.addEventListener('click',e=>{const toggle=e.target.closest('.menu-group-toggle');if(!toggle)return;const group=toggle.closest('.menu-group');const open=!group.classList.contains('open');group.classList.toggle('open',open);toggle.classList.toggle('active',open);toggle.setAttribute('aria-expanded',String(open))});

document.addEventListener('click',e=>{const link=e.target.closest('.sidebar .menu a[href]');if(link)closeMobileMenu()});

document.addEventListener('input',e=>{if(e.target.id!=='menuSearch')return;const q=String(e.target.value||'').trim().toLowerCase();document.querySelectorAll('.sidebar .menu a').forEach(a=>a.classList.toggle('menu-search-hidden',!!q&&!a.textContent.toLowerCase().includes(q)));document.querySelectorAll('.sidebar .menu-group').forEach(g=>{const visible=[...g.querySelectorAll('.menu-submenu a')].some(a=>!a.classList.contains('menu-search-hidden'));g.classList.toggle('menu-search-hidden',!!q&&!visible&&!g.querySelector('.menu-group-toggle')?.textContent.toLowerCase().includes(q));if(q&&visible)g.classList.add('open')})});

document.addEventListener('click',e=>{const el=e.target.closest('[data-click]');if(!el)return;const expr=el.getAttribute('data-click')||'';const m=expr.match(/^([A-Za-z_$][\w$]*)\((.*)\)$/);if(!m)return;const fn=window[m[1]]||globalThis[m[1]];if(typeof fn!=='function')return;const href=el.tagName==='A'?String(el.getAttribute('href')||''):'';const navigates=el.tagName==='A'&&href&&href!=='#'&&!href.toLowerCase().startsWith('javascript:');if(!navigates)e.preventDefault();let args=[];const raw=m[2].trim();if(raw){args=raw.split(',').map(x=>{x=x.trim();if(x==='true')return true;if(x==='false')return false;if(x==='null')return null;if(/^[-+]?\d+(\.\d+)?$/.test(x))return Number(x);return x.replace(/^['\"]|['\"]$/g,'')})}fn(...args)});
