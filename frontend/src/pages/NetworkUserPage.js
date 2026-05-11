import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Users, Briefcase, PiggyBank, ArrowLeft, UserPlus, Check, Loader2 } from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';

const KINDS = [
  { v: 'social',       l: 'Social',       icon: Users,     tone: 'from-indigo-500 to-blue-500' },
  { v: 'professional', l: 'Professional', icon: Briefcase, tone: 'from-amber-500 to-orange-500' },
  { v: 'financial',    l: 'Financial',    icon: PiggyBank, tone: 'from-emerald-500 to-teal-500' },
];

const NetworkUserPage = ({ user }) => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [summary, setSummary] = useState(null);
  const [requesting, setRequesting] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [p, s] = await Promise.all([
          axiosInstance.get(`/users/${userId}`),
          axiosInstance.get(`/users/${userId}/network-summary`),
        ]);
        setProfile(p.data);
        setSummary(s.data);
      } catch {
        toast.error('Could not load profile');
      }
    })();
  }, [userId]);

  const requestConnection = async (kind) => {
    setRequesting(kind);
    try {
      const r = await axiosInstance.post('/connections/request', { target_user_id: userId, kind });
      if (r.data.status === 'accepted') {
        toast.success('Already connected!');
      } else {
        toast.success(`${kind} connection request sent`);
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not send request');
    } finally {
      setRequesting(null);
    }
  };

  if (!profile || !summary) return <div className="p-10 text-center text-text-muted"><Loader2 className="mx-auto animate-spin" /></div>;

  const isSelf = user && user.id === userId;

  return (
    <div className="min-h-screen bg-background-DEFAULT pb-24" data-testid="network-user-page">
      <div className="sticky top-0 z-10 bg-white/85 backdrop-blur-lg border-b border-gray-200 px-4 py-3 flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-base font-heading font-bold text-primary flex-1 truncate">{profile.username}'s Network</h1>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4">
          {profile.photo ? (
            <img src={profile.photo} alt="" className="w-16 h-16 rounded-full object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary text-white text-xl font-bold flex items-center justify-center">
              {(profile.username || '?')[0].toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-text-primary">{profile.full_name || profile.username}</p>
            <p className="text-xs text-text-secondary">@{profile.username}</p>
            <p className="text-[11px] text-text-muted">Total network: <strong className="text-primary">{summary.total}</strong></p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {KINDS.map((k) => {
            const Icon = k.icon;
            const count = summary.counts?.[k.v] || 0;
            return (
              <div
                key={k.v}
                className={`rounded-2xl p-4 text-white bg-gradient-to-br ${k.tone}`}
                data-testid={`other-network-card-${k.v}`}>
                <Icon size={18} className="mb-1.5 opacity-80" />
                <p className="text-2xl font-heading font-bold leading-none">{count}</p>
                <p className="text-[11px] uppercase tracking-wider font-bold opacity-90 mt-1">{k.l}</p>
              </div>
            );
          })}
        </div>

        {!isSelf && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-xs uppercase tracking-wider font-semibold text-text-muted mb-2">Connect with {profile.username}</p>
            <div className="grid grid-cols-3 gap-2">
              {KINDS.map((k) => (
                <button
                  key={k.v}
                  onClick={() => requestConnection(k.v)}
                  disabled={requesting === k.v}
                  className="bg-gray-50 hover:bg-gray-100 rounded-xl py-2.5 text-xs font-semibold text-text-primary inline-flex items-center justify-center gap-1 disabled:opacity-50"
                  data-testid={`request-connection-${k.v}`}>
                  {requesting === k.v
                    ? <Loader2 size={12} className="animate-spin" />
                    : <><UserPlus size={12} /> {k.l}</>}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NetworkUserPage;
