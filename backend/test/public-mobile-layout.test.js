const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'frontend/publico.html'),'utf8');
const css=fs.readFileSync(path.join(root,'frontend/style.css'),'utf8');
const js=fs.readFileSync(path.join(root,'frontend/js/publico.js'),'utf8');

test('página pública usa viewport seguro e assets versionados',()=>{
  assert.match(html,/viewport-fit=cover/);
  assert.match(html,/\?v=20260826-[A-Za-z0-9_-]+/);
});

test('formulário público mobile usa campos grandes e sem zoom de input',()=>{
  assert.match(css,/\.public-bg \.field input,\.public-bg \.field select\{[^}]*min-height:52px[^}]*font-size:16px/s);
  assert.match(css,/\.public-book-cta\{[^}]*position:static[^}]*min-height:54px/s);
});

test('layout público mobile evita overflow e respeita safe area',()=>{
  assert.match(css,/body\.public-bg\{[^}]*overflow-x:hidden/s);
  assert.match(css,/env\(safe-area-inset-bottom\)/);
  assert.match(css,/\.public-manage-actions\{display:grid/s);
});

test('data mínima pública usa data local em vez de UTC',()=>{
  assert.match(js,/const localToday=/);
  assert.doesNotMatch(js,/data\.min=new Date\(\)\.toISOString\(\)\.slice\(0,10\)/);
});
