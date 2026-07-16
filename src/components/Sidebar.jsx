import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { presenceLabel, conversationNudge } from '../presence'

export default function Sidebar({ profile, conversations, activeId, onSelect, onOpenProfile, onNewChat, mobileHidden, widthOverride }) {
  return (
    <div
      className={`app-sidebar${mobileHidden ? ' mobile-hide' : ''}`}
      style={widthOverride ? { ...styles.sidebar, width: widthOverride, minWidth: widthOverride } : styles.sidebar}
    >
      <div style={styles.header}>
        <button style={styles.avatarBtn} onClick={onOpenProfile} title="Your profile">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" style={styles.avatarImg} />
          ) : (
            <span style={styles.avatarFallback}>{(profile?.display_name || '?')[0].toUpperCase()}</span>
          )}
        </button>
        <h2 style={styles.title}>Driftline</h2>
        <button style={styles.newChatBtn} onClick={onNewChat} title="New chat">+</button>
      </div>

      <div style={styles.list}>
        {conversations.length === 0 && (
          <p style={styles.empty}>No chats yet. Tap + to start one.</p>
        )}
        {conversations.map(c => {
          const presence = presenceLabel(c.otherLastSeen)
          const nudge = conversationNudge(c.lastMessageAt)
          return (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              style={{
                ...styles.convoItem,
                background: c.id === activeId ? 'var(--surface-raised)' : 'transparent',
              }}
            >
              <div style={styles.convoAvatarWrap}>
                <div style={styles.convoAvatar}>
                  {c.otherAvatar ? (
                    <img src={c.otherAvatar} alt="" style={styles.avatarImg} />
                  ) : (
                    <span style={styles.avatarFallback}>{(c.title || '?')[0].toUpperCase()}</span>
                  )}
                </div>
                {presence && (
                  <span
                    style={{
                      ...styles.presenceDot,
                      opacity: 0.35 + presence.glow * 0.65,
                      boxShadow: `0 0 ${4 + presence.glow * 8}px rgba(212,163,80,${presence.glow})`,
                    }}
                    title={presence.label}
                  />
                )}
              </div>
              <div style={styles.convoText}>
                <span style={styles.convoNameRow}>
                  <span style={styles.convoName}>{c.title}</span>
                  {c.otherMood && <span style={styles.moodTag}>{c.otherMood}</span>}
                </span>
                <span style={styles.convoPreview}>{c.preview || 'Say hi 👋'}</span>
                {nudge && (
                  <span style={{ ...styles.nudge, color: nudge.tone === 'warm' ? 'var(--accent)' : 'var(--mist)' }}>
                    {nudge.tone === 'warm' ? '🔥 ' : '🌊 '}{nudge.text}
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      <button style={styles.signOutBtn} onClick={() => supabase.auth.signOut()}>
        Sign out
      </button>
    </div>
  )
}

const styles = {
  sidebar: {
    background: 'var(--surface)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '18px 16px',
    borderBottom: '1px solid var(--border)',
  },
  title: {
    fontFamily: 'var(--font-display)',
    fontSize: 18,
    margin: 0,
    flex: 1,
    fontWeight: 600,
  },
  avatarBtn: {
    width: 34, height: 34, borderRadius: '50%', border: 'none', padding: 0,
    background: 'var(--surface-raised)', overflow: 'hidden', flexShrink: 0,
  },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  avatarFallback: {
    width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--accent)', fontWeight: 600, fontSize: 14,
  },
  newChatBtn: {
    width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)',
    background: 'var(--surface-raised)', color: 'var(--accent)', fontSize: 18, lineHeight: 1,
  },
  list: { flex: 1, overflowY: 'auto', padding: 8 },
  empty: { color: 'var(--mist)', fontSize: 13, padding: 16, textAlign: 'center' },
  convoItem: {
    width: '100%', display: 'flex', alignItems: 'center', gap: 10, border: 'none',
    padding: 10, borderRadius: 10, textAlign: 'left', marginBottom: 2,
  },
  convoAvatarWrap: { position: 'relative', flexShrink: 0 },
  convoAvatar: {
    width: 40, height: 40, borderRadius: '50%', background: 'var(--surface-raised)',
    overflow: 'hidden', flexShrink: 0,
  },
  presenceDot: {
    position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: '50%',
    background: 'var(--accent)', border: '2px solid var(--surface)',
  },
  convoText: { display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 },
  convoNameRow: { display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' },
  moodTag: { fontSize: 11, color: 'var(--mist)', whiteSpace: 'nowrap', flexShrink: 0 },
  convoName: { color: 'var(--text)', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  convoPreview: { color: 'var(--mist)', fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  nudge: { fontSize: 11, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  signOutBtn: {
    margin: 12, padding: '10px 0', background: 'none', border: '1px solid var(--border)',
    borderRadius: 10, color: 'var(--mist)', fontSize: 13,
  },
}