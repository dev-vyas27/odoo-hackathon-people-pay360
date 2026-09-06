


import { PayrollTabs } from './_components/payroll-tabs'

export default function PayrollLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <PayrollTabs />
      {children}
    </div>
  )
}

