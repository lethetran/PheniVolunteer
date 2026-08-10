'use client'

import { SelectInput } from './field'

/** Select trong form GET — tự submit ngay khi đổi lựa chọn, không cần bấm nút/Enter. */
export function AutoSubmitSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <SelectInput
      {...props}
      onChange={(e) => {
        e.currentTarget.form?.requestSubmit()
      }}
    />
  )
}
