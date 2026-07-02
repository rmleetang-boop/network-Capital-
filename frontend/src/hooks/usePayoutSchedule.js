/**
 * usePayoutSchedule — iter 58d.
 *
 * Single source of truth for the rolling monthly payout cycle on the frontend.
 * Calls `/api/payouts/schedule` once per session, caches in module state so
 * every consumer (wallet banner, withdrawal modal, ambassador strip, owner
 * control centre) renders the SAME canonical sentence verbatim.
 *
 * The backend returns:
 *   { message, deadline_iso, release_iso }
 * where `message` is the ONLY string callers should render. Per user spec:
 * "Only include that information."
 */
import { useEffect, useState } from 'react';
import { axiosInstance } from '../App';

let _cached = null;        // { message, deadline_iso, release_iso }
let _inflight = null;      // de-dupe parallel fetches across components

const fetchSchedule = () => {
  if (_cached) return Promise.resolve(_cached);
  if (_inflight) return _inflight;
  _inflight = axiosInstance.get('/payouts/schedule')
    .then((r) => { _cached = r.data || null; return _cached; })
    .catch(() => null)
    .finally(() => { _inflight = null; });
  return _inflight;
};

const usePayoutSchedule = () => {
  const [schedule, setSchedule] = useState(_cached);
  useEffect(() => {
    if (_cached) { setSchedule(_cached); return; }
    let alive = true;
    fetchSchedule().then((d) => { if (alive) setSchedule(d); });
    return () => { alive = false; };
  }, []);
  return schedule;
};

export default usePayoutSchedule;
