


import { registerTimeOff } from '@/modules/timeoff'
import { registerDelivery } from '@/modules/delivery'
import { registerPeople } from '@/modules/people'
import { registerEmployment } from '@/modules/employment'
import { registerAttendance } from '@/modules/attendance'
import { registerPayrollPorts } from '@/modules/payroll-processing/composition'
import { registerInterimAdapters } from '@/lib/interim-adapters'

let done = false

export function bootstrap(): void {
  
  
  if (done) return
  done = true

  
  registerTimeOff()
  
  registerDelivery()

  
  registerPeople()          
  registerEmployment()      
  registerAttendance()      

  
  
  
  
  registerPayrollPorts()

  
  
  registerInterimAdapters()
}
