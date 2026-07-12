import { useEffect, useRef, useState } from 'react'

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client'
let scriptLoadPromise = null

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

export default function GoogleSignInButton({ onCredential, disabled = false, text = 'continue_with' }) {
  const buttonRef = useRef(null)
  const [error, setError] = useState('')
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

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

        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => onCredential(response.credential),
        })

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
  }, [clientId, disabled, onCredential, text])

  if (error) return <p className="aas-field-err" style={{ textAlign: 'center' }}>{error}</p>

  return <div ref={buttonRef} style={{ display: 'flex', justifyContent: 'center' }} />
}
