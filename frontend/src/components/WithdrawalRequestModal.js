import React, { useEffect, useState } from 'react';
import { X, Upload, Loader2, ShieldCheck, AlertTriangle, FileText, Clock, Banknote } from 'lucide-react';
import { axiosInstance } from '../App';
import { toast } from 'sonner';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
const MIN_SCORE = 3500;

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

const WithdrawalRequestModal = ({ onClose, onSubmitted }) => {
  const [step, setStep] = useState(1);             // 1 = source + amount, 2 = KYC, 3 = review
  const [eligibility, setEligibility] = useState(null);
  const [balances, setBalances] = useState(null);
  const [history, setHistory] = useState([]);
  const [payoutLock, setPayoutLock] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    source: 'wallet',
    amount_zar: '',
    full_name: '',
    bank_name: '',
    account_number: '',
    branch_code: '',
    swift_code: '',
    address: '',
    proof_data_url: '',
    proof_filename: '',
  });

  useEffect(() => {
    (async () => {
      try {
        const r = await axiosInstance.get('/withdrawals/me');
        setEligibility(r.data?.eligibility || null);
        setBalances(r.data?.balances || { wallet_zar: 0, promotion_zar: 0 });
        setHistory(r.data?.withdrawals || []);
      } catch (e) { toast.error(e.response?.data?.detail || 'Could not load'); }
      try {
        const p = await axiosInstance.get('/payouts/status');
        setPayoutLock(p.data || null);
      } catch { /* silent */ }
      setLoading(false);
    })();
  }, []);

  const handleFile = async (file) => {
    if (!file) return;
    if (!ALLOWED_MIME.includes(file.type)) {
      toast.error('Proof of banking must be PDF, JPG, or PNG.');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error('Proof must be 5 MB or smaller.');
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    setForm((f) => ({ ...f, proof_data_url: dataUrl, proof_filename: file.name }));
    toast.success('Proof attached');
  };

  const available = form.source === 'wallet' ? (balances?.wallet_zar || 0) : (balances?.promotion_zar || 0);
  const amountNum = Number(form.amount_zar);

  const canAdvance1 = amountNum > 0 && amountNum <= available && (eligibility?.eligible);
  const canAdvance2 = form.full_name.trim() && form.bank_name.trim() && form.account_number.trim() && form.address.trim() && form.proof_data_url;

  const submit = async () => {
    setSubmitting(true);
    try {
      const r = await axiosInstance.post('/withdrawals', {
        source: form.source,
        amount_zar: amountNum,
        full_name: form.full_name.trim(),
        bank_name: form.bank_name.trim(),
        account_number: form.account_number.trim(),
        branch_code: form.branch_code.trim(),
        swift_code: form.swift_code.trim(),
        address: form.address.trim(),
        proof_data_url: form.proof_data_url,
      });
      toast.success(`Request submitted · R${r.data.amount_zar.toFixed(2)} · est. 24–48h`);
      onSubmitted?.(r.data);
      onClose();
    } catch (e) { toast.error(e.response?.data?.detail || 'Request failed'); }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose} data-testid="withdrawal-modal">
      <div onClick={(e) => e.stopPropagation()} className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-3 flex items-center gap-2">
          <h3 className="font-heading font-bold text-base inline-flex items-center gap-2 flex-1"><Banknote size={16} className="text-secondary" /> Request withdrawal</h3>
          <span className="text-[10px] uppercase tracking-wider font-bold text-text-muted">Step {step}/3</span>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100" data-testid="withdrawal-modal-close"><X size={14} /></button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-text-muted"><Loader2 className="mx-auto animate-spin" /></div>
        ) : payoutLock?.locked ? (
          <div className="p-6 text-center" data-testid="withdrawal-june-locked">
            <Clock size={36} className="mx-auto text-amber-500 mb-2" />
            <p className="font-bold text-text-primary mb-1">June 2026 payout window</p>
            <p className="text-xs text-text-muted leading-relaxed">{payoutLock.message}</p>
            <p className="text-[11px] text-text-muted mt-2">Your balance is safe — submit a request from <strong>30 June 2026 (23:59 SAST)</strong> onwards.</p>
            <button onClick={onClose} className="mt-4 bg-primary text-white font-bold px-4 py-2 rounded-full text-sm">Got it</button>
          </div>
        ) : !eligibility?.eligible ? (
          <div className="p-6 text-center" data-testid="withdrawal-ineligible">
            <AlertTriangle size={36} className="mx-auto text-amber-500 mb-2" />
            <p className="font-bold text-text-primary mb-1">You need {MIN_SCORE} Network Score to withdraw</p>
            <p className="text-xs text-text-muted">Your current score: <strong>{eligibility?.your_network_score || 0}</strong> (monthly {eligibility?.your_monthly_score || 0}). Keep contributing — posts, comments, referrals, place reviews, and connections all build your score.</p>
            <button onClick={onClose} className="mt-4 bg-primary text-white font-bold px-4 py-2 rounded-full text-sm">OK</button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Step 1 — source + amount */}
            {step === 1 && (
              <div className="space-y-3" data-testid="withdrawal-step-1">
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-text-muted mb-1.5">Withdraw from</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { k: 'wallet', label: 'Wallet', amt: balances.wallet_zar, hint: 'Funds from premium, referrals, deposits' },
                      { k: 'promotion', label: 'Promotions', amt: balances.promotion_zar, hint: 'ZAR earned during open promotion windows' },
                    ].map((s) => {
                      const on = form.source === s.k;
                      return (
                        <button key={s.k} onClick={() => setForm((f) => ({ ...f, source: s.k }))}
                          className={`text-left p-3 rounded-2xl border-2 ${on ? 'border-primary bg-primary/5' : 'border-gray-100 bg-white'}`}
                          data-testid={`withdrawal-source-${s.k}`}>
                          <p className="text-xs uppercase tracking-wider font-bold text-text-muted">{s.label}</p>
                          <p className="text-xl font-heading font-bold text-primary">R{(s.amt || 0).toLocaleString()}</p>
                          <p className="text-[10px] text-text-muted mt-0.5">{s.hint}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-text-muted mb-1.5">Amount (ZAR)</p>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted font-bold">R</span>
                    <input
                      type="number" inputMode="decimal" min={1} max={available} step="0.01"
                      value={form.amount_zar} onChange={(e) => setForm((f) => ({ ...f, amount_zar: e.target.value }))}
                      className="w-full pl-7 pr-3 py-2.5 border border-gray-200 rounded-xl text-base font-semibold outline-none focus:border-primary"
                      placeholder="0.00"
                      data-testid="withdrawal-amount" />
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <p className="text-[11px] text-text-muted">Available: <strong className="text-primary">R{available.toLocaleString()}</strong></p>
                    <button onClick={() => setForm((f) => ({ ...f, amount_zar: String(available) }))} className="text-[11px] font-semibold text-primary hover:underline" data-testid="withdrawal-max">Max</button>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-text-secondary inline-flex gap-2">
                  <Clock size={13} className="text-blue-600 flex-shrink-0 mt-0.5" />
                  <span>All withdrawals are reviewed by our team and typically take <strong>24–48 hours</strong>. Funds are released to your bank account after approval.</span>
                </div>
                <button disabled={!canAdvance1} onClick={() => setStep(2)} className="w-full bg-primary text-white font-bold py-2.5 rounded-full text-sm disabled:opacity-50" data-testid="withdrawal-next-1">Continue</button>
              </div>
            )}

            {/* Step 2 — KYC */}
            {step === 2 && (
              <div className="space-y-3" data-testid="withdrawal-step-2">
                <p className="text-[11px] text-text-muted">All fields are required. Account-holder name on the bank account must match the name you enter below.</p>
                <FieldRow label="Full legal name" testId="withdrawal-name" value={form.full_name} onChange={(v) => setForm((f) => ({ ...f, full_name: v }))} placeholder="As shown on your bank statement" />
                <div className="grid grid-cols-2 gap-2">
                  <FieldRow label="Bank name" testId="withdrawal-bank" value={form.bank_name} onChange={(v) => setForm((f) => ({ ...f, bank_name: v }))} placeholder="e.g., FNB" />
                  <FieldRow label="Account number" testId="withdrawal-account" value={form.account_number} onChange={(v) => setForm((f) => ({ ...f, account_number: v }))} placeholder="••••••••" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <FieldRow label="Branch code" testId="withdrawal-branch" value={form.branch_code} onChange={(v) => setForm((f) => ({ ...f, branch_code: v }))} placeholder="(optional)" />
                  <FieldRow label="SWIFT (international)" testId="withdrawal-swift" value={form.swift_code} onChange={(v) => setForm((f) => ({ ...f, swift_code: v }))} placeholder="(optional)" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-text-muted mb-1.5">Residential address</p>
                  <textarea value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} rows={2}
                    className="w-full p-2.5 border border-gray-200 rounded-xl text-sm resize-none outline-none focus:border-primary"
                    placeholder="Street, city, postal code, country"
                    data-testid="withdrawal-address" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-text-muted mb-1.5">Proof of banking (PDF or JPG/PNG, max 5 MB)</p>
                  <label className="block border-2 border-dashed border-gray-200 hover:border-primary rounded-xl p-4 cursor-pointer text-center transition-colors" data-testid="withdrawal-proof-label">
                    <input type="file" accept=".pdf,image/png,image/jpeg" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} data-testid="withdrawal-proof-input" />
                    {form.proof_data_url ? (
                      <div className="text-xs">
                        <FileText className="mx-auto text-emerald-600 mb-1" size={18} />
                        <p className="font-bold text-emerald-700">{form.proof_filename}</p>
                        <p className="text-[10px] text-text-muted">Click to replace</p>
                      </div>
                    ) : (
                      <div className="text-xs text-text-muted">
                        <Upload className="mx-auto text-text-muted mb-1" size={18} />
                        <p className="font-bold text-primary">Upload bank letter or statement</p>
                        <p className="text-[10px]">Bank-issued document showing your name + account</p>
                      </div>
                    )}
                  </label>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setStep(1)} className="flex-1 bg-gray-100 text-text-primary font-semibold py-2.5 rounded-full text-sm" data-testid="withdrawal-back-2">Back</button>
                  <button disabled={!canAdvance2} onClick={() => setStep(3)} className="flex-1 bg-primary text-white font-bold py-2.5 rounded-full text-sm disabled:opacity-50" data-testid="withdrawal-next-2">Review</button>
                </div>
              </div>
            )}

            {/* Step 3 — Review */}
            {step === 3 && (
              <div className="space-y-3" data-testid="withdrawal-step-3">
                <div className="bg-background-subtle rounded-2xl p-4">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-text-muted">Withdrawal amount</p>
                  <p className="text-3xl font-heading font-bold text-primary">R{amountNum.toLocaleString()}</p>
                  <p className="text-[11px] text-text-muted mt-0.5">From {form.source === 'wallet' ? 'Wallet' : 'Promotions ZAR balance'}</p>
                </div>
                <div className="text-xs space-y-1.5">
                  <Row k="Name" v={form.full_name} />
                  <Row k="Bank" v={form.bank_name} />
                  <Row k="Account" v={form.account_number} mono />
                  {form.branch_code && <Row k="Branch" v={form.branch_code} mono />}
                  {form.swift_code && <Row k="SWIFT" v={form.swift_code} mono />}
                  <Row k="Address" v={form.address} />
                  <Row k="Proof" v={form.proof_filename || '—'} />
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-xs text-emerald-800 inline-flex gap-2">
                  <ShieldCheck size={14} className="flex-shrink-0 mt-0.5" />
                  <span>By submitting you confirm the details above are accurate and the bank account is in your name. Your request will be reviewed within 24–48 hours.</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setStep(2)} className="flex-1 bg-gray-100 text-text-primary font-semibold py-2.5 rounded-full text-sm" data-testid="withdrawal-back-3">Back</button>
                  <button disabled={submitting} onClick={submit} className="flex-1 bg-emerald-600 text-white font-bold py-2.5 rounded-full text-sm disabled:opacity-50" data-testid="withdrawal-submit">
                    {submitting && <Loader2 size={12} className="inline animate-spin mr-1" />}
                    Submit request
                  </button>
                </div>
              </div>
            )}

            {history.length > 0 && step === 1 && (
              <div className="border-t border-gray-100 pt-3">
                <p className="text-[10px] uppercase tracking-wider font-bold text-text-muted mb-2">Recent requests</p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto" data-testid="withdrawal-history">
                  {history.slice(0, 5).map((h) => (
                    <div key={h.id} className="flex items-center gap-2 text-xs bg-background-subtle rounded-xl p-2">
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${h.status === 'pending' ? 'bg-amber-100 text-amber-700' : h.status === 'approved' ? 'bg-blue-100 text-blue-700' : h.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{h.status}</span>
                      <span className="flex-1 truncate">R{h.amount_zar.toLocaleString()} · {h.source} · {new Date(h.created_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const FieldRow = ({ label, value, onChange, placeholder, testId }) => (
  <div>
    <p className="text-[10px] uppercase tracking-wider font-bold text-text-muted mb-1">{label}</p>
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary" data-testid={testId} />
  </div>
);

const Row = ({ k, v, mono }) => (
  <div className="flex items-baseline gap-2">
    <span className="text-text-muted w-16">{k}</span>
    <span className={`flex-1 font-semibold text-text-primary ${mono ? 'font-mono' : ''} break-all`}>{v}</span>
  </div>
);

export default WithdrawalRequestModal;
