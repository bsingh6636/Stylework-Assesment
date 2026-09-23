import { LoaderCircle, Trash2 } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { Lead } from '../types.ts'

interface DeleteLeadDialogProps {
  lead: Lead | null
  onClose: () => void
  onConfirm: (lead: Lead) => Promise<void>
}

// A native modal <dialog> traps focus, closes on Escape and returns focus to
// the button that opened it. Cancel comes first, so it is focused by default.
function DeleteLeadDialog({ lead, onClose, onConfirm }: DeleteLeadDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (lead && !dialog?.open) dialog?.showModal()
    if (!lead && dialog?.open) dialog.close()
  }, [lead])

  async function handleConfirm(lead: Lead) {
    setIsDeleting(true)
    try {
      await onConfirm(lead)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        if (isDeleting) event.preventDefault()
      }}
      onClose={onClose}
    >
      {lead && (
        <>
          <h2 id={titleId}>Delete lead?</h2>
          <p>
            <strong>{lead.name}</strong> ({lead.email}) will be removed permanently. This can't be undone.
          </p>
          <div className="dialog-actions">
            <button type="button" className="button-secondary" onClick={onClose} disabled={isDeleting}>
              Cancel
            </button>
            <button
              type="button"
              className="button-danger"
              onClick={() => handleConfirm(lead)}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <LoaderCircle className="spin" size={16} aria-hidden="true" />
              ) : (
                <Trash2 size={16} aria-hidden="true" />
              )}
              {isDeleting ? 'Deleting…' : 'Delete lead'}
            </button>
          </div>
        </>
      )}
    </dialog>
  )
}

export default DeleteLeadDialog
