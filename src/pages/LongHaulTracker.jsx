import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '@iconify/react'
import download from '@iconify-icons/mdi/download'
import pencilOutline from '@iconify-icons/mdi/pencil-outline'
import timelineCheck from '@iconify-icons/mdi/timeline-check'
import train from '@iconify-icons/mdi/train'
import trophyOutline from '@iconify-icons/mdi/trophy-outline'
import upload from '@iconify-icons/mdi/upload'
import Modal from '../components/Modal.jsx'
import AutocompleteInput from '../components/AutocompleteInput.jsx'
import edition from '../data/active-edition.js'
import trainkmsSnapshot from '../data/trainkms-snapshot.json'
import { eventTime, initialTracker, makeBackup, parseBackup, storageKeyFor, validateTracker } from '../lib/session.js'
import { backupFor, buildNetwork, calculateTracker, resolveStationCode, stationListFor } from '../lib/tracker.js'

const formatPoints = (points) => `${new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 }).format(points)} pts`
const formatKm = (hectometres) => `${(hectometres / 10).toLocaleString('en-GB', { maximumFractionDigits: 1 })} km`

function loadStoredState() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKeyFor(edition.id)))
    return validateTracker(saved, edition) ?? initialTracker()
  } catch {
    return initialTracker()
  }
}

