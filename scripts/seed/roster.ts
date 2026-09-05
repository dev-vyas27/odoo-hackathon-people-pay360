/**
 * The workforce. One generated company, used by every seed part.
 *
 * Departments, posts, people, reporting lines and wages are all derived here
 * so that `people`, `employment`, `attendance`, `timeoff` and
 * `payroll-processing` all describe the SAME company. Before this they each
 * hardcoded their own five employees and had to be kept in step by hand — the
 * wage table in payroll-processing carried a comment reading "must match
 * employment.seed.ts", which is a comment that is one edit away from being a
 * lie. Now there is one source and nothing to synchronise.
 *
 * ── Deterministic, not random ──────────────────────────────────────────────
 *
 * Every value comes from a seeded PRNG, so the roster is byte-identical on
 * every run. That is not a nicety: the whole seed is `ON CONFLICT (id) DO
 * UPDATE` keyed on ids derived from the row index, so a person who changed
 * department between runs would leave their old attendance behind pointing at
 * the wrong team. Fixed output also means a rehearsed demo URL still opens the
 * same employee tomorrow.
 *
 * `Math.random()` would break both. Do not introduce it here.
 */
import { SEED, seedId } from './ids'

/**
 * Where the demo's mail goes.
 *
 * A public throwaway-mail service, so the "Send payslips" flow can be run end
 * to end and the result actually opened — nothing else in the system produces
 * evidence you can hold up. Addresses are name-derived, so `priya.sharma`'s
 * payslip lands in an inbox that reads as hers.
 *
 * These inboxes are PUBLIC: anyone who knows the address can read them. That is
 * fine for invented people and must never be pointed at real staff. Change this
 * one constant to a domain you control before this goes anywhere near a real
 * employee.
 */
export const MAIL_DOMAIN = 'mailinator.com'

// ───────────────────────────────────────────────────────────────────────────
// Names
//
// Real, ordinary names from the two places this company hires: an Indian head
// office and a US office. Deliberately not "Test User 42" — a demo where every
// row reads as filler invites the reader to assume the rest is filler too.
// ───────────────────────────────────────────────────────────────────────────

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

// ───────────────────────────────────────────────────────────────────────────
// Structure
// ───────────────────────────────────────────────────────────────────────────

export type Level = 'intern' | 'junior' | 'mid' | 'senior' | 'lead' | 'manager' | 'director'

/**
 * Monthly wage band per level, in rupees.
 *
 * Bands rather than single figures, so a department's salary cost is not a
 * suspiciously round multiple of its headcount, and so the "Average salary"
 * tile reads as a real average rather than a repeated number.
 */
const BANDS: Record<Level, [number, number]> = {
  intern: [18_000, 28_000],
  junior: [38_000, 62_000],
  mid: [70_000, 115_000],
  senior: [125_000, 185_000],
  lead: [190_000, 250_000],
  manager: [220_000, 300_000],
  director: [340_000, 460_000],
}

/**
 * The US office is paid on a US market rate, converted.
 *
 * One payroll, one currency: this company runs its books in rupees, so a US
 * salary is stated here in rupees the way any Indian parent company would state
 * it. Without the multiplier the two offices would be indistinguishable on the
 * department cost chart, which is the one place the difference should show.
 */
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
  /** Roughly how many of this post the department has, relative to its peers. */
  weight: number
}

interface DepartmentSpec {
  key: DepartmentKey
  name: string
  code: string
  headcount: number
  /** The post the department head holds. Exactly one person gets it. */
  head: Post
  /** Middle management. Reports to the head; everyone else reports to them. */
  managers: { post: Post; count: number }
  /** Individual contributors, sampled by weight. */
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

/** Every distinct post across the company, numbered for `seedId('job', n)`. */
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

// ───────────────────────────────────────────────────────────────────────────
// Schedules
// ───────────────────────────────────────────────────────────────────────────

export const SCHEDULES = {
  standard40: SEED.schedules.standard40,
  partTime20: SEED.schedules.partTime20,
  compressed36: seedId('sch', 3),
  intern30: seedId('sch', 4),
} as const

// ───────────────────────────────────────────────────────────────────────────
// Generation
// ───────────────────────────────────────────────────────────────────────────

/** mulberry32 — small, fast, and identical on every platform. */
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
  /** Index into `seedId('emp', n)`. 1-based. */
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
  /** Monthly, in rupees. The contract wage and every payslip derive from this. */
  wage: number
  bankAccount: string | null
  isActive: boolean
  /** `seedId('emp', n)` of this person's manager, or null for a department head. */
  managerId: string | null
  origin: 'IN' | 'US'
}

