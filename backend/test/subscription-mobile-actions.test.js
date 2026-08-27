const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const frontend=path.resolve(__dirname,'../../frontend');

test('ações de assinatura ficam lado a lado no mobile',()=>{
  const html=fs.readFileSync(path.join(frontend,'pages/assinatura.html'),'utf8');
  const css=fs.readFileSync(path.join(frontend,'style.css'),'utf8');
  const js=fs.readFileSync(path.join(frontend,'js/assinatura.js'),'utf8');
  assert.match(html,/id=\"acoes\" class=\"subscription-actions\"/);
  assert.match(css,/@media\(max-width:760px\)[\s\S]*?\.subscription-actions\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/\.subscription-actions \.btn:only-child\{grid-column:1\/-1\}/);
  assert.match(js,/Continuar pagamento/);
  assert.match(js,/Cancelar assinatura/);
});
