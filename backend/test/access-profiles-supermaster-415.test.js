const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..','..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const common=read('frontend/js/common.js');
const css=read('frontend/style.css');
const masterRoute=read('backend/src/routes/master.js');
const appointments=read('backend/src/routes/agendamentos.js');
const clients=read('backend/src/routes/clientes.js');
const dashboard=read('frontend/script.js');
const tenant=read('backend/src/routes/tenant.js');

test('shell preserva menus distintos para gerente, recepção e barbeiro',()=>{
  assert.match(common,/\['dashboard','\/',[\s\S]*?\['dono','gerente','recepcao','barbeiro'\]/);
  assert.match(common,/\['clientes',[\s\S]*?\['dono','gerente','recepcao'\]/);
  assert.match(common,/\['financeiro',[\s\S]*?\['dono','gerente'\]/);
  assert.match(common,/\['assinatura',[\s\S]*?\['dono'\]/);
  assert.match(common,/role==='barbeiro'\?\[\['\/','home','Início'\],\['\/pages\/agendamentos\.html','calendar','Agenda'\],\['\/pages\/suporte\.html','support','Suporte'\]\]/);
  assert.match(common,/role==='recepcao'\?\[\['\/','home','Início'\],\['\/pages\/agendamentos\.html','calendar','Agenda'\],\['\/pages\/clientes\.html','users','Clientes'\],\['\/pages\/gestao\.html\?secao=comandas','receipt','Comandas'\]\]/);
  assert.match(dashboard,/role==='barbeiro'\?\[\['\/pages\/agendamentos\.html','calendar','Minha agenda'\],\['\/pages\/suporte\.html','support','Suporte'\]\]/);
  assert.match(dashboard,/role==='recepcao'\?\[\['\/pages\/agendamentos\.html','calendar','Agenda'\],\['\/pages\/clientes\.html','users','Clientes'\],\['\/pages\/gestao\.html\?secao=comandas','clipboard','Comandas'\],\['\/pages\/suporte\.html','support','Suporte'\]\]/);
});

test('API mantém isolamento de Supermaster e limites operacionais dos perfis',()=>{
  assert.match(masterRoute,/router\.use\(autenticar,exigirPapel\('super_admin'\)\)/);
  assert.match(clients,/exigirPapel\('dono','gerente','recepcao'\)/);
  assert.ok(appointments.includes("if(req.usuario.papel==='barbeiro'){if(!req.usuario.barbeiro_id)return res.json([])"));
  assert.ok(appointments.includes('filtros.push(`a.barbeiro_id=$${vals.length}`)'));
  assert.match(appointments,/router\.post\('\/',exigirPapel\('dono','gerente','recepcao'\)/);
  assert.match(tenant,/if\(req\.usuario\.papel==='recepcao'\)for\(const key of \['receita_prevista_hoje','faturamento_hoje','ticket_medio','faturamento_mes','comissao_hoje','comissao_mes'\]\)delete resumo\[key\]/);
  assert.match(tenant,/if\(req\.usuario\.papel==='barbeiro'\)for\(const key of \['receita_prevista_hoje','faturamento_hoje','ticket_medio','faturamento_mes'\]\)delete resumo\[key\]/);
});

test('perfil autenticado é identificado e Supermaster não herda cards brancos',()=>{
  assert.match(common,/document\.body\.dataset\.role=u\.papel\|\|''/);
  assert.match(css,/body\[data-role="recepcao"\] \.dashboard-kpi-icon\{background:#111b25!important/);
  assert.match(css,/body\[data-role="barbeiro"\] \.dashboard-kpi-icon\{background:#102018!important/);
  for(const selector of ['.master-attention-card','.master-plan-distribution','.health-card','.master-quick-card','.master-support-ticket','.master-gateway-card','.master-security-status-box>div','.master-authenticator-option','.master-mfa-secret-box']){
    assert.match(css,new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'[\\s\\S]*?background:linear-gradient\\(145deg,#12151a,#0d1014\\)!important'));
  }
});

test('Supermaster usa largura restante e mantém sair visível no mobile',()=>{
  assert.match(css,/@media\(min-width:1181px\)\{[\s\S]*?\.master-sidebar-v2\{width:236px!important\}[\s\S]*?\.master-main-v2\{[\s\S]*?margin-left:236px!important/);
  assert.match(css,/@media\(max-width:760px\)\{[\s\S]*?\.master-sidebar-bottom-v2 \.master-logout-v2\{display:flex!important;visibility:visible!important;opacity:1!important\}/);
});
