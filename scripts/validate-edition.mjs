import edition from '../src/data/active-edition.js'
import network from '../src/data/trainkms-snapshot.json' with { type: 'json' }

const fail = (message) => { throw new Error(`Edition validation failed: ${message}`) }
const stationNames = new Set(Object.values(network.stations))
const aliases = edition.stationLists.aliases
const sourceName = (name) => aliases[name] ?? name
const lists = Object.entries(edition.stationLists.lists)

if (!edition.id || !edition.name || !Number.isFinite(edition.stationClaimMultiplier)) fail('edition metadata is incomplete')
if (!Array.isArray(edition.stationLists.regions) || edition.stationLists.regions.length === 0) fail('regions are missing')
if (lists.length === 0) fail('no station lists are configured')
for (const [listNumber, stations] of lists) {
  if (!Array.isArray(stations) || stations.length !== edition.stationLists.regions.length) fail(`list ${listNumber} does not match the region count`)
  for (const station of stations) {
    if (!['Intercity', 'Sprinter'].includes(station.type)) fail(`${station.name} has an unknown train type`)
    if (!stationNames.has(sourceName(station.name))) fail(`${station.name} is not present in the trainkms graph`)
  }
}
for (const [type, backups] of Object.entries(edition.stationLists.backups)) {
  if (!Array.isArray(backups) || backups.length !== edition.stationLists.regions.length) fail(`${type} backups do not match the region count`)
  for (const backup of backups) {
    if (!backup) continue
    const station = typeof backup === 'string' ? { name: backup, type } : backup
    if (!['Intercity', 'Sprinter'].includes(station.type)) fail(`${station.name} backup has an unknown train type`)
    if (!stationNames.has(sourceName(station.name))) fail(`${station.name} backup is not present in the trainkms graph`)
  }
}
const challengeIds = new Set()
for (const challenge of edition.challenges) {
  if (!challenge.id || challengeIds.has(challenge.id) || !challenge.name || !challenge.description) fail('challenge IDs and metadata must be unique and complete')
  challengeIds.add(challenge.id)
  const scoreIds = new Set()
  for (const score of challenge.scores ?? []) {
    if (!score.id || scoreIds.has(score.id) || !score.label || !Number.isFinite(score.points)) fail(`${challenge.id} has an invalid score`)
    scoreIds.add(score.id)
  }
}
if (!network.source || !/^[0-9a-f]{40}$/.test(network.snapshotCommit ?? '')) fail('trainkms provenance is missing')
console.log(`Validated ${edition.id}: ${lists.length} station lists, ${edition.challenges.length} challenges, ${Object.keys(network.stations).length} stations.`)
