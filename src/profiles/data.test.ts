import assert from 'node:assert/strict';
import test from 'node:test';
import type { WidgetInstance } from '../types/layout.ts';
import {
  addPrivateWidget,
  createProfileAccount,
  emptyProfileDatabase,
  readProfileSecret,
  unlockProfile,
  writeProfileSecret,
} from './data.ts';
import { isPrivateApp } from './privateApps.ts';

function widget(id: string, type: string): WidgetInstance {
  return { id, type, x: 0, y: 0, w: 6, h: 6, page: 'home', settings: {} };
}

test('two profiles keep private apps and credentials apart', async () => {
  let db = emptyProfileDatabase();
  const casey = await createProfileAccount(db, 'Casey', 'alpha-secret', 'profile_a');
  db = casey.db;
  const sam = await createProfileAccount(db, 'Sam', 'beta-secret', 'profile_b');
  db = sam.db;
  db = addPrivateWidget(db, casey.account.id, widget('w_drive', 'drive'));
  db = await writeProfileSecret(db, casey.account.id, casey.key, 'drive', 'drive-pass-a');

  assert.deepEqual(db.widgets[sam.account.id], []);
  assert.equal(db.widgets[casey.account.id]?.[0]?.type, 'drive');
  assert.equal(JSON.stringify(db.secrets).includes('drive-pass-a'), false);
  assert.equal(JSON.stringify(db).includes('alpha-secret'), false);

  const samOpen = await unlockProfile(db, 'Sam', 'beta-secret');
  assert.equal(await readProfileSecret(db, sam.account.id, samOpen.key, 'drive'), '');
  await assert.rejects(() => readProfileSecret(db, casey.account.id, samOpen.key, 'drive'));

  const caseyOpen = await unlockProfile(db, 'Casey', 'alpha-secret');
  assert.equal(await readProfileSecret(db, casey.account.id, caseyOpen.key, 'drive'), 'drive-pass-a');
  await assert.rejects(() => unlockProfile(db, 'Casey', 'beta-secret'), /Wrong name or password/);
});

test('a public app cannot be stored on a profile', async () => {
  assert.equal(isPrivateApp('files'), false);
  assert.equal(isPrivateApp('game'), false);
  assert.equal(isPrivateApp('drive'), true);
  assert.equal(isPrivateApp('gmail'), true);
  const created = await createProfileAccount(emptyProfileDatabase(), 'Casey', 'alpha-secret', 'profile_a');
  assert.throws(() => addPrivateWidget(created.db, created.account.id, widget('w_files', 'files')), /private app/);
  await assert.rejects(
    () => writeProfileSecret(created.db, created.account.id, created.key, 'files', 'secret'),
    /private app/,
  );
});
