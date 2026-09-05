/**
 * Route guard.
 *
 * Next.js 16 renamed `middleware.ts` to `proxy.ts` and the exported function to
 * `proxy`. The runtime is Node.js and is NOT configurable — which is convenient
 * here, because it means we can verify the JWT properly rather than doing a
 * cookie-presence hand-wave at the edge.
 *
 * This is coarse-grained gatekeeping only: is there a valid session, and is this
 * area of the app allowed for that role. Row-level rules ("your own attendance
 * only") belong in use cases, never here.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { AUTH_COOKIE, verifyToken } from '@/lib/auth'
import { can, type Resource } from '@/modules/shared/contracts/permissions'

/** Top-level sections and the resource each one reads. */
const SECTION_RESOURCE: Array<{ prefix: string; resource: Resource }> = [
  { prefix: '/employees', resource: 'employee' },
  { prefix: '/contracts', resource: 'contract' },
  { prefix: '/schedules', resource: 'working_schedule' },
  { prefix: '/attendance', resource: 'attendance' },
  { prefix: '/time-off', resource: 'leave_request' },
  { prefix: '/payroll/structures', resource: 'salary_structure' },
  { prefix: '/payroll/rules', resource: 'salary_rule' },
  { prefix: '/payroll/payslips', resource: 'payslip' },
  { prefix: '/payroll', resource: 'payrun' },
  { prefix: '/reports', resource: 'dashboard' },
  { prefix: '/admin', resource: 'user' },
]

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/health']

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next()
  }

  const token = request.cookies.get(AUTH_COOKIE)?.value
  const payload = token ? verifyToken(token) : null

  if (!payload) {
    // API callers get JSON; humans get redirected somewhere useful.
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: 'Sign in to continue' } },
        { status: 401 },
      )
    }
    const login = new URL('/login', request.url)
    login.searchParams.set('next', pathname)
    return NextResponse.redirect(login)
  }

  // Section-level authorization for page navigations.
  const section = SECTION_RESOURCE.find((s) => pathname.startsWith(s.prefix))
  if (section && !can(payload.role, section.resource, 'read')) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Your role cannot access this area' } },
        { status: 403 },
      )
    }
    return NextResponse.redirect(new URL('/forbidden', request.url))
  }

  return NextResponse.next()
}

export const config = {
  /**
   * Skip static assets and image optimisation; match everything else including
   * /api so unauthenticated API calls fail fast with JSON.
   */
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|fonts/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|otf|woff2?)$).*)',
  ],
}
