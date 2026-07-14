import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function ChatWindow({ conversationId, myId, title, onBack, mobileHidden }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef(null)
  const fileInputRef = useRef(null)

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
      if (loadErr) setError(loadErr.message)
      else setMessages(data)
    }
    loadMessages()

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          setMessages(prev => [...prev, payload.new])
        }
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [conversationId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(e) {
    e.preventDefault()
    if (!text.trim()) return
    const content = text.trim()
    setText('')
    const { error: sendErr } = await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: myId, content })
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
        })
      if (sendErr) throw sendErr
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  if (!conversationId) {
    return (
      <div
        className={`app-chat${mobileHidden ? ' mobile-hide' : ''}`}
        style={styles.emptyState}
      >
        <p style={styles.emptyText}>Select a chat, or start a new one.</p>
      </div>
    )
  }

  return (
    <div
      className={`app-chat${mobileHidden ? ' mobile-hide' : ''}`}
      style={styles.window}
    >
      <div style={styles.header}>
        <button className="mobile-back-btn" style={styles.backBtn} onClick={onBack} aria-label="Back to chats">
          ←
        </button>
        <h3 style={styles.headerTitle}>{title}</h3>
      </div>

      <div style={styles.messages}>
        {messages.map(m => {
          const mine = m.sender_id === myId
          return (
            <div key={m.id} style={{ ...styles.messageRow, justifyContent: mine ? 'flex-end' : 'flex-start' }}>
              <div
                className="bubble-max"
                style={{ ...styles.bubble, background: mine ? 'var(--accent)' : 'var(--bubble-received)', color: mine ? '#1b1206' : 'var(--text)' }}
              >
                {m.content && <span>{m.content}</span>}
                {m.media_type === 'image' && (
                  <img src={m.media_url} alt="" style={styles.mediaImg} />
                )}
                {m.media_type === 'video' && (
                  <video src={m.media_url} controls style={styles.mediaImg} />
                )}
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
    </div>
  )
}

const styles = {
  window: { display: 'flex', flexDirection: 'column', height: '100%' },
  header: { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--border)' },
  backBtn: {
    background: 'none', border: 'none', color: 'var(--text)', fontSize: 20,
    padding: 4, margin: 0, lineHeight: 1, flexShrink: 0,
  },
  headerTitle: { fontFamily: 'var(--font-display)', margin: 0, fontSize: 17, fontWeight: 600 },
  messages: { flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 8, WebkitOverflowScrolling: 'touch' },
  messageRow: { display: 'flex' },
  bubble: {
    maxWidth: '60%', padding: '10px 14px', borderRadius: 16, fontSize: 14.5,
    lineHeight: 1.4, animation: 'drift-in 0.25s ease', wordBreak: 'break-word',
  },
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