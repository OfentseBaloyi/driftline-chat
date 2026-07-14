import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Auth() {
  const [mode, setMode] = useState('signin') // signin | signup | forgot
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmSent, setConfirmSent] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'forgot') {
        const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        })
        if (resetErr) throw resetErr
        setResetSent(true)
      } else if (mode === 'signup') {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName || email.split('@')[0] } }
        })
        if (signUpError) throw signUpError
        setConfirmSent(true)
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) throw signInError
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.brand}>
          <span style={styles.brandMark}>~</span>
          <h1 style={styles.brandName}>Driftline</h1>
        </div>
        <p style={styles.tagline}>A quiet place to talk with people you actually know.</p>

        {confirmSent ? (
          <div style={styles.confirmBox}>
            <p>Check your email to confirm your account, then sign in.</p>
            <button style={styles.linkBtn} onClick={() => { setConfirmSent(false); setMode('signin') }}>
              Back to sign in
            </button>
          </div>
        ) : resetSent ? (
          <div style={styles.confirmBox}>
            <p>Check your email for a link to reset your password.</p>
            <button style={styles.linkBtn} onClick={() => { setResetSent(false); setMode('signin') }}>
              Back to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={styles.form}>
            {mode === 'signup' && (
              <input
                style={styles.input}
                placeholder="Your name"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
              />
            )}
            <input
              style={styles.input}
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            {mode !== 'forgot' && (
              <input
                style={styles.input}
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
              />
            )}
            {mode === 'signin' && (
              <button
                type="button"
                style={styles.forgotLink}
                onClick={() => { setError(''); setMode('forgot') }}
              >
                Forgot password?
              </button>
            )}
            {error && <p style={styles.error}>{error}</p>}
            <button style={styles.submitBtn} type="submit" disabled={loading}>
              {loading
                ? 'Please wait…'
                : mode === 'signup'
                  ? 'Create account'
                  : mode === 'forgot'
                    ? 'Send reset link'
                    : 'Sign in'}
            </button>
          </form>
        )}

        {!confirmSent && !resetSent && (
          <p style={styles.switchLine}>
            {mode === 'forgot' ? (
              <button style={styles.linkBtn} onClick={() => { setError(''); setMode('signin') }}>
                Back to sign in
              </button>
            ) : (
              <>
                {mode === 'signup' ? 'Already have an account?' : "Don't have an account?"}{' '}
                <button
                  style={styles.linkBtn}
                  onClick={() => { setError(''); setMode(mode === 'signup' ? 'signin' : 'signup') }}
                >
                  {mode === 'signup' ? 'Sign in' : 'Create one'}
                </button>
              </>
            )}
          </p>
        )}
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'radial-gradient(circle at 50% 0%, #1b2138 0%, #10131f 60%)',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: '36px 32px',
    animation: 'drift-in 0.5s ease',
  },
  brand: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 },
  brandMark: {
    fontFamily: 'var(--font-display)',
    fontSize: 28,
    color: 'var(--accent)',
  },
  brandName: {
    fontFamily: 'var(--font-display)',
    fontWeight: 600,
    fontSize: 26,
    margin: 0,
    letterSpacing: '-0.02em',
  },
  tagline: { color: 'var(--mist)', fontSize: 14, margin: '8px 0 28px' },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  input: {
    background: 'var(--surface-raised)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '12px 14px',
    color: 'var(--text)',
    fontSize: 14,
  },
  submitBtn: {
    background: 'var(--accent)',
    color: '#1b1206',
    border: 'none',
    borderRadius: 10,
    padding: '12px 14px',
    fontWeight: 600,
    fontSize: 14,
    marginTop: 6,
  },
  error: { color: 'var(--danger)', fontSize: 13, margin: 0 },
  forgotLink: {
    background: 'none', border: 'none', color: 'var(--mist)', fontSize: 12.5,
    padding: 0, margin: '-4px 0 0', textAlign: 'left', textDecoration: 'underline',
  },
  switchLine: { color: 'var(--mist)', fontSize: 13, marginTop: 22, textAlign: 'center' },
  linkBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--accent)',
    fontSize: 13,
    padding: 0,
    fontWeight: 600,
  },
  confirmBox: { color: 'var(--mist)', fontSize: 14, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 14 },
}