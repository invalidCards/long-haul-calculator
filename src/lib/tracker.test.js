import assert from 'node:assert/strict'
import test from 'node:test'
import { backupFor, buildNetwork, calculateTracker, findRoute } from './tracker.js'

const network = buildNetwork({
  stations: { a: 'Alpha', b: 'Bravo', c: 'Charlie', s: 'Sprinter Stop', x: 'Elsewhere' },
  routes: [
    { fromStation: 'a', toStation: 'b', distance: 10 }, { fromStation: 'b', toStation: 'a', distance: 10 },
    { fromStation: 'b', toStation: 'c', distance: 15 }, { fromStation: 'c', toStation: 'b', distance: 15 },
    { fromStation: 'a', toStation: 'c', distance: 40 }, { fromStation: 'c', toStation: 'a', distance: 40 },
  ],
})
const edition = {
  stationClaimMultiplier: 0.25,
  stationLists: {
    aliases: {},
    backups: { Intercity: ['Charlie', null], Sprinter: ['Sprinter Stop', null] },
  },
}
const event = (type, fields, time = '09:00') => ({ id: crypto.randomUUID(), type, time, ...fields })

test('finds the shortest route across the graph', () => {
  assert.deepEqual(findRoute(network, 'a', 'c'), {
    stations: ['a', 'b', 'c'],
    edges: [{ fromStation: 'a', toStation: 'b', distance: 10 }, { fromStation: 'b', toStation: 'c', distance: 15 }],
    distance: 25,
  })
})

test('does not score an already-used track until a station claim resets it', () => {
  const list = [{ name: 'Elsewhere', type: 'Intercity' }]
  const result = calculateTracker([
    event('route', { from: 'a', to: 'b', trainType: 'Intercity' }),
    event('route', { from: 'b', to: 'a', trainType: 'Intercity' }, '09:01'),
  ], list, network, edition)
  assert.equal(result.travelPoints, 10)

  const withClaim = calculateTracker([
    event('route', { from: 'a', to: 'b', trainType: 'Intercity' }),
    event('route', { from: 'b', to: 'a', trainType: 'Intercity' }, '09:01'),
  ], [{ name: 'Bravo', type: 'Intercity' }], network, edition)
  assert.equal(withClaim.travelPoints, 20)
  assert.equal(withClaim.multiplier, 1.25)
})

test('requires a Sprinter to claim a Sprinter slot', () => {
  const list = [{ name: 'Bravo', type: 'Sprinter' }]
  const result = calculateTracker([event('route', { from: 'a', to: 'b', trainType: 'Intercity' })], list, network, edition)
  assert.equal(result.claimedSlots.size, 0)
  assert.equal(result.multiplier, 1)
})

test('applies a backup before later events according to event time', () => {
  const list = [{ name: 'Alpha', type: 'Intercity' }]
  const result = calculateTracker([
    event('route', { from: 'a', to: 'c', trainType: 'Intercity' }, '10:00'),
    event('station-swap', { provinceIndex: 0, stationType: 'Intercity', backupStation: 'Charlie', backupType: 'Intercity' }, '09:00'),
  ], list, network, edition)
  assert.equal(result.claimedSlots.get(0), 'Charlie')
  assert.equal(result.multiplier, 1.25)
})

test('keeps adjustments and surfaces disconnected routes', () => {
  const result = calculateTracker([
    event('adjustment', { label: 'Penalty', points: -50 }),
    event('route', { from: 'a', to: 'x', trainType: 'Intercity' }, '09:01'),
  ], [{ name: 'Elsewhere', type: 'Intercity' }], network, edition)
  assert.equal(result.adjustmentPoints, -50)
  assert.equal(result.timeline[1].error, 'No route found in the trainkms graph.')
})

test('returns typed backups and respects unavailable positions', () => {
  assert.deepEqual(backupFor({ type: 'Intercity' }, 0, edition.stationLists), { name: 'Charlie', type: 'Intercity' })
  assert.equal(backupFor({ type: 'Sprinter' }, 1, edition.stationLists), null)
})
