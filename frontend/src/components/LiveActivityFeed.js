import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, UserPlus, Sparkles, Award } from 'lucide-react';
import { axiosInstance } from '../App';

const ICONS = {
  joined: UserPlus,
  score: Award,
  benefit: Sparkles,
};

const COLORS = {
  joined: 'text-blue-400',
  score: 'text-secondary',
  benefit: 'text-pink-400',
};

const formatAgo = (item) => {
  if (item.minutes_ago !== undefined) {
    return item.minutes_ago < 60 ? `${item.minutes_ago}m` : `${Math.floor(item.minutes_ago / 60)}h`;
  }
  if (!item.created_at) return 'now';
  const diff = (Date.now() - new Date(item.created_at).getTime()) / 60000;
  if (diff < 1) return 'just now';
  if (diff < 60) return `${Math.floor(diff)}m`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h`;
  return `${Math.floor(diff / 1440)}d`;
};

const LiveActivityFeed = ({ limit = 12, theme = 'dark' }) => {
  const [items, setItems] = useState([]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const r = await axiosInstance.get(`/activity/live?limit=${limit}`);
        if (mounted) setItems(r.data.items || []);
      } catch {}
    };
    load();
    const id = setInterval(load, 10000);
    return () => { mounted = false; clearInterval(id); };
  }, [limit]);

  const isDark = theme === 'dark';
  const containerClass = isDark
    ? 'bg-white/5 border-white/10 text-white'
    : 'bg-white border-gray-200 text-text-primary';
  const subColor = isDark ? 'text-white/60' : 'text-text-muted';

  return (
    <div className={`rounded-2xl border ${containerClass} overflow-hidden`} data-testid="live-activity-feed">
      <div className={`flex items-center justify-between px-4 py-3 border-b ${isDark ? 'border-white/10' : 'border-gray-100'}`}>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
          </span>
          <h3 className="font-heading font-bold text-sm">Live Activity</h3>
        </div>
        <Activity size={14} className={subColor} />
      </div>
      <ul className="divide-y divide-white/5 max-h-96 overflow-y-auto">
        <AnimatePresence initial={false}>
          {items.map((item, idx) => {
            const Icon = ICONS[item.type] || Activity;
            const colorClass = COLORS[item.type] || 'text-white';
            return (
              <motion.li
                key={`${item.username}-${item.created_at || item.minutes_ago}-${idx}`}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: Math.min(idx, 8) * 0.03 }}
                className={`flex items-start gap-3 px-4 py-2.5 hover:bg-white/5`}
                data-testid={`feed-item-${idx}`}
              >
                <div className={`mt-0.5 ${colorClass}`}><Icon size={16} /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-tight">
                    <span className="font-semibold">@{item.username}</span>
                    <span className={`ml-1 ${subColor}`}>{item.text}</span>
                  </p>
                  <p className={`text-[11px] ${subColor}`}>
                    {item.city ? `${item.city} · ` : ''}{formatAgo(item)}
                    {item.seeded && <span className="ml-1 italic opacity-60">· demo</span>}
                  </p>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
        {items.length === 0 && (
          <li className={`px-4 py-6 text-center text-sm ${subColor}`}>Loading community activity…</li>
        )}
      </ul>
    </div>
  );
};

export default LiveActivityFeed;
