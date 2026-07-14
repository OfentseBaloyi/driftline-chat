import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function NewChatModal({ myId, onClose, onCreated }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [error, setError] = useState('')
  const [searching, setSearching] = useState(false)

  async function handleSearch(e) {
    e.preventDefault()
    setError('')
    setSearching(true)
    try {
      const { data, error: searchErr } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .ilike('display_name', `%${query}%`)
        .neq('id', myId)
        .limit(10)
      if (searchErr) throw searchErr
      setResults(data)
      if (data.length === 0) setError('No one found with that name. They need to have signed up already.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSearching(false)
    }
  }

  async function startChat(otherUser) {
    setError('')
    try {
      const { data: conversationId, error: rpcErr } = await supabase
        .rpc('create_direct_conversation', { other_user_id: otherUser.id })
      if (rpcErr) throw rpcErr

      onCreated(conversationId)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <h3 style={styles.heading}>Start a chat</h3>
        <form onSubmit={handleSearch} style={styles.form}>
          <input
            style={styles.input}
            placeholder="Search by name…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
          <button style={styles.searchBtn} type="submit" disabled={searching}>Search</button>
        </form>
        {error && <p style={styles.error}>{error}</p>}
        <div style={styles.results}>
          {results.map(u => (
            <button key={u.id} style={styles.resultItem} onClick={() => startChat(u)}>
              <div style={styles.resultAvatar}>
                {u.avatar_url ? <img src={u.avatar_url} alt="" style={styles.avatarImg} /> : <span>{u.display_name[0].toUpperCase()}</span>}
              </div>
              {u.display_name}
            </button>
          ))}
        </div>
        <button style={styles.closeBtn} onClick={onClose}>Close</button>
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(10,12,20,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
  },
  modal: {
    width: '100%', maxWidth: 380, background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 16, padding: 24,
  },
  heading: { fontFamily: 'var(--font-display)', margin: '0 0 16px', fontSize: 20 },
  form: { display: 'flex', gap: 8 },
  input: {
    flex: 1, background: 'var(--surface-raised)', border: '1px solid var(--border)',
    borderRadius: 10, padding: '10px 12px', color: 'var(--text)', fontSize: 14,
  },
  searchBtn: {
    background: 'var(--accent)', border: 'none', borderRadius: 10, padding: '10px 14px',
    color: '#1b1206', fontWeight: 600, fontSize: 13,
  },
  error: { color: 'var(--danger)', fontSize: 13, marginTop: 12 },
  results: { marginTop: 14, display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 240, overflowY: 'auto' },
  resultItem: {
    display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none',
    padding: 10, borderRadius: 10, color: 'var(--text)', fontSize: 14, textAlign: 'left',
  },
  resultAvatar: {
    width: 32, height: 32, borderRadius: '50%', background: 'var(--surface-raised)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0,
    color: 'var(--accent)', fontWeight: 600, fontSize: 13,
  },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  closeBtn: {
    marginTop: 16, width: '100%', background: 'none', border: '1px solid var(--border)',
    borderRadius: 10, padding: '10px 0', color: 'var(--mist)', fontSize: 13,
  },
}