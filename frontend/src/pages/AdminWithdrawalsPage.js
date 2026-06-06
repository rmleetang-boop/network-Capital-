import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Search, Filter, FileText, CheckCircle2, XCircle, Clock, Eye, MessageSquarePlus, Banknote, AlertTriangle } from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';

const STATUS_TABS = [
  { k: 'pending', label: 'Pending', icon: Clock, tone: 'bg-amber-100 text-amber-700' },
  { k: 'approved', label: 'Approved', icon: CheckCircle2, tone: 'bg-blue-100 text-blue-700' },
  { k: 'paid', label: 'Paid', icon: Banknote, tone: 'bg-emerald-100 text-emerald-700' },
  { k: 'rejected', label: 'Rejected', icon: XCircle, tone: 'bg-red-100 text-red-700' },
  { k: 'all', label: 'All', icon: FileText, tone: 'bg-gray-100 text-gray-700' },
];

const AdminWithdrawalsPage = ({ user }) => {
  const navigate = useNavigate();
  const [status, setStatus] = useState('pending');
  const [q, setQ] = useState('');
  const [list, setList] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null);   // selected withdrawal id (detail)

  const isAdmin = user && (user.role === 'admin' || user.role === 'super_admin');

  const load = async () => {
    setLoading(true);
    try {
      const r = await axiosInstance.get('/admin/withdrawals', { params: { status_filter: status, q: q.trim() || undefined } });
      setList(r.data?.withdrawals || []);
      setSummary(r.data?.summary || null);
    } catch (e) { toast.error(e.response?.data?.detail || 'Could not load'); }
    setLoading(false);
  };
  useEffect(() => { if (isAdmin) load(); /* eslint-disable-next-line */ }, [status, isAdmin]);

  if (!isAdmin) return <div className="p-10 text-center text-text-muted" data-testid="admin-withdrawals-gated">Admin only.</div>;

  return (
    <div className="min-h-screen bg-background-DEFAULT pb-24" data-testid="admin-withdrawals-page">
      <div className="sticky top-0 z-10 bg-white/85 backdrop-blur-lg border-b border-gray-200 px-4 py-3 flex items-center gap-2">
        <button onClick={() => navigate('/admin/dashboard')} className="p-2 -ml-2 rounded-full hover:bg-gray-100"><ArrowLeft size={20} /></button>
        <h1 className="text-base font-heading font-bold text-primary flex-1 inline-flex items-center gap-2"><Banknote size={16} className="text-secondary" /> Withdrawals</h1>
      </div>

      <div className="max-w-5xl mx-auto p-4 space-y-4">
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2" data-testid="withdrawals-summary">
            <Tile label="Pending" value={summary.pending} tone="from-amber-500 to-amber-600" />
            <Tile label="Approved" value={summary.approved} tone="from-blue-500 to-blue-600" />
            <Tile label="Paid" value={summary.paid} tone="from-emerald-500 to-emerald-600" />
            <Tile label="Rejected" value={summary.rejected} tone="from-red-500 to-red-600" />
            <Tile label="Outstanding ZAR" value={`R${(summary.pending_plus_approved_zar || 0).toLocaleString()}`} tone="from-primary to-[#0a1628]" />
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {STATUS_TABS.map((t) => {
            const I = t.icon; const on = status === t.k;
            return (
              <button key={t.k} onClick={() => setStatus(t.k)} className={`px-3 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-1 ${on ? 'bg-primary text-white' : t.tone}`} data-testid={`withdrawals-tab-${t.k}`}>
                <I size={11} /> {t.label}
              </button>
            );
          })}
          <div className="ml-auto relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && load()}
              placeholder="Search user / bank…"
              className="pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-full bg-white outline-none focus:border-primary w-44"
              data-testid="withdrawals-search" />
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-text-muted"><Loader2 className="mx-auto animate-spin" /></div>
        ) : list.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-text-muted text-sm" data-testid="withdrawals-empty">No withdrawals in this view.</div>
        ) : (
          <div className="space-y-2">
            {list.map((w) => <Row key={w.id} w={w} onOpen={() => setOpen(w.id)} />)}
          </div>
        )}
      </div>

      {open && <WithdrawalDetailModal withdrawalId={open} onClose={() => setOpen(null)} onChange={load} />}
    </div>
  );
};

