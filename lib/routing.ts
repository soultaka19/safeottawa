export type RiskZone = {
  lat: number
  lon: number
  risk_score: number
  nb_collisions: number
  nb_fatal: number
}

export type RouteResult = {
  coords: [number, number][]   // [lat, lon][]
  distance: number             // metres
  duration: number             // secondes
  riskScore: number            // pourcentage 0-100
  riskRaw: number              // score brut interne (pour le calcul meteo)
  zonesCount: number           // nb zones dangereuses traversees
  label: 'safe' | 'alt' | 'risky'
  color: string
}

/**
 * Clamp utilitaire — conserve la compatibilite avec les imports existants.
 */
export function rawToPercent(raw: number): number {
  return Math.max(0, Math.min(100, Math.round(raw * 10) / 10))
}

/** Libelle lisible selon le pourcentage */
export function riskLabel(pct: number): { text: string; color: string } {
  if (pct <= 15)  return { text: 'Faible',     color: '#22c55e' }
  if (pct <= 40)  return { text: 'Modere',     color: '#84cc16' }
  if (pct <= 60)  return { text: 'Eleve',      color: '#f97316' }
  if (pct <= 80)  return { text: 'Tres eleve', color: '#ef4444' }
  return              { text: 'Critique',  color: '#dc2626' }
}

// ─── Index spatial ────────────────────────────────────────────────────────────
type SpatialIndex = Map<string, { zone: RiskZone; idx: number }[]>

function buildSpatialIndex(zones: RiskZone[], cellSize = 0.005): SpatialIndex {
  const index: SpatialIndex = new Map()
  zones.forEach((zone, idx) => {
    const key = `${Math.floor(zone.lat / cellSize)}:${Math.floor(zone.lon / cellSize)}`
    if (!index.has(key)) index.set(key, [])
    index.get(key)!.push({ zone, idx })
  })
  return index
}

function getNearbyZones(
  lat: number, lon: number,
  index: SpatialIndex,
  radius: number, cellSize: number
): { zone: RiskZone; idx: number }[] {
  const cLat = Math.floor(lat / cellSize)
  const cLon = Math.floor(lon / cellSize)
  const result: { zone: RiskZone; idx: number }[] = []
  for (let dL = -1; dL <= 1; dL++) {
    for (let dO = -1; dO <= 1; dO++) {
      const cell = index.get(`${cLat + dL}:${cLon + dO}`)
      if (cell) result.push(...cell)
    }
  }
  return result.filter(({ zone }) =>
    Math.sqrt((zone.lat - lat) ** 2 + (zone.lon - lon) ** 2) < radius
  )
}

// ─── Score de risque ──────────────────────────────────────────────────────────
/**
 * Calcule le score de risque d'une route en pourcentage (0-100 %).
 *
 * Approche :
 *   Les zones sont deja normalisees 0-100 par data_prep.py.
 *   On calcule la MOYENNE des scores des zones uniques traversees,
 *   ce qui produit naturellement un resultat dans [0, 100].
 *
 *   Un bonus fatal (max +15 pts) penalise les routes dont une part
 *   importante des zones contient des collisions mortelles.
 *
 * Lecture :
 *    0-15 %  → Faible   — banlieue residientielle calme
 *   16-40 %  → Modere   — artere urbaine standard
 *   41-60 %  → Eleve    — centre-ville dense
 *   61-80 %  → Tres eleve — corridors accidentogenes identifies
 *   81-100 % → Critique — top 5 % des pires trajectoires d'Ottawa
 */
export function scoreRoute(
  coords: [number, number][],
  zones: RiskZone[],
  weatherMultiplier = 1.0
): { raw: number; pct: number; zonesCount: number } {
  if (!zones.length || !coords.length) return { raw: 0, pct: 0, zonesCount: 0 }

  const RADIUS    = 0.003   // ~300 m
  const CELL_SIZE = 0.005   // ~500 m par cellule
  const STEP      = 4       // 1 point sur 4 pour la perf

  const index     = buildSpatialIndex(zones, CELL_SIZE)
  const hitZones  = new Set<number>()
  let totalRisk   = 0
  let fatalZones  = 0

  for (let i = 0; i < coords.length; i += STEP) {
    const [lat, lon] = coords[i]
    for (const { zone, idx } of getNearbyZones(lat, lon, index, RADIUS, CELL_SIZE)) {
      if (!hitZones.has(idx)) {
        hitZones.add(idx)
        totalRisk += zone.risk_score
        if (zone.nb_fatal > 0) fatalZones++
      }
    }
  }

  if (!hitZones.size) return { raw: 0, pct: 0, zonesCount: 0 }

  // Moyenne des scores de zones traversees (0-100 naturellement)
  const avgRisk   = totalRisk / hitZones.size

  // Bonus zones mortelles : ratio * 15 pts max
  const fatalBonus = (fatalZones / hitZones.size) * 15

  const raw = Math.round((avgRisk + fatalBonus) * 10) / 10
  const pct = rawToPercent(raw * weatherMultiplier)

  return { raw, pct, zonesCount: hitZones.size }
}

