const test=require('node:test');const assert=require('node:assert/strict');
const {horaParaMinutos,minutosParaHora}=require('../src/utils/time');
test('converte horário em minutos',()=>{assert.equal(horaParaMinutos('08:30:00'),510);assert.equal(horaParaMinutos('00:00'),0)});
test('converte minutos em horário',()=>{assert.equal(minutosParaHora(510),'08:30:00');assert.equal(minutosParaHora(0),'00:00:00')});
