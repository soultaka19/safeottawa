import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

/**
 * Signalements citoyens.
 *
 * La persistance passait auparavant par `fs.writeFileSync` sur
 * `data/reports.json`. C'était impossible en hébergement serverless : le
 * système de fichiers d'une fonction Vercel est en lecture seule sauf `/tmp`,
 * l'écriture levait `EROFS` et rendait 500. Même dans `/tmp`, la donnée serait
 * propre à une instance et perdue au démarrage à froid suivant.
 *
 * Les signalements vivent donc dans PostgreSQL (Neon, colocalisé avec les
 * fonctions Vercel en `us-east-1`). Le pilote `neon()` parle en HTTP : pas de
 * pool de connexions à gérer, ce qui convient à une fonction sans état.
 */

const sql = neon(process.env.DATABASE_URL!)

/** Contrat rendu au client : `timestamp`, comme avant la migration. */
type ReportOut = {
  id: number
  lat: number
  lon: number
  type: string
  description: string
  timestamp: string
}

type Ligne = {
  id: string | number
  lat: number
  lon: number
  type: string
  description: string
  created_at: string | Date
}

const versSortie = (l: Ligne): ReportOut => ({
  id: Number(l.id),
  lat: l.lat,
  lon: l.lon,
  type: l.type,
  description: l.description,
  timestamp: new Date(l.created_at).toISOString(),
})

const TYPE_MAX = 80
const DESCRIPTION_MAX = 500

/**
 * Valide l'entrée. L'API acceptait auparavant n'importe quoi — `{"lat":"abc",
 * "injected":{...}}` était persisté tel quel. Les contraintes CHECK de la table
 * refuseraient ces valeurs, mais une erreur SQL rendrait 500 : mieux vaut un
 * 400 explicite, et ne jamais laisser passer de champ non attendu.
 */
function valider(corps: unknown): { ok: true; valeur: Omit<ReportOut, 'id' | 'timestamp'> } | { ok: false; message: string } {
  if (typeof corps !== 'object' || corps === null) {
    return { ok: false, message: 'Corps JSON attendu.' }
  }
  const c = corps as Record<string, unknown>

  const lat = typeof c.lat === 'number' ? c.lat : Number.NaN
  const lon = typeof c.lon === 'number' ? c.lon : Number.NaN
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    return { ok: false, message: 'lat doit etre un nombre entre -90 et 90.' }
  }
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
    return { ok: false, message: 'lon doit etre un nombre entre -180 et 180.' }
  }

  const type = typeof c.type === 'string' ? c.type.trim() : ''
  if (!type || type.length > TYPE_MAX) {
    return { ok: false, message: `type est requis et ne doit pas depasser ${TYPE_MAX} caracteres.` }
  }

  const description = typeof c.description === 'string' ? c.description.trim() : ''
  if (description.length > DESCRIPTION_MAX) {
    return { ok: false, message: `description ne doit pas depasser ${DESCRIPTION_MAX} caracteres.` }
  }

  return { ok: true, valeur: { lat, lon, type, description } }
}

export async function GET() {
  try {
    const lignes = (await sql`
      SELECT id, lat, lon, type, description, created_at
      FROM reports
      ORDER BY created_at DESC
      LIMIT 500
    `) as Ligne[]
    return NextResponse.json(lignes.map(versSortie))
  } catch (erreur) {
    console.error('GET /api/reports', erreur)
    return NextResponse.json({ error: 'Lecture des signalements impossible' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  // Un corps mal forme levait auparavant une exception non gerée (500 avec une
  // page d'erreur vide, illisible pour le client).
  let corps: unknown
  try {
    corps = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const v = valider(corps)
  if (!v.ok) return NextResponse.json({ error: v.message }, { status: 400 })

  try {
    const [ligne] = (await sql`
      INSERT INTO reports (lat, lon, type, description)
      VALUES (${v.valeur.lat}, ${v.valeur.lon}, ${v.valeur.type}, ${v.valeur.description})
      RETURNING id, lat, lon, type, description, created_at
    `) as Ligne[]
    return NextResponse.json(versSortie(ligne), { status: 201 })
  } catch (erreur) {
    console.error('POST /api/reports', erreur)
    return NextResponse.json({ error: 'Enregistrement du signalement impossible' }, { status: 500 })
  }
}
