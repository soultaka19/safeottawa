'use client'

import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { RouteResult, RiskZone } from '@/lib/routing'

// Fix icones Leaflet (Next.js ne copie pas les assets automatiquement)
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const START_ICON = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
})
const END_ICON = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
})
const REPORT_ICON = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
})

export type Report = {
  id: number
  lat: number
  lon: number
  type: string
  description: string
  timestamp: string
}

type Props = {
  heatmapData: [number, number, number][]
  zones: RiskZone[]
  routes: RouteResult[]
  origin: [number, number] | null
  dest: [number, number] | null
  reports: Report[]
  onMapClick?: (lat: number, lon: number) => void
  showReports?: boolean
}

// Capture les clics carte
function ClickHandler({ onMapClick }: { onMapClick?: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick?.(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

// Couche heatmap via leaflet.heat
function HeatmapLayer({ data }: { data: [number, number, number][] }) {
  const layerRef = useRef<any>(null)
  const map = useMapEvents({ click() {} })

  useEffect(() => {
    if (!map || !data.length) return

    import('leaflet.heat').then(() => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current)
      }
      // @ts-ignore — leaflet.heat etend L globalement
      layerRef.current = L.heatLayer(data, {
        radius: 20,
        blur: 25,
        maxZoom: 17,
        max: 100,
        gradient: { 0.3: '#3b82f6', 0.6: '#f97316', 1.0: '#ef4444' },
      }).addTo(map)
    })

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current)
        layerRef.current = null
      }
    }
  }, [map, data])

  return null
}

export default function MapView({
  heatmapData,
  routes,
  origin,
  dest,
  reports,
  onMapClick,
  showReports = false,
}: Props) {
  return (
    <MapContainer
      center={[45.4215, -75.6972]}
      zoom={13}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <ClickHandler onMapClick={onMapClick} />

      {/* Heatmap zones dangereuses */}
      {heatmapData.length > 0 && <HeatmapLayer data={heatmapData} />}

      {/* Routes */}
      {routes.map((route, i) => (
        <Polyline
          key={i}
          positions={route.coords}
          color={route.color}
          weight={route.label === 'safe' ? 6 : 3}
          opacity={route.label === 'safe' ? 0.95 : 0.55}
        >
          <Popup>
            <div className="text-sm">
              <strong>
                {route.label === 'safe' ? 'Route recommandee' : route.label === 'alt' ? 'Alternative' : 'Moins sure'}
              </strong>
              <br />Risque : <strong>{route.riskScore.toFixed(0)} %</strong>
              <br />{route.zonesCount} zone{route.zonesCount !== 1 ? 's' : ''} dangereuse{route.zonesCount !== 1 ? 's' : ''}
              <br />Distance : {(route.distance / 1000).toFixed(1)} km
              <br />Duree : ~{Math.round(route.duration / 60)} min
            </div>
          </Popup>
        </Polyline>
      ))}

      {/* Marqueurs depart / arrivee */}
      {origin && (
        <Marker position={origin} icon={START_ICON}>
          <Popup>Depart</Popup>
        </Marker>
      )}
      {dest && (
        <Marker position={dest} icon={END_ICON}>
          <Popup>Arrivee</Popup>
        </Marker>
      )}

      {/* Signalements utilisateurs */}
      {showReports && reports.map(r => (
        <Marker key={r.id} position={[r.lat, r.lon]} icon={REPORT_ICON}>
          <Popup>
            <div className="text-sm">
              <strong>{r.type}</strong>
              {r.description && <><br />{r.description}</>}
              <br /><small>{new Date(r.timestamp).toLocaleDateString('fr-CA')}</small>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
