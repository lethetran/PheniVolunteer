import { prisma } from '@/lib/prisma'
import { requireCampaignScope } from '@/lib/scope'
import { PERMISSIONS } from '@/lib/permissions'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { FieldManager } from '@/components/fields/field-manager'

export default async function CampaignFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const scope = await requireCampaignScope(id)
  scope.assert(PERMISSIONS.FIELD_MANAGE)

  const [regFields, trackingFields] = await Promise.all([
    prisma.fieldDefinition.findMany({
      where: { scope: 'REGISTRATION_FORM', campaignId: id },
      orderBy: { order: 'asc' },
    }),
    prisma.fieldDefinition.findMany({
      where: { scope: 'MEMBER_TRACKING', campaignId: id },
      orderBy: { order: 'asc' },
    }),
  ])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Form đăng ký"
          description="Câu hỏi hiển thị khi tình nguyện viên đăng ký tham gia sự kiện."
        />
        <CardBody>
          <FieldManager scope="REGISTRATION_FORM" campaignId={id} defs={regFields} title="Câu hỏi đăng ký" />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Cột theo dõi thành viên"
          description="Cột nội bộ để ban tổ chức theo dõi (áo, ca trực, ô tích nhiệm vụ, ghi chú...)."
        />
        <CardBody>
          <FieldManager scope="MEMBER_TRACKING" campaignId={id} defs={trackingFields} title="Cột theo dõi" />
        </CardBody>
      </Card>
    </div>
  )
}
