const test=require('node:test');
const assert=require('node:assert/strict');
const {intId,hhmm,finiteMoney,finiteQty,finitePercent,safeColor,safeHttpUrl,safeCsvCell}=require('../src/utils/validation');

test('IDs aceitam apenas inteiros positivos seguros',()=>{assert.equal(intId('12'),12);assert.equal(intId('0'),null);assert.equal(intId('-1'),null);assert.equal(intId('1.2'),null)});
test('horários são normalizados e validados',()=>{assert.equal(hhmm('08:30'),'08:30:00');assert.equal(hhmm('23:59:00'),'23:59:00');assert.equal(hhmm('24:00'),null)});
test('valores financeiros rejeitam NaN e negativos',()=>{assert.equal(finiteMoney('10.25'),10.25);assert.equal(finiteMoney(-1),null);assert.equal(finiteQty(2),2);assert.equal(finiteQty(0),null);assert.equal(finitePercent(50),50);assert.equal(finitePercent(101),null)});
test('cores e URLs públicas têm allowlist',()=>{assert.equal(safeColor('#aabbcc'),'#aabbcc');assert.equal(safeColor('javascript:alert(1)','#000000'),'#000000');assert.equal(safeHttpUrl('https://example.com/a.png'),'https://example.com/a.png');assert.equal(safeHttpUrl('javascript:alert(1)'),false)});
test('CSV neutraliza fórmulas',()=>{assert.equal(safeCsvCell('=1+1'),"'=1+1");assert.equal(safeCsvCell('+SUM(A1:A2)'),"'+SUM(A1:A2)");assert.equal(safeCsvCell('texto'),'texto')});
