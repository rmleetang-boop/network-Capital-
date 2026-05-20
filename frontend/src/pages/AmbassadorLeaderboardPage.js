import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Trophy, Star, Crown } from 'lucide-react';
import { axiosInstance } from '../App';

const rankTone = (rank) => {
  if (rank === 'Network Legend') return 'from-yellow-400 to-amber-600 text-white';
  if (rank === 'Elite Ambassador') return 'from-purple-500 to-indigo-600 text-white';
  if (rank === 'Senior Ambassador') return 'from-blue-500 to-cyan-600 text-white';
  if (rank === 'Ambassador') return 'from-emerald-500 to-teal-600 text-white';
  return 'from-gray-200 to-gray-400 text-text-primary';
};

const AmbassadorLeaderboardPage = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axiosInstance.get('/ambassadors/leaderboard')
      .then((r) => setRows(r.data?.leaderboard || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-background-DEFAULT pb-24" data-testid="ambassador-leaderboard-page">
      <div className="sticky top-0 z-10 bg-white/85 backdrop-blur-lg border-b border-gray-200 px-4 py-3 flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100"><ArrowLeft size={20} /></button>
        <h1 className="text-base font-heading font-bold text-primary flex-1 inline-flex items-center gap-2"><Trophy size={16} className="text-secondary" /> Ambassador Leaderboard</h1>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-3">
        {loading ? (
          <div className="p-10 text-center text-text-muted"><Loader2 className="mx-auto animate-spin" /></div>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-text-muted text-sm">
            No ambassadors yet — admins can grant Ambassador status from any user profile.
          </div>
        ) : (
          <>
            {/* Top 3 podium */}
            {rows.length >= 3 && (
              <div className="grid grid-cols-3 gap-2 mb-2">
                {[1, 0, 2].map((i) => {
                  const a = rows[i];
                  if (!a) return null;
                  const place = i + 1;
                  const heights = { 1: 'h-32', 2: 'h-28', 3: 'h-24' };
                  return (
                    <div key={a.user_id} className={`bg-gradient-to-br ${rankTone(a.rank)} rounded-2xl p-3 flex flex-col items-center justify-end ${heights[place] || 'h-24'}`} data-testid={`podium-${place}`}>
                      {place === 1 && <Crown size={18} className="mb-1" />}
                      {a.photo ? (
                        <img src={a.photo} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-white mb-1" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-white/30 text-white text-xs font-bold flex items-center justify-center mb-1">{(a.username || '?')[0].toUpperCase()}</div>
                      )}
                      <p className="text-[11px] font-bold truncate w-full text-center">@{a.username}</p>
                      <p className="text-[10px] opacity-90">{a.total_contribution} pts</p>
                      <p className="text-[9px] uppercase tracking-wider font-bold mt-0.5">#{place}</p>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
              {rows.map((a, idx) => (
                <div key={a.user_id} className="px-4 py-3 flex items-center gap-3" data-testid={`leaderboard-row-${a.user_id}`}>
                  <span className="text-xs font-bold text-text-muted w-6 text-center">#{idx + 1}</span>
                  {a.photo ? (
                    <img src={a.photo} alt="" className="w-9 h-9 rounded-full object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-secondary text-white text-xs font-bold flex items-center justify-center">{(a.username || '?')[0].toUpperCase()}</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{a.full_name || a.username}</p>
                    <p className="text-[10px] text-text-muted inline-flex items-center gap-1">
                      <Star size={10} className={`${a.rank === 'Network Legend' ? 'text-yellow-500' : 'text-secondary'} fill-current`} /> {a.rank}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-primary">{a.total_contribution}</p>
                    <p className="text-[10px] text-text-muted">{a.recruit_count} recruits · +{a.new_30d} this month</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AmbassadorLeaderboardPage;
