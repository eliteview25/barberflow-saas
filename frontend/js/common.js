const API='/api';
function token(){return localStorage.getItem('bf_token')||''}
function currentUser(){try{return JSON.parse(localStorage.getItem('bf_user')||'{}')}catch{return {}}}
function currentSubscription(){try{return JSON.parse(localStorage.getItem('bf_assinatura')||'{}')}catch{return {}}}
function hasFeature(f){const a=currentSubscription();return Array.isArray(a.recursos)?a.recursos.includes(f):true}
function planLabel(p){return ({starter:'Starter',pro:'Pro',premium:'Premium'})[p]||p||'-'}
function authHeaders(extra={}){return {'Content-Type':'application/json','Authorization':`Bearer ${token()}`,...extra}}
function money(v){return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
function dateBR(v){if(!v)return '-';const s=String(v).slice(0,10).split('-');return `${s[2]}/${s[1]}/${s[0]}`}
function timeBR(v){return String(v||'').slice(0,5)}
function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function roleLabel(p){return ({super_admin:'Master',dono:'Dono',gerente:'Gerente',recepcao:'Recepção',barbeiro:'Barbeiro'})[p]||p||''}
function hasRole(...roles){return roles.includes(currentUser().papel)}
async function api(path,opts={}){const r=await fetch(`${API}${path}`,{...opts,headers:authHeaders(opts.headers||{})});let d={};try{d=await r.json()}catch{}if(r.status===401){logout();throw new Error('Sessão expirada')}if(!r.ok)throw new Error(d.erro||'Erro na operação');return d}
async function syncSubscription(){if(!token()||currentUser().papel==='super_admin')return;try{const r=await fetch('/api/assinatura/recursos',{headers:authHeaders()});if(r.ok){const a=await r.json();localStorage.setItem('bf_assinatura',JSON.stringify(a));}}catch{}}
function logout(){localStorage.removeItem('bf_token');localStorage.removeItem('bf_user');localStorage.removeItem('bf_barbearia');localStorage.removeItem('bf_assinatura');localStorage.removeItem('bf_assinatura');location.replace('/login.html')}
function tokenExpirado(){
  const t=token();
  if(!t)return true;
  try{
    const payload=JSON.parse(atob(t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
    return payload.exp && Date.now() >= payload.exp*1000;
  }catch{return true}
}
function mostrarPaginaProtegida(){
  document.body.classList.remove('auth-checking');
  document.body.classList.add('auth-ready');
}
function requireAuth(roles=null){
  if(!token()||tokenExpirado()){
    localStorage.removeItem('bf_token');localStorage.removeItem('bf_user');localStorage.removeItem('bf_barbearia');localStorage.removeItem('bf_assinatura');
    location.replace('/login.html');
    return false;
  }
  const u=currentUser();
  if(Array.isArray(roles)&&!roles.includes(u.papel)){
    location.replace(u.papel==='super_admin'?'/master.html':'/');
    return false;
  }
  document.querySelectorAll('[data-user-name]').forEach(e=>e.textContent=u.nome||'Usuário');
  document.querySelectorAll('[data-user-role]').forEach(e=>e.textContent=roleLabel(u.papel));
  mostrarPaginaProtegida();
  setTimeout(syncSubscription,0);
  return true;
}
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
    <div class="mobile-appbar master-mobile-appbar"><button class="icon-btn" onclick="toggleMobileMenu()">☰</button><a class="mobile-logo" href="/master.html">Barber<span>Flow</span></a><div class="mobile-avatar">MA</div></div>
    <div class="sidebar-backdrop" onclick="closeMobileMenu()"></div>
    <aside class="sidebar master-sidebar-v2">
      <div class="sidebar-mobile-head"><div class="master-brand-v2"><div class="master-brand-mark">BF</div><div><strong>BarberFlow</strong><span>SUPERMASTER</span></div></div><button class="close-drawer" onclick="closeMobileMenu()">×</button></div>
      <div class="master-brand-v2 desktop-logo"><div class="master-brand-mark">BF</div><div><strong>BarberFlow</strong><span>SUPERMASTER</span></div></div>
      <div class="master-sidebar-label">NAVEGAÇÃO</div>
      <nav class="menu master-side-menu">
        <button type="button" class="master-side-link master-tab active" data-section="visao" onclick="closeMobileMenu()"><span class="master-side-icon">⌂</span><span>Visão geral</span></button>
        <button type="button" class="master-side-link master-tab" data-section="barbearias-sec" onclick="closeMobileMenu()"><span class="master-side-icon">▦</span><span>Barbearias</span></button>
        <button type="button" class="master-side-link master-tab" data-section="financeiro-sec" onclick="closeMobileMenu()"><span class="master-side-icon">↗</span><span>Financeiro SaaS</span></button>
        <button type="button" class="master-side-link master-tab" data-section="perfil-sec" onclick="closeMobileMenu()"><span class="master-side-icon">◎</span><span>Meu perfil</span></button>
      </nav>
      <div class="master-sidebar-label master-sidebar-system-label">SISTEMA</div>
      <div class="master-system-card"><div><i></i><span>Ambiente</span></div><strong>Produção</strong></div>
      <div class="sidebar-bottom master-sidebar-bottom-v2">
        <div class="sidebar-user master-user-v2"><div class="master-user-avatar-v2">${esc((u.nome||'MA').slice(0,2).toUpperCase())}</div><div><strong>${esc(u.nome||'Master')}</strong><span>Super Admin</span></div></div>
        <a href="#" onclick="logout()" class="master-logout-v2"><span class="menu-icon">↪</span><span>Sair</span></a>
      </div>
    </aside>
    <nav class="mobile-bottom-nav master-bottom master-bottom-v2">
      <button class="master-tab active" data-section="visao"><span>⌂</span><small>Início</small></button>
      <button class="master-tab" data-section="barbearias-sec"><span>▦</span><small>Clientes</small></button>
      <button class="master-tab" data-section="financeiro-sec"><span>↗</span><small>Financeiro</small></button>
      <button class="master-tab" data-section="perfil-sec"><span>◎</span><small>Perfil</small></button>
    </nav>`}
  const links=[
    ['dashboard','/','🏠','Dashboard',['dono','gerente','recepcao','barbeiro']],
    ['agendamentos','/pages/agendamentos.html','📅','Agenda',['dono','gerente','recepcao','barbeiro']],
    ['clientes','/pages/clientes.html','👥','Clientes',['dono','gerente','recepcao']],
    ['barbeiros','/pages/barbeiros.html','💈','Barbeiros',['dono','gerente']],
    ['servicos','/pages/servicos.html','✂️','Serviços',['dono','gerente']],
    ['financeiro','/pages/financeiro.html','💰','Financeiro',['dono','gerente'],'financeiro_basico'],
    ['equipe','/pages/equipe.html','🔐','Equipe',['dono','gerente'],'equipe'],
    ['gestao','/pages/gestao.html','🧰','Gestão',['dono','gerente','recepcao'],'pdv_estoque'],
    ['automacoes','/pages/automacoes.html','🤖','Automações',['dono','gerente'],'automacoes'],
    ['config','/pages/configuracoes.html','⚙️','Configurações',['dono','gerente']],
    ['assinatura','/pages/assinatura.html','💳','Assinatura',['dono']]
  ];
  const allowed=links.filter(x=>x[4].includes(role)&&(!x[5]||hasFeature(x[5])));
  const menu=allowed.map(x=>`<a class="${active===x[0]?'active':''}" href="${x[1]}" onclick="closeMobileMenu()"><span class="menu-icon">${x[2]}</span><span>${x[3]}</span></a>`).join('');
  const quickKeys=['dashboard','agendamentos','clientes'];
  const quick=allowed.filter(x=>quickKeys.includes(x[0])).slice(0,3);
  const bottom=quick.map(x=>`<a class="${active===x[0]?'active':''}" href="${x[1]}"><span>${x[2]}</span><small>${x[3]}</small></a>`).join('');
  return `
    <div class="mobile-appbar">
      <button class="icon-btn" type="button" onclick="toggleMobileMenu()" aria-label="Abrir menu">☰</button>
      <a class="mobile-logo" href="/">Barber<span>Flow</span></a>
      <div class="mobile-avatar">${esc((u.nome||'BF').slice(0,2).toUpperCase())}</div>
    </div>
    <div class="sidebar-backdrop" onclick="closeMobileMenu()"></div>
    <aside class="sidebar">
      <div class="sidebar-mobile-head"><div class="logo">Barber<span>Flow</span></div><button class="close-drawer" onclick="closeMobileMenu()">×</button></div>
      <div class="logo desktop-logo">Barber<span>Flow</span></div>
      <nav class="menu">${menu}</nav>
      <div class="sidebar-bottom">
        <div class="sidebar-user"><strong>${esc(u.nome||'Usuário')}</strong><span>${esc(roleLabel(role))}</span></div>
        <a href="#" onclick="logout()"><span class="menu-icon">↪</span><span>Sair</span></a>
      </div>
    </aside>
    <nav class="mobile-bottom-nav">${bottom}<button type="button" onclick="toggleMobileMenu()"><span>☰</span><small>Mais</small></button></nav>`
}
