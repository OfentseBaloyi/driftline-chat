import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'

// A small shared scratchpad per conversation — plans, addresses, inside jokes,
// anything worth keeping outside the scroll of the main chat log.
export default function DriftwoodPanel({ conversationId, myId, onClose }) {
  const [content, setContent] = useState('')
  const [savedAt, setSavedAt] = useState(null)
  const [loading, setLoading] = useState(true)
  const saveTimer = useRef(null)
  const skipNextRemoteRef = useRef(false)

  useEffect(() => {
    let active = true

    async function load() {
      const { data } = await supabase
        .from('driftwood_notes')
        .select('content, updated_at')
        .eq('conversation_id', conversationId)
        .maybeSingle()
      if (!active) return
      setContent(data?.content || '')
      setSavedAt(data?.updated_at || null)
      setLoading(false)
    }
    load()

    const channel = supabase
      .channel(`driftwood:${conversationId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'driftwood_notes', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          if (skipNextRemoteRef.current) {
            skipNextRemoteRef.current = false
            return
          }
          if (payload.new) {
            setContent(payload.new.content || '')
            setSavedAt(payload.new.updated_at || null)
          }
        }
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [conversationId])

  function handleChange(e) {
    const value = e.target.value
    setContent(value)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => save(value), 600)
  }

  async function save(value) {
    skipNextRemoteRef.current = true
    const { error } = await supabase
      .from('driftwood_notes')
      .upsert(
        { conversation_id: conversationId, content: value, updated_by: myId, updated_at: new Date().toISOString() },
        { onConflict: 'conversation_id' }
      )
    if (!error) setSavedAt(new Date().toISOString())
  }

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <span style={styles.title}>🪵 Driftwood</span>
        <button style={styles.closeBtn} onClick={onClose} aria-label="Close driftwood notes">✕</button>
      </div>
      <p style={styles.hint}>A shared scratchpad only you two can see — plans, links, anything worth keeping.</p>
      <textarea
        style={styles.textarea}
        value={loading ? '' : content}
        onChange={handleChange}
        placeholder="Start jotting things down together…"
        disabled={loading}
      />
      {savedAt && !loading && (
        <p style={styles.savedLine}>Saved {new Date(savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
      )}
    </div>
  )
}

const styles = {
  panel: {
    position: 'absolute', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 320,
    background: 'var(--surface)', borderLeft: '1px solid var(--border)',
    display: 'flex', flexDirection: 'column', padding: 18, boxSizing: 'border-box',
    zIndex: 20, animation: 'drift-in 0.2s ease',
  },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  title: { fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600 },
  closeBtn: { background: 'none', border: 'none', color: 'var(--mist)', fontSize: 15, padding: 4 },
  hint: { color: 'var(--mist)', fontSize: 12, margin: '0 0 12px' },
  textarea: {
    flex: 1, resize: 'none', background: 'var(--surface-raised)', border: '1px solid var(--border)',
    borderRadius: 10, padding: 12, color: 'var(--text)', fontSize: 13.5, lineHeight: 1.5,
  },
  savedLine: { color: 'var(--mist)', fontSize: 11, marginTop: 8, textAlign: 'right' },
}