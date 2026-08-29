import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const FILE = path.join(process.cwd(), 'data', 'reports.json')

function readReports(): object[] {
  if (!fs.existsSync(FILE)) return []
  return JSON.parse(fs.readFileSync(FILE, 'utf8'))
}

export async function GET() {
  return NextResponse.json(readReports())
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const reports = readReports()
  const report = {
    ...body,
    id: Date.now(),
    timestamp: new Date().toISOString(),
  }
  reports.unshift(report)
  fs.mkdirSync(path.dirname(FILE), { recursive: true })
  fs.writeFileSync(FILE, JSON.stringify(reports, null, 2))
  return NextResponse.json(report, { status: 201 })
}
