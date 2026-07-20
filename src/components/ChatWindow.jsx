import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import { isOnline } from '../presence'
import DriftwoodPanel from './DriftwoodPanel'

const MOOD_OPTIONS = [
  { key: 'happy', emoji: '😊', label: 'Happy' },
  { key: 'sad', emoji: '😢', label: 'Sad' },
  { key: 'lonely', emoji: '😔', label: 'Lonely' },
  { key: 'mad', emoji: '😠', label: 'Mad' },
]

function moodKey(conversationId) {
  return `driftline:mood:${conversationId}`
}

function moodEmoji(tag) {
  return MOOD_OPTIONS.find(m => m.key === tag)?.emoji || null
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export default function ChatWindow({
  conversationId, myId, title, otherLastSeen,
  onBack, mobileHidden, widthOverride,
}) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [activeMood, setActiveMood] = useState(() => localStorage.getItem(moodKey(conversationId)) || null)
  const [showMoodMenu, setShowMoodMenu] = useState(false)
  const [showDriftwood, setShowDriftwood] = useState(false)
  const bottomRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    setActiveMood(localStorage.getItem(moodKey(conversationId)) || null)
  }, [conversationId])

  useEffect(() => {
    if (!conversationId) return
    let active = true

    async function loadMessages() {
      const { data, error: loadErr } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
      if (!active) return
      if (loadErr) {
        setError(loadErr.message)
        return
      }
      setMessages(data || [])

      // Mark anything the other person sent as read, now that we're viewing it
      const unreadIds = (data || [])
        .filter(m => m.sender_id !== myId && !m.read_at)
        .map(m => m.id)
      if (unreadIds.length > 0) {
        supabase.from('messages').update({ read_at: new Date().toISOString() }).in('id', unreadIds).then(() => {})
      }
    }
    loadMessages()

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          setMessages(prev => [...prev, payload.new])
          if (payload.new.sender_id !== myId) {
            supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('id', payload.new.id).then(() => {})
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          setMessages(prev => prev.map(m => (m.id === payload.new.id ? payload.new : m)))
        }
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [conversationId, myId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function setMood(key) {
    setActiveMood(key)
    if (key === null) localStorage.removeItem(moodKey(conversationId))
    else localStorage.setItem(moodKey(conversationId), key)
    setShowMoodMenu(false)
  }

  async function sendMessage(e) {
    e.preventDefault()
    if (!text.trim()) return
    const content = text.trim()
    setText('')
    const { error: sendErr } = await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: myId, content, mood_tag: activeMood })
    if (sendErr) setError(sendErr.message)
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const isVideo = file.type.startsWith('video/')
      const ext = file.name.split('.').pop()
      const path = `${conversationId}/${crypto.randomUUID()}.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from('chat-media')
        .upload(path, file)
      if (uploadErr) throw uploadErr

      const { data: signed, error: signErr } = await supabase.storage
        .from('chat-media')
        .createSignedUrl(path, 60 * 60 * 24 * 365)
      if (signErr) throw signErr

      const { error: sendErr } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: myId,
          media_url: signed.signedUrl,
          media_type: isVideo ? 'video' : 'image',
          mood_tag: activeMood,
        })
      if (sendErr) throw sendErr
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const online = isOnline(otherLastSeen)

  if (!conversationId) {
    return (
      <div
        className={`app-chat${mobileHidden ? ' mobile-hide' : ''}`}
        style={widthOverride ? { ...styles.emptyState, width: widthOverride, flex: 'none' } : styles.emptyState}
      >
        <p style={styles.emptyText}>Select a chat, or start a new one.</p>
      </div>
    )
  }

  return (
    <div
      className={`app-chat${mobileHidden ? ' mobile-hide' : ''}`}
      style={{ ...(widthOverride ? { ...styles.window, width: widthOverride, flex: 'none' } : styles.window), position: 'relative', overflow: 'hidden' }}
    >
      <div style={styles.header}>
        <button className="mobile-back-btn" style={styles.backBtn} onClick={onBack} aria-label="Back to chats">
          ←
        </button>
        <div style={styles.headerTextWrap}>
          <h3 style={styles.headerTitle}>{title}</h3>
          <span style={{ ...styles.headerSubline, color: online ? 'var(--accent)' : 'var(--mist)' }}>
            {online ? 'online' : 'offline'}
          </span>
        </div>
        <div style={styles.headerActions}>
          <div style={{ position: 'relative' }}>
            <button
              style={{ ...styles.iconBtn, color: activeMood ? 'var(--accent)' : 'var(--mist)' }}
              onClick={() => setShowMoodMenu(s => !s)}
              title="Set your mood for this chat"
            >
              {activeMood ? moodEmoji(activeMood) : '🙂'}
            </button>
            {showMoodMenu && (
              <div style={styles.moodMenu}>
                <button style={styles.moodOption} onClick={() => setMood(null)}>No mood</button>
                {MOOD_OPTIONS.map(opt => (
                  <button
                    key={opt.key}
                    style={{ ...styles.moodOption, color: activeMood === opt.key ? 'var(--accent)' : 'var(--text)' }}
                    onClick={() => setMood(opt.key)}
                  >
                    {opt.emoji} {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button style={styles.iconBtn} onClick={() => setShowDriftwood(s => !s)} title="Shared notes">
            🪵
          </button>
        </div>
      </div>

      <div style={styles.messages}>
        {messages.map(m => {
          const mine = m.sender_id === myId
          return (
            <div key={m.id} style={{ ...styles.messageRow, justifyContent: mine ? 'flex-end' : 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start', maxWidth: '82%' }}>
                <div
                  className="bubble-max"
                  style={{
                    ...styles.bubble,
                    background: mine ? 'var(--accent)' : 'var(--bubble-received)',
                    color: mine ? '#1b1206' : 'var(--text)',
                  }}
                >
                  {m.mood_tag && <span style={{ marginRight: 6 }}>{moodEmoji(m.mood_tag)}</span>}
                  {m.content && <span>{m.content}</span>}
                  {m.media_type === 'image' && (
                    <img src={m.media_url} alt="" style={styles.mediaImg} />
                  )}
                  {m.media_type === 'video' && (
                    <video src={m.media_url} controls style={styles.mediaImg} />
                  )}
                </div>
                <div style={styles.bubbleFooter}>
                  <span style={styles.timeTag}>{formatTime(m.created_at)}</span>
                  {mine && <span style={styles.readTag}>{m.read_at ? 'Read' : 'Sent'}</span>}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {error && <p style={styles.error}>{error}</p>}

      <form onSubmit={sendMessage} style={styles.inputBar}>
        <input
          type="file"
          accept="image/*,video/*"
          ref={fileInputRef}
          onChange={handleFile}
          style={{ display: 'none' }}
        />
        <button
          type="button"
          style={styles.attachBtn}
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          title="Send a photo or video"
        >
          {uploading ? '…' : '📎'}
        </button>

        <input
          style={styles.textInput}
          placeholder="Message…"
          value={text}
          onChange={e => setText(e.target.value)}
        />

        <button style={styles.sendBtn} type="submit">Send</button>
      </form>

      {showDriftwood && (
        <DriftwoodPanel conversationId={conversationId} myId={myId} onClose={() => setShowDriftwood(false)} />
      )}
    </div>
  )
}

const styles = {
  window: { display: 'flex', flexDirection: 'column', height: '100%' },
  header: { display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--border)' },
  backBtn: {
    background: 'none', border: 'none', color: 'var(--text)', fontSize: 20,
    padding: 4, margin: 0, lineHeight: 1, flexShrink: 0,
  },
  headerTextWrap: { display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' },
  headerTitle: { fontFamily: 'var(--font-display)', margin: 0, fontSize: 17, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  headerSubline: { fontSize: 12, fontWeight: 600 },
  headerActions: { display: 'flex', gap: 4, flexShrink: 0 },
  iconBtn: { background: 'none', border: 'none', fontSize: 17, padding: 6, color: 'var(--text)' },
  moodMenu: {
    position: 'absolute', top: '110%', right: 0, background: 'var(--surface-raised)',
    border: '1px solid var(--border)', borderRadius: 10, padding: 6, zIndex: 30,
    display: 'flex', flexDirection: 'column', minWidth: 130,
  },
  moodOption: { background: 'none', border: 'none', padding: '8px 10px', fontSize: 13, textAlign: 'left', borderRadius: 6, whiteSpace: 'nowrap' },
  messages: { flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 10, WebkitOverflowScrolling: 'touch' },
  messageRow: { display: 'flex' },
  bubble: {
    maxWidth: '100%', padding: '10px 14px', borderRadius: 16, fontSize: 14.5,
    lineHeight: 1.4, animation: 'drift-in 0.25s ease', wordBreak: 'break-word',
  },
  bubbleFooter: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, paddingLeft: 4 },
  timeTag: { fontSize: 10.5, color: 'var(--mist)' },
  readTag: { fontSize: 10.5, color: 'var(--mist)' },
  mediaImg: { display: 'block', maxWidth: 240, borderRadius: 10, marginTop: 6 },
  inputBar: {
    display: 'flex', alignItems: 'center', gap: 8, padding: 14,
    borderTop: '1px solid var(--border)',
  },
  attachBtn: {
    background: 'var(--surface-raised)', border: '1px solid var(--border)',
    borderRadius: 10, width: 40, height: 40, fontSize: 16, flexShrink: 0,
  },
  textInput: {
    flex: 1, background: 'var(--surface-raised)', border: '1px solid var(--border)',
    borderRadius: 20, padding: '10px 16px', color: 'var(--text)', fontSize: 14.5,
  },
  sendBtn: {
    background: 'var(--accent)', border: 'none', borderRadius: 20, padding: '10px 18px',
    color: '#1b1206', fontWeight: 600, fontSize: 14,
  },
  error: { color: 'var(--danger)', fontSize: 13, padding: '0 20px' },
  emptyState: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: 'var(--mist)', fontSize: 15 },
}