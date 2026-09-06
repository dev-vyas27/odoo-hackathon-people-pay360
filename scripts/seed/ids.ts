



export type SeedKind =
  | 'usr' 
  | 'emp' 
  | 'dep' 
  | 'job' 
  | 'con' 
  | 'sch' 
  | 'att' 
  | 'tot' 
  | 'alc' 
  | 'lvr' 
  | 'rul' 
  | 'str' 
  | 'run' 
  | 'psl' 



export function seedId(kind: SeedKind, index: number): string {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error(`seedId index must be a non-negative integer, got ${index}`)
  }

  
  const prefix = Buffer.from(kind, 'ascii').toString('hex').padEnd(8, '0')
  const suffix = index.toString(16).padStart(12, '0')

  if (suffix.length > 12) {
    throw new Error(`seedId index ${index} is too large to encode`)
  }

  
  return `${prefix}-0000-4000-8000-${suffix}`
}


export function seedIds(kind: SeedKind, count: number): string[] {
  return Array.from({ length: count }, (_, i) => seedId(kind, i + 1))
}



export const SEED = {
  users: {
    admin: seedId('usr', 1),
    hrManager: seedId('usr', 2),
    payrollUser: seedId('usr', 3),
    payrollManager: seedId('usr', 4),
    employee: seedId('usr', 5),
  },
  departments: {
    engineering: seedId('dep', 1),
    sales: seedId('dep', 2),
    operations: seedId('dep', 3),
    


    humanResources: seedId('dep', 4),
  },
  schedules: {
    standard40: seedId('sch', 1),
    partTime20: seedId('sch', 2),
  },
  timeOffTypes: {
    paid: seedId('tot', 1),
    sick: seedId('tot', 2),
    unpaid: seedId('tot', 3),
  },
  


  employees: {
    demoLead: seedId('emp', 1),
    twoContracts: seedId('emp', 2),
  },
} as const