const Row = ({ w, onOpen }) => {
  const statusMeta = STATUS_TABS.find((s) => s.k === w.status) || STATUS_TABS[0];
  const SI = statusMeta.icon;
  const amt = Number(w.amount_zar || 0);
  return (
    <div onClick={onOpen} className="bg-white rounded-2xl border border-gray-100 p-3 flex items-center gap-3 cursor-pointer hover:shadow-md transition" data-testid={`withdrawal-row-${w.id}`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${statusMeta.tone}`}>
        <SI size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-text-primary truncate">{w.full_name || '—'} <span className="text-text-muted font-normal">@{w.username || 'user'}</span></p>
          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${statusMeta.tone}`}>{w.status}</span>
          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${w.source === 'promotion' ? 'bg-fuchsia-100 text-fuchsia-700' : 'bg-indigo-100 text-indigo-700'}`}>{w.source}</span>
        </div>
        <p className="text-[11px] text-text-muted truncate">
          {w.bank_name || '—'} · NS {w.network_score_at_request ?? 0} pts · {w.created_at ? new Date(w.created_at).toLocaleString() : ''}
        </p>
      </div>
      <p className="text-base font-bold text-primary">R{amt.toLocaleString()}</p>
    </div>
  );
};

const Tile = ({ label, value, tone }) => (
  <div className={`bg-gradient-to-br ${tone} text-white rounded-2xl p-3`}>
    <p className="text-xl font-heading font-bold leading-none">{value}</p>
    <p className="text-[9px] uppercase tracking-wider opacity-90 mt-1 font-bold">{label}</p>
  </div>
);

const WithdrawalDetailModal = ({ withdrawalId, onClose, onChange }) => {
  const [w, setW] = useState(null);
  const [proof, setProof] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const r = await axiosInstance.get(`/admin/withdrawals/${withdrawalId}`);
    setW(r.data);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [withdrawalId]);

  const loadProof = async () => {
    try {
      const r = await axiosInstance.get(`/admin/withdrawals/${withdrawalId}/proof`);
      setProof(r.data?.proof_data_url || '');
    } catch (e) { toast.error('Could not load proof'); }
  };

  const act = async (kind) => {
    if (kind === 'reject' && !note.trim()) {
      if (!window.confirm('Reject without a reason note?')) return;
    }
    setBusy(true);
    try {
      await axiosInstance.post(`/admin/withdrawals/${withdrawalId}/${kind === 'mark-paid' ? 'mark-paid' : kind}`, { note });
      toast.success(`Withdrawal ${kind === 'mark-paid' ? 'marked paid' : kind + 'd'}`);
      setNote('');
      await load();
      onChange?.();
    } catch (e) { toast.error(e.response?.data?.detail || 'Action failed'); }
    setBusy(false);
  };

  const addNote = async () => {
    if (!note.trim()) return;
    setBusy(true);
    try {
      await axiosInstance.post(`/admin/withdrawals/${withdrawalId}/note`, { note });
      toast.success('Note added');
      setNote('');
      await load();
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    setBusy(false);
  };

  if (!w) return null;
  const isPdf = proof && proof.startsWith('data:application/pdf');

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose} data-testid="withdrawal-detail-modal">
      <div onClick={(e) => e.stopPropagation()} className="bg-white w-full sm:max-w-2xl sm:rounded-3xl rounded-t-3xl max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-3 flex items-center gap-2">
          <h3 className="font-heading font-bold flex-1">Withdrawal · R{w.amount_zar.toLocaleString()}</h3>
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${w.status === 'pending' ? 'bg-amber-100 text-amber-700' : w.status === 'approved' ? 'bg-blue-100 text-blue-700' : w.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{w.status}</span>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 ml-1">✕</button>
        </div>
        <div className="p-5 space-y-4 text-sm">
          <Section title="Member">
            <Field k="Name on account" v={w.full_name} />
            <Field k="Username" v={`@${w.username}`} />
            <Field k="Email" v={w.user_email} />
            <Field k="Network Score at request" v={`${w.network_score_at_request} pts (monthly ${w.monthly_score_at_request})`} />
          </Section>
          <Section title="Bank details">
            <Field k="Bank" v={w.bank_name} />
            <Field k="Account number" v={w.account_number} mono />
            {w.branch_code && <Field k="Branch code" v={w.branch_code} mono />}
            {w.swift_code && <Field k="SWIFT" v={w.swift_code} mono />}
            <Field k="Address" v={w.address} wide />
          </Section>
          <Section title="Proof of banking">
            {!proof ? (
              <button onClick={loadProof} className="text-xs font-semibold bg-primary text-white px-3 py-1.5 rounded-full inline-flex items-center gap-1" data-testid="withdrawal-load-proof"><Eye size={11} /> View proof</button>
            ) : isPdf ? (
              <embed src={proof} type="application/pdf" className="w-full h-72 rounded-xl border border-gray-100" />
            ) : (
              <img src={proof} alt="proof" className="w-full max-h-96 object-contain rounded-xl border border-gray-100" />
            )}
          </Section>
          <Section title="Source & timing">
            <Field k="Source" v={w.source === 'promotion' ? 'Promotions ZAR balance' : 'Wallet'} />
            <Field k="Requested" v={new Date(w.created_at).toLocaleString()} />
            {w.approved_at && <Field k="Approved" v={new Date(w.approved_at).toLocaleString()} />}
            {w.paid_at && <Field k="Paid" v={new Date(w.paid_at).toLocaleString()} />}
            {w.rejected_at && <Field k="Rejected" v={new Date(w.rejected_at).toLocaleString()} />}
          </Section>

          {(w.admin_notes || []).length > 0 && (
            <Section title="Admin notes & history">
              <div className="space-y-1">
                {w.admin_notes.map((n, i) => (
                  <div key={i} className="text-xs bg-background-subtle rounded-xl p-2" data-testid={`withdrawal-note-${i}`}>
                    <span className="font-bold text-primary capitalize">{n.action}</span> · <span className="text-text-muted">{new Date(n.at).toLocaleString()} by {n.by}</span>
                    {n.note && <p className="mt-0.5 text-text-secondary">{n.note}</p>}
                  </div>
                ))}
              </div>
            </Section>
          )}

          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-text-muted mb-1">Note (optional for approve/paid · required for reject)</p>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="w-full p-2.5 border border-gray-200 rounded-xl text-sm resize-none" placeholder="Why is this being approved/rejected/paid?" data-testid="withdrawal-note-input" />
          </div>

          <div className="flex gap-2 flex-wrap pt-1">
            {w.status === 'pending' && (
              <>
                <button onClick={() => act('approve')} disabled={busy} className="flex-1 bg-blue-600 text-white font-bold py-2 rounded-full text-sm disabled:opacity-50" data-testid="withdrawal-approve">Approve</button>
                <button onClick={() => act('reject')} disabled={busy} className="flex-1 bg-red-600 text-white font-bold py-2 rounded-full text-sm disabled:opacity-50" data-testid="withdrawal-reject">Reject</button>
              </>
            )}
            {w.status === 'approved' && (
              <>
                <button onClick={() => act('mark-paid')} disabled={busy} className="flex-1 bg-emerald-600 text-white font-bold py-2 rounded-full text-sm disabled:opacity-50" data-testid="withdrawal-mark-paid">Mark as paid</button>
                <button onClick={() => act('reject')} disabled={busy} className="flex-1 bg-red-600 text-white font-bold py-2 rounded-full text-sm disabled:opacity-50" data-testid="withdrawal-reject">Reject &amp; refund</button>
              </>
            )}
            <button onClick={addNote} disabled={busy || !note.trim()} className="px-3 bg-gray-100 text-text-primary font-semibold py-2 rounded-full text-xs disabled:opacity-50 inline-flex items-center gap-1" data-testid="withdrawal-add-note"><MessageSquarePlus size={12} /> Add note</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Section = ({ title, children }) => (
  <div className="border border-gray-100 rounded-2xl p-3">
    <p className="text-[10px] uppercase tracking-wider font-bold text-text-muted mb-2">{title}</p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1 gap-x-3">{children}</div>
  </div>
);

const Field = ({ k, v, mono, wide }) => (
  <div className={wide ? 'sm:col-span-2' : ''}>
    <p className="text-[10px] text-text-muted">{k}</p>
    <p className={`text-sm text-text-primary ${mono ? 'font-mono' : 'font-semibold'} break-all`}>{v || '—'}</p>
  </div>
);

export default AdminWithdrawalsPage;
