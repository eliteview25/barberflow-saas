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
async function requestStepUp(){const senha=prompt('Confirme sua senha do Supermaster:');if(!senha)throw new Error('Confirmação cancelada');const mfa_code=prompt('Código de 6 dígitos do autenticador:');if(!mfa_code)throw new Error('Código MFA obrigatório');const r=await fetch('/api/auth/step-up',{method:'POST',credentials:'same-origin',headers:authHeaders(),body:JSON.stringify({senha,mfa_code})});const d=await r.json();if(!r.ok)throw new Error(d.erro||'Falha na confirmação de segurança');return true}
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
  const section=new URLSearchParams(location.search).get('secao')||'';
  const links=[
    ['dashboard','/','🏠','Dashboard',['dono','gerente','recepcao','barbeiro']],
    ['agendamentos','/pages/agendamentos.html','📅','Agenda',['dono','gerente','recepcao','barbeiro']],
    ['clientes','/pages/clientes.html','👥','Clientes',['dono','gerente','recepcao']],
    ['barbeiros','/pages/barbeiros.html','💈','Barbeiros',['dono','gerente']],
    ['servicos','/pages/servicos.html','✂️','Serviços',['dono','gerente']],
    ['pagina-publica','/pages/configuracoes.html?secao=pagina-publica','🌐','Página pública',['dono','gerente']],
    ['financeiro','/pages/financeiro.html','💰','Financeiro',['dono','gerente'],'financeiro_basico'],
    ['gestao-pdv','/pages/gestao.html?secao=pdv','🧾','Caixa / PDV',['dono','gerente','recepcao'],'pdv_estoque'],
    ['gestao-produtos','/pages/gestao.html?secao=estoque','📦','Produtos e estoque',['dono','gerente','recepcao'],'pdv_estoque'],
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
  const gestaoKeys={pdv:'gestao-pdv',estoque:'gestao-produtos',comissoes:'gestao-comissoes',fila:'gestao-fila',crm:'gestao-crm',fidelidade:'gestao-fidelidade',avaliacoes:'gestao-avaliacoes',relatorios:'gestao-relatorios',dados:'gestao-dados'};
  const gestaoActive=active==='gestao'?(gestaoKeys[section||'pdv']||'gestao-pdv'):'';
  const isActive=k=>active===k||k===gestaoActive||(active==='config'&&((k==='pagina-publica'&&section==='pagina-publica')||(k==='seguranca'&&section==='seguranca')||(k==='perfil'&&(!section||section==='perfil'))));
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
  const menu=[
    linkHtml(byKey.dashboard),
    groupHtml('barbearia','💈','Barbearia',['agendamentos','clientes','barbeiros','servicos','pagina-publica']),
    linkHtml(byKey.financeiro),
    groupHtml('gestao','🧰','Gestão',['gestao-pdv','gestao-produtos','gestao-comissoes','gestao-fila','gestao-crm','gestao-fidelidade','gestao-avaliacoes','gestao-relatorios','gestao-dados']),
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
