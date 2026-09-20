import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const projectRoot = resolve(import.meta.dirname, '..')
const sourceDirectory = resolve(projectRoot, 'vendor/trainkms')
const outputPath = resolve(projectRoot, 'src/data/trainkms-snapshot.json')
const source = 'https://github.com/nanderv/trainkms/'

const routes = JSON.parse(await readFile(resolve(sourceDirectory, 'routes.json'), 'utf8'))
const page = await readFile(resolve(sourceDirectory, 'trains.html'), 'utf8')
const stationMatch = page.match(/const stations='(\{[\s\S]*?\})'/)
if (!stationMatch) throw new Error('Could not find the trainkms station map in trains.html.')
const snapshotCommit = execFileSync('git', ['-C', sourceDirectory, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify({ source, snapshotCommit, routes, stations: JSON.parse(stationMatch[1].replaceAll("\\'", "'")) }, null, 2)}\n`)
