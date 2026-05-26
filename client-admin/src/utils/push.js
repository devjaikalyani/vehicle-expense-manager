import axios from 'axios';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return new Uint8Array([...rawData].map((c) => c.charCodeAt(0)));
}

export async function requestPushPermission() {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return false;
  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

export async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  try {
    const keyRes = await axios.get('/api/push/vapid-public-key');
    const vapidKey = keyRes.data?.key;
    if (!vapidKey) return null; // VAPID not configured on server

    const granted = await requestPushPermission();
    if (!granted) return null;

    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    await axios.post('/api/push/subscribe', { subscription: sub });
    return sub;
  } catch (err) {
    console.warn('Push subscription failed:', err.message);
    return null;
  }
}

export async function unsubscribeFromPush() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
    await axios.delete('/api/push/subscribe');
  } catch (err) {
    console.warn('Push unsubscribe failed:', err.message);
  }
}

export async function isPushSubscribed() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch {
    return false;
  }
}
