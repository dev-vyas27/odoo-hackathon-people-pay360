

import { CONTRACT_PLAN } from '../contracts'
import { STRUCTURE_ID } from './payroll-config.seed'
import type { SeedPart } from '../types'

export const employmentSeed: SeedPart = {
  name: 'employment',
  tables: ['contracts'],
  async run(ctx) {
    const contracts = await ctx.upsert(
      'contracts',
      CONTRACT_PLAN.map((contract) => ({
        id: contract.id,
        employee_id: contract.employeeId,
        wage: contract.wage,
        salary_structure_id: STRUCTURE_ID,
        working_schedule_id: contract.scheduleId,
        starts_on: contract.startsOn,
        ends_on: contract.endsOn,
        status: contract.status,
      })),
    )

    const active = CONTRACT_PLAN.filter((c) => c.status === 'active').length
    const endingSoon = CONTRACT_PLAN.filter((c) => c.status === 'active' && c.endsOn).length
    ctx.log(`${contracts} contracts (${active} active, ${endingSoon} ending inside the window)`)
  },
}
