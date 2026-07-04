import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '#/components/ui/alert-dialog'
import type { ReactNode } from 'react'

/**
 * Destructive confirmation dialog (red confirm button). Use either
 * controlled (`open`/`onOpenChange`) or with a `trigger` element. The dialog
 * stays open while `loading` so async deletes can settle before the parent
 * closes it.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  loading = false,
  onConfirm,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: ReactNode
  title: string
  description: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  loading?: boolean
  onConfirm: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {trigger ? (
        <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      ) : null}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="display-title">{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={loading}
            onClick={(event) => {
              // keep the dialog open until the caller closes it (async safety)
              event.preventDefault()
              onConfirm()
            }}
          >
            {loading ? 'Working…' : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
