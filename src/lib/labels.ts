import type {
  AttendanceStatus,
  CampaignStatus,
  NoteSeverity,
  NoteStatus,
  RegistrationStatus,
  TaskStatus,
  UserStatus,
} from '@prisma/client'

type Tone = 'gray' | 'blue' | 'green' | 'amber' | 'red' | 'violet'

export const CAMPAIGN_STATUS: Record<CampaignStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: 'Nháp', tone: 'gray' },
  OPEN: { label: 'Đang mở đăng ký', tone: 'green' },
  CLOSED: { label: 'Đã đóng đăng ký', tone: 'amber' },
  ONGOING: { label: 'Đang diễn ra', tone: 'blue' },
  FINISHED: { label: 'Đã kết thúc', tone: 'violet' },
  ARCHIVED: { label: 'Lưu trữ', tone: 'gray' },
}

export const REGISTRATION_STATUS: Record<RegistrationStatus, { label: string; tone: Tone }> = {
  PENDING: { label: 'Chờ duyệt', tone: 'amber' },
  APPROVED: { label: 'Đã duyệt', tone: 'green' },
  REJECTED: { label: 'Từ chối', tone: 'red' },
  WAITLIST: { label: 'Danh sách chờ', tone: 'violet' },
  CANCELLED: { label: 'Đã huỷ', tone: 'gray' },
  REMOVED: { label: 'Đã loại', tone: 'red' },
}

export const ATTENDANCE_STATUS: Record<AttendanceStatus, { label: string; tone: Tone }> = {
  NOT_YET: { label: 'Chưa điểm danh', tone: 'gray' },
  PRESENT: { label: 'Có mặt', tone: 'green' },
  ABSENT: { label: 'Vắng', tone: 'red' },
  LATE: { label: 'Đi muộn', tone: 'amber' },
  EXCUSED: { label: 'Có phép', tone: 'blue' },
}

export const TASK_STATUS: Record<TaskStatus, { label: string; tone: Tone }> = {
  NOT_STARTED: { label: 'Chưa làm', tone: 'gray' },
  IN_PROGRESS: { label: 'Đang làm', tone: 'blue' },
  SUBMITTED: { label: 'Chờ duyệt', tone: 'amber' },
  DONE: { label: 'Hoàn thành', tone: 'green' },
  BLOCKED: { label: 'Đang vướng', tone: 'red' },
}

export const NOTE_SEVERITY: Record<NoteSeverity, { label: string; tone: Tone }> = {
  INFO: { label: 'Thông tin', tone: 'blue' },
  WARNING: { label: 'Cần lưu ý', tone: 'amber' },
  ISSUE: { label: 'Vấn đề', tone: 'red' },
  BLOCKER: { label: 'Nghiêm trọng', tone: 'red' },
}

export const NOTE_STATUS: Record<NoteStatus, { label: string; tone: Tone }> = {
  OPEN: { label: 'Chưa xử lý', tone: 'amber' },
  IN_PROGRESS: { label: 'Đang xử lý', tone: 'blue' },
  RESOLVED: { label: 'Đã xong', tone: 'green' },
}

export const USER_STATUS: Record<UserStatus, { label: string; tone: Tone }> = {
  ACTIVE: { label: 'Hoạt động', tone: 'green' },
  LOCKED: { label: 'Đã khoá', tone: 'red' },
}

export const ROLE_TONE: Record<string, Tone> = {
  ROOT_ADMIN: 'red',
  ADMIN: 'violet',
  MANAGER: 'blue',
  VOLUNTEER: 'gray',
}

export type { Tone }
