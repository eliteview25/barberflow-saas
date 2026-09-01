const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..','..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('tema oferece claro, escuro e sistema com persistência e mídia do dispositivo',()=>{
  const js=read('frontend/js/theme.js');
  assert.match(js,/bf_theme_preference/);
  assert.match(js,/\['light','dark','system'\]/);
  assert.match(js,/prefers-color-scheme:\s*dark/);
  assert.match(js,/localStorage\.setItem/);
  assert.match(js,/media\.addEventListener\('change'/);
  assert.match(js,/data-bf-theme-select/);
});

test('tema é carregado antes do CSS em todas as telas administrativas e de acesso',()=>{
  const files=[
    'frontend/index.html','frontend/master.html','frontend/login.html','frontend/cadastro.html',
    'frontend/recuperar-senha.html','frontend/redefinir-senha.html','frontend/verificar-email.html',
    'frontend/pages/agendamentos.html','frontend/pages/clientes.html','frontend/pages/barbeiros.html',
    'frontend/pages/servicos.html','frontend/pages/configuracoes.html','frontend/pages/financeiro.html',
    'frontend/pages/automacoes.html','frontend/pages/pagamentos.html','frontend/pages/gestao.html',
    'frontend/pages/marketing.html','frontend/pages/equipe.html','frontend/pages/assinatura.html',
    'frontend/pages/suporte.html','frontend/pages/loja.html'
  ];
  for(const file of files){
    const html=read(file);
    const theme=html.indexOf('/js/theme.js?v=20260901-v453');
    const css=html.indexOf('/style.css?v=20260901-v454');
    assert.ok(theme>=0,`${file} precisa carregar theme.js`);
    assert.ok(css>theme,`${file} precisa aplicar o tema antes do CSS`);
  }
});

test('CSS contém camadas clara e escura e tipografia responsiva',()=>{
  const css=read('frontend/style.css');
  assert.match(css,/html\[data-bf-theme="light"\]/);
  assert.match(css,/html\[data-bf-theme="dark"\]/);
  assert.match(css,/\.bf-theme-control-sidebar/);
  assert.match(css,/\.bf-theme-control-floating/);
  assert.match(css,/@media\(min-width:761px\)[\s\S]*font-size:30px!important/);
  assert.match(css,/@media\(max-width:760px\)[\s\S]*font-size:16px!important/);
  assert.match(css,/@media\(max-width:380px\)/);
});

test('tema administrativo não substitui a identidade da página pública e da loja',()=>{
  assert.doesNotMatch(read('frontend/publico.html'),/\/js\/theme\.js/);
  assert.doesNotMatch(read('frontend/loja.html'),/\/js\/theme\.js/);
});
