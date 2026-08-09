import { flushEmailQueue } from '../src/lib/mail'

async function main() {
  const result = await flushEmailQueue(100)
  console.log(`Đã gửi: ${result.sent}, lỗi: ${result.failed}${result.skipped ? ' (chưa cấu hình SMTP)' : ''}`)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
