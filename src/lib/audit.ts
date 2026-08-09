import { prisma } from './prisma'

/** Ghi nhật ký hoạt động. Không bao giờ làm hỏng luồng chính nếu lỗi. */
export async function logAudit(
  actorId: string | null | undefined,
  action: string,
  opts: { entityType?: string; entityId?: string; metadata?: Record<string, unknown> } = {},
) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: actorId ?? null,
        action,
        entityType: opts.entityType ?? null,
        entityId: opts.entityId ?? null,
        metadata: (opts.metadata ?? {}) as object,
      },
    })
  } catch {
    // nuốt lỗi: audit không được phép chặn nghiệp vụ
  }
}

export const AUDIT_LABELS: Record<string, string> = {
  'campaign.create': 'Tạo sự kiện',
  'campaign.update': 'Cập nhật sự kiện',
  'campaign.delete': 'Xoá sự kiện',
  'campaign.status': 'Đổi trạng thái sự kiện',
  'group.create': 'Tạo nhóm',
  'group.update': 'Sửa nhóm',
  'group.delete': 'Xoá nhóm',
  'group.leader.assign': 'Cử trưởng nhóm',
  'group.leader.remove': 'Gỡ trưởng nhóm',
  'campaignAdmin.assign': 'Cử admin phụ trách sự kiện',
  'campaignAdmin.remove': 'Gỡ admin phụ trách sự kiện',
  'registration.apply': 'Đăng ký tham gia',
  'registration.decide': 'Duyệt / từ chối đăng ký',
  'registration.update': 'Cập nhật thành viên',
  'registration.group': 'Xếp nhóm thành viên',
  'registration.cancel': 'Huỷ đăng ký',
  'attendance.update': 'Điểm danh',
  'field.create': 'Tạo cột thông tin',
  'field.update': 'Sửa cột thông tin',
  'field.delete': 'Xoá cột thông tin',
  'task.create': 'Tạo nhiệm vụ',
  'task.update': 'Sửa nhiệm vụ',
  'task.delete': 'Xoá nhiệm vụ',
  'task.progress': 'Cập nhật tiến độ nhiệm vụ',
  'task.review': 'Xác nhận nhiệm vụ',
  'note.create': 'Thêm ghi chú',
  'note.update': 'Cập nhật ghi chú',
  'note.delete': 'Xoá ghi chú',
  'post.create': 'Đăng thông báo',
  'post.update': 'Sửa thông báo',
  'post.delete': 'Xoá thông báo',
  'user.role': 'Đổi vai trò tài khoản',
  'user.permissions': 'Cấp quyền tài khoản',
  'user.status': 'Khoá / mở khoá tài khoản',
  'user.update': 'Sửa hồ sơ người dùng',
  'import.run': 'Nhập dữ liệu từ Excel',
  'export.run': 'Xuất dữ liệu',
  'profile.update': 'Cập nhật hồ sơ cá nhân',
}
