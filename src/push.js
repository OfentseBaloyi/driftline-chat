import { supabase } from './supabaseClient'

// Public VAPID key — safe to expose in frontend code (this is the "public" half of the keypair)
const VAPID_PUBLIC_KEY = 'BJSLV_i6LxtKlw3pO-SOnW5aIW-fYEXczuByFGYQiUs02ZNaxRymJ6rgZYn9W1K0pazJ8xifQAMeorzAj03UQG8'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

// Call this after a user logs in. Safe to call repeatedly — it no-ops
// if already subscribed, and re-registers if the browser issued a new subscription.
export async function enablePushNotifications(userId) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, reason: 'unsupported' }
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    return { ok: false, reason: 'denied' }
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready

    let subscription = await registration.pushManager.getSubscription()
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
    }

    const json = subscription.toJSON()
    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: userId,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      },
      { onConflict: 'endpoint' }
    )
    if (error) throw error

    return { ok: true }
  } catch (err) {
    console.error('Push subscription failed:', err)
    return { ok: false, reason: 'error', error: err }
  }
}