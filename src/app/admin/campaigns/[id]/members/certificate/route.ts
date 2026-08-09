import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCampaignScope } from '@/lib/scope'
import { PERMISSIONS } from '@/lib/permissions'
import { generateCertificate } from '@/lib/certificate'
import { slugify } from '@/lib/utils'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const registrationId = new URL(request.url).searchParams.get('registrationId')
  if (!registrationId) return NextResponse.json({ error: 'missing registrationId' }, { status: 400 })

  const scope = await getCampaignScope(id)
  if (!scope) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: { user: true, campaign: true },
  })
  if (!registration || registration.campaignId !== id) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  if (!scope.canAnywhere(PERMISSIONS.DATA_EXPORT) || !scope.can(PERMISSIONS.DATA_EXPORT, registration.groupId)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  if (!registration.completed) {
    return NextResponse.json({ error: 'Chỉ xuất được giấy chứng nhận cho người đã hoàn thành sự kiện.' }, { status: 400 })
  }

  const bytes = await generateCertificate({
    recipientName: registration.user.name ?? registration.user.email,
    studentCode: registration.user.studentCode,
    campaignTitle: registration.campaign.title,
    organizer: registration.campaign.organizer,
    hours: registration.hoursAwarded,
    points: registration.pointsAwarded,
    issuedAt: new Date(),
    appName: process.env.NEXT_PUBLIC_APP_NAME ?? 'Phenikaa Volunteer',
  })

  const filename = `chung-nhan-${slugify(registration.user.name ?? registration.user.email)}.pdf`
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
