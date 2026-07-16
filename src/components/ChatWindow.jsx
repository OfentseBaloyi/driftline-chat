import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import { presenceLabel } from '../presence'
import DriftwoodPanel from './DriftwoodPanel'

const TIDE_OPTIONS = [
  { label: 'Off', ms: null },
  { label: '1 hour', ms: 1000 * 60 * 60 },
  { label: '24 hours', ms: 1000 * 60 * 60 * 24 },
  { label: '7 days', ms: 1000 * 60 * 60 * 24 * 7 },
]

function tideKey(conversationId) {
  return `driftline:tide:${conversationId}`
}

function formatTimeLeft(expiresAt) {
  const diff = new Date(expiresAt).getTime() - Date.now()
  if (diff <= 0) return 'fading…'
  const hours = diff / 3600000
  if (hours < 1) return `${Math.ceil(diff / 60000)}m left`
  if (hours < 24) return `${Math.ceil(hours)}h left`
  return `${Math.ceil(hours / 24)}d left`
}

export default function ChatWindow({
  conversationId, myId, title, otherMood, otherLastSeen,
  anchoredMessage, onToggleAnchor, onBack, mobileHidden, widthOverride,
}) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [tideMs, setTideMs] = useState(() => {
    const saved = localStorage.getItem(tideKey(conversationId))
    return saved ? Number(saved) : null
  })
  const [showTideMenu, setShowTideMenu] = useState(false)
  const [showDriftwood, setShowDriftwood] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const bottomRef = useRef(null)
  const fileInputRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const analyserRef = useRef(null)
  const audioCtxRef = useRef(null)
  const waveformSamplesRef = useRef([])
  const recordTimerRef = useRef(null)
  const mimeTypeRef = useRef('')

  useEffect(() => {
    const saved = localStorage.getItem(tideKey(conversationId))
    setTideMs(saved ? Number(saved) : null)
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
      if (loadErr) setError(loadErr.message)
      else setMessages((data || []).filter(m => !m.expires_at || new Date(m.expires_at) > new Date()))
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

    // Sweep out any tide messages that expire while this chat stays open
    const sweep = setInterval(() => {
      setMessages(prev => prev.filter(m => !m.expires_at || new Date(m.expires_at) > new Date()))
    }, 15000)

    return () => {
      active = false
      supabase.removeChannel(channel)
      clearInterval(sweep)
    }
  }, [conversationId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function setTide(ms) {
    setTideMs(ms)
    if (ms === null) localStorage.removeItem(tideKey(conversationId))
    else localStorage.setItem(tideKey(conversationId), String(ms))
    setShowTideMenu(false)
  }

  async function sendMessage(e) {
    e.preventDefault()
    if (!text.trim()) return
    const content = text.trim()
    setText('')
    const expires_at = tideMs ? new Date(Date.now() + tideMs).toISOString() : null
    const { error: sendErr } = await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, sender_id: myId, content, expires_at })
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

      const expires_at = tideMs ? new Date(Date.now() + tideMs).toISOString() : null
      const { error: sendErr } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: myId,
          media_url: signed.signedUrl,
          media_type: isVideo ? 'video' : 'image',
          expires_at,
        })
      if (sendErr) throw sendErr
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function pickAudioMimeType() {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/aac',
      'audio/ogg;codecs=opus',
    ]
    for (const type of candidates) {
      if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(type)) {
        return type
      }
    }
    return '' // let the browser pick its own default
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      const audioCtx = new AudioContextClass()
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      audioCtxRef.current = audioCtx
      analyserRef.current = analyser
      waveformSamplesRef.current = []

      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      recordTimerRef.current = setInterval(() => {
        analyser.getByteFrequencyData(dataArray)
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
        waveformSamplesRef.current.push(Math.round(avg))
        setRecordSeconds(s => s + 0.15)
      }, 150)

      const mimeType = pickAudioMimeType()
      mimeTypeRef.current = mimeType
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      audioChunksRef.current = []
      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data)
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        audioCtx.close()
        clearInterval(recordTimerRef.current)
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      setRecording(true)
      setRecordSeconds(0)
    } catch (err) {
      setError('Microphone access was blocked or unavailable.')
    }
  }

  async function stopRecording(send) {
    const recorder = mediaRecorderRef.current
    if (!recorder) return
    const waveform = waveformSamplesRef.current.slice()

    await new Promise(resolve => {
      recorder.addEventListener('stop', resolve, { once: true })
      recorder.stop()
    })
    setRecording(false)

    if (!send) return

    try {
      setUploading(true)
      // Use whatever format was actually recorded — Safari records audio/mp4, others audio/webm
      const actualType = recorder.mimeType || mimeTypeRef.current || 'audio/webm'
      const blob = new Blob(audioChunksRef.current, { type: actualType })
      const ext = actualType.includes('mp4') ? 'm4a' : actualType.includes('ogg') ? 'ogg' : 'webm'
      const path = `${conversationId}/${crypto.randomUUID()}.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('chat-media')
        .upload(path, blob, { contentType: actualType })
      if (uploadErr) throw uploadErr
      const { data: signed, error: signErr } = await supabase.storage
        .from('chat-media')
        .createSignedUrl(path, 60 * 60 * 24 * 365)
      if (signErr) throw signErr

      const expires_at = tideMs ? new Date(Date.now() + tideMs).toISOString() : null
      const { error: sendErr } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: myId,
          media_url: signed.signedUrl,
          media_type: 'audio',
          waveform,
          expires_at,
        })
      if (sendErr) throw sendErr
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  const presence = presenceLabel(otherLastSeen)

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
          <span style={styles.headerSubline}>
            {otherMood ? otherMood : ''}
            {otherMood && presence ? ' · ' : ''}
            {presence ? presence.label : ''}
          </span>
        </div>
        <div style={styles.headerActions}>
          <div style={{ position: 'relative' }}>
            <button
              style={{ ...styles.iconBtn, color: tideMs ? 'var(--accent)' : 'var(--mist)' }}
              onClick={() => setShowTideMenu(s => !s)}
              title="Tide messages (disappearing)"
            >
              🌊
            </button>
            {showTideMenu && (
              <div style={styles.tideMenu}>
                {TIDE_OPTIONS.map(opt => (
                  <button
                    key={opt.label}
                    style={{ ...styles.tideOption, color: tideMs === opt.ms ? 'var(--accent)' : 'var(--text)' }}
                    onClick={() => setTide(opt.ms)}
                  >
                    {opt.label}
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

      {anchoredMessage && (
        <div style={styles.anchorBanner}>
          <span style={styles.anchorIcon}>📌</span>
          <span style={styles.anchorText}>
            {anchoredMessage.content || (anchoredMessage.media_type ? `${anchoredMessage.media_type === 'image' ? '📷 Photo' : anchoredMessage.media_type === 'video' ? '🎥 Video' : '🎤 Voice note'}` : '')}
          </span>
          <button style={styles.anchorClear} onClick={() => onToggleAnchor(anchoredMessage.id)} title="Unpin">✕</button>
        </div>
      )}

      {tideMs && (
        <div style={styles.tideBanner}>
          🌊 Tide mode on — new messages fade after {TIDE_OPTIONS.find(o => o.ms === tideMs)?.label.toLowerCase()}
        </div>
      )}

      <div style={styles.messages}>
        {messages.map(m => {
          const mine = m.sender_id === myId
          const isAnchored = anchoredMessage?.id === m.id
          return (
            <div key={m.id} style={{ ...styles.messageRow, justifyContent: mine ? 'flex-end' : 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start', maxWidth: '82%' }}>
                <div
                  className="bubble-max"
                  style={{
                    ...styles.bubble,
                    background: mine ? 'var(--accent)' : 'var(--bubble-received)',
                    color: mine ? '#1b1206' : 'var(--text)',
                    outline: isAnchored ? '2px solid var(--accent)' : 'none',
                    outlineOffset: 2,
                  }}
                >
                  {m.content && <span>{m.content}</span>}
                  {m.media_type === 'image' && (
                    <img src={m.media_url} alt="" style={styles.mediaImg} />
                  )}
                  {m.media_type === 'video' && (
                    <video src={m.media_url} controls style={styles.mediaImg} />
                  )}
                  {m.media_type === 'audio' && (
                    <VoiceBubble src={m.media_url} waveform={m.waveform} mine={mine} />
                  )}
                </div>
                <div style={styles.bubbleFooter}>
                  <button style={styles.anchorPinBtn} onClick={() => onToggleAnchor(m.id)} title={isAnchored ? 'Unpin' : 'Anchor this message'}>
                    {isAnchored ? '📌' : '📍'}
                  </button>
                  {m.expires_at && <span style={styles.tideTag}>🌊 {formatTimeLeft(m.expires_at)}</span>}
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
          disabled={uploading || recording}
          title="Send a photo or video"
        >
          {uploading ? '…' : '📎'}
        </button>

        {recording ? (
          <div style={styles.recordingBar}>
            <span style={styles.recordingDot} />
            <span style={styles.recordingTime}>{recordSeconds.toFixed(1)}s</span>
            <button type="button" style={styles.cancelRecordBtn} onClick={() => stopRecording(false)}>Cancel</button>
          </div>
        ) : (
          <input
            style={styles.textInput}
            placeholder="Message…"
            value={text}
            onChange={e => setText(e.target.value)}
          />
        )}

        <button
          type="button"
          style={{ ...styles.attachBtn, color: recording ? 'var(--danger)' : 'var(--text)' }}
          onMouseDown={startRecording}
          onMouseUp={() => recording && stopRecording(true)}
          onTouchStart={(e) => { e.preventDefault(); startRecording() }}
          onTouchEnd={(e) => { e.preventDefault(); recording && stopRecording(true) }}
          disabled={uploading}
          title="Hold to record a voice note"
        >
          {recording ? '⏹' : '🎤'}
        </button>

        <button style={styles.sendBtn} type="submit" disabled={recording}>Send</button>
      </form>

      {showDriftwood && (
        <DriftwoodPanel conversationId={conversationId} myId={myId} onClose={() => setShowDriftwood(false)} />
      )}
    </div>
  )
}

function VoiceBubble({ src, waveform, mine }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const bars = (waveform && waveform.length > 0 ? waveform : Array.from({ length: 20 }, () => 20))
  const maxVal = Math.max(...bars, 1)

  function toggle() {
    if (!audioRef.current) return
    if (playing) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 160 }}>
      <button
        type="button"
        onClick={toggle}
        style={{
          width: 28, height: 28, borderRadius: '50%', border: 'none', flexShrink: 0,
          background: mine ? 'rgba(27,18,6,0.2)' : 'var(--accent)', color: mine ? '#1b1206' : '#1b1206',
          fontSize: 12,
        }}
      >
        {playing ? '⏸' : '▶'}
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 24, flex: 1 }}>
        {bars.map((v, i) => (
          <span
            key={i}
            style={{
              width: 3,
              height: Math.max(3, (v / maxVal) * 22),
              background: mine ? 'rgba(27,18,6,0.5)' : 'var(--mist)',
              borderRadius: 2,
            }}
          />
        ))}
      </div>
      <audio
        ref={audioRef}
        src={src}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        style={{ display: 'none' }}
      />
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
  headerSubline: { fontSize: 12, color: 'var(--mist)' },
  headerActions: { display: 'flex', gap: 4, flexShrink: 0 },
  iconBtn: { background: 'none', border: 'none', fontSize: 17, padding: 6, color: 'var(--text)' },
  tideMenu: {
    position: 'absolute', top: '110%', right: 0, background: 'var(--surface-raised)',
    border: '1px solid var(--border)', borderRadius: 10, padding: 6, zIndex: 30,
    display: 'flex', flexDirection: 'column', minWidth: 110,
  },
  tideOption: { background: 'none', border: 'none', padding: '8px 10px', fontSize: 13, textAlign: 'left', borderRadius: 6 },
  anchorBanner: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
    background: 'var(--surface-raised)', borderBottom: '1px solid var(--border)', fontSize: 12.5,
  },
  anchorIcon: { flexShrink: 0 },
  anchorText: { flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', color: 'var(--text)' },
  anchorClear: { background: 'none', border: 'none', color: 'var(--mist)', fontSize: 13, padding: 4 },
  tideBanner: {
    padding: '6px 16px', fontSize: 11.5, color: 'var(--mist)', background: 'rgba(212,163,80,0.08)',
    borderBottom: '1px solid var(--border)',
  },
  messages: { flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 10, WebkitOverflowScrolling: 'touch' },
  messageRow: { display: 'flex' },
  bubble: {
    maxWidth: '100%', padding: '10px 14px', borderRadius: 16, fontSize: 14.5,
    lineHeight: 1.4, animation: 'drift-in 0.25s ease', wordBreak: 'break-word',
  },
  bubbleFooter: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, paddingLeft: 4 },
  anchorPinBtn: { background: 'none', border: 'none', fontSize: 11, padding: 0, opacity: 0.55, color: 'var(--mist)' },
  tideTag: { fontSize: 10.5, color: 'var(--mist)' },
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
  recordingBar: {
    flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-raised)',
    border: '1px solid var(--border)', borderRadius: 20, padding: '8px 14px',
  },
  recordingDot: { width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)' },
  recordingTime: { fontSize: 13, color: 'var(--text)' },
  cancelRecordBtn: { marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--mist)', fontSize: 12 },
  sendBtn: {
    background: 'var(--accent)', border: 'none', borderRadius: 20, padding: '10px 18px',
    color: '#1b1206', fontWeight: 600, fontSize: 14,
  },
  error: { color: 'var(--danger)', fontSize: 13, padding: '0 20px' },
  emptyState: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: 'var(--mist)', fontSize: 15 },
}