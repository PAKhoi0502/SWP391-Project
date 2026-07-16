import { useEffect, useRef, useState } from 'react'

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client?hl=en'
let scriptLoadPromise = null
let initialized = false
let activeCredentialHandler = null

function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve()

  if (!scriptLoadPromise) {
    scriptLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = SCRIPT_SRC
      script.async = true
      script.defer = true
      script.onload = resolve
      script.onerror = () => reject(new Error('Could not load Google Sign-In script.'))
      document.head.appendChild(script)
    })
  }

  return scriptLoadPromise
}

// google.accounts.id.initialize() is a single global registration — calling it
// more than once makes Google warn that only the last call "wins". Since every
// rendered button (login panel + register panel) shares the same page, we
// initialize exactly once and route credentials to whichever button is
// currently the active/visible one.
function ensureInitialized(clientId) {
  if (initialized) return
  initialized = true
  window.google.accounts.id.initialize({
    client_id: clientId,
    callback: (response) => activeCredentialHandler?.(response.credential),
  })
}

export default function GoogleSignInButton({ onCredential, active = true, disabled = false, text = 'continue_with' }) {
  const buttonRef = useRef(null)
  const [error, setError] = useState('')
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

  useEffect(() => {
    if (active) activeCredentialHandler = onCredential
  }, [active, onCredential])

  useEffect(() => {
    if (!clientId) {
      setError('Google sign-in is not configured.')
      return
    }
    if (disabled) return

    let cancelled = false

    loadGoogleScript()
      .then(() => {
        if (cancelled || !buttonRef.current) return

        ensureInitialized(clientId)

        window.google.accounts.id.renderButton(buttonRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          width: 320,
          text,
        })
      })
      .catch(() => {
        if (!cancelled) setError('Could not load Google Sign-In.')
      })

    return () => { cancelled = true }
  }, [clientId, disabled, text])

  if (error) return <p className="aas-field-err" style={{ textAlign: 'center' }}>{error}</p>

  return <div ref={buttonRef} style={{ display: 'flex', justifyContent: 'center' }} />
}
