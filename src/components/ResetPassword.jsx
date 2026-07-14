import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function ResetPassword({ onDone }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      const { error: updateErr } = await supabase.auth.updateUser({ password })
      if (updateErr) throw updateErr
      onDone()
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
        <p style={styles.tagline}>Choose a new password for your account.</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            style={styles.input}
            type="password"
            placeholder="New password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
            autoFocus
          />
          <input
            style={styles.input}
            type="password"
            placeholder="Confirm new password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
            minLength={6}
          />
          {error && <p style={styles.error}>{error}</p>}
          <button style={styles.submitBtn} type="submit" disabled={loading}>
            {loading ? 'Saving…' : 'Save new password'}
          </button>
        </form>
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
}