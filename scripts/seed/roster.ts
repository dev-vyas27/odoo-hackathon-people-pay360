


import { SEED, seedId } from './ids'



export const MAIL_DOMAIN = 'mailinator.com'



const IN_GIVEN = [
  'Aarav', 'Aditya', 'Arjun', 'Rohan', 'Kabir', 'Ishaan', 'Karthik', 'Rahul', 'Siddharth',
  'Nikhil', 'Vikram', 'Aniket', 'Pranav', 'Yash', 'Dhruv', 'Aryan', 'Sameer', 'Tanmay',
  'Varun', 'Abhishek', 'Gaurav', 'Naveen', 'Rajat', 'Anand', 'Deepak', 'Kunal', 'Mohit',
  'Nitin', 'Parth', 'Raghav', 'Sachin', 'Tushar', 'Vishal', 'Manav', 'Harsh', 'Rudra',
  'Aanya', 'Aditi', 'Ananya', 'Bhavna', 'Chitra', 'Deepika', 'Divya', 'Gauri', 'Isha',
  'Kavya', 'Meera', 'Neha', 'Nandini', 'Pooja', 'Priya', 'Radhika', 'Riya', 'Sanya',
  'Shreya', 'Sneha', 'Swati', 'Tanvi', 'Trisha', 'Vaishnavi', 'Anjali', 'Kritika',
  'Namrata', 'Payal', 'Rashmi', 'Sakshi', 'Shalini', 'Preeti', 'Nisha', 'Ritika', 'Ishita',
]

const IN_FAMILY = [
  'Sharma', 'Verma', 'Iyer', 'Nair', 'Desai', 'Reddy', 'Patel', 'Gupta', 'Mehta',
  'Kulkarni', 'Chatterjee', 'Banerjee', 'Mukherjee', 'Joshi', 'Rao', 'Kapoor', 'Malhotra',
  'Bhat', 'Pillai', 'Menon', 'Sinha', 'Chauhan', 'Rathore', 'Bose', 'Dutta', 'Ghosh',
  'Shetty', 'Naidu', 'Deshmukh', 'Agarwal', 'Bansal', 'Chopra', 'Khanna', 'Saxena',
  'Trivedi', 'Hegde', 'Kamath', 'Sundaram', 'Krishnan', 'Raghunathan',
]

const US_GIVEN = [
  'James', 'Michael', 'Robert', 'David', 'William', 'Christopher', 'Daniel', 'Matthew',
  'Andrew', 'Joshua', 'Ryan', 'Brandon', 'Justin', 'Ethan', 'Tyler', 'Nathan', 'Brian',
  'Kevin', 'Eric', 'Adam', 'Jason', 'Aaron', 'Sean', 'Patrick', 'Derek', 'Marcus',
  'Grant', 'Logan', 'Cole', 'Spencer',
  'Mary', 'Jennifer', 'Linda', 'Elizabeth', 'Sarah', 'Jessica', 'Emily', 'Ashley',
  'Amanda', 'Megan', 'Rachel', 'Lauren', 'Nicole', 'Katherine', 'Hannah', 'Olivia',
  'Sophia', 'Madison', 'Chloe', 'Grace', 'Natalie', 'Victoria', 'Samantha', 'Brooke',
  'Danielle', 'Erin', 'Heather', 'Kelly', 'Monica', 'Paige',
]

const US_FAMILY = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White',
  'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young',
  'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Hill', 'Flores', 'Whitfield',
]



export type Level = 'intern' | 'junior' | 'mid' | 'senior' | 'lead' | 'manager' | 'director'



const BANDS: Record<Level, [number, number]> = {
  intern: [18_000, 28_000],
  junior: [38_000, 62_000],
  mid: [70_000, 115_000],
  senior: [125_000, 185_000],
  lead: [190_000, 250_000],
  manager: [220_000, 300_000],
  director: [340_000, 460_000],
}



const US_MULTIPLIER = 2.4

export type DepartmentKey =
  | 'engineering'
  | 'product'
  | 'sales'
  | 'marketing'
  | 'success'
  | 'finance'
  | 'humanResources'
  | 'operations'

interface Post {
  title: string
  level: Level
  
  weight: number
}

interface DepartmentSpec {
  key: DepartmentKey
  name: string
  code: string
  headcount: number
  
  head: Post
  
