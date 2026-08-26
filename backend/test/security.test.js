const test=require('node:test');
const assert=require('node:assert/strict');
process.env.APP_SECRETS_ENCRYPTION_KEY='unit-test-secret-that-is-long-enough-for-booking-otp-tests-123';
const {strongPassword,timingSafeText,otpHash,normalizePhone}=require('../src/utils/security');

test('senhas fortes exigem variedade e tamanho',()=>{assert.equal(strongPassword('Abcd1234!xyz'),true);assert.equal(strongPassword('abcdefghijklm'),false);assert.equal(strongPassword('Abc123!'),false)});
test('comparação constante distingue conteúdo',()=>{assert.equal(timingSafeText('abc','abc'),true);assert.equal(timingSafeText('abc','abd'),false);assert.equal(timingSafeText('abc','abcd'),false)});
test('OTP usa HMAC com pepper e não SHA simples',()=>{const a=otpHash('123456'),b=otpHash('123456'),c=otpHash('654321');assert.equal(a,b);assert.notEqual(a,c);assert.match(a,/^[a-f0-9]{64}$/)});
test('telefone é normalizado sem aceitar mais que 15 dígitos',()=>{assert.equal(normalizePhone('+55 (86) 99999-9999'),'5586999999999');assert.equal(normalizePhone('12345678901234567890'),'678901234567890')});
