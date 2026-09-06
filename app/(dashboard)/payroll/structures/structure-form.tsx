'use client'



import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  salaryStructureFormSchema,
  type SalaryStructureFormValues,
} from '@/modules/payroll-config'
import { ResourceForm, type FieldConfig } from '@/components/resource/resource-form'
import { Button } from '@/components/ui/button'
import { ApiError, apiPatch, apiPost } from '../_lib/api'
import { StructureRulesField, type AvailableRule } from './structure-rules-field'

const fields: FieldConfig<SalaryStructureFormValues>[] = [
  { name: 'name', label: 'Name', placeholder: 'Standard Monthly' },
  {
    name: 'code',
    label: 'Code',
    placeholder: 'STD_MONTHLY',
    description: 'Uppercase identifier used by contracts and imports.',
  },
  { name: 'active', label: 'Active', type: 'checkbox', span: 2 },
]

export const emptyStructure: SalaryStructureFormValues = {
  name: '',
  code: '',
  active: true,
  rules: [],
}

export function StructureForm({
  structure,
  structureId,
  available,
  readOnly = false,
}: {
  structure: SalaryStructureFormValues
  structureId?: string
  available: AvailableRule[]
  
  readOnly?: boolean
}) {
  const router = useRouter()

  async function submit(values: SalaryStructureFormValues) {
    try {
      if (structureId) {
        await apiPatch(`/api/payroll/structures/${structureId}`, values)
        toast.success(`Saved "${values.name}"`)
      } else {
        await apiPost('/api/payroll/structures', values)
        toast.success(`Created "${values.name}"`)
      }
      router.push('/payroll/structures')
      router.refresh()
    } catch (reason) {
      toast.error(reason instanceof ApiError ? reason.message : 'Could not save this structure')
    }
  }

  return (
    <ResourceForm
      readOnly={readOnly}
      schema={salaryStructureFormSchema}
      fields={fields}
      defaultValues={structure as never}
      onSubmit={submit}
      submitLabel={structureId ? 'Save structure' : 'Create structure'}
      cancel={
        <Button asChild type="button" variant="ghost">
          <Link href="/payroll/structures">Cancel</Link>
        </Button>
      }
    >
      <StructureRulesField available={available} />
    </ResourceForm>
  )
}
