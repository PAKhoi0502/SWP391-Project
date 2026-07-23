import { useState } from 'react'
import './ServiceStepsProgress.css'

const TEXT = {
  noSteps: 'No service steps found.',
  notInProgress: 'Steps can only be updated while the booking is in progress.',
  completeStep: 'Complete step',
  reopenStep: 'Reopen step',
  confirm: 'Confirm',
  confirmReopen: 'Confirm reopen',
  cancel: 'Cancel',
  notePlaceholder: 'Add a note (optional)...',
  pending: 'Pending',
  completed: 'Completed',
  completedAt: 'Completed at',
  completedBy: 'Updated by',
  processing: 'Processing...',
  blockedHint: 'Please fill and save the inspection before completing this step.',
}

const formatDateTime = (value) => {
  if (!value) return null
  return new Date(value).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
}

const normalizeStep = (step, index) => ({
  id: step.id,
  title: step.title || step.name || step.stepName || `Step ${index + 1}`,
  description: step.description || step.detail || '',
  order: Number(step.stepOrder || step.order || step.sequence || index + 1),
  status: String(step.status || 'PENDING').toUpperCase(),
  completedAt: step.completedAt || null,
  completedByStaffId: step.completedByStaffId || step.completedBy || step.staffId || null,
  note: step.note || step.staffNote || '',
  executionPhase: String(step.executionPhase || step.phase || '').toUpperCase(),
})

export default function ServiceStepsProgress({
  steps,
  bookingStatus,
  onCompleteStep,
  onReopenStep,
  actionLoadingStepId,
  error,
  renderStepExtra,
  isStepBlocked,
}) {
  const [expandedStepId, setExpandedStepId] = useState(null)
  const [expandAction, setExpandAction] = useState(null)
  const [noteValue, setNoteValue] = useState('')

  const isInProgress = String(bookingStatus || '').toUpperCase() === 'IN_PROGRESS'

  const normalizedSteps = Array.isArray(steps)
    ? steps.map(normalizeStep).sort((a, b) => a.order - b.order)
    : []

  const handleExpand = (stepId, action) => {
    if (expandedStepId === stepId && expandAction === action) {
      setExpandedStepId(null)
      setExpandAction(null)
      setNoteValue('')
      return
    }

    setExpandedStepId(stepId)
    setExpandAction(action)
    setNoteValue('')
  }

  const handleConfirm = (stepId) => {
    if (expandAction === 'complete') {
      onCompleteStep(stepId, noteValue.trim())
    } else {
      onReopenStep(stepId, noteValue.trim())
    }
    setExpandedStepId(null)
    setExpandAction(null)
    setNoteValue('')
  }

  const handleCancelExpand = () => {
    setExpandedStepId(null)
    setExpandAction(null)
    setNoteValue('')
  }

  if (normalizedSteps.length === 0) {
    return <p className="ssp-empty">{TEXT.noSteps}</p>
  }

  return (
    <div className="ssp-root">
      {error && <p className="ssp-error">{error}</p>}
      {!isInProgress && onCompleteStep && onReopenStep && (
        <p className="ssp-hint">{TEXT.notInProgress}</p>
      )}
      <ol className="ssp-list">
        {normalizedSteps.map((step) => {
          const isCompleted = step.status === 'COMPLETED'
          const isLoadingThis = actionLoadingStepId === step.id
          const isExpanded = expandedStepId === step.id
          const hasId = Boolean(step.id)
          const anyLoading = actionLoadingStepId !== null
          const blockedMsg = !isCompleted && isStepBlocked ? isStepBlocked(step) : null
          const blocked = Boolean(blockedMsg)

          return (
            <li
              key={step.id || step.order}
              className={`ssp-item${isCompleted ? ' ssp-item--completed' : ' ssp-item--pending'}`}
            >
              <div className="ssp-item-header">
                <span className="ssp-dot">{step.order}</span>
                <div className="ssp-item-body">
                  <div className="ssp-title-row">
                    <strong className="ssp-title">{step.title}</strong>
                    <span className={`ssp-badge${isCompleted ? ' ssp-badge--done' : ' ssp-badge--pending'}`}>
                      {isCompleted ? TEXT.completed : TEXT.pending}
                    </span>
                  </div>
                  {step.description && <p className="ssp-desc">{step.description}</p>}
                  {isCompleted && step.completedAt && (
                    <p className="ssp-meta">
                      {TEXT.completedAt}: {formatDateTime(step.completedAt)}
                      {step.completedByStaffId && (
                        <> &middot; {TEXT.completedBy} Staff #{step.completedByStaffId}</>
                      )}
                    </p>
                  )}
                  {step.note && <p className="ssp-step-note">&#8220;{step.note}&#8221;</p>}
                </div>
              </div>

              {renderStepExtra && renderStepExtra(step)}

              {isInProgress && hasId && onCompleteStep && onReopenStep && (
                <div className="ssp-actions">
                  {isLoadingThis ? (
                    <span className="ssp-loading-label">{TEXT.processing}</span>
                  ) : !isExpanded ? (
                    <>
                      <button
                        type="button"
                        className={`ssp-btn${isCompleted ? ' ssp-btn--reopen' : ' ssp-btn--complete'}`}
                        disabled={anyLoading || blocked}
                        onClick={() => handleExpand(step.id, isCompleted ? 'reopen' : 'complete')}
                      >
                        {isCompleted ? TEXT.reopenStep : TEXT.completeStep}
                      </button>
                      {blocked && <p className="ssp-blocked-hint">{typeof blockedMsg === 'string' ? blockedMsg : TEXT.blockedHint}</p>}
                    </>
                  ) : (
                    <div className="ssp-confirm-panel">
                      <textarea
                        className="ssp-note-textarea"
                        placeholder={TEXT.notePlaceholder}
                        value={noteValue}
                        onChange={(e) => setNoteValue(e.target.value)}
                        rows={2}
                        disabled={anyLoading}
                      />
                      <div className="ssp-confirm-actions">
                        <button
                          type="button"
                          className="ssp-btn ssp-btn--secondary"
                          onClick={handleCancelExpand}
                          disabled={anyLoading}
                        >
                          {TEXT.cancel}
                        </button>
                        <button
                          type="button"
                          className={`ssp-btn${expandAction === 'reopen' ? ' ssp-btn--reopen' : ' ssp-btn--complete'}`}
                          onClick={() => handleConfirm(step.id)}
                          disabled={anyLoading}
                        >
                          {expandAction === 'reopen' ? TEXT.confirmReopen : TEXT.confirm}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