  managers: { post: Post; count: number }
  
  posts: Post[]
}

const DEPARTMENTS: DepartmentSpec[] = [
  {
    key: 'engineering',
    name: 'Engineering',
    code: 'ENG',
    headcount: 48,
    head: { title: 'VP of Engineering', level: 'director', weight: 1 },
    managers: { post: { title: 'Engineering Manager', level: 'manager', weight: 1 }, count: 4 },
    posts: [
      { title: 'Software Engineer', level: 'mid', weight: 10 },
      { title: 'Senior Software Engineer', level: 'senior', weight: 7 },
      { title: 'Staff Engineer', level: 'lead', weight: 2 },
      { title: 'QA Engineer', level: 'mid', weight: 4 },
      { title: 'DevOps Engineer', level: 'senior', weight: 3 },
      { title: 'Engineering Intern', level: 'intern', weight: 3 },
    ],
  },
  {
    key: 'product',
    name: 'Product & Design',
    code: 'PRD',
    headcount: 16,
    head: { title: 'Head of Product', level: 'director', weight: 1 },
    managers: { post: { title: 'Senior Product Manager', level: 'lead', weight: 1 }, count: 2 },
    posts: [
      { title: 'Product Manager', level: 'senior', weight: 4 },
      { title: 'Product Designer', level: 'mid', weight: 5 },
      { title: 'UX Researcher', level: 'mid', weight: 2 },
    ],
  },
  {
    key: 'sales',
    name: 'Sales',
    code: 'SLS',
    headcount: 30,
    head: { title: 'VP of Sales', level: 'director', weight: 1 },
    managers: { post: { title: 'Regional Sales Manager', level: 'manager', weight: 1 }, count: 3 },
    posts: [
      { title: 'Account Executive', level: 'mid', weight: 8 },
      { title: 'Senior Account Executive', level: 'senior', weight: 4 },
      { title: 'Sales Development Representative', level: 'junior', weight: 6 },
    ],
  },
  {
    key: 'marketing',
    name: 'Marketing',
    code: 'MKT',
    headcount: 14,
    head: { title: 'Head of Marketing', level: 'director', weight: 1 },
    managers: { post: { title: 'Performance Marketing Lead', level: 'lead', weight: 1 }, count: 1 },
    posts: [
      { title: 'Marketing Associate', level: 'junior', weight: 5 },
      { title: 'Content Strategist', level: 'mid', weight: 4 },
      { title: 'Brand Designer', level: 'mid', weight: 2 },
    ],
  },
  {
    key: 'success',
    name: 'Customer Success',
    code: 'CS',
    headcount: 22,
    head: { title: 'Director of Customer Success', level: 'director', weight: 1 },
    managers: { post: { title: 'Customer Success Team Lead', level: 'lead', weight: 1 }, count: 2 },
    posts: [
      { title: 'Customer Success Manager', level: 'mid', weight: 7 },
      { title: 'Support Specialist', level: 'junior', weight: 8 },
    ],
  },
  {
    key: 'finance',
    name: 'Finance & Accounts',
    code: 'FIN',
    headcount: 14,
    head: { title: 'Finance Controller', level: 'director', weight: 1 },
    managers: { post: { title: 'Payroll Manager', level: 'manager', weight: 1 }, count: 1 },
    posts: [
      { title: 'Financial Analyst', level: 'mid', weight: 4 },
      { title: 'Payroll Specialist', level: 'mid', weight: 3 },
      { title: 'Accounts Executive', level: 'junior', weight: 4 },
    ],
  },
  {
    key: 'humanResources',
    name: 'Human Resources',
    code: 'HR',
    headcount: 12,
    head: { title: 'Head of People', level: 'director', weight: 1 },
    managers: { post: { title: 'HR Manager', level: 'manager', weight: 1 }, count: 1 },
    posts: [
      { title: 'HR Business Partner', level: 'mid', weight: 4 },
      { title: 'Talent Acquisition Specialist', level: 'mid', weight: 3 },
      { title: 'HR Executive', level: 'junior', weight: 3 },
    ],
  },
  {
    key: 'operations',
    name: 'Operations',
    code: 'OPS',
    headcount: 18,
    head: { title: 'Head of Operations', level: 'director', weight: 1 },
    managers: { post: { title: 'Operations Manager', level: 'manager', weight: 1 }, count: 2 },
    posts: [
      { title: 'Operations Analyst', level: 'mid', weight: 6 },
      { title: 'Operations Executive', level: 'junior', weight: 5 },
      { title: 'Facilities Coordinator', level: 'junior', weight: 3 },
    ],
  },
]


