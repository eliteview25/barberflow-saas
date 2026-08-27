const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..','..');
function read(rel){return fs.readFileSync(path.join(root,rel),'utf8')}
test('migração libera contas antigas presas em trial_pendente',()=>{const m=read('backend/migrar-banco.js');assert.match(m,/status='trial_pendente'/);assert.match(m,/SET email_verificado=true/);assert.match(m,/CURRENT_DATE\+INTERVAL '7 days'/)});
test('páginas protegidas não ficam invisíveis quando uma API falha',()=>{const c=read('frontend/js/common.js');assert.match(c,/function requireAuth[\s\S]*mostrarPaginaProtegida\(\)/)});
test('assets do painel revalidam após deploy em vez de cachear por uma hora',()=>{const a=read('backend/src/app.js');assert.match(a,/express\.static\(frontend,\{maxAge:0,etag:true\}\)/)});