function downloadBackup(tracker) {
  const blob = new Blob([`${JSON.stringify(makeBackup(tracker, edition), null, 2)}\n`], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `long-haul-${edition.id}-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
}

export default function LongHaulTracker() {
  const [tracker, setTracker] = useState(loadStoredState)
  const [notice, setNotice] = useState('')
  const [routeForm, setRouteForm] = useState({ from: edition.startingStation, to: '', trainType: 'Intercity', note: '' })
  const [challengeForm, setChallengeForm] = useState({ challengeId: edition.challenges[0].id, scoreId: edition.challenges[0].scores[0].id })
  const [adjustmentForm, setAdjustmentForm] = useState({ label: 'Guessing game', points: '', note: '' })
  const [editingEventId, setEditingEventId] = useState(null)
  const [editingTime, setEditingTime] = useState('')
  const [challengeHelpOpen, setChallengeHelpOpen] = useState(false)
  const [confirmation, setConfirmation] = useState(null)
  const importInput = useRef(null)
  const network = useMemo(() => buildNetwork(trainkmsSnapshot), [])
  const baseList = stationListFor(edition, tracker.listNumber)
  const calculation = useMemo(() => calculateTracker(tracker.events, baseList, network, edition), [baseList, network, tracker.events])
  const challengeById = useMemo(() => new Map(edition.challenges.map((challenge) => [challenge.id, challenge])), [])
  const selectedChallenge = challengeById.get(challengeForm.challengeId) ?? edition.challenges[0]
  const selectedScore = selectedChallenge.scores.find((score) => score.id === challengeForm.scoreId) ?? selectedChallenge.scores[0]

  useEffect(() => {
    window.localStorage.setItem(storageKeyFor(edition.id), JSON.stringify(tracker))
  }, [tracker])

  const addEvent = (event) => setTracker((current) => ({ ...current, events: [...current.events, { ...event, time: eventTime(), id: crypto.randomUUID() }] }))
  const stationCode = (name) => resolveStationCode(network, edition.stationLists, name)
  const eventChallengeName = (event) => {
    const challenge = challengeById.get(event.challengeId)
    const score = challenge?.scores.find((item) => item.id === event.scoreId)
    return challenge && score ? `${challenge.name} — ${score.label}` : 'Unknown challenge score'
  }

  const addRoute = (event) => {
    event.preventDefault()
    const from = stationCode(routeForm.from)
    const to = stationCode(routeForm.to)
    if (!from || !to) {
      setNotice('Choose stations from the suggestions so their distance can be calculated.')
      return
    }
    addEvent({ type: 'route', from, to, trainType: routeForm.trainType, note: routeForm.note.trim() })
    setRouteForm({ from: routeForm.to, to: '', trainType: routeForm.trainType, note: '' })
    setNotice('')
  }

  const addChallenge = (event) => {
    event.preventDefault()
    addEvent({ type: 'challenge', challengeId: selectedChallenge.id, scoreId: selectedScore.id, points: selectedScore.points })
  }

  const addAdjustment = (event) => {
    event.preventDefault()
    const points = Number(adjustmentForm.points)
    if (!Number.isFinite(points)) return
    addEvent({ type: 'adjustment', label: adjustmentForm.label.trim() || 'Score adjustment', points, note: adjustmentForm.note.trim() })
    setAdjustmentForm((current) => ({ ...current, points: '', note: '' }))
  }

  const addStationSwap = (station) => {
    const backup = backupFor(station, station.index, edition.stationLists)
    if (backup) setConfirmation({ kind: 'swap', station, backup })
  }

  const confirmAction = () => {
    if (!confirmation) return
    if (confirmation.kind === 'swap') {
      addEvent({ type: 'station-swap', provinceIndex: confirmation.station.index, stationType: confirmation.station.type, backupStation: confirmation.backup.name, backupType: confirmation.backup.type })
    } else if (confirmation.kind === 'remove') {
      setTracker((current) => ({ ...current, events: current.events.filter((item) => item.id !== confirmation.event.id) }))
    } else if (confirmation.kind === 'clear') {
      setTracker((current) => ({ ...current, events: [] }))
    } else if (confirmation.kind === 'import') {
      setTracker(confirmation.tracker)
      setNotice('Backup imported. This browser now holds the restored score record.')
    }
    setConfirmation(null)
  }

  const saveEventTime = () => {
    if (!editingEventId || !editingTime) return
    setTracker((current) => ({ ...current, events: current.events.map((event) => event.id === editingEventId ? { ...event, time: editingTime } : event) }))
    setEditingEventId(null)
    setEditingTime('')
  }

  const importBackup = async (event) => {
    const [file] = event.target.files ?? []
    event.target.value = ''
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text())
      setConfirmation({ kind: 'import', tracker: parseBackup(parsed, edition) })
      setNotice('')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not read this backup file.')
    }
  }

  const renderTimelineEvent = (event) => <li key={event.id} className={`timeline-item timeline-item--${event.type}`}>
    {editingEventId === event.id ? <div className="timeline-time-editor"><input autoFocus type="time" value={editingTime} onChange={(item) => setEditingTime(item.target.value)} /><button type="button" onClick={saveEventTime}>Save</button><button type="button" onClick={() => { setEditingEventId(null); setEditingTime('') }}>Cancel</button></div> : <time>{event.time}</time>}
    <div className="timeline-body">
      {event.type === 'route' ? <><div><strong>{network.stations[event.from]} → {network.stations[event.to]}</strong><span className="timeline-meta"> · {event.trainType}{event.note ? ` · ${event.note}` : ''}</span></div>{event.error ? <p>{event.error}</p> : <p>{formatKm(event.route.distance)} travelled · <b>{formatKm(event.earned)} scored</b>{event.resets.length ? ` · reset at ${event.resets.join(', ')}` : ''}</p>}</> : null}
      {event.type === 'station-swap' ? <><div><strong>Station backup activated</strong><span className="timeline-meta"> · {edition.stationLists.regions[event.provinceIndex]} · {event.stationType}{event.backupType !== event.stationType ? ` → ${event.backupType}` : ''}</span></div><p>{event.previousStation} → <b>{event.backupStation}</b></p></> : null}
      {event.type === 'challenge' ? <><div><strong>{eventChallengeName(event)}</strong></div><p>+{formatPoints(event.points)}</p></> : null}
      {event.type === 'adjustment' ? <><div><strong>{event.label}</strong>{event.note && <span className="timeline-meta"> · {event.note}</span>}</div><p className={event.points < 0 ? 'negative-points' : ''}>{event.points > 0 ? '+' : ''}{formatPoints(event.points)}</p></> : null}
    </div>
    <div className="timeline-actions"><button className="timeline-edit" type="button" aria-label="Edit event time" onClick={() => { setEditingEventId(event.id); setEditingTime(event.time) }}><Icon icon={pencilOutline} /></button><button className="timeline-remove" type="button" aria-label="Remove timeline item" onClick={() => setConfirmation({ kind: 'remove', event })}>×</button></div>
  </li>

  return <main className="long-haul">
    <header className="long-haul-header">
      <div className="long-haul-title"><span className="long-haul-mark"><Icon icon={train} /></span><div><p className="eyebrow">{edition.officialLabel} · {edition.editionLabel}</p><h1>{edition.name}</h1></div></div>
      <p>{edition.intro}</p>
      <div className="backup-controls"><span>Your records stay in this browser.</span><button type="button" onClick={() => downloadBackup(tracker)}><Icon icon={download} /> Export backup</button><button type="button" onClick={() => importInput.current?.click()}><Icon icon={upload} /> Import backup</button><input ref={importInput} className="sr-only" type="file" accept="application/json,.json" onChange={importBackup} /></div>
    </header>
    {notice && <div className="notice" role="alert">{notice}</div>}
    <section className="long-haul-scoreboard"><div><span>Projected score</span><strong>{formatPoints(calculation.finalScore)}</strong><small>({formatPoints(calculation.basePoints)} × {calculation.multiplier.toFixed(2)}×)</small></div><div><span>Travel scored</span><strong>{formatKm(calculation.travelPoints)}</strong><small>{formatPoints(calculation.travelPoints)}</small></div><div><span>Stations reached</span><strong>{calculation.claimedSlots.size} / {edition.stationLists.regions.length}</strong><small>{calculation.multiplier.toFixed(2)}× multiplier</small></div></section>
    <section className="long-haul-controls"><div className="section-heading"><div><p className="eyebrow">Your draw</p><h2>Station list</h2></div><label className="list-picker">List<select value={tracker.listNumber} onChange={(event) => setTracker((current) => ({ ...current, listNumber: Number(event.target.value) }))}>{Object.keys(edition.stationLists.lists).map((number) => <option key={number} value={number}>List {number}</option>)}</select></label></div><div className="station-list">{calculation.activeList.map((station) => { const isReached = calculation.claimedSlots.has(station.index); const backup = backupFor(station, station.index, edition.stationLists); return <div key={`${station.index}-${station.name}`} className={`station-list-item station-list-item--${station.type.toLowerCase()}${isReached ? ' is-reached' : ''}`}><button className="station-backup-button" type="button" disabled={!backup || station.name === backup.name} title={backup && station.name !== backup.name ? `Switch to backup: ${backup.name}` : 'No backup station available'} aria-label={backup && station.name !== backup.name ? `Switch ${station.name} to backup ${backup.name}` : 'No backup station available'} onClick={() => addStationSwap(station)}>↔</button><span>{edition.stationLists.regions[station.index]} · {station.type}</span><strong>{station.name}</strong><small>{isReached ? `Reached${station.originalName !== station.name ? ` as ${calculation.claimedSlots.get(station.index)}` : ''}` : station.originalName !== station.name ? `Backup for ${station.originalName}` : 'Not yet reached'}</small></div> })}</div></section>
    <div className="long-haul-workspace">
      <section className="long-haul-entry"><div className="section-heading"><div><p className="eyebrow">Travel</p><h2>Add a route</h2></div><Icon icon={train} /></div><form onSubmit={addRoute}><div className="entry-grid"><label>From<AutocompleteInput required suggestions={network.stationEntries.map((station) => station.name)} value={routeForm.from} onChange={(value) => setRouteForm({ ...routeForm, from: value })} /></label><label>To<AutocompleteInput required suggestions={network.stationEntries.map((station) => station.name)} value={routeForm.to} onChange={(value) => setRouteForm({ ...routeForm, to: value })} placeholder="Start typing a station" /></label><label>Train type<select value={routeForm.trainType} onChange={(event) => setRouteForm({ ...routeForm, trainType: event.target.value })}><option>Intercity</option><option>Sprinter</option><option>Other stopping train</option></select></label><label>Note <small>optional</small><input value={routeForm.note} onChange={(event) => setRouteForm({ ...routeForm, note: event.target.value })} placeholder="Train or context" /></label></div><button className="primary-button">Calculate and add route</button></form></section>
      <section className="long-haul-entry"><div className="section-heading"><div><p className="eyebrow">Challenges</p><h2>Record a completion</h2></div><Icon icon={trophyOutline} /></div><form onSubmit={addChallenge}><div className="entry-grid"><div className="entry-wide challenge-picker"><label>Challenge<select value={selectedChallenge.id} onChange={(event) => { const challenge = challengeById.get(event.target.value); setChallengeForm({ challengeId: challenge.id, scoreId: challenge.scores[0].id }) }}>{edition.challenges.map((challenge) => <option key={challenge.id} value={challenge.id}>{challenge.name}</option>)}</select></label><button className="challenge-help-button" type="button" onClick={() => setChallengeHelpOpen(true)} aria-label={`Show description for ${selectedChallenge.name}`}>?</button></div><label className="entry-wide">Score<select value={selectedScore.id} onChange={(event) => setChallengeForm((current) => ({ ...current, scoreId: event.target.value }))}>{selectedChallenge.scores.map((score) => <option key={score.id} value={score.id}>{score.label} · {formatPoints(score.points)}</option>)}</select></label></div><button className="primary-button">Add {formatPoints(selectedScore.points)}</button></form></section>
      <section className="long-haul-entry"><div className="section-heading"><div><p className="eyebrow">Score</p><h2>Guess or adjustment</h2></div><Icon icon={timelineCheck} /></div><form onSubmit={addAdjustment}><div className="entry-grid"><label>Label<input value={adjustmentForm.label} onChange={(event) => setAdjustmentForm({ ...adjustmentForm, label: event.target.value })} /></label><label>Points<input required type="number" value={adjustmentForm.points} onChange={(event) => setAdjustmentForm({ ...adjustmentForm, points: event.target.value })} placeholder="500 or -250" /></label><label className="entry-wide">Note <small>optional</small><input value={adjustmentForm.note} onChange={(event) => setAdjustmentForm({ ...adjustmentForm, note: event.target.value })} /></label></div><button className="primary-button">Add to timeline</button></form></section>
    </div>
    <section className="long-haul-timeline"><div className="section-heading"><div><p className="eyebrow">Live record</p><h2>Timeline</h2></div><button className="danger-button" type="button" disabled={!tracker.events.length} onClick={() => setConfirmation({ kind: 'clear' })}>Clear timeline</button></div>{!tracker.events.length ? <p className="empty-timeline">Your day starts here. Add the first route from {edition.startingStation} when you board.</p> : <ol>{calculation.timeline.map(renderTimelineEvent)}</ol>}<footer className="score-detail"><span>Travel {formatPoints(calculation.travelPoints)}</span><span>Challenges {formatPoints(calculation.challengePoints)}</span><span>Guesses & adjustments {formatPoints(calculation.adjustmentPoints)}</span><strong>{formatPoints(calculation.basePoints)} × {calculation.multiplier.toFixed(2)} = {formatPoints(calculation.finalScore)}</strong></footer></section>
    <footer className="source-note">Rail graph: <a href={trainkmsSnapshot.source}>trainkms</a> at <code>{trainkmsSnapshot.snapshotCommit.slice(0, 12)}</code>.</footer>
    {challengeHelpOpen && <Modal title={selectedChallenge.name} onClose={() => setChallengeHelpOpen(false)}><p>{selectedChallenge.description}</p></Modal>}
    {confirmation && <Modal title={confirmation.kind === 'swap' ? 'Switch to backup station' : confirmation.kind === 'clear' ? 'Clear Long Haul timeline' : confirmation.kind === 'remove' ? 'Remove timeline item' : 'Replace this score record'} onClose={() => setConfirmation(null)}><p className="modal-help">{confirmation.kind === 'swap' ? <>Replace <strong>{confirmation.station.name}</strong> with <strong>{confirmation.backup.name}</strong>?</> : confirmation.kind === 'clear' ? 'Clear this Long Haul timeline? This cannot be undone.' : confirmation.kind === 'remove' ? 'Remove this timeline item?' : 'Importing replaces the timeline currently held in this browser. Continue?'}</p><div className="form-actions"><button type="button" onClick={() => setConfirmation(null)}>Cancel</button><button className={confirmation.kind === 'swap' || confirmation.kind === 'import' ? 'primary-button' : 'danger-button'} type="button" onClick={confirmAction}>{confirmation.kind === 'swap' ? 'Switch station' : confirmation.kind === 'clear' ? 'Clear timeline' : confirmation.kind === 'remove' ? 'Remove item' : 'Import backup'}</button></div></Modal>}
  </main>
}
