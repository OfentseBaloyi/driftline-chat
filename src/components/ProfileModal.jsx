import { useRef, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function ProfileModal({ profile, onClose, onUpdated }) {
  const [displayName, setDisplayName] = useState(profile?.display_name || '')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const ext = file.name.split('.').pop()
      const path = `${profile.id}/avatar.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true })
      if (uploadErr) throw uploadErr

      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
      const avatar_url = `${pub.publicUrl}?t=${Date.now()}`

      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ avatar_url })
        .eq('id', profile.id)
      if (updateErr) throw updateErr

      onUpdated({ ...profile, avatar_url })
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  async function saveName() {
    setError('')
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ display_name: displayName })
      .eq('id', profile.id)
    if (updateErr) setError(updateErr.message)
    else onUpdated({ ...profile, display_name: displayName })
  }

  return (
    <div className="modal-overlay" style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <h3 style={styles.heading}>Your profile</h3>

        <div style={styles.avatarSection}>
          <div style={styles.avatarWrap}>
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" style={styles.avatarImg} />
            ) : (
              <span style={styles.avatarFallback}>{(profile?.display_name || '?')[0].toUpperCase()}</span>
            )}
          </div>
          <input type="file" accept="image/*" ref={fileInputRef} onChange={handleAvatarChange} style={{ display: 'none' }} />
          <button style={styles.smallBtn} onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? 'Uploading…' : 'Change photo'}
          </button>
        </div>

        <label style={styles.label}>Display name</label>
        <div style={styles.row}>
          <input style={styles.input} value={displayName} onChange={e => setDisplayName(e.target.value)} />
          <button style={styles.smallBtn} onClick={saveName}>Save</button>
        </div>

        {error && <p style={styles.error}>{error}</p>}

        <button style={styles.closeBtn} onClick={onClose}>Done</button>
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(10,12,20,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
    padding: 20, boxSizing: 'border-box',
  },
  modal: {
    width: '100%', maxWidth: 360, background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 16, padding: 24, maxHeight: '85vh', overflowY: 'auto',
  },
  heading: { fontFamily: 'var(--font-display)', margin: '0 0 20px', fontSize: 20 },
  avatarSection: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 22 },
  avatarWrap: {
    width: 80, height: 80, borderRadius: '50%', background: 'var(--surface-raised)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  avatarFallback: { fontSize: 28, color: 'var(--accent)', fontWeight: 600 },
  label: { fontSize: 12.5, color: 'var(--mist)', marginBottom: 6, display: 'block' },
  row: { display: 'flex', gap: 8 },
  input: {
    flex: 1, background: 'var(--surface-raised)', border: '1px solid var(--border)',
    borderRadius: 10, padding: '10px 12px', color: 'var(--text)', fontSize: 14,
  },
  smallBtn: {
    background: 'var(--accent)', border: 'none', borderRadius: 10, padding: '10px 14px',
    color: '#1b1206', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap',
  },
  error: { color: 'var(--danger)', fontSize: 13, marginTop: 10 },
  closeBtn: {
    marginTop: 20, width: '100%', background: 'none', border: '1px solid var(--border)',
    borderRadius: 10, padding: '10px 0', color: 'var(--mist)', fontSize: 13,
  },
}