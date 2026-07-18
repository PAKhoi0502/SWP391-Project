import { useEffect, useState } from 'react'
import { bankAccountService } from '../../services/bankAccountService'
import { vietqrService } from '../../services/vietqrService'
import './BankAccountsModal.css'

const emptyForm = {
  bankCode: '',
  bankName: '',
  accountNumber: '',
  accountHolderName: '',
  isDefault: false,
}

function maskAccountNumber(number) {
  const value = String(number || '')
  if (value.length <= 4) return value
  return `•••• ${value.slice(-4)}`
}

function getError(err, fallback) {
  return err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback
}

export default function BankAccountsModal({ open, onClose }) {
  const [accounts,       setAccounts]       = useState([])
  const [banks,          setBanks]          = useState([])
  const [loading,        setLoading]        = useState(false)
  const [saving,         setSaving]         = useState(false)
  const [error,          setError]          = useState('')
  const [formError,      setFormError]      = useState('')

  const [view,            setView]            = useState('list')
  const [editingAccount,  setEditingAccount]  = useState(null)
  const [form,            setForm]            = useState(emptyForm)
  const [confirm,         setConfirm]         = useState(null)

  const loadAccounts = async () => {
    setLoading(true)
    setError('')
    try {
      setAccounts(await bankAccountService.listOwn())
    } catch (err) {
      setError(getError(err, 'Could not load bank accounts.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return
    setView('list')
    setEditingAccount(null)
    setForm(emptyForm)
    setError('')
    setFormError('')
    setConfirm(null)
    loadAccounts()
    vietqrService.getBanks().then(setBanks).catch(() => setBanks([]))
  }, [open])

  const openCreate = () => {
    setEditingAccount(null)
    setForm(emptyForm)
    setFormError('')
    setView('form')
  }

  const openEdit = (account) => {
    setEditingAccount(account)
    setForm({
      bankCode:          account.bankCode          || '',
      bankName:          account.bankName          || '',
      accountNumber:     account.accountNumber     || '',
      accountHolderName: account.accountHolderName || '',
      isDefault:         Boolean(account.isDefault),
    })
    setFormError('')
    setView('form')
  }

  const handleBankChange = (bankCode) => {
    const bank = banks.find((b) => b.code === bankCode)
    setForm((prev) => ({ ...prev, bankCode, bankName: bank?.shortName || bank?.name || '' }))
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setFormError('')
    try {
      if (editingAccount) {
        await bankAccountService.update(editingAccount.id, { accountHolderName: form.accountHolderName.trim() })
      } else {
        await bankAccountService.create({
          bankCode: form.bankCode,
          bankName: form.bankName,
          accountNumber: form.accountNumber.trim(),
          accountHolderName: form.accountHolderName.trim(),
          isDefault: form.isDefault,
        })
      }
      setView('list')
      await loadAccounts()
    } catch (err) {
      setFormError(getError(err, 'Could not save bank account.'))
    } finally {
      setSaving(false)
    }
  }

  const handleConfirm = async () => {
    if (!confirm) return
    setSaving(true)
    setError('')
    try {
      if (confirm.type === 'default') {
        await bankAccountService.setDefault(confirm.account.id)
      } else {
        await bankAccountService.updateStatus(confirm.account.id, confirm.nextValue)
      }
      setConfirm(null)
      await loadAccounts()
    } catch (err) {
      setError(getError(err, 'Could not update bank account.'))
      setConfirm(null)
    } finally {
      setSaving(false)
    }
  }

  const f = (key, val) => setForm((prev) => ({ ...prev, [key]: val }))

  if (!open) return null

  return (
    <div
      className="ba-overlay"
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose() }}
    >
      <div className="ba-dialog" role="dialog" aria-modal="true">

        {/* Header */}
        <div className="ba-header">
          <div className="ba-header-left">
            {view === 'form' && (
              <button
                type="button"
                className="ba-back-btn"
                onClick={() => { if (!saving) { setView('list'); setFormError('') } }}
                aria-label="Back"
              >
                ←
              </button>
            )}
            <h2 className="ba-title">
              {view === 'list' ? 'Bank Accounts' : editingAccount ? 'Edit Bank Account' : 'Add Bank Account'}
            </h2>
          </div>
          <div className="ba-header-right">
            {view === 'list' && (
              <button type="button" className="ba-add-btn" onClick={openCreate}>+ Add</button>
            )}
            <button type="button" className="ba-close-btn" onClick={() => { if (!saving) onClose() }} aria-label="Close">✕</button>
          </div>
        </div>

        {/* Body */}
        <div className="ba-body">

          {/* LIST */}
          {view === 'list' && (
            <>
              {loading && <p className="ba-state">Loading…</p>}
              {!loading && error && <p className="ba-error">{error}</p>}

              {!loading && !error && accounts.length === 0 && (
                <div className="ba-empty">
                  <div className="ba-empty-icon">
                    <svg width="44" height="44" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="10" width="18" height="9" rx="1.5"/>
                      <path d="M3 10l9-6 9 6"/>
                      <path d="M6 13v4M10 13v4M14 13v4M18 13v4"/>
                    </svg>
                  </div>
                  <p className="ba-empty-text">No bank accounts saved yet.</p>
                  <button type="button" className="ba-add-cta" onClick={openCreate}>Add a bank account</button>
                </div>
              )}

              {!loading && accounts.length > 0 && (
                <ul className="ba-list">
                  {accounts.map((a) => {
                    const active = a.isActive !== false
                    const bank = banks.find((b) => b.code === a.bankCode)
                    return (
                      <li key={a.id} className={`ba-item${!active ? ' ba-item--inactive' : ''}`}>
                        <div className="ba-item-row">
                          {bank?.logo && <img src={bank.logo} alt={a.bankName} className="ba-item-logo" />}

                          <div className="ba-item-body">
                            <div className="ba-item-top">
                              <div className="ba-bank-wrap">
                                <span className="ba-bank-name">{a.bankName}</span>
                                {a.isDefault && <span className="ba-default-chip">Default</span>}
                                {!active     && <span className="ba-inactive-chip">Inactive</span>}
                              </div>
                            </div>

                            <dl className="ba-details">
                              <div>
                                <dt>Account Number</dt>
                                <dd>{maskAccountNumber(a.accountNumber)}</dd>
                              </div>
                              <div>
                                <dt>Account Holder</dt>
                                <dd>{a.accountHolderName}</dd>
                              </div>
                            </dl>

                            <div className="ba-item-actions">
                              <button type="button" className="ba-action-btn" onClick={() => openEdit(a)}>Edit</button>
                              <button
                                type="button"
                                className={`ba-action-btn ${active ? 'ba-action-btn--danger' : 'ba-action-btn--ghost'}`}
                                onClick={() => setConfirm({ type: 'status', account: a, nextValue: !active })}
                              >
                                {active ? 'Deactivate' : 'Reactivate'}
                              </button>
                              {!a.isDefault && active && (
                                <button type="button" className="ba-action-btn ba-action-btn--set-default" onClick={() => setConfirm({ type: 'default', account: a })}>
                                  Set default
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </>
          )}

          {/* FORM */}
          {view === 'form' && (
            <form className="ba-form" onSubmit={handleSave}>
              {formError && <p className="ba-error">{formError}</p>}

              {!editingAccount && (
                <label className="ba-field">
                  <span className="ba-label">Bank *</span>
                  <select required className="ba-select" value={form.bankCode} onChange={(e) => handleBankChange(e.target.value)}>
                    <option value="">Select bank</option>
                    {banks.map((b) => <option key={b.code} value={b.code}>{b.shortName || b.name}</option>)}
                  </select>
                </label>
              )}

              {!editingAccount && (
                <label className="ba-field">
                  <span className="ba-label">Account Number *</span>
                  <input required className="ba-input" value={form.accountNumber} onChange={(e) => f('accountNumber', e.target.value)} placeholder="0123456789" />
                </label>
              )}

              <label className="ba-field">
                <span className="ba-label">Account Holder Name *</span>
                <input required className="ba-input" value={form.accountHolderName} onChange={(e) => f('accountHolderName', e.target.value)} placeholder="NGUYEN VAN A" />
              </label>

              {!editingAccount && (
                <label className="ba-checkbox">
                  <input type="checkbox" checked={form.isDefault} onChange={(e) => f('isDefault', e.target.checked)} />
                  Set as default account
                </label>
              )}

              <div className="ba-form-actions">
                <button type="button" className="ba-action-btn ba-action-btn--ghost" onClick={() => { if (!saving) { setView('list'); setFormError('') } }} disabled={saving}>Cancel</button>
                <button type="submit" className="ba-save-btn" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          )}
        </div>

        {/* CONFIRM OVERLAY */}
        {confirm && (
          <div className="ba-confirm-overlay" onClick={(e) => { if (e.target === e.currentTarget && !saving) setConfirm(null) }}>
            <div className="ba-confirm-card">
              <h3 className="ba-confirm-title">
                {confirm.type === 'default' ? 'Set as Default?' : confirm.nextValue ? 'Reactivate Account?' : 'Deactivate Account?'}
              </h3>
              <p className="ba-confirm-msg">
                {confirm.type === 'default'
                  ? `Set ${confirm.account.bankName} (${maskAccountNumber(confirm.account.accountNumber)}) as your default account?`
                  : `${confirm.nextValue ? 'Reactivate' : 'Deactivate'} ${confirm.account.bankName} (${maskAccountNumber(confirm.account.accountNumber)})?`}
              </p>
              <div className="ba-confirm-actions">
                <button type="button" className="ba-action-btn ba-action-btn--ghost" onClick={() => { if (!saving) setConfirm(null) }} disabled={saving}>Cancel</button>
                <button type="button" className={`ba-save-btn${confirm.nextValue === false ? ' ba-save-btn--danger' : ''}`} onClick={handleConfirm} disabled={saving}>
                  {saving ? 'Processing…' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
