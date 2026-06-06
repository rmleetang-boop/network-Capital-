import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, Loader2, Shield, AlertTriangle, Check, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { axiosInstance } from '../App';

/* Platform-owner one-time-set super-admin PIN.
 * Renders three states:
 *   1) status=loading: spinner
 *   2) status=unset:   "Create your PIN" form (set-once)
 *   3) status=set:     "Verify your PIN" form (issues a 15-min token stored in
 *                      sessionStorage as `nc_super_pin_token` for downstream calls)
 * The pin is hashed bcrypt server-side and can never be changed via the app.
 */
const SuperPinPage = ({ user, onVerified }) => {
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const isOwner = user && user.role === 'super_admin';

  useEffect(() => {
    if (!isOwner) { setStatus('not_owner'); return; }
    axiosInstance.get('/admin/super-pin/status')
      .then((r) => setStatus(r.data?.is_set ? 'set' : 'unset'))
      .catch(() => setStatus('error'));
  }, [isOwner]);

  const handleSet = async () => {
    if (pin.length < 6) { toast.error('PIN must be at least 6 characters'); return; }
    if (pin !== confirm) { toast.error('PINs do not match'); return; }
    if (!window.confirm('This PIN cannot be changed via the app once set. Continue?')) return;
    setBusy(true);
    try {
      await axiosInstance.post('/admin/super-pin/set', { pin });
      toast.success('Super-admin PIN set');
      setStatus('set');
      setPin(''); setConfirm('');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to set PIN');
    } finally { setBusy(false); }
  };

  const handleVerify = async () => {
    if (!pin) { toast.error('Enter your PIN'); return; }
    setBusy(true);
    try {
      const r = await axiosInstance.post('/admin/super-pin/verify', { pin });
      sessionStorage.setItem('nc_super_pin_token', r.data.token);
      sessionStorage.setItem('nc_super_pin_exp', String(Date.now() + (r.data.expires_in_minutes || 15) * 60 * 1000));
      toast.success('PIN verified — sensitive actions unlocked for 15 minutes');
      if (onVerified) onVerified(r.data.token);
      navigate('/admin/owner');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'PIN verification failed');
      setPin('');
    } finally { setBusy(false); }
  };

  if (!isOwner) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#04101e] text-white p-6">
        <div className="max-w-sm text-center bg-white/5 border border-white/10 rounded-3xl p-8">
          <Shield size={32} className="mx-auto text-white/40 mb-3" />
          <p className="text-sm">Platform Owner only.</p>
          <button onClick={() => navigate(-1)} className="mt-4 bg-secondary text-primary text-sm font-bold px-5 py-2 rounded-full">Go back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#04101e] via-[#0a1f3a] to-[#04101e] text-white" data-testid="super-pin-page">
      <div className="max-w-md mx-auto px-6 py-12">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-br from-[#E8A817]/30 to-[#E8A817]/5 border border-[#E8A817]/30 mb-4">
            <Crown size={28} className="text-[#E8A817]" />
          </div>
          <h1 className="font-heading font-bold text-2xl sm:text-3xl mb-1">
            {status === 'unset' ? 'Set your Owner PIN' : 'Owner PIN'}
          </h1>
          <p className="text-sm text-white/55">
            {status === 'unset'
              ? 'Choose a strong PIN — it will guard destructive admin actions and cannot be changed via the app.'
              : 'Enter your PIN to unlock destructive admin actions for 15 minutes.'}
          </p>
        </div>

        {status === 'loading' && (
          <div className="py-16 text-center"><Loader2 className="mx-auto animate-spin text-white/40" /></div>
        )}

        {status === 'unset' && (
          <div className="bg-white/[0.04] border border-white/10 rounded-3xl p-6 space-y-4 backdrop-blur-sm">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 flex gap-2.5">
              <AlertTriangle size={16} className="text-amber-300 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-100/90 leading-snug">
                <strong>One-time only.</strong> Pick something memorable + strong. The hash is stored server-side and cannot be retrieved or reset from the app.
              </p>
            </div>
            <PinField label="New PIN (min 6 chars)" value={pin} setValue={setPin} show={show} setShow={setShow} testid="pin-input" />
            <PinField label="Confirm PIN" value={confirm} setValue={setConfirm} show={show} setShow={setShow} testid="pin-confirm" />
            <button
              onClick={handleSet}
              disabled={busy || pin.length < 6 || pin !== confirm}
              className="w-full bg-[#E8A817] text-[#04101e] font-bold py-3.5 rounded-full inline-flex items-center justify-center gap-2 disabled:opacity-50"
              data-testid="pin-set-btn"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              Set Owner PIN forever
            </button>
          </div>
        )}

        {status === 'set' && (
          <div className="bg-white/[0.04] border border-white/10 rounded-3xl p-6 space-y-4 backdrop-blur-sm">
            <PinField label="Owner PIN" value={pin} setValue={setPin} show={show} setShow={setShow} testid="pin-verify-input" autofocus />
            <button
              onClick={handleVerify}
              disabled={busy || !pin}
              className="w-full bg-[#E8A817] text-[#04101e] font-bold py-3.5 rounded-full inline-flex items-center justify-center gap-2 disabled:opacity-50"
              data-testid="pin-verify-btn"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
              Unlock destructive actions
            </button>
            <p className="text-[11px] text-white/40 text-center">Token expires after 15 minutes of inactivity.</p>
          </div>
        )}

        {status === 'error' && (
          <p className="text-center text-red-300 text-sm py-8">Could not load PIN status.</p>
        )}
      </div>
    </div>
  );
};

const PinField = ({ label, value, setValue, show, setShow, testid, autofocus }) => (
  <div>
    <label className="text-[11px] uppercase tracking-wider font-bold text-white/55">{label}</label>
    <div className="relative mt-1.5">
      <input
        autoFocus={autofocus}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full bg-white/5 border border-white/15 rounded-2xl px-4 py-3 text-base font-mono text-white placeholder-white/30 outline-none focus:border-[#E8A817]"
        placeholder="••••••"
        data-testid={testid}
      />
      <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white">
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  </div>
);

export default SuperPinPage;
