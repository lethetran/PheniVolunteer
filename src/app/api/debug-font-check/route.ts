import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'

// TEMP: verify the Noto Sans .ttf files are actually present in the deployed
// serverless bundle (outputFileTracingIncludes). Delete this route once confirmed.
export async function GET() {
  const dir = path.join(process.cwd(), 'src/assets/fonts')
  let files: { name: string; size: number }[] = []
  let error: string | null = null
  try {
    files = fs.readdirSync(dir).map((name) => ({
      name,
      size: fs.statSync(path.join(dir, name)).size,
    }))
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
  }
  return NextResponse.json({ cwd: process.cwd(), dir, files, error })
}
