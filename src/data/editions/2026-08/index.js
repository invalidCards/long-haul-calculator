import edition from './edition.json' with { type: 'json' }
import stationLists from './station-lists.json' with { type: 'json' }
import challenges from './challenges.json' with { type: 'json' }

export default { ...edition, stationLists, challenges }
