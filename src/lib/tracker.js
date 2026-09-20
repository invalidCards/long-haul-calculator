export const routeKey = (from, to) => [from, to].sort().join('::')

export function buildNetwork({ routes, stations }) {
  const adjacency = new Map()
  for (const route of routes) {
    if (!adjacency.has(route.fromStation)) adjacency.set(route.fromStation, [])
    adjacency.get(route.fromStation).push(route)
  }
  return {
    adjacency,
    stations,
    stationEntries: Object.entries(stations)
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'nl')),
  }
}

// Mirrors trainkms: a Dijkstra search over its supplied station-to-station hm graph.
export function findRoute(network, from, to) {
  if (from === to) return { stations: [from], edges: [], distance: 0 }
  const queue = [{ station: from, distance: 0, previous: null, edge: null }]
  const visited = new Set()
  while (queue.length) {
    queue.sort((a, b) => a.distance - b.distance)
    const current = queue.shift()
    if (!current || visited.has(current.station)) continue
    if (current.station === to) {
      const edges = []
      let cursor = current
      while (cursor.previous) {
        edges.unshift(cursor.edge)
        cursor = cursor.previous
      }
      return { stations: [from, ...edges.map((edge) => edge.toStation)], edges, distance: current.distance }
    }
    visited.add(current.station)
    for (const edge of network.adjacency.get(current.station) ?? []) {
      if (!visited.has(edge.toStation)) queue.push({ station: edge.toStation, distance: current.distance + edge.distance, previous: current, edge })
    }
  }
  return null
}

export function backupFor(station, index, stationLists) {
  const backup = stationLists.backups[station.type]?.[index]
  if (typeof backup === 'string') return { name: backup, type: station.type }
  return backup ?? null
}

export function resolveStationCode(network, stationLists, name) {
  const sourceName = stationLists.aliases[name.trim()] ?? name.trim()
  return network.stationEntries.find((station) => station.name.localeCompare(sourceName, 'nl', { sensitivity: 'accent' }) === 0)?.code
}

export function stationListFor(edition, listNumber) {
  return edition.stationLists.lists[listNumber]?.map((station) => ({ ...station })) ?? null
}

export function calculateTracker(events, list, network, edition) {
  const usedTracks = new Set()
  const claimedSlots = new Map()
  const timeline = []
  const activeList = list.map((station, index) => ({ ...station, index, originalName: station.name }))
  let travelPoints = 0
  let challengePoints = 0
  let adjustmentPoints = 0

  const claimStation = (code, trainType) => {
    const name = network.stations[code]
    const listStation = activeList.find((station) => (edition.stationLists.aliases[station.name] ?? station.name) === name)
    if (!listStation || claimedSlots.has(listStation.index) || (listStation.type === 'Sprinter' && trainType !== 'Sprinter')) return null
    claimedSlots.set(listStation.index, listStation.name)
    usedTracks.clear()
    return listStation.name
  }

  const chronologicalEvents = events
    .map((event, index) => ({ event, index }))
    .sort((a, b) => (a.event.time ?? '').localeCompare(b.event.time ?? '') || a.index - b.index)
    .map(({ event }) => event)

  for (const event of chronologicalEvents) {
    if (event.type === 'station-swap') {
      const station = activeList[event.provinceIndex]
      if (!station) {
        timeline.push({ ...event, error: 'This station swap is no longer valid for the selected list.' })
        continue
      }
      const previousStation = station.name
      station.name = event.backupStation
      station.type = event.backupType ?? station.type
      timeline.push({ ...event, previousStation, backupStation: station.name })
      continue
    }
    if (event.type === 'route') {
      const route = findRoute(network, event.from, event.to)
      if (!route) {
        timeline.push({ ...event, error: 'No route found in the trainkms graph.' })
        continue
      }
      let earned = 0
      for (const edge of route.edges) {
        const key = routeKey(edge.fromStation, edge.toStation)
        if (!usedTracks.has(key)) {
          usedTracks.add(key)
          earned += edge.distance
        }
      }
      const hit = claimStation(event.to, event.trainType)
      travelPoints += earned
      timeline.push({ ...event, route, earned, resets: hit ? [hit] : [] })
      continue
    }
    if (event.type === 'challenge') challengePoints += event.points
    else if (event.type === 'adjustment') adjustmentPoints += event.points
    timeline.push(event)
  }

  const multiplier = 1 + claimedSlots.size * edition.stationClaimMultiplier
  const basePoints = travelPoints + challengePoints + adjustmentPoints
  return { timeline, activeList, claimedSlots, travelPoints, challengePoints, adjustmentPoints, basePoints, multiplier, finalScore: basePoints * multiplier }
}
