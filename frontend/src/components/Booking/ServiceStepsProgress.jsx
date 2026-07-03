import { useState } from 'react'
import './ServiceStepsProgress.css'

const TEXT = {
  noSteps: 'Ch\u01b0a c\u00f3 b\u01b0\u1edbc d\u1ecbch v\u1ee5 n\u00e0o.',
  notInProgress:
    'Ch\u1ec9 c\u00f3 th\u1ec3 c\u1eadp nh\u1eadt b\u01b0\u1edbc khi booking \u0111ang th\u1ef1c hi\u1ec7n.',
  completeStep: 'Ho\u00e0n th\u00e0nh b\u01b0\u1edbc',
  reopenStep: 'M\u1edf l\u1ea1i b\u01b0\u1edbc',
  confirm: 'X\u00e1c nh\u1eadn',
  confirmReopen: 'X\u00e1c nh\u1eadn m\u1edf l\u1ea1i',
  cancel: 'H\u1ee7y',
  notePlaceholder: 'Ghi ch\u00fa (t\u00f9y ch\u1ecdn)...',
  pending: '\u0110ang ch\u1edd',
  completed: 'Ho\u00e0n th\u00e0nh',
  completedAt: 'Ho\u00e0n th\u00e0nh l\u00fac',
  completedBy: 'Ng\u01b0\u1eddi c\u1eadp nh\u1eadt',
  processing: '\u0110ang x\u1eed l\u00fd...',
}

const formatDateTime = (value) => {
  if (!value) return null
  return new Date(value).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' })
}

const normalizeStep = (step, index) => ({
  id: step.id,
  title: step.title || step.name || step.stepName || `B\u01b0\u1edbc ${index + 1}`,
  description: step.description || step.detail || '',
  order: Number(step.stepOrder || step.order || step.sequence || index + 1),
  status: String(step.status || 'PENDING').toUpperCase(),
  completedAt: step.completedAt || null,
  completedByStaffId: step.completedByStaffId || step.completedBy || step.staffId || null,
  note: step.note || step.staffNote || '',
})

export default function ServiceStepsProgress({
  steps,
  bookingStatus,
  onCompleteStep,
  onReopenStep,
  actionLoadingStepId,
  error,
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
      {!isInProgress && <p className="ssp-hint">{TEXT.notInProgress}</p>}
      <ol className="ssp-list">
        {normalizedSteps.map((step) => {
          const isCompleted = step.status === 'COMPLETED'
          const isLoadingThis = actionLoadingStepId === step.id
          const isExpanded = expandedStepId === step.id
          const hasId = Boolean(step.id)
          const anyLoading = actionLoadingStepId !== null

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
                        <>
                          {' \u00b7 '} {TEXT.completedBy} Staff #{step.completedByStaffId}
                        </>
                      )}
                    </p>
                  )}
                  {step.note && <p className="ssp-step-note">&#8220;{step.note}&#8221;</p>}
                </div>
              </div>

              {isInProgress && hasId && (
                <div className="ssp-actions">
                  {isLoadingThis ? (
                    <span className="ssp-loading-label">{TEXT.processing}</span>
                  ) : !isExpanded ? (
                    <button
                      type="button"
                      className={`ssp-btn${isCompleted ? ' ssp-btn--reopen' : ' ssp-btn--complete'}`}
                      disabled={anyLoading}
                      onClick={() => handleExpand(step.id, isCompleted ? 'reopen' : 'complete')}
                    >
                      {isCompleted ? TEXT.reopenStep : TEXT.completeStep}
                    </button>
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