// ─── Distance Haversine ───────────────────────────────────────────────────────
function estimateDistanceKm(coords: [number, number][]): number {
  if (coords.length < 2) return 0
  const R = 6371
  let total = 0
  for (let i = 1; i < coords.length; i++) {
    const dLat = ((coords[i][0] - coords[i - 1][0]) * Math.PI) / 180
    const dLon = ((coords[i][1] - coords[i - 1][1]) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((coords[i - 1][0] * Math.PI) / 180) *
        Math.cos((coords[i][0] * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2
    total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }
  return total
}

// ─── OSRM ─────────────────────────────────────────────────────────────────────
export async function fetchRoutes(
  origin: [number, number],
  dest: [number, number],
  mode: 'foot' | 'bike'
): Promise<RouteResult[]> {
  const url =
    `http://router.project-osrm.org/route/v1/${mode}/` +
    `${origin[1]},${origin[0]};${dest[1]},${dest[0]}` +
    `?alternatives=3&geometries=geojson&overview=full`

  const res  = await fetch(url, { signal: AbortSignal.timeout(8000) })
  const data = await res.json()
  if (data.code !== 'Ok' || !data.routes?.length) return []

  return data.routes.slice(0, 3).map((r: any) => ({
    coords:     r.geometry.coordinates.map(([lon, lat]: number[]) => [lat, lon] as [number, number]),
    distance:   r.distance,
    duration:   r.legs[0].duration,
    riskScore:  0,
    riskRaw:    0,
    zonesCount: 0,
    label:      'alt' as const,
    color:      '#94a3b8',
  }))
}

// ─── Classement final ─────────────────────────────────────────────────────────
const COLORS = { safe: '#22c55e', alt: '#f97316', risky: '#ef4444' }

/**
 * Score les routes et les classe selon le score brut.
 * Les labels (safe/alt/risky) sont ensuite ajustes par applyTolerance.
 */
export function rankRoutes(
  routes: RouteResult[],
  zones: RiskZone[],
  weatherMultiplier = 1.0
): RouteResult[] {
  const scored = routes.map(r => {
    const { raw, pct, zonesCount } = scoreRoute(r.coords, zones, weatherMultiplier)
    return { ...r, riskScore: pct, riskRaw: raw, zonesCount }
  })
  scored.sort((a, b) => a.riskScore - b.riskScore)
  // Label provisoire par rang — sera ecrase par applyTolerance
  return scored.map((r, i) => ({
    ...r,
    label: (['safe', 'alt', 'risky'] as const)[Math.min(i, 2)],
    color: COLORS[(['safe', 'alt', 'risky'] as const)[Math.min(i, 2)]],
  }))
}

/**
 * Applique les labels definitifs par rang (independamment du seuil).
 *   rang 0 → 'safe'  (Recommande)   — toujours la route la moins risquee
 *   rang 1 → 'alt'   (Alternatif)
 *   rang 2 → 'risky' (Deconseille)
 *
 * La tolerance influence uniquement le badge d'avertissement affiche
 * dans la carte (riskScore > tolerance), pas le label ni la couleur.
 * Cela garantit que les 3 routes ont toujours des etiquettes distinctes.
 */
export function applyTolerance(routes: RouteResult[], _tolerance: number): RouteResult[] {
  if (!routes.length) return routes
  const RANKS = ['safe', 'alt', 'risky'] as const
  return routes.map((r, i) => {
    const label = RANKS[Math.min(i, 2)]
    return { ...r, label, color: COLORS[label] }
  })
}

// ─── Formatage ────────────────────────────────────────────────────────────────
export function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`
}

export function formatDuration(s: number): string {
  const min = Math.round(s / 60)
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)}h${(min % 60).toString().padStart(2, '0')}`
}
