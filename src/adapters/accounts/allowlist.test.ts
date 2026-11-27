import assert from 'node:assert/strict';
import test from 'node:test';
import { assertOwnerEmail, assertPassword, OWNER_EMAIL } from './allowlist.ts';

test('only the owner email is accepted', () => {
  assert.equal(assertOwnerEmail('  CaseyLSims@gmail.com '), OWNER_EMAIL);
  assert.throws(() => assertOwnerEmail('someone@gmail.com'), /limited to caseylsims@gmail.com/);
  assert.throws(() => assertOwnerEmail('caseylsims+test@gmail.com'), /limited to caseylsims@gmail.com/);
  assert.throws(() => assertOwnerEmail(''), /limited to caseylsims@gmail.com/);
});

test('passwords need 8 characters', () => {
  assert.equal(assertPassword('12345678'), '12345678');
  assert.throws(() => assertPassword('short'), /at least 8/);
  assert.throws(() => assertPassword('x'.repeat(201)), /at least 8/);
});
