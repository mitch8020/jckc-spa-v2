import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { downloadFile } from '#/api/client'

export type ReportKind = 'sign-in-sheet' | 'roll-call-sheet'

const REPORTS: Record<ReportKind, { path: string; filename: string }> = {
  'sign-in-sheet': {
    path: '/api/reports/sign-in-sheet',
    filename: 'sign-in-sheet.pdf',
  },
  'roll-call-sheet': {
    path: '/api/reports/roll-call-sheet',
    filename: 'roll-call-sheet.pdf',
  },
}

/**
 * Downloads one of the two generated PDF reports (admin/teacher only).
 * While pending, `mutation.variables` holds the kind being fetched, so two
 * buttons can share the hook and show independent loading states.
 */
export function useDownloadReport() {
  return useMutation({
    mutationFn: (kind: ReportKind) => {
      const report = REPORTS[kind]
      return downloadFile(report.path, report.filename)
    },
    onSuccess: (_data, kind) => {
      toast.success(
        kind === 'sign-in-sheet'
          ? 'Sign-in sheets downloaded'
          : 'Roll call sheets downloaded',
      )
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Could not download the report')
    },
  })
}
