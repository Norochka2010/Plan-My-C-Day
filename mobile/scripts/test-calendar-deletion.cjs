const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/c-day-calendar.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const request = { actionId: 'action-one', title: 'Plan', startsAt: '2026-11-10T12:00:00Z', timeZone: 'UTC', nativeEventId: null };
const marker = 'Plan My C-Day reference: action-one';
function setup({ link = null, available = true, permission = true, error, notes = marker, matches = [] } = {}) {
 let stored = link && JSON.stringify(link), deleted = [], permissionCalls = 0;
 const calendar = {
  requestCalendarPermissionsAsync: async () => { permissionCalls++; return { granted: permission }; },
  getEventAsync: async () => { if (error) throw error; return { notes }; },
  deleteEventAsync: async id => { deleted.push(id); },
  getCalendarsAsync: async () => [{ id: 'calendar', allowsModifications: true }],
  getEventsAsync: async () => matches,
  EntityTypes: { EVENT: 'event' },
 };
 const exports = {};
 vm.runInNewContext(source, { exports, require: name => {
  if (name === '@react-native-async-storage/async-storage') return { __esModule: true, default: { getItem: async () => stored, removeItem: async () => { stored = null; } } };
  if (name === 'react-native') return { Platform: { OS: 'ios' } };
  if (name === 'expo-modules-core') return { requireOptionalNativeModule: () => available ? {} : null };
  if (name === 'expo-calendar/legacy') return calendar;
  throw Error(name);
 }});
 return { service: exports.cDayCalendar, deleted, stored: () => stored, permissions: () => permissionCalls };
}
const link = { id: 'native-one', calendarId: 'calendar', startsAt: request.startsAt };
test('unsynced drafts delete without a native module or calendar permission', async () => {
 const h = setup({ available: false });
 assert.equal((await h.service.remove(request)).status, 'not_requested');
 assert.equal(h.permissions(), 0);
});
test('remote device identifiers never authorize a local deletion', async () => {
 const h = setup();
 assert.equal((await h.service.remove({ ...request, nativeEventId: 'other-phone-id' })).status, 'not_requested');
 assert.equal(h.permissions(), 0); assert.equal(h.deleted.length, 0);
});
test('owned entries delete and repeated cleanup succeeds', async () => {
 const h = setup({ link });
 assert.equal((await h.service.remove(request)).status, 'not_requested');
 assert.equal((await h.service.remove(request)).status, 'not_requested');
 assert.deepEqual(h.deleted, ['native-one']); assert.equal(h.stored(), null);
});
test('already-deleted entries clear stale links', async () => {
 const h = setup({ link, error: { code: 'ERR_EVENT_NOT_FOUND' } });
 assert.equal((await h.service.remove(request)).status, 'not_requested');
 assert.equal(h.stored(), null);
});
test('permission denial and unrelated errors retain retry links', async () => {
 for (const options of [{ permission: false }, { error: { code: 'ERR_CALENDAR_UNAVAILABLE' } }]) {
  const h = setup({ link, ...options });
  assert.notEqual((await h.service.remove(request)).status, 'not_requested');
  assert.ok(h.stored()); assert.equal(h.deleted.length, 0);
 }
});
test('ownership mismatch never deletes another event', async () => {
 const h = setup({ link, notes: 'Personal event' });
 assert.equal((await h.service.remove(request)).status, 'failed');
 assert.ok(h.stored()); assert.equal(h.deleted.length, 0);
});
test('interrupted creation recovers only the matching marked event', async () => {
 const h = setup({ link: { calendarId: 'calendar', startsAt: request.startsAt }, matches: [{ id: 'unrelated', notes: 'Personal' }, { id: 'recovered', notes: marker }] });
 assert.equal((await h.service.remove(request)).status, 'not_requested');
 assert.deepEqual(h.deleted, ['recovered']); assert.equal(h.stored(), null);
});
