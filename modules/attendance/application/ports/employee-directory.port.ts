/**
 * EmployeeDirectoryPort — the facts from `people` that attendance needs.
 *
 * `departmentIdFor` is denormalized onto our own records rather than joined at
 * report time, which is what lets AttendanceStatsPort.summary filter by
 * department with a single aggregation pipeline instead of a cross-module join.
 *
 * `workingScheduleIdFor` feeds ScheduleLookupAdapter: exception derivation must
 * know which schedule to judge a check-in against.
 */
export interface EmployeeDirectoryPort {
  departmentIdFor(employeeId: string): Promise<string | null>
  workingScheduleIdFor(employeeId: string): Promise<string | null>
}
