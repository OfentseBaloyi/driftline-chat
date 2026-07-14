import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabaseClient'
import Auth from './components/Auth'
import ResetPassword from './components/ResetPassword'
import Sidebar from './components/Sidebar'
import ChatWindow from './components/ChatWindow'
import NewChatModal from './components/NewChatModal'
import ProfileModal from './components/ProfileModal'

export default function App() {
  const [session, setSession] = useState(null)
  const [loadingSession, setLoadingSession] = useState(true)
  const [profile, setProfile] = useState(null)
  const [conversations, setConversations] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [showNewChat, setShowNewChat] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [passwordRecovery, setPasswordRecovery] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoadingSession(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((event, sess) => {
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true)
      }
      setSession(sess)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const loadProfile = useCallback(async (userId) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    setProfile(data)
  }, [])

  const loadConversations = useCallback(async (userId) => {
    const { data: myParts } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', userId)

    const convoIds = (myParts || []).map(p => p.conversation_id)
    if (convoIds.length === 0) {
      setConversations([])
      return
    }

    const { data: allParts } = await supabase
      .from('conversation_participants')
      .select('conversation_id, user_id, profiles(display_name, avatar_url)')
      .in('conversation_id', convoIds)

    const { data: lastMessages } = await supabase
      .from('messages')
      .select('conversation_id, content, media_type, created_at')
      .in('conversation_id', convoIds)
      .order('created_at', { ascending: false })

    const result = convoIds.map(id => {
      const others = (allParts || []).filter(p => p.conversation_id === id && p.user_id !== userId)
      const other = others[0]
      const lastMsg = (lastMessages || []).find(m => m.conversation_id === id)
      let preview = ''
      if (lastMsg) {
        preview = lastMsg.content || (lastMsg.media_type === 'image' ? '📷 Photo' : lastMsg.media_type === 'video' ? '🎥 Video' : '')
      }
      return {
        id,
        title: other?.profiles?.display_name || 'Unknown',
        otherAvatar: other?.profiles?.avatar_url,
        preview,
      }
    })

    setConversations(result)
  }, [])

  useEffect(() => {
    if (!session) {
      setProfile(null)
      setConversations([])
      setActiveId(null)
      return
    }
    loadProfile(session.user.id)
    loadConversations(session.user.id)

    const channel = supabase
      .channel('conversations-refresh')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        loadConversations(session.user.id)
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [session, loadProfile, loadConversations])

  if (loadingSession) {
    return <div style={{ color: 'var(--mist)', padding: 40 }}>Loading…</div>
  }

  if (passwordRecovery) {
    return (
      <ResetPassword
        onDone={() => {
          setPasswordRecovery(false)
        }}
      />
    )
  }

  if (!session) {
    return <Auth />
  }

  const activeConvo = conversations.find(c => c.id === activeId)

  return (
    <div className="app-shell">
      <Sidebar
        profile={profile}
        conversations={conversations}
        activeId={activeId}
        onSelect={setActiveId}
        onOpenProfile={() => setShowProfile(true)}
        onNewChat={() => setShowNewChat(true)}
        mobileHidden={!!activeId}
      />
      <ChatWindow
        conversationId={activeId}
        myId={session.user.id}
        title={activeConvo?.title || ''}
        onBack={() => setActiveId(null)}
        mobileHidden={!activeId}
      />
      {showNewChat && (
        <NewChatModal
          myId={session.user.id}
          onClose={() => setShowNewChat(false)}
          onCreated={(id) => {
            setShowNewChat(false)
            loadConversations(session.user.id).then(() => setActiveId(id))
          }}
        />
      )}
      {showProfile && (
        <ProfileModal
          profile={profile}
          onClose={() => setShowProfile(false)}
          onUpdated={(p) => { setProfile(p); setShowProfile(false) }}
        />
      )}
    </div>
  )
}