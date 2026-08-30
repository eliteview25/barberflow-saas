const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'../..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('loja saiu da navegação e produtos viraram módulo operacional',()=>{const c=read('frontend/js/common.js');assert.doesNotMatch(c,/lojaGroupHtml|loja-config|loja-pedidos/);assert.match(c,/gestao-produtos/);assert.match(c,/Produtos & Estoque/);assert.match(c,/Vendas \/ PDV/);assert.match(c,/Histórico de vendas/)});
test('vitrine online fica desativada por padrão mas preservada para futuro',()=>{const a=read('backend/src/app.js'),s=read('backend/src/services/storeCommerce.js');assert.match(a,/ENABLE_PUBLIC_STORE/);assert.match(s,/ENABLE_PUBLIC_STORE/)});
