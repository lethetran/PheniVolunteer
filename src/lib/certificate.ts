import 'server-only'
import fs from 'node:fs'
import path from 'node:path'
import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'

const FONT_DIR = path.join(process.cwd(), 'src/assets/fonts')

function loadFont(name: 'NotoSans-Regular.ttf' | 'NotoSans-Bold.ttf') {
  return fs.readFileSync(path.join(FONT_DIR, name))
}

/** Vẽ text căn giữa theo chiều ngang trang. */
function drawCentered(
  page: import('pdf-lib').PDFPage,
  text: string,
  y: number,
  font: import('pdf-lib').PDFFont,
  size: number,
  color = rgb(0.06, 0.09, 0.16),
) {
  const width = font.widthOfTextAtSize(text, size)
  page.drawText(text, { x: (page.getWidth() - width) / 2, y, size, font, color })
}

export async function generateCertificate(opts: {
  recipientName: string
  studentCode?: string | null
  campaignTitle: string
  organizer?: string | null
  hours: number
  points: number
  issuedAt: Date
  appName: string
}) {
  const pdfDoc = await PDFDocument.create()
  pdfDoc.registerFontkit(fontkit)
  // subset:true làm hỏng glyph dấu tiếng Việt với font này (chữ có dấu bị mất nét) —
  // giữ nguyên font đầy đủ, đổi lại file lớn hơn (~300KB) nhưng hiển thị đúng.
  const regular = await pdfDoc.embedFont(loadFont('NotoSans-Regular.ttf'), { subset: false })
  const bold = await pdfDoc.embedFont(loadFont('NotoSans-Bold.ttf'), { subset: false })

  const page = pdfDoc.addPage([842, 595]) // A4 ngang (points)
  const brand = rgb(0.11, 0.43, 0.94)
  const slate = rgb(0.35, 0.41, 0.5)

  page.drawRectangle({ x: 0, y: 0, width: page.getWidth(), height: page.getHeight(), borderWidth: 3, borderColor: brand })
  page.drawRectangle({ x: 16, y: 16, width: page.getWidth() - 32, height: page.getHeight() - 32, borderWidth: 1, borderColor: brand })

  drawCentered(page, opts.appName, 500, bold, 16, brand)
  drawCentered(page, 'GIẤY CHỨNG NHẬN', 445, bold, 30)
  drawCentered(page, 'Chứng nhận tham gia hoạt động tình nguyện', 410, regular, 13, slate)

  drawCentered(page, 'Trao tặng', 355, regular, 12, slate)
  drawCentered(page, opts.recipientName, 315, bold, 26, brand)
  if (opts.studentCode) drawCentered(page, `MSSV: ${opts.studentCode}`, 285, regular, 12, slate)

  const body = `Đã tham gia sự kiện "${opts.campaignTitle}"${opts.organizer ? ` do ${opts.organizer} tổ chức` : ''}.`
  drawCentered(page, body, 245, regular, 13)
  drawCentered(page, `Số giờ tình nguyện: ${opts.hours} giờ · Điểm rèn luyện: ${opts.points} điểm`, 215, bold, 13, brand)

  const issuedLabel = new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(opts.issuedAt)
  drawCentered(page, `Ngày cấp: ${issuedLabel}`, 100, regular, 11, slate)

  return pdfDoc.save()
}
