import { useEffect, useRef } from 'react';
import { axiosInstance } from '../App';

/**
 * Sends a heartbeat to the backend every 60 seconds while the tab is active.
 * Backend awards 10 pts per 180 cumulative active minutes per spec.
 */
export default function useHeartbeat(enabled = true) {
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;

    const ping = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        await axiosInstance.post('/users/me/heartbeat');
      } catch {}
    };

    // initial ping after 5s, then every 60s
    const initial = setTimeout(ping, 5000);
    intervalRef.current = setInterval(ping, 60000);

    return () => {
      clearTimeout(initial);
      clearInterval(intervalRef.current);
    };
  }, [enabled]);
}
