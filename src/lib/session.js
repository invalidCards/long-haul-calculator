export const SESSION_SCHEMA_VERSION = 1

export const storageKeyFor = (editionId) => `long-haul-calculator:${editionId}:v${SESSION_SCHEMA_VERSION}`
export const initialTracker = () => ({ listNumber: 1, events: [] })
export const eventTime = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const isTime = (value) => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
const isText = (value, maximum = 1000) => typeof value === 'string' && value.length <= maximum

function validEvent(event, edition) {
  if (!isObject(event) || !isText(event.id, 160) || !isTime(event.time)) return false
  if (event.type === 'route') return isText(event.from, 100) && isText(event.to, 100) && isText(event.trainType, 100) && (event.note === undefined || isText(event.note))
  if (event.type === 'challenge') {
    const challenge = edition.challenges.find((item) => item.id === event.challengeId)
    const score = challenge?.scores.find((item) => item.id === event.scoreId)
    return Boolean(score) && event.points === score.points
  }
  if (event.type === 'adjustment') return isText(event.label) && Number.isFinite(event.points) && (event.note === undefined || isText(event.note))
  return event.type === 'station-swap' && Number.isInteger(event.provinceIndex) && isText(event.stationType, 100) && isText(event.backupStation, 200) && (event.backupType === undefined || isText(event.backupType, 100))
}

export function validateTracker(tracker, edition) {
  if (!isObject(tracker) || !Number.isInteger(tracker.listNumber) || !edition.stationLists.lists[tracker.listNumber] || !Array.isArray(tracker.events)) return null
  if (!tracker.events.every((event) => validEvent(event, edition))) return null
  return { listNumber: tracker.listNumber, events: tracker.events }
}

export function makeBackup(tracker, edition) {
  return { schemaVersion: SESSION_SCHEMA_VERSION, editionId: edition.id, exportedAt: new Date().toISOString(), tracker }
}

export function parseBackup(value, edition) {
  if (!isObject(value) || value.schemaVersion !== SESSION_SCHEMA_VERSION) throw new Error('This backup uses an unsupported format.')
  if (value.editionId !== edition.id) throw new Error(`This backup is for ${value.editionId ?? 'another edition'}, not ${edition.id}.`)
  const tracker = validateTracker(value.tracker, edition)
  if (!tracker) throw new Error('This backup contains invalid calculator data.')
  return tracker
}
