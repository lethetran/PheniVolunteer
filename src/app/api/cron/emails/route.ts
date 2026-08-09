import { NextResponse } from 'next/server'
import { flushEmailQueue } from '@/lib/mail'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get('key')
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const result = await flushEmailQueue()
  return NextResponse.json(result)
}
