import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { axiosInstance } from '../App';
import { toast } from 'sonner';
import { Lock, Building2, Hash, Briefcase, ShieldCheck, Check, X } from 'lucide-react';

/**
 * Stokvel banking-collection block. Used inline on /stokvels (banner) and
 * inside a modal that gates Create/Join actions. Discloses clearly that the
 * details are ONLY for distribution of pool money.
 */
const StokvelBankingPrompt = ({ inline = false, onSaved, onCancel }) => {
  const [bankName, setBankName] = useState('');
  const [acc, setAcc] = useState('');
  const [swift, setSwift] = useState('');
  const [branch, setBranch] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e?.preventDefault();
    if (!bankName || !acc || !swift || !branch) {
      toast.error('Please complete all fields');
      return;
    }
    setSaving(true);
    try {
      await axiosInstance.post('/users/me/banking', {
        bank_name: bankName,
        account_number: acc,
        swift_code: swift,
        branch_number: branch,
      });
      toast.success('Banking details saved securely');
      onSaved?.();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save banking');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={inline ? 'bg-white rounded-2xl border border-gray-100 shadow-sm p-5' : 'bg-white rounded-2xl p-5 max-w-md w-full shadow-2xl'} data-testid="stokvel-banking-prompt">
      <div className="flex items-start gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-secondary/15 flex items-center justify-center flex-shrink-0">
          <Lock size={18} className="text-secondary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-heading font-bold text-text-primary text-base">Add banking details for the Stokvel</h3>
          <p className="text-xs text-text-muted leading-relaxed mt-0.5">
            Used <strong className="text-text-primary">only for distribution of pool money</strong> from your group.
            Network Capital does not hold or move your funds — contributions are held by an independent partner and your group keeps full control.
          </p>
        </div>
        {!inline && onCancel && (
          <button onClick={onCancel} className="text-text-muted hover:text-text-primary p-1" data-testid="banking-prompt-close">
            <X size={18} />
          </button>
        )}
      </div>

      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
        <Field icon={Building2} label="Bank name" value={bankName} onChange={setBankName} testid="sk-bank-name" placeholder="e.g. Standard Bank" />
        <Field icon={Hash} label="Account number" value={acc} onChange={setAcc} testid="sk-account-number" placeholder="Account number" />
        <Field icon={Briefcase} label="SWIFT code" value={swift} onChange={setSwift} testid="sk-swift-code" placeholder="SWIFT / BIC" />
        <Field icon={Hash} label="Branch number" value={branch} onChange={setBranch} testid="sk-branch-number" placeholder="Branch / sort code" />

        <div className="sm:col-span-2 flex items-center gap-2 text-[11px] text-text-muted">
          <ShieldCheck size={12} className="text-secondary" />
          Encrypted at rest · POPIA-protected · Never sold or shared.
        </div>

        <div className="sm:col-span-2 flex gap-2 pt-1">
          {onCancel && !inline && (
            <button type="button" onClick={onCancel} className="px-4 py-2.5 rounded-full bg-gray-100 text-text-primary text-sm font-medium" data-testid="banking-prompt-cancel">
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-primary hover:bg-primary-hover text-white py-2.5 rounded-full font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60 active:scale-95 transition-all"
            data-testid="banking-prompt-save"
          >
            {saving ? 'Saving…' : (<><Check size={16} /> Save banking details</>)}
          </button>
        </div>
      </form>
    </div>
  );
};

const Field = ({ icon: Icon, label, value, onChange, testid, placeholder }) => (
  <div>
    <label className="text-[11px] uppercase tracking-wider text-text-muted block mb-1">{label}</label>
    <div className="relative">
      <Icon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-background-subtle border border-gray-200 focus:border-primary outline-none text-sm"
        data-testid={testid}
      />
    </div>
  </div>
);

/**
 * Banner used on /stokvels listing — checks /users/me/banking and renders
 * the prompt only if missing. Calls onResolved when banking is on file.
 */
export const StokvelBankingBanner = ({ onResolved }) => {
  const [status, setStatus] = useState('loading'); // loading | needed | satisfied
  const [bankingInfo, setBankingInfo] = useState(null);

  const refresh = async () => {
    try {
      const r = await axiosInstance.get('/users/me/banking');
      if (r.data?.on_file) {
        setBankingInfo(r.data);
        setStatus('satisfied');
        onResolved?.(r.data);
      } else {
        setStatus('needed');
      }
    } catch {
      setStatus('needed');
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === 'loading') return null;

  if (status === 'satisfied') {
    return (
      <div className="rounded-2xl bg-green-50 border border-green-200 px-4 py-3 flex items-center gap-2 text-sm text-green-800" data-testid="banking-on-file-banner">
        <ShieldCheck size={16} className="text-green-600" />
        <span>Banking on file ({bankingInfo?.bank_name} · {bankingInfo?.account_masked}). You're ready to participate in any group.</span>
      </div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
        <StokvelBankingPrompt inline onSaved={refresh} />
      </motion.div>
    </AnimatePresence>
  );
};

export default StokvelBankingPrompt;