/**
 * The two people the demo script names.
 *
 * Kept at fixed indexes because `SEED.employees` promises they mean these
 * things: index 1 is the protagonist whose login demonstrates row-level
 * scoping, index 2 is the one carrying an expired contract alongside a current
 * one. Both are ordinary members of their departments otherwise — the cast is
 * pinned, not privileged.
 */
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

/** Pick by weight, so a department has ten engineers and two staff engineers. */
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

  /** A name nobody else has. Falls back through the pool rather than looping. */
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

  /** `priya.sharma@…`, with a numeric suffix only if it is genuinely taken. */
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

  /** Everything about a person that follows from their post and origin. */
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

    /**
     * A handful have no bank account on file, which is what gives the
     * dashboard's "cannot be paid until filled in" alert something true to
     * report. Never a head or a manager — an alert naming the VP of Engineering
     * reads as broken data rather than as a real gap.
     */
    const missingBank = !options.protected && random() < 0.035

    // A few people have left. Archived, not deleted: their payslips remain.
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

  /**
   * The named cast takes indexes 1 and 2 before anything else.
   *
   * `SEED.employees.demoLead` and `.twoContracts` are those two ids, and the
   * timeoff and payroll parts reference them by name. Generating departments
   * first would hand those indexes to whoever happened to come first in
   * Engineering.
   */
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
    // The cast already fills some of this department's seats.
    const alreadyHere = people.filter((p) => p.departmentKey === department.key).length
    const remaining = Math.max(0, department.headcount - alreadyHere)

    const headIndex = nextIndex
    const managerIndexes: number[] = []

    for (let slot = 0; slot < remaining; slot += 1) {
      const index = nextIndex
      nextIndex += 1

      const isHead = slot === 0
      const isManager = !isHead && managerIndexes.length < department.managers.count

      // Roughly a third of the company sits in the US office.
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

    /**
     * Reporting lines, once the department is fully built.
     *
     * The head reports to nobody, managers report to the head, and everyone
     * else is spread across the managers round-robin. A second pass because a
     * manager has to exist in the array before anyone can point at them.
     */
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

/** Built once. Every seed part reads this same array. */
export const ROSTER: RosterPerson[] = buildRoster()

export const ROSTER_BY_ID = new Map(ROSTER.map((person) => [person.id, person]))

/** The head of each department, for `departments.manager_id`. */
export const DEPARTMENT_HEADS: Record<string, string> = Object.fromEntries(
  DEPARTMENTS.map((department) => {
    const head = ROSTER.find(
      (person) => person.departmentKey === department.key && person.title === department.head.title,
    )
    return [department.key, head?.id ?? '']
  }).filter(([, id]) => id !== ''),
)

/** Active people only — everything downstream of employment cares about these. */
export const ACTIVE_ROSTER = ROSTER.filter((person) => person.isActive)

/**
 * The people who can sign in, one per role.
 *
 * Four of the five are ORDINARY ROSTER MEMBERS promoted to a role, found by the
 * post they hold — the HR Manager is the person in Human Resources whose job
 * title is HR Manager, not a synthetic account standing beside the real ones.
 * That is how the product actually works: an administrator creates an employee,
 * and that employee is the account.
 *
 * The administrator is the exception and stays a row of its own with no
 * department. It operates the system rather than working in it, and the
 * employee list filters admins out for exactly that reason — promoting a roster
 * member would silently drop them from the headcount.
 */
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

/** Anyone with an elevated role, so the seed never treats them as a plain hire. */
export const STAFF_IDS = new Set<string>([
  STAFF.admin,
  STAFF.hrManager.id,
  STAFF.payrollUser.id,
  STAFF.payrollManager.id,
])
