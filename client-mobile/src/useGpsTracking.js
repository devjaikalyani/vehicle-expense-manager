import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { enqueue, flush } from './gpsQueue';
import { useAuth } from './App';

const MIN_INTERVAL_MS = 5000;
const MIN_DISTANCE_M = 10;

function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Returns liveKm. Single watchPosition handles server posting + live map + km display.
export function useGpsTracking(tripId) {
  const { user } = useAuth();
  const [liveKm, setLiveKm] = useState(0);
  const lastPostRef = useRef(0);
  const lastPosRef = useRef(null);
  const accKmRef = useRef(0);
  const watchIdRef = useRef(null);
  const socketRef = useRef(null);
  const wakeLockRef = useRef(null);

  async function acquireWakeLock() {
    if (!('wakeLock' in navigator)) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
    } catch {}
  }

  useEffect(() => {
    window.addEventListener('online', flush);
    flush();
    return () => window.removeEventListener('online', flush);
  }, []);

  // Re-acquire wake lock when tab becomes visible again (OS releases it on hide)
  useEffect(() => {
    if (!tripId) return;
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') acquireWakeLock();
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [tripId]);

  useEffect(() => {
    if (!tripId || !navigator.geolocation) return;

    accKmRef.current = 0;
    lastPosRef.current = null;
    setLiveKm(0);

    acquireWakeLock();
    socketRef.current = io({ path: '/socket.io' });

    function onPosition(pos) {
      const { latitude, longitude, speed } = pos.coords;
      const now = Date.now();
      const last = lastPosRef.current;
      const dist = last ? haversineM(last.lat, last.lng, latitude, longitude) : 0;

      // Accumulate live km for any movement > 5 m (noise filter)
      if (last && dist > 5) {
        accKmRef.current += dist / 1000;
        setLiveKm(+(accKmRef.current.toFixed(2)));
      }

      lastPosRef.current = { lat: latitude, lng: longitude };

      // Post to server only if enough time OR distance has passed
      const tooSoon = now - lastPostRef.current < MIN_INTERVAL_MS;
      const tooClose = dist < MIN_DISTANCE_M;
      if (tooSoon && tooClose) return;

      lastPostRef.current = now;

      // REST — persists GPS breadcrumbs for trip route history
      enqueue({
        trip_id: tripId,
        latitude,
        longitude,
        speed: speed ?? 0,
        timestamp: new Date().toISOString(),
      });
      flush();

      // Socket.IO — pushes live location to admin map in real time
      socketRef.current?.emit('gps:update', {
        userId: user?.id,
        name: user?.name,
        tripId,
        lat: latitude,
        lng: longitude,
        speed: speed ?? 0,
      });
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      onPosition,
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 },
    );

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      socketRef.current?.emit('gps:stop', { userId: user?.id });
      socketRef.current?.disconnect();
      socketRef.current = null;
      wakeLockRef.current?.release();
      wakeLockRef.current = null;
    };
  }, [tripId]);

  return liveKm;
}
