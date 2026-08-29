import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

type Location = { name: string; lat: number; lon: number; count: number }

// Mots-clés indiquant des entrées non routables pour piétons/cyclistes
const HIGHWAY_PATTERNS = /highway|hwy\d|ramp|ic\d|autoroute/i

let cachedPlaces: Location[] | null = null

function getPlaces(): Location[] {
  if (cachedPlaces) return cachedPlaces

  // 1. Lieux curatés (landmarks + intersections piéton/vélo fiables)
  const knownFile = path.join(process.cwd(), 'public', 'known_places.json')
  const known: Location[] = JSON.parse(fs.readFileSync(knownFile, 'utf8'))

  // 2. Top collisions CSV — filtré : pas d'autoroutes, pas de rampes
  const topFile = path.join(process.cwd(), 'public', 'top_locations.json')
  const top: Location[] = JSON.parse(fs.readFileSync(topFile, 'utf8'))
    .filter((l: Location) => !HIGHWAY_PATTERNS.test(l.name))

  // Fusionner : known_places en tête (priorité), puis top_locations filtrées
  cachedPlaces = [...known, ...top]
  return cachedPlaces
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim().toLowerCase()
  if (!q || q.length < 2) return NextResponse.json([])

  const places = getPlaces()

  const results = places
    .filter(l => l.name.toLowerCase().includes(q))
    .slice(0, 6)
    .map(l => ({ name: l.name, lat: l.lat, lon: l.lon, source: 'local' as const }))

  return NextResponse.json(results)
}
