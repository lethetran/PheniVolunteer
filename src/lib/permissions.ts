import type { Role } from '@prisma/client'

/**
 * Một bộ từ vựng quyền duy nhất cho cả hệ thống.
 *
 *  - ROOT_ADMIN : mặc định có TẤT CẢ quyền, không cần cấp.
 *  - ADMIN      : Root cấp quyền toàn hệ thống (User.permissions) -> áp dụng mọi chiến dịch.
 *  - MANAGER    : Admin cấp quyền cho từng nhóm nhỏ (GroupAssignment.permissions)
 *                 hoặc cho cả 1 chiến dịch (CampaignAdmin.permissions) -> chỉ trong phạm vi đó.
 *  - VOLUNTEER  : không có quyền quản trị.
 */
export const PERMISSIONS = {
  // Chiến dịch
  CAMPAIGN_CREATE: 'campaign.create',
  CAMPAIGN_EDIT: 'campaign.edit',
  CAMPAIGN_DELETE: 'campaign.delete',
  CAMPAIGN_PUBLISH: 'campaign.publish',
  // Nhóm nhỏ & phân cấp quản lý
  GROUP_MANAGE: 'group.manage',
  MANAGER_ASSIGN: 'manager.assign',
  // Thành viên chiến dịch
  REGISTRATION_REVIEW: 'registration.review',
  MEMBER_MANAGE: 'member.manage',
  ATTENDANCE_MANAGE: 'attendance.manage',
  // Cột thông tin động
  FIELD_MANAGE: 'field.manage',
  // Nhiệm vụ
  TASK_MANAGE: 'task.manage',
  TASK_REVIEW: 'task.review',
  // Ghi chú / vấn đề
  NOTE_MANAGE: 'note.manage',
  // Thông tin / tin bài
  POST_MANAGE: 'post.manage',
  // Tình nguyện viên (danh bạ toàn hệ thống)
  VOLUNTEER_VIEW: 'volunteer.view',
  VOLUNTEER_EDIT: 'volunteer.edit',
  VOLUNTEER_IMPORT: 'volunteer.import',
  // Dữ liệu & hệ thống
  DATA_EXPORT: 'data.export',
  MAIL_SEND: 'mail.send',
  REPORT_VIEW: 'report.view',
  AUDIT_VIEW: 'audit.view',
  USER_MANAGE: 'user.manage',
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

export const PERMISSION_LABELS: Record<Permission, string> = {
  'campaign.create': 'Tạo chiến dịch mới',
  'campaign.edit': 'Sửa thông tin chiến dịch',
  'campaign.delete': 'Xoá chiến dịch',
  'campaign.publish': 'Mở/đóng đăng ký, đổi trạng thái chiến dịch',
  'group.manage': 'Tạo & sửa nhóm nhỏ trong chiến dịch',
  'manager.assign': 'Cử quản lý nhóm và cấp quyền cho họ',
  'registration.review': 'Duyệt / từ chối đơn đăng ký',
  'member.manage': 'Quản lý thành viên (đổi nhóm, điền cột thông tin, giờ/điểm)',
  'attendance.manage': 'Điểm danh, check-in / check-out',
  'field.manage': 'Tạo & sửa cột thông tin động (form, hồ sơ, theo dõi)',
  'task.manage': 'Tạo & sửa nhiệm vụ',
  'task.review': 'Xác nhận nhiệm vụ tình nguyện viên đã nộp',
  'note.manage': 'Ghi chú / xử lý vấn đề phát sinh',
  'post.manage': 'Đăng thông tin, thông báo cho chiến dịch',
  'volunteer.view': 'Xem danh bạ tình nguyện viên',
  'volunteer.edit': 'Sửa hồ sơ tình nguyện viên',
  'volunteer.import': 'Nhập danh sách từ Excel',
  'data.export': 'Xuất dữ liệu ra Excel',
  'mail.send': 'Gửi email thông báo hàng loạt',
  'report.view': 'Xem báo cáo tổng hợp',
  'audit.view': 'Xem lịch sử hoạt động hệ thống',
  'user.manage': 'Quản lý tài khoản & cấp quyền admin',
}

/** Quyền chỉ có ý nghĩa ở cấp toàn hệ thống — không cấp cho quản lý nhóm được. */
export const GLOBAL_ONLY_PERMISSIONS: Permission[] = [
  PERMISSIONS.CAMPAIGN_CREATE,
  PERMISSIONS.CAMPAIGN_DELETE,
  PERMISSIONS.VOLUNTEER_VIEW,
  PERMISSIONS.VOLUNTEER_EDIT,
  PERMISSIONS.VOLUNTEER_IMPORT,
  PERMISSIONS.MAIL_SEND,
  PERMISSIONS.AUDIT_VIEW,
  PERMISSIONS.USER_MANAGE,
]

export const ALL_PERMISSIONS = Object.values(PERMISSIONS) as Permission[]

/** Bộ quyền Root có thể cấp cho một Admin. */
export const ADMIN_GRANTABLE_PERMISSIONS = ALL_PERMISSIONS.filter(
  (p) => p !== PERMISSIONS.USER_MANAGE,
)

/** Bộ quyền Admin có thể cấp cho quản lý nhóm / quản lý chiến dịch. */
export const MANAGER_GRANTABLE_PERMISSIONS = ALL_PERMISSIONS.filter(
  (p) => !GLOBAL_ONLY_PERMISSIONS.includes(p) && p !== PERMISSIONS.CAMPAIGN_EDIT,
)

/**
 * Toàn bộ quyền có ý nghĩa ở cấp 1 sự kiện (không gồm các quyền chỉ áp dụng toàn hệ
 * thống). Cấp mặc định cho người tạo sự kiện và các admin được chọn cùng phụ trách
 * ngay lúc tạo — họ có toàn quyền với RIÊNG sự kiện này, không tự động có quyền gì
 * với các sự kiện khác.
 */
export const CAMPAIGN_ADMIN_PERMISSIONS = ALL_PERMISSIONS.filter(
  (p) => !GLOBAL_ONLY_PERMISSIONS.includes(p),
)

/** Bộ quyền gợi ý khi cấp nhanh cho một Admin mới. */
export const DEFAULT_ADMIN_PERMISSIONS: Permission[] = [
  PERMISSIONS.CAMPAIGN_CREATE,
  PERMISSIONS.CAMPAIGN_EDIT,
  PERMISSIONS.CAMPAIGN_PUBLISH,
  PERMISSIONS.GROUP_MANAGE,
  PERMISSIONS.MANAGER_ASSIGN,
  PERMISSIONS.REGISTRATION_REVIEW,
  PERMISSIONS.MEMBER_MANAGE,
  PERMISSIONS.ATTENDANCE_MANAGE,
  PERMISSIONS.FIELD_MANAGE,
  PERMISSIONS.TASK_MANAGE,
  PERMISSIONS.TASK_REVIEW,
  PERMISSIONS.NOTE_MANAGE,
  PERMISSIONS.POST_MANAGE,
  PERMISSIONS.VOLUNTEER_VIEW,
  PERMISSIONS.DATA_EXPORT,
  PERMISSIONS.REPORT_VIEW,
]

/** Bộ quyền gợi ý cho trưởng nhóm nhỏ. */
export const DEFAULT_GROUP_LEADER_PERMISSIONS: Permission[] = [
  PERMISSIONS.REGISTRATION_REVIEW,
  PERMISSIONS.MEMBER_MANAGE,
  PERMISSIONS.ATTENDANCE_MANAGE,
  PERMISSIONS.TASK_MANAGE,
  PERMISSIONS.TASK_REVIEW,
  PERMISSIONS.NOTE_MANAGE,
  PERMISSIONS.DATA_EXPORT,
]

export const ROLE_LABELS: Record<Role, string> = {
  ROOT_ADMIN: 'Root Admin',
  ADMIN: 'Admin',
  MANAGER: 'Quản lý nhóm',
  VOLUNTEER: 'Tình nguyện viên',
}

export const ROLE_ORDER: Record<Role, number> = {
  ROOT_ADMIN: 0,
  ADMIN: 1,
  MANAGER: 2,
  VOLUNTEER: 3,
}

export function isAtLeast(role: Role, min: Role) {
  return ROLE_ORDER[role] <= ROLE_ORDER[min]
}

/** Quyền hiệu lực ở cấp toàn hệ thống của một người dùng. */
export function globalPermissions(user: { role: Role; permissions: string[] }): Set<string> {
  if (user.role === 'ROOT_ADMIN') return new Set<string>(ALL_PERMISSIONS)
  return new Set(user.permissions)
}

export function hasGlobalPermission(
  user: { role: Role; permissions: string[] } | null | undefined,
  permission: Permission,
) {
  if (!user) return false
  if (user.role === 'ROOT_ADMIN') return true
  return user.permissions.includes(permission)
}

/** Người dùng có vào được khu vực quản trị hay không. */
export function canAccessAdminArea(user: {
  role: Role
  permissions: string[]
}): boolean {
  return user.role !== 'VOLUNTEER'
}
