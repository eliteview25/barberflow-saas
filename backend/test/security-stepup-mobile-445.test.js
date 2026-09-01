const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('step-up separa corpo rolavel e rodape de acoes',()=>{
  const js=read('frontend/js/common.js');
  assert.match(js,/class="security-challenge-body"/);
  assert.match(js,/class="security-challenge-actions"/);
  assert.ok(js.indexOf('security-challenge-body')<js.indexOf('security-challenge-actions'));
});

test('rodape do step-up nao fica dentro da rolagem no mobile',()=>{
  const css=read('frontend/style.css');
  assert.match(css,/\.security-challenge-card form\{[\s\S]*overflow:hidden!important/);
  assert.match(css,/\.security-challenge-body\{[\s\S]*overflow-y:auto/);
  assert.match(css,/\.security-challenge-actions\{[\s\S]*position:relative!important;[\s\S]*pointer-events:auto!important/);
  assert.match(css,/#bfSecurityConfirm\{position:relative!important;z-index:13!important\}/);
});

test('step-up acompanha viewport visual quando teclado mobile abre',()=>{
  const js=read('frontend/js/common.js');
  assert.match(js,/window\.visualViewport/);
  assert.match(js,/--bf-security-height/);
  assert.match(js,/addEventListener\('resize',fitSecurityViewport\)/);
  assert.match(js,/removeEventListener\('resize',fitSecurityViewport\)/);
});

test('cache de common e css foi renovado para 4.4.6 no dashboard',()=>{
  const html=read('frontend/index.html');
  assert.match(html,/style\.css\?v=20260901-v446/);
  assert.match(html,/common\.js\?v=20260901-v446/);
});
