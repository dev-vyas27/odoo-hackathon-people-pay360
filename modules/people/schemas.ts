




export {
  EMPLOYEE_TYPES,
  EMPLOYEE_TYPE_LABELS,
  isEmployeeType,
  type EmployeeType,
} from './domain/employee-type'

export {
  employeeTypeSchema,
  createEmployeeSchema,
  updateEmployeeSchema,
  employeeQuerySchema,
  type CreateEmployeeBody,
  type UpdateEmployeeBody,
  type EmployeeQuery,
} from './interface/employee.schema'

export {
  createDepartmentSchema,
  updateDepartmentSchema,
  type CreateDepartmentBody,
  type UpdateDepartmentBody,
} from './interface/department.schema'

export {
  createJobPositionSchema,
  updateJobPositionSchema,
  type CreateJobPositionBody,
  type UpdateJobPositionBody,
} from './interface/job-position.schema'



export interface EmployeeListItem {
  id: string
  name: string
  email: string
  departmentId: string | null
  


  departmentName: string | null
  jobPositionId: string | null
  jobPositionName: string | null
  managerId: string | null
  managerName: string | null
  workingScheduleId: string | null
  workingScheduleName: string | null
  employeeType: 'full_time' | 'part_time' | 'contract' | 'intern'
  bankAccount: string | null
  isActive: boolean
}


export interface EmployeeDetailView extends EmployeeListItem {
  counts: {
    contracts: number
    attendance: number
    timeOff: number
    allocations: number
  }
}

export interface DepartmentListItem {
  id: string
  name: string
  managerId: string | null
  parentDepartmentId: string | null
}

export interface JobPositionListItem {
  id: string
  title: string
  departmentId: string | null
}
