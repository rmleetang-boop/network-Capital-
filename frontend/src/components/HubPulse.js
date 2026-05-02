import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Users, Briefcase, UserPlus } from 'lucide-react';
import { axiosInstance } from '../App';

/**
 * Hub Pulse — live activity stats for a given city.
 * Renders a compact stat row + sparkline message.
 */
const HubPulse = ({ city }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!city) { setLoading(false); return; }
    setLoading(true);
    axiosInstance
      .get('/hubs/pulse', { params: { city } })
      .then((r) => setStats(r.data.stats))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [city]);

  if (!city || loading) return null;
  if (!stats) return null;

  const items = [
    { icon: Users, label: 'Members', value: stats.total_members, color: 'text-blue-300' },
    { icon: UserPlus, label: 'New (week)', value: stats.new_members_week, color: 'text-green-300' },
    { icon: Briefcase, label: 'Stokvels', value: stats.active_stokvels, color: 'text-secondary' },
    { icon: TrendingUp, label: 'Connects', value: stats.connections_week, color: 'text-purple-300' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/5 border border-white/10 rounded-2xl p-3"
      data-testid="hub-pulse"
    >
      <p className="text-white/60 text-[10px] uppercase tracking-wide mb-2">Hub Pulse · last 7 days</p>
      <div className="grid grid-cols-4 gap-2">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <div key={it.label} className="bg-white/5 rounded-lg p-2 text-center">
              <Icon size={14} className={`${it.color} mx-auto mb-1`} />
              <p className="text-white font-bold text-sm">{(it.value || 0).toLocaleString()}</p>
              <p className="text-white/40 text-[9px] uppercase">{it.label}</p>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default HubPulse;
