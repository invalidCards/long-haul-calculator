import assert from 'node:assert/strict'
import test from 'node:test'
import edition from '../data/active-edition.js'
import { makeBackup, parseBackup, storageKeyFor, validateTracker } from './session.js'

const tracker = {
  listNumber: 1,
  events: [{ id: 'route-1', type: 'route', time: '09:00', from: 'ut', to: 'amf', trainType: 'Intercity', note: '' }],
}

test('validates and round-trips a backup for the active edition', () => {
  const backup = makeBackup(tracker, edition)
  assert.deepEqual(parseBackup(backup, edition), tracker)
  assert.equal(storageKeyFor(edition.id), 'long-haul-calculator:2026-08:v1')
})

test('rejects malformed records and records from another edition', () => {
  assert.equal(validateTracker({ listNumber: 1, events: [{ type: 'route' }] }, edition), null)
  assert.throws(() => parseBackup({ schemaVersion: 1, editionId: '2027-01', tracker }, edition), /not 2026-08/)
  assert.throws(() => parseBackup({ schemaVersion: 99, editionId: edition.id, tracker }, edition), /unsupported format/)
})

test('rejects challenge records whose IDs do not exist in the active data', () => {
  assert.equal(validateTracker({ listNumber: 1, events: [{ id: 'challenge-1', type: 'challenge', time: '09:00', challengeId: 'missing', scoreId: 'first', points: 1 }] }, edition), null)
  const challenge = edition.challenges[0]
  assert.equal(validateTracker({ listNumber: 1, events: [{ id: 'challenge-2', type: 'challenge', time: '09:00', challengeId: challenge.id, scoreId: challenge.scores[0].id, points: 1 }] }, edition), null)
})
