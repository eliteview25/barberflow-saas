const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const app=fs.readFileSync(path.join(__dirname,'..','src','app.js'),'utf8');
const publico=fs.readFileSync(path.join(__dirname,'..','src','routes','publico.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'..','..','frontend','publico.html'),'utf8');
const js=fs.readFileSync(path.join(__dirname,'..','..','frontend','js','publico.js'),'utf8');

test('código seguro público tem formato restrito e rate limit dedicado',()=>{
  assert.match(publico,/\^\[A-Za-z0-9_-\]\{32,200\}\$/);
  assert.match(app,/PUBLIC_TOKEN_ATTEMPTS_PER_15_MIN/);
  assert.match(app,/\/api\/publico\/:slug\/agendamentos',publicTokenLimit/);
  assert.match(app,/\/api\/publico\/:slug\/reservas',publicTokenLimit/);
});

test('código seguro fica mascarado na interface pública',()=>{
  assert.match(html,/id="manageToken" type="password"/);
  assert.match(js,/function maskManageToken/);
  assert.doesNotMatch(js,/Guarde seu código seguro: \$\{d\.agendamento\.token\}/);
});

test('campos públicos têm limites de servidor',()=>{
  assert.match(publico,/cleanText\(req\.body\.nome,120/);
  assert.match(publico,/email\.length>160/);
  assert.match(publico,/\^\[0-9\]\{6\}\$/);
  assert.match(publico,/tentativas\|\|0\)>=5/);
  assert.match(publico,/cleanText\(req\.body\.comentario,1000\)/);
});
