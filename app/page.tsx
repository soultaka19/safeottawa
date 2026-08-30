'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { fetchRoutes, rankRoutes, applyTolerance, formatDistance, formatDuration, riskLabel, RouteResult, RiskZone } from '@/lib/routing'
import AutocompleteInput from '@/components/AutocompleteInput'
import RiskSlider from '@/components/RiskSlider'

// Import dynamique : Leaflet ne supporte pas SSR
const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-slate-800 animate-pulse rounded-xl flex items-center justify-center text-slate-400 text-sm">
      Chargement de la carte...
    </div>
  ),
})

type RiskData = {
  zones: RiskZone[]
  heatmap: [number, number, number][]
  stats: Record<string, number>
}
type Report = {
  id: number
  lat: number
  lon: number
  type: string
  description: string
  timestamp: string
}

const DANGER_TYPES = [
  'Intersection dangereuse',
  'Glace / neige sur la chaussee',
  'Chaussee degradee',
  'Visibilite reduite',
  'Absence de signalisation velo',
  'Comportement dangereux signale',
  'Autre',
]

export default function Home() {
  const [tab, setTab] = useState<'nav' | 'report'>('nav')

  // Donnees risque (chargees une fois)
  const [riskData, setRiskData] = useState<RiskData | null>(null)
  const [dataLoaded, setDataLoaded] = useState(false)

  // Charger les zones de risque au demarrage pour afficher la heatmap immediatement
  useEffect(() => {
    ensureRiskData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Onglet navigateur
  const [mode, setMode] = useState<'foot' | 'bike'>('foot')
  const [originInput, setOriginInput] = useState('')
  const [destInput, setDestInput] = useState('')
  const [origin, setOrigin] = useState<[number, number] | null>(null)
  const [dest, setDest] = useState<[number, number] | null>(null)
  // Coords pré-remplies par l'autocomplete (évite un geocodage inutile)
  const [originCoords, setOriginCoords] = useState<[number, number] | null>(null)
  const [destCoords, setDestCoords] = useState<[number, number] | null>(null)
  const [routes, setRoutes] = useState<RouteResult[]>([])       // routes scorees (brutes)
  const [tolerance, setTolerance] = useState(40)                 // seuil utilisateur
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Onglet signalement
  const [reports, setReports] = useState<Report[]>([])
  const [reportsLoaded, setReportsLoaded] = useState(false)
  const [reportLat, setReportLat] = useState('')
  const [reportLon, setReportLon] = useState('')
  const [reportType, setReportType] = useState(DANGER_TYPES[0])
  const [reportDesc, setReportDesc] = useState('')
  const [reportSuccess, setReportSuccess] = useState(false)
  const [reportLoading, setReportLoading] = useState(false)

  async function ensureRiskData(): Promise<RiskData> {
    if (riskData) return riskData
    const res = await fetch('/risk_zones.json')
    const data: RiskData = await res.json()
    setRiskData(data)
    setDataLoaded(true)
    return data
  }

  async function loadReports() {
    if (reportsLoaded) return
    const res = await fetch('/api/reports')
    if (!res.ok) {
      setError('Signalements indisponibles')
      return
    }
    const data: Report[] = await res.json()
    setReports(data)
    setReportsLoaded(true)
  }

  async function geocode(q: string): Promise<[number, number]> {
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`)
    if (!res.ok) throw new Error(`Adresse introuvable : "${q}"`)
    const { lat, lon } = await res.json()
    return [lat, lon]
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setRoutes([])
    setLoading(true)
    try {
      const data = await ensureRiskData()
      // Si l'autocomplete a déjà fourni les coords, pas besoin de géocoder
      const [o, d] = await Promise.all([
        originCoords ? Promise.resolve(originCoords) : geocode(originInput),
        destCoords   ? Promise.resolve(destCoords)   : geocode(destInput),
      ])
      setOrigin(o)
      setDest(d)
      const rawRoutes = await fetchRoutes(o, d, mode)
      if (!rawRoutes.length) throw new Error('Aucun itineraire trouve entre ces deux points.')
      const ranked = rankRoutes(rawRoutes, data.zones)
      setRoutes(ranked)
    } catch (err: any) {
      setError(err.message ?? 'Erreur inattendue')
    } finally {
      setLoading(false)
    }
  }

  const handleMapClick = useCallback((lat: number, lon: number) => {
    if (tab === 'report') {
      setReportLat(lat.toFixed(5))
      setReportLon(lon.toFixed(5))
    }
  }, [tab])

  async function handleReport(e: React.FormEvent) {
    e.preventDefault()
    if (!reportLat || !reportLon) {
      setError('Cliquez sur la carte pour selectionner un emplacement')
      return
    }
    setReportLoading(true)
    setReportSuccess(false)
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: parseFloat(reportLat),
          lon: parseFloat(reportLon),
          type: reportType,
          description: reportDesc,
        }),
      })
      if (!res.ok) {
        // L'API renvoie { error } en 400 comme en 500 : on montre sa raison
        // plutot qu'un message generique.
        const detail = await res.json().catch(() => null)
        setError(detail?.error ?? 'Erreur lors du signalement')
        return
      }
      const newReport: Report = await res.json()
      setReports(prev => [newReport, ...prev])
      setReportDesc('')
      setReportLat('')
      setReportLon('')
      setReportSuccess(true)
      setTimeout(() => setReportSuccess(false), 3000)
    } catch {
      setError('Erreur lors du signalement')
    } finally {
      setReportLoading(false)
    }
  }

  // Routes re-etiquetees en temps reel quand tolerance change (zero API call)
  const displayedRoutes = useMemo(
    () => applyTolerance(routes, tolerance),
    [routes, tolerance]
  )

  function switchTab(t: 'nav' | 'report') {
    setTab(t)
    setError('')
    if (t === 'report') {
      ensureRiskData()
      loadReports()
    }
  }

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-white">
      {/* HEADER */}
      <header className="flex items-center justify-between px-6 py-3 bg-slate-900 border-b border-slate-700 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-2xl">&#128737;</span>
          <div>
            <h1 className="text-lg font-bold leading-none">SafeOttawa</h1>
            <p className="text-xs text-slate-400">Navigation securisee pour pietons et cyclistes</p>
          </div>
        </div>
        {dataLoaded && riskData && (
          <div className="hidden sm:flex gap-6 text-xs text-slate-400">
            <span><strong className="text-red-400">{riskData.stats.total_fatal}</strong> collisions fatales</span>
            <span><strong className="text-orange-400">{riskData.stats.total_collisions_vulnerables.toLocaleString()}</strong> incidents</span>
            <span><strong className="text-slate-200">{riskData.stats.total_zones}</strong> zones analysees</span>
          </div>
        )}
        <div className="flex rounded-lg overflow-hidden border border-slate-600">
          <button
            onClick={() => switchTab('nav')}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${tab === 'nav' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
          >
            Navigateur
          </button>
          <button
            onClick={() => switchTab('report')}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${tab === 'report' ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
          >
            Signalement
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* PANNEAU GAUCHE */}
        <aside className="w-80 shrink-0 bg-slate-900 border-r border-slate-700 flex flex-col overflow-hidden">

          {/* ONGLET NAVIGATEUR */}
          {tab === 'nav' && (
            <>
              {/* ZONE 1 — Formulaire (hauteur fixe) */}
              <div className="shrink-0 p-4 flex flex-col gap-3 border-b border-slate-700">
                {/* Mode */}
                <div className="flex gap-2">
                  {(['foot', 'bike'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors ${mode === m ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'}`}
                    >
                      {m === 'foot' ? '🚶 Pieton' : '🚲 Cycliste'}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleSearch} className="flex flex-col gap-2">
                  <AutocompleteInput
                    label="Depart"
                    placeholder="Ex: King Edward @ Rideau St"
                    value={originInput}
                    onChange={v => { setOriginInput(v); setOriginCoords(null) }}
                    onSelect={(name, coords) => { setOriginInput(name); setOriginCoords(coords) }}
                  />
                  <AutocompleteInput
                    label="Arrivee"
                    placeholder="Ex: Bank St @ Catherine St"
                    value={destInput}
                    onChange={v => { setDestInput(v); setDestCoords(null) }}
                    onSelect={(name, coords) => { setDestInput(name); setDestCoords(coords) }}
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 font-semibold text-sm transition-colors"
                  >
                    {loading ? '⏳ Calcul en cours...' : 'Trouver itineraire securise'}
                  </button>
                </form>

                {error && (
                  <p className="text-red-400 text-xs bg-red-950 border border-red-800 rounded-lg px-3 py-2">{error}</p>
                )}
              </div>

              {/* ZONE 2 — Slider tolerance (hauteur fixe) */}
              <div className="shrink-0 px-4 py-3 border-b border-slate-700 bg-slate-800/40">
                <RiskSlider value={tolerance} onChange={setTolerance} />
              </div>

              {/* ZONE 3 — Resultats (prend tout l'espace restant, scrollable) */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Itineraires
                  </h3>
                  {displayedRoutes.length > 0 && (
                    <span className="text-xs text-slate-500">{displayedRoutes.length} route{displayedRoutes.length > 1 ? 's' : ''}</span>
                  )}
                </div>

                {/* Etat vide */}
                {!loading && displayedRoutes.length === 0 && (
                  <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center py-8">
                    <span className="text-4xl opacity-30">🗺️</span>
                    <p className="text-slate-500 text-xs leading-relaxed">
                      Entrez un depart et une arrivee puis lancez la recherche pour voir les itineraires securises.
                    </p>
                  </div>
                )}

                {/* Etat chargement */}
                {loading && (
                  <div className="flex flex-col items-center justify-center flex-1 gap-3 py-8">
                    <div className="w-6 h-6 border-2 border-slate-600 border-t-blue-400 rounded-full animate-spin" />
                    <p className="text-slate-500 text-xs">Calcul des itineraires...</p>
                  </div>
                )}

                {/* Cartes de routes */}
                {displayedRoutes.map((r, i) => {
                  const rl = riskLabel(r.riskScore)
                  const aboveTolerance = r.riskScore > tolerance
                  const isRecommended = r.label === 'safe'
                  const isAlt = r.label === 'alt'

                  return (
                    <div
                      key={i}
                      className={`rounded-xl border overflow-hidden transition-all ${
                        isRecommended ? 'border-green-600 bg-green-950/60' :
                        isAlt         ? 'border-orange-700 bg-orange-950/40' :
                                        'border-red-900 bg-red-950/30'
                      }`}
                    >
                      {/* En-tete de la carte */}
                      <div className={`flex items-center justify-between px-3 py-2 ${
                        isRecommended ? 'bg-green-900/50' :
                        isAlt         ? 'bg-orange-900/40' :
                                        'bg-red-900/30'
                      }`}>
                        <div className="flex items-center gap-2">
                          <span className="text-base">
                            {isRecommended ? '✅' : isAlt ? '🔶' : '🔴'}
                          </span>
                          <span className="text-sm font-bold text-white">
                            {isRecommended ? 'Recommande' : isAlt ? 'Alternative' : 'Deconseille'}
                          </span>
                        </div>
                        <span className="text-lg font-extrabold" style={{ color: rl.color }}>
                          {r.riskScore.toFixed(0)}%
                        </span>
                      </div>

                      {/* Corps de la carte */}
                      <div className="px-3 py-2.5 flex flex-col gap-2">
                        {/* Barre de risque */}
                        <div className="relative w-full h-2 bg-slate-700 rounded-full">
                          <div
                            className="h-2 rounded-full transition-all duration-500"
                            style={{ width: `${r.riskScore}%`, backgroundColor: rl.color }}
                          />
                          {/* Marqueur seuil */}
                          <div
                            className="absolute top-0 bottom-0 w-0.5 bg-white/50 rounded"
                            style={{ left: `${tolerance}%` }}
                          />
                        </div>

                        {/* Niveau de risque textuel */}
                        <p className="text-xs font-medium" style={{ color: rl.color }}>
                          Risque {rl.text}
                        </p>

                        {/* Stats */}
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                          <div className="text-slate-400">Distance</div>
                          <div className="text-slate-200 font-medium">{formatDistance(r.distance)}</div>
                          <div className="text-slate-400">Duree</div>
                          <div className="text-slate-200 font-medium">{formatDuration(r.duration)}</div>
                          <div className="text-slate-400">Zones risque</div>
                          <div className="text-slate-200 font-medium">{r.zonesCount}</div>
                        </div>

                        {/* Badge au-dessus du seuil */}
                        {aboveTolerance && (
                          <div className="flex items-center gap-1.5 text-xs text-yellow-400 bg-yellow-950/50 border border-yellow-800/50 rounded-lg px-2 py-1.5">
                            <span>⚠</span>
                            <span>Depasse votre seuil de {tolerance}%</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* ONGLET SIGNALEMENT */}
          {tab === 'report' && (
            <div className="p-4 flex flex-col gap-4">
              <div>
                <h2 className="font-semibold text-slate-200">Signaler un danger</h2>
                <p className="text-xs text-slate-400 mt-1">Cliquez sur la carte puis remplissez le formulaire.</p>
              </div>

              <form onSubmit={handleReport} className="flex flex-col gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Type de danger</label>
                  <select
                    value={reportType}
                    onChange={e => setReportType(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
                  >
                    {DANGER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Description</label>
                  <textarea
                    value={reportDesc}
                    onChange={e => setReportDesc(e.target.value)}
                    placeholder="Decrivez le danger..."
                    rows={3}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-orange-500 resize-none"
                  />
                </div>

                <div className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm">
                  {reportLat && reportLon
                    ? <span className="text-green-400">Position : {parseFloat(reportLat).toFixed(4)}, {parseFloat(reportLon).toFixed(4)}</span>
                    : <span className="text-slate-500">Cliquez sur la carte pour selectionner</span>
                  }
                </div>

                <button
                  type="submit"
                  disabled={reportLoading || !reportLat}
                  className="w-full py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:bg-slate-700 disabled:text-slate-500 font-semibold text-sm transition-colors"
                >
                  {reportLoading ? 'Envoi...' : 'Soumettre le signalement'}
                </button>
              </form>

              {reportSuccess && (
                <div className="bg-green-950 border border-green-700 rounded-lg p-3 text-green-300 text-sm">
                  Signalement enregistre !
                </div>
              )}

              {error && (
                <p className="text-red-400 text-xs bg-red-950 border border-red-800 rounded-lg p-3">{error}</p>
              )}

              {reports.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Signalements ({reports.length})
                  </h3>
                  <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                    {reports.map(r => (
                      <div key={r.id} className="bg-slate-800 rounded-lg p-2.5 text-xs border border-slate-700">
                        <p className="font-semibold text-orange-300">{r.type}</p>
                        {r.description && <p className="text-slate-400 mt-0.5">{r.description}</p>}
                        <p className="text-slate-500 mt-1">{new Date(r.timestamp).toLocaleDateString('fr-CA')}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </aside>

        {/* CARTE */}
        <main className="flex-1 relative">
          <MapView
            heatmapData={riskData?.heatmap ?? []}
            zones={riskData?.zones ?? []}
            routes={displayedRoutes}
            origin={origin}
            dest={dest}
            reports={reports}
            onMapClick={handleMapClick}
            showReports={tab === 'report'}
          />
        </main>
      </div>
    </div>
  )
}