export const POSTS: Array<{ title: string; departmentKey: DepartmentKey; level: Level }> =
  DEPARTMENTS.flatMap((department) =>
    [department.head, department.managers.post, ...department.posts].map((post) => ({
      title: post.title,
      departmentKey: department.key,
      level: post.level,
    })),
  )

const POST_INDEX = new Map(POSTS.map((post, i) => [`${post.departmentKey}:${post.title}`, i + 1]))

export const DEPARTMENT_SPECS = DEPARTMENTS



export const SCHEDULES = {
  standard40: SEED.schedules.standard40,
  partTime20: SEED.schedules.partTime20,
  compressed36: seedId('sch', 3),
  intern30: seedId('sch', 4),
} as const




function makeRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface RosterPerson {
  
  index: number
  id: string
  name: string
  email: string
  phone: string
  departmentKey: DepartmentKey
  jobIndex: number
  title: string
  level: Level
  employeeType: 'full_time' | 'part_time' | 'contract' | 'intern'
  scheduleId: string
  
  wage: number
  bankAccount: string | null
  isActive: boolean
  
  managerId: string | null
  origin: 'IN' | 'US'
}



const CAST: Array<Partial<RosterPerson> & { index: number; departmentKey: DepartmentKey }> = [
  {
    index: 1,
    name: 'Priya Sharma',
    departmentKey: 'engineering',
    title: 'Senior Software Engineer',
    level: 'senior',
    origin: 'IN',
  },
  {
    index: 2,
    name: 'Rahul Verma',
    departmentKey: 'sales',
    title: 'Senior Account Executive',
    level: 'senior',
    origin: 'IN',
  },
]

function slug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z\s]/g, '')
    .trim()
    .split(/\s+/)
    .join('.')
}


function weighted<T extends { weight: number }>(items: T[], roll: number): T {
  const total = items.reduce((sum, item) => sum + item.weight, 0)
  let cursor = roll * total
  for (const item of items) {
    cursor -= item.weight
    if (cursor <= 0) return item
  }
  return items[items.length - 1]
}

