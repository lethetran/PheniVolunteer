import { PrismaClient } from '@prisma/client'
import { DEFAULT_ADMIN_PERMISSIONS, DEFAULT_GROUP_LEADER_PERMISSIONS, CAMPAIGN_ADMIN_PERMISSIONS } from '../src/lib/permissions'

const prisma = new PrismaClient()

const rootEmails = (process.env.ROOT_ADMIN_EMAILS ?? 'admin@phenikaa-uni.edu.vn')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

const domain = (process.env.ALLOWED_EMAIL_DOMAINS ?? 'st.phenikaa-uni.edu.vn,phenikaa-uni.edu.vn')
  .split(',')[0]
  .trim()

async function main() {
  console.log('Seeding…')

  for (const email of rootEmails) {
    await prisma.user.upsert({
      where: { email },
      update: { role: 'ROOT_ADMIN', status: 'ACTIVE' },
      create: { email, name: 'Root Admin', role: 'ROOT_ADMIN' },
    })
  }
  console.log(`✓ ${rootEmails.length} root admin(s)`)

  const admin = await prisma.user.upsert({
    where: { email: `admin.demo@${domain}` },
    update: { role: 'ADMIN', permissions: DEFAULT_ADMIN_PERMISSIONS },
    create: {
      email: `admin.demo@${domain}`,
      name: 'Admin Demo',
      role: 'ADMIN',
      permissions: DEFAULT_ADMIN_PERMISSIONS,
    },
  })

  const leader = await prisma.user.upsert({
    where: { email: `leader.demo@${domain}` },
    update: {},
    create: { email: `leader.demo@${domain}`, name: 'Trưởng nhóm Demo', studentCode: '21010001' },
  })

  const volunteerEmails = ['tnv1', 'tnv2', 'tnv3', 'tnv4', 'tnv5']
  const volunteers = []
  for (const [i, name] of volunteerEmails.entries()) {
    const v = await prisma.user.upsert({
      where: { email: `${name}.demo@${domain}` },
      update: {},
      create: {
        email: `${name}.demo@${domain}`,
        name: `Tình nguyện viên ${i + 1}`,
        studentCode: `2101000${i + 2}`,
        faculty: 'Công nghệ thông tin',
      },
    })
    volunteers.push(v)
  }
  console.log(`✓ 1 admin, 1 leader, ${volunteers.length} volunteers`)

  const campaign = await prisma.campaign.upsert({
    where: { code: 'TN2026-01' },
    update: {},
    create: {
      code: 'TN2026-01',
      title: 'Mùa hè xanh 2026',
      slug: 'mua-he-xanh-2026',
      summary: 'Chiến dịch tình nguyện hè hỗ trợ cộng đồng tại các vùng khó khăn.',
      description:
        'Tham gia cùng CLB Tình nguyện Phenikaa trong chiến dịch Mùa hè xanh 2026: hỗ trợ dạy học, xây dựng công trình dân sinh và các hoạt động cộng đồng.',
      location: 'Hoà Bình',
      organizer: 'CLB Tình nguyện Phenikaa',
      status: 'OPEN',
      startAt: new Date('2026-07-01T07:00:00+07:00'),
      endAt: new Date('2026-07-15T17:00:00+07:00'),
      regOpenAt: new Date('2026-05-01T00:00:00+07:00'),
      regCloseAt: new Date('2026-06-15T23:59:59+07:00'),
      capacity: 60,
      hoursDefault: 40,
      pointsDefault: 10,
      requireApproval: true,
      allowSelfJoin: true,
      createdById: admin.id,
    },
  })
  console.log(`✓ campaign ${campaign.title}`)

  // Quyền quản trị sự kiện giờ chỉ có hiệu lực khi được thêm rõ ràng làm CampaignAdmin
  // cho TỪNG sự kiện (User.permissions không còn tự động cấp quyền toàn bộ campaign).
  await prisma.campaignAdmin.upsert({
    where: { campaignId_userId: { campaignId: campaign.id, userId: admin.id } },
    update: { permissions: CAMPAIGN_ADMIN_PERMISSIONS },
    create: { campaignId: campaign.id, userId: admin.id, permissions: CAMPAIGN_ADMIN_PERMISSIONS },
  })
  await prisma.registration.upsert({
    where: { campaignId_userId: { campaignId: campaign.id, userId: admin.id } },
    update: { status: 'APPROVED' },
    create: { campaignId: campaign.id, userId: admin.id, status: 'APPROVED', decidedAt: new Date() },
  })

  const groupA = await prisma.campaignGroup.upsert({
    where: { campaignId_name: { campaignId: campaign.id, name: 'Nhóm Dạy học' } },
    update: {},
    create: {
      campaignId: campaign.id,
      name: 'Nhóm Dạy học',
      description: 'Phụ trách hoạt động dạy học cho trẻ em địa phương.',
      quota: 20,
      shift: 'Sáng',
      order: 0,
    },
  })
  const groupB = await prisma.campaignGroup.upsert({
    where: { campaignId_name: { campaignId: campaign.id, name: 'Nhóm Hậu cần' } },
    update: {},
    create: {
      campaignId: campaign.id,
      name: 'Nhóm Hậu cần',
      description: 'Phụ trách hậu cần, ăn ở, di chuyển.',
      quota: 15,
      shift: 'Cả ngày',
      order: 1,
    },
  })

  await prisma.groupAssignment.upsert({
    where: { groupId_userId: { groupId: groupA.id, userId: leader.id } },
    update: {},
    create: {
      groupId: groupA.id,
      userId: leader.id,
      title: 'Trưởng nhóm',
      permissions: DEFAULT_GROUP_LEADER_PERMISSIONS,
    },
  })
  await prisma.user.update({ where: { id: leader.id }, data: { role: 'MANAGER' } })
  console.log('✓ groups + leader')

  const regField = await prisma.fieldDefinition.upsert({
    where: { scope_campaignId_key: { scope: 'REGISTRATION_FORM', campaignId: campaign.id, key: 'size_ao' } },
    update: {},
    create: {
      scope: 'REGISTRATION_FORM',
      campaignId: campaign.id,
      key: 'size_ao',
      label: 'Size áo đồng phục',
      type: 'SELECT',
      options: ['S', 'M', 'L', 'XL'],
      required: true,
      order: 0,
      createdById: admin.id,
    },
  })

  const trackField = await prisma.fieldDefinition.upsert({
    where: { scope_campaignId_key: { scope: 'MEMBER_TRACKING', campaignId: campaign.id, key: 'da_nhan_ao' } },
    update: {},
    create: {
      scope: 'MEMBER_TRACKING',
      campaignId: campaign.id,
      key: 'da_nhan_ao',
      label: 'Đã nhận áo',
      type: 'CHECKBOX',
      order: 0,
      createdById: admin.id,
    },
  })
  console.log('✓ dynamic fields:', regField.key, trackField.key)

  await prisma.task.upsert({
    where: { id: 'seed-task-orientation' },
    update: {},
    create: {
      id: 'seed-task-orientation',
      campaignId: campaign.id,
      title: 'Tham gia buổi tập huấn trước chiến dịch',
      description: 'Điểm danh tại buổi tập huấn ngày 20/6/2026.',
      required: true,
      order: 0,
      createdById: admin.id,
    },
  })
  await prisma.task.upsert({
    where: { id: 'seed-task-report' },
    update: {},
    create: {
      id: 'seed-task-report',
      campaignId: campaign.id,
      groupId: groupA.id,
      title: 'Nộp giáo án buổi dạy đầu tiên',
      requireEvidence: true,
      required: true,
      order: 1,
      createdById: admin.id,
    },
  })
  console.log('✓ tasks')

  const statuses = ['PENDING', 'APPROVED', 'APPROVED', 'WAITLIST', 'PENDING'] as const
  for (const [i, v] of volunteers.entries()) {
    await prisma.registration.upsert({
      where: { campaignId_userId: { campaignId: campaign.id, userId: v.id } },
      update: {},
      create: {
        campaignId: campaign.id,
        userId: v.id,
        status: statuses[i],
        groupId: statuses[i] === 'APPROVED' ? (i % 2 === 0 ? groupA.id : groupB.id) : null,
        formData: { size_ao: ['S', 'M', 'L'][i % 3] },
        motivation: 'Em muốn đóng góp cho cộng đồng và rèn luyện kỹ năng mềm.',
      },
    })
  }
  console.log('✓ sample registrations')

  console.log('Seed hoàn tất.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
