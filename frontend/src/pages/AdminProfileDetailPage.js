import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Shield, DollarSign, Ban, AlertTriangle, Trash2, Flame, MessageCircle, Star, Send } from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';
import CreditGrantModal from '../components/CreditGrantModal';

const AdminProfileDetailPage = ({ user }) => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [creditOpen, setCreditOpen] = useState(false);
  const [dmOpen, setDmOpen] = useState(false);
  const [restrictOpen, setRestrictOpen] = useState(false);

  const isAdmin = user && user.role === 'admin';

  const load = async () => {
    try {
      const r = await axiosInstance.get(`/admin/users/${userId}/full-profile`);
      setData(r.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not load profile');
    }
  };

  useEffect(() => { if (isAdmin) load(); /* eslint-disable-next-line */ }, [userId]);

  if (!isAdmin) return <div className="p-10 text-center text-text-muted"><Shield size={28} className="mx-auto text-primary mb-2" />Admin only.</div>;
  if (!data) return <div className="p-10 text-center text-text-muted"><Loader2 className="mx-auto animate-spin" /></div>;
  const u = data.user;

  const suspendToggle = async () => {
    if (!window.confirm(u.suspended ? 'Unsuspend this user?' : 'Suspend this user?')) return;
    try {
      const r = await axiosInstance.post(`/admin/users/${userId}/suspend`, { reason: 'admin_panel' });
      toast.success(r.data.suspended ? 'Suspended' : 'Unsuspended'); load();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  const flagToggle = async () => {
    const reason = window.prompt(u.flagged_for_review ? 'Unflag — enter reason:' : 'Flag for review — enter reason:');
    if (!reason || reason.trim().length < 4) return;
    try {
      await axiosInstance.post(`/admin/users/${userId}/flag`, { flagged: !u.flagged_for_review, reason: reason.trim() });
      toast.success(u.flagged_for_review ? 'Unflagged' : 'Flagged'); load();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  const grantAmbassador = async () => {
    const becomeAmb = !u.is_ambassador;
    if (!window.confirm(becomeAmb ? 'Make this user an Ambassador?' : 'Revoke ambassador status?')) return;
    try {
      await axiosInstance.post(`/admin/users/${userId}/make-ambassador`, { ambassador: becomeAmb });
      toast.success(becomeAmb ? 'Granted ambassador' : 'Revoked ambassador'); load();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  const doDelete = async (mode) => {
    const reason = window.prompt(`${mode === 'hard' ? 'HARD-DELETE' : 'Soft-delete'} this account — enter reason:`);
    if (!reason || reason.trim().length < 4) return;
    if (mode === 'hard' && !window.confirm('⚠️ FINAL: WIPE this user + ALL their content?')) return;
    try {
      await axiosInstance.delete(`/admin/users/${userId}`, { params: { mode, reason: reason.trim(), purge_content: mode === 'hard' } });
      toast.success(`${mode}-deleted`);
      navigate('/admin/users');
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
  };

  const counts = data.counts || {};

  return (
    <div className="min-h-screen bg-background-DEFAULT pb-24" data-testid="admin-profile-detail-page">
      <div className="sticky top-0 z-10 bg-white/85 backdrop-blur-lg border-b border-gray-200 px-4 py-3 flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100"><ArrowLeft size={20} /></button>
        <h1 className="text-base font-heading font-bold text-primary flex-1 truncate">{u.full_name || u.username}</h1>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-3">
        {/* Profile header */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4">
          {u.photo ? (
            <img src={u.photo} alt="" className="w-16 h-16 rounded-full object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary text-white text-xl font-bold flex items-center justify-center">
              {(u.username || '?')[0].toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="font-semibold text-text-primary">{u.full_name || u.username}</p>
              {u.role === 'admin' && <span className="bg-red-100 text-red-700 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full">Admin</span>}
              {u.role === 'moderator' && <span className="bg-amber-100 text-amber-700 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full">Moderator</span>}
              {u.is_ambassador && <span className="bg-secondary text-primary text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full">★ Ambassador</span>}
              {u.suspended && <span className="bg-red-100 text-red-700 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full">Suspended</span>}
              {u.flagged_for_review && <span className="bg-orange-100 text-orange-700 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full">Flagged</span>}
              {u.deactivated && <span className="bg-amber-100 text-amber-700 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full">Pending purge</span>}
              {u.is_premium && <span className="bg-yellow-100 text-yellow-700 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full">Premium</span>}
            </div>
            <p className="text-xs text-text-muted">@{u.username} · {u.email}</p>
            <p className="text-[11px] text-text-muted">{u.city || '—'} · joined {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</p>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
          {[
            ['Wallet', `$${(u.wallet_balance || 0).toFixed(2)}`],
            ['Score (mo)', u.monthly_score || 0],
            ['Score (life)', u.network_score || 0],
            ['Posts', counts.posts || 0],
            ['Comments', counts.comments || 0],
            ['Messages', counts.messages || 0],
            ['Place reviews', counts.place_reviews || 0],
            ['Jobs posted', counts.jobs_posted || 0],
            ['Applications', counts.applications || 0],
            ['Stokvels', counts.stokvels_member_of || 0],
            ['Referrals', counts.referrals || 0],
          ].map(([k, v]) => (
            <div key={k} className="bg-white rounded-xl border border-gray-100 p-3 text-center">
              <p className="text-lg font-heading font-bold text-primary leading-none">{v}</p>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-text-muted mt-1">{k}</p>
            </div>
          ))}
        </div>

        {/* Restrictions */}
        {u.restrictions && Object.keys(u.restrictions).length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-3">
            <p className="text-[10px] uppercase tracking-wider font-bold text-orange-800 mb-1">Active restrictions</p>
            <ul className="text-xs text-orange-800">
              {u.restrictions.can_post === false && <li>• Cannot post</li>}
              {u.restrictions.can_comment === false && <li>• Cannot comment</li>}
              {u.restrictions.can_dm === false && <li>• Cannot send DMs</li>}
            </ul>
          </div>
        )}

        {/* Action grid */}
        <div className="bg-white rounded-2xl border border-gray-100 p-3 grid grid-cols-2 md:grid-cols-3 gap-2" data-testid="admin-profile-actions">
          <button onClick={() => setDmOpen(true)} className="bg-primary text-white font-semibold py-2 rounded-full text-xs inline-flex items-center justify-center gap-1.5" data-testid="action-dm"><MessageCircle size={12} /> Message</button>
          <button onClick={() => setCreditOpen(true)} className="bg-secondary text-primary font-semibold py-2 rounded-full text-xs inline-flex items-center justify-center gap-1.5" data-testid="action-credit"><DollarSign size={12} /> Adjust balance</button>
          <button onClick={() => setRestrictOpen(true)} className="bg-orange-100 text-orange-700 font-semibold py-2 rounded-full text-xs inline-flex items-center justify-center gap-1.5" data-testid="action-restrict"><AlertTriangle size={12} /> Restrict</button>
          <button onClick={suspendToggle} className="bg-gray-100 text-text-primary font-semibold py-2 rounded-full text-xs inline-flex items-center justify-center gap-1.5" data-testid="action-suspend"><Ban size={12} /> {u.suspended ? 'Unsuspend' : 'Suspend'}</button>
          <button onClick={flagToggle} className="bg-orange-100 text-orange-700 font-semibold py-2 rounded-full text-xs inline-flex items-center justify-center gap-1.5" data-testid="action-flag"><AlertTriangle size={12} /> {u.flagged_for_review ? 'Unflag' : 'Flag'}</button>
          <button onClick={grantAmbassador} className="bg-yellow-100 text-yellow-700 font-semibold py-2 rounded-full text-xs inline-flex items-center justify-center gap-1.5" data-testid="action-ambassador"><Star size={12} /> {u.is_ambassador ? 'Revoke ambassador' : 'Make ambassador'}</button>
          <button onClick={() => doDelete('soft')} className="bg-amber-100 text-amber-700 font-semibold py-2 rounded-full text-xs inline-flex items-center justify-center gap-1.5" data-testid="action-soft-delete"><Trash2 size={12} /> Soft-delete</button>
          <button onClick={() => doDelete('hard')} className="bg-red-100 text-red-700 font-semibold py-2 rounded-full text-xs inline-flex items-center justify-center gap-1.5" data-testid="action-hard-delete"><Flame size={12} /> Hard-delete</button>
        </div>

        {/* Recent posts */}
        {Array.isArray(data.recent_posts) && data.recent_posts.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-[10px] uppercase tracking-wider font-bold text-text-muted mb-2">Recent posts</p>
            {data.recent_posts.map((p) => (
              <div key={p.id} className="border-b border-gray-50 last:border-0 py-2 text-xs">
                <p className="text-text-primary line-clamp-2">{p.content}</p>
                <p className="text-[10px] text-text-muted mt-0.5">{p.likes || 0} likes · {new Date(p.created_at).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {creditOpen && (
        <CreditGrantModal
          targetType="user"
          targetId={userId}
          targetLabel={u.full_name || u.username}
          onClose={() => setCreditOpen(false)}
          onApplied={load}
        />
      )}
      {dmOpen && <DmAsNCModal targetUser={u} onClose={() => setDmOpen(false)} />}
      {restrictOpen && <RestrictModal user={u} onClose={() => setRestrictOpen(false)} onApplied={load} />}
    </div>
  );
};

const DmAsNCModal = ({ targetUser, onClose }) => {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const send = async () => {
    if (text.trim().length < 1) return;
    setSubmitting(true);
    try {
      await axiosInstance.post('/admin/dm', { to_user_id: targetUser.id, message: text.trim() });
      toast.success(`Sent to ${targetUser.username} as Network Capital`);
      onClose();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    setSubmitting(false);
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose} data-testid="dm-as-nc-modal">
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl max-w-md w-full p-5">
        <h3 className="font-heading font-bold text-lg mb-1">Message as Network Capital</h3>
        <p className="text-xs text-text-muted mb-3">To: <strong>{targetUser.full_name || targetUser.username}</strong></p>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5}
          placeholder="Type your message — this will appear from the official Network Capital account."
          className="w-full p-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary resize-none mb-3"
          data-testid="dm-message-input" />
        <button onClick={send} disabled={submitting}
          className="w-full bg-primary text-white font-bold py-2.5 rounded-full inline-flex items-center justify-center gap-2 disabled:opacity-50"
          data-testid="dm-send-button">
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send as Network Capital
        </button>
      </div>
    </div>
  );
};

const RestrictModal = ({ user, onClose, onApplied }) => {
  const r = user.restrictions || {};
  const [canPost, setCanPost] = useState(r.can_post !== false);
  const [canComment, setCanComment] = useState(r.can_comment !== false);
  const [canDm, setCanDm] = useState(r.can_dm !== false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const apply = async () => {
    if (reason.trim().length < 4) return toast.error('Reason min 4 chars');
    setSubmitting(true);
    try {
      await axiosInstance.post(`/admin/users/${user.id}/restrict`, {
        can_post: canPost, can_comment: canComment, can_dm: canDm, reason: reason.trim(),
      });
      toast.success('Restrictions updated'); onApplied(); onClose();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose} data-testid="restrict-modal">
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl max-w-md w-full p-5">
        <h3 className="font-heading font-bold text-lg mb-3">Restrict user</h3>
        <div className="space-y-2 mb-3">
          {[
            ['Can post', canPost, setCanPost],
            ['Can comment', canComment, setCanComment],
            ['Can send DMs', canDm, setCanDm],
          ].map(([label, v, set]) => (
            <label key={label} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-xl">
              <span className="text-sm">{label}</span>
              <input type="checkbox" checked={v} onChange={(e) => set(e.target.checked)} />
            </label>
          ))}
        </div>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
          placeholder="Reason (min 4 chars)"
          className="w-full p-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary resize-none mb-3"
          data-testid="restrict-reason-input" />
        <button onClick={apply} disabled={submitting} className="w-full bg-primary text-white font-bold py-2.5 rounded-full disabled:opacity-50" data-testid="restrict-apply-button">
          Apply restrictions
        </button>
      </div>
    </div>
  );
};

export default AdminProfileDetailPage;