function buildRoster(): RosterPerson[] {
  const random = makeRng(360_2026)
  const people: RosterPerson[] = []
  const usedNames = new Set<string>(CAST.map((entry) => entry.name!))
  const usedEmails = new Set<string>()

  
  function uniqueName(origin: 'IN' | 'US'): string {
    const given = origin === 'IN' ? IN_GIVEN : US_GIVEN
    const family = origin === 'IN' ? IN_FAMILY : US_FAMILY
    for (let attempt = 0; attempt < 500; attempt += 1) {
      const name = `${given[Math.floor(random() * given.length)]} ${
        family[Math.floor(random() * family.length)]
      }`
      if (!usedNames.has(name)) {
        usedNames.add(name)
        return name
      }
    }
    throw new Error('Name pool exhausted — add more names to roster.ts')
  }

  
  function uniqueEmail(name: string): string {
    const base = slug(name)
    let candidate = `${base}@${MAIL_DOMAIN}`
    let n = 2
    while (usedEmails.has(candidate)) {
      candidate = `${base}${n}@${MAIL_DOMAIN}`
      n += 1
    }
    usedEmails.add(candidate)
    return candidate
  }

  
  function flesh(
    index: number,
    name: string,
    origin: 'IN' | 'US',
    departmentKey: DepartmentKey,
    post: { title: string; level: Level },
    options: { protected?: boolean } = {},
  ): RosterPerson {
    const level = post.level
    const [low, high] = BANDS[level]
    const base = low + random() * (high - low)
    const wage = Math.round((origin === 'US' ? base * US_MULTIPLIER : base) / 500) * 500

    const employeeType: RosterPerson['employeeType'] =
      level === 'intern'
        ? 'intern'
        : random() < 0.06
          ? 'part_time'
          : random() < 0.06
            ? 'contract'
            : 'full_time'

    const scheduleId =
      employeeType === 'intern'
        ? SCHEDULES.intern30
        : employeeType === 'part_time'
          ? SCHEDULES.partTime20
          : random() < 0.12
            ? SCHEDULES.compressed36
            : SCHEDULES.standard40

    


    const missingBank = !options.protected && random() < 0.035

    
    const isActive = options.protected || random() > 0.035

    return {
      index,
      id: seedId('emp', index),
      name,
      email: uniqueEmail(name),
      phone:
        origin === 'IN'
          ? `+91 ${90 + Math.floor(random() * 10)}${String(
              Math.floor(random() * 100_000_000),
            ).padStart(8, '0')}`
          : `+1 ${200 + Math.floor(random() * 700)} ${String(
              Math.floor(random() * 10_000_000),
            ).padStart(7, '0')}`,
      departmentKey,
      jobIndex: POST_INDEX.get(`${departmentKey}:${post.title}`)!,
      title: post.title,
      level,
      employeeType,
      scheduleId,
      wage,
      bankAccount: missingBank
        ? null
        : origin === 'IN'
          ? `HDFC${String(Math.floor(random() * 10_000_000_000)).padStart(11, '0')}`
          : `CHASE${String(Math.floor(random() * 1_000_000_000)).padStart(10, '0')}`,
      isActive,
      managerId: null,
      origin,
    }
  }

  


  for (const entry of CAST) {
    people.push(
      flesh(
        entry.index,
        entry.name!,
        entry.origin!,
        entry.departmentKey,
        { title: entry.title!, level: entry.level! },
        { protected: true },
      ),
    )
  }

  let nextIndex = CAST.length + 1

  for (const department of DEPARTMENTS) {
    
    const alreadyHere = people.filter((p) => p.departmentKey === department.key).length
    const remaining = Math.max(0, department.headcount - alreadyHere)

    const headIndex = nextIndex
    const managerIndexes: number[] = []

    for (let slot = 0; slot < remaining; slot += 1) {
      const index = nextIndex
      nextIndex += 1

      const isHead = slot === 0
      const isManager = !isHead && managerIndexes.length < department.managers.count

      
      const origin: 'IN' | 'US' = random() < 0.3 ? 'US' : 'IN'
      const post = isHead
        ? department.head
        : isManager
          ? department.managers.post
          : weighted(department.posts, random())

      if (isManager) managerIndexes.push(index)

      people.push(
        flesh(index, uniqueName(origin), origin, department.key, post, {
          protected: isHead || isManager,
        }),
      )
    }

    


    const inDepartment = people.filter((person) => person.departmentKey === department.key)
    const head = inDepartment.find((person) => person.index === headIndex)
    const managers = inDepartment.filter((person) => managerIndexes.includes(person.index))

    inDepartment.forEach((person, position) => {
      if (person.index === headIndex) return
      if (managerIndexes.includes(person.index)) {
        person.managerId = head?.id ?? null
        return
      }
      person.managerId = managers.length
        ? managers[position % managers.length].id
        : (head?.id ?? null)
    })
  }

  return people.sort((a, b) => a.index - b.index)
}


export const ROSTER: RosterPerson[] = buildRoster()

export const ROSTER_BY_ID = new Map(ROSTER.map((person) => [person.id, person]))


export const DEPARTMENT_HEADS: Record<string, string> = Object.fromEntries(
  DEPARTMENTS.map((department) => {
    const head = ROSTER.find(
      (person) => person.departmentKey === department.key && person.title === department.head.title,
    )
    return [department.key, head?.id ?? '']
  }).filter(([, id]) => id !== ''),
)


export const ACTIVE_ROSTER = ROSTER.filter((person) => person.isActive)



function findByTitle(title: string): RosterPerson {
  const person = ROSTER.find((candidate) => candidate.title === title && candidate.isActive)
  if (!person) throw new Error(`No active roster member holds the post "${title}"`)
  return person
}

export const STAFF = {
  admin: SEED.users.admin,
  hrManager: findByTitle('HR Manager'),
  payrollUser: findByTitle('Payroll Specialist'),
  payrollManager: findByTitle('Payroll Manager'),
  employee: ROSTER_BY_ID.get(SEED.employees.demoLead)!,
} as const


export const STAFF_IDS = new Set<string>([
  STAFF.admin,
  STAFF.hrManager.id,
  STAFF.payrollUser.id,
  STAFF.payrollManager.id,
])
