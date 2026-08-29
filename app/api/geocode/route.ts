import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')
  if (!q) return NextResponse.json({ error: 'missing q' }, { status: 400 })

  const url =
    `https://nominatim.openstreetmap.org/search?` +
    `q=${encodeURIComponent(q + ', Ottawa, Ontario, Canada')}` +
    `&format=json&limit=1`

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'SafeOttawa/1.0 (hackathon)' },
      signal: AbortSignal.timeout(6000),
    })
    const data = await res.json()
    if (!data.length) return NextResponse.json({ error: 'Adresse introuvable' }, { status: 404 })
    return NextResponse.json({
      lat: parseFloat(data[0].lat),
      lon: parseFloat(data[0].lon),
      display: data[0].display_name,
    })
  } catch {
    return NextResponse.json({ error: 'Erreur geocodage' }, { status: 500 })
  }
}
