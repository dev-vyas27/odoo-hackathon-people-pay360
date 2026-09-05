import { redirect } from 'next/navigation'

/** /payroll has no screen of its own — pay runs are what people come here for. */
export default function PayrollIndexPage() {
  redirect('/payroll/payruns')
}
