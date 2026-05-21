import { useEffect, useRef } from 'react';
import { enqueue, flush } from './gpsQueue';

const MIN_INTERVAL_MS = 15000;
const MIN_DISTANCE_M = 20;

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

export function useGpsTracking(tripId) {
  const lastPostRef = useRef(0);
  const lastPosRef = useRef(null);
  const watchIdRef = useRef(null);

  // Flush queued points whenever network comes back
  useEffect(() => {
    window.addEventListener('online', flush);
    flush(); // also attempt on mount
    return () => window.removeEventListener('online', flush);
  }, []);

  useEffect(() => {
    if (!tripId || !navigator.geolocation) return;

    function onPosition(pos) {
      const { latitude, longitude, speed } = pos.coords;
      const now = Date.now();

      const last = lastPosRef.current;
      const tooSoon = now - lastPostRef.current < MIN_INTERVAL_MS;
      const tooClose =
        last && haversineM(last.lat, last.lng, latitude, longitude) < MIN_DISTANCE_M;

      if (tooSoon && tooClose) return;

      lastPostRef.current = now;
      lastPosRef.current = { lat: latitude, lng: longitude };

      enqueue({
        trip_id: tripId,
        latitude,
        longitude,
        speed: speed ?? 0,
        timestamp: new Date().toISOString(),
      });

      // Try to flush immediately — if offline, stays queued
      flush();
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      onPosition,
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 }
    );

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [tripId]);
}
