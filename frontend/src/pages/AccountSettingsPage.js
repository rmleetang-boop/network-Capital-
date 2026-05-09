import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, AlertTriangle, Power, Trash2, Loader2, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { axiosInstance } from '../App';

const AccountSettingsPage = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [showDeactivate, setShowDeactivate] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [reason, setReason] = useState('');

  const expectedConfirm = (user?.username || '').trim();

  const handleDeactivate = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await axiosInstance.post('/account/deactivate', { reason });
      toast.success('Account deactivated. Log in again any time to reactivate.');
      setShowDeactivate(false);
      if (onLogout) onLogout();
      navigate('/');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not deactivate account');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (busy) return;
    if (confirmText.trim() !== expectedConfirm) {
      toast.error(`Please type your username "${expectedConfirm}" exactly to confirm.`);
      return;
    }
    setBusy(true);
    try {
      await axiosInstance.post('/account/delete', { confirm: confirmText.trim(), reason });
      toast.success('Account scheduled for deletion in 30 days. Log in any time to cancel.');
      setShowDelete(false);
      if (onLogout) onLogout();
      navigate('/');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not delete account');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background-DEFAULT pb-24" data-testid="account-settings-page">
      <div className="sticky top-0 z-10 bg-white/85 backdrop-blur-lg border-b border-gray-200 px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100" data-testid="settings-back">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-heading font-bold text-primary">Account Settings</h1>
          <p className="text-xs text-text-secondary">Manage how your account is stored and accessed.</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-5">
        {/* Account summary */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <p className="text-xs text-text-muted uppercase tracking-wider font-semibold mb-1">Signed in as</p>
          <p className="text-base font-semibold text-text-primary">@{user?.username}</p>
          <p className="text-sm text-text-secondary">{user?.email}</p>
        </motion.div>

        {/* Deactivate */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="bg-white rounded-2xl border border-secondary/30 p-5 shadow-sm">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-secondary/15 text-secondary flex items-center justify-center flex-shrink-0">
              <Power size={20} />
            </div>
            <div className="flex-1">
              <h3 className="font-heading font-bold text-text-primary mb-1">Deactivate temporarily</h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                Hide your profile and pause activity. Reactivates automatically the next time you log in. All your data is preserved.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowDeactivate(true)}
            className="w-full bg-secondary/15 hover:bg-secondary/25 text-[#7a4f00] font-semibold py-2.5 rounded-full transition-all"
            data-testid="deactivate-open-button"
          >
            Deactivate account
          </button>
        </motion.div>

        {/* Delete */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl border border-red-200 p-5 shadow-sm">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0">
              <Trash2 size={20} />
            </div>
            <div className="flex-1">
              <h3 className="font-heading font-bold text-text-primary mb-1">Delete account</h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                Schedule your account for deletion. You have <strong>30 days</strong> to change your mind — just log in to cancel. After that, your data is permanently removed.
              </p>
              <ul className="text-xs text-text-secondary mt-2 space-y-0.5">
                <li>• Premium subscription auto-cancelled</li>
                <li>• Direct messages, notifications, and score history erased</li>
                <li>• Posts and comments may remain anonymised</li>
              </ul>
            </div>
          </div>
          <button
            onClick={() => setShowDelete(true)}
            className="w-full bg-red-50 hover:bg-red-100 text-red-700 font-semibold py-2.5 rounded-full transition-all"
            data-testid="delete-open-button"
          >
            Delete account
          </button>
        </motion.div>
      </div>

      {/* Deactivate confirm modal */}
      {showDeactivate && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => !busy && setShowDeactivate(false)} data-testid="deactivate-modal">
          <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="px-6 pt-6 pb-4 bg-gradient-to-br from-secondary/10 to-secondary/0">
              <div className="flex items-center gap-3 mb-2">
                <ShieldAlert size={22} className="text-secondary" />
                <h3 className="font-heading font-bold text-lg">Deactivate temporarily?</h3>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed">
                Your profile will be hidden until you log back in. Nothing is deleted.
              </p>
            </div>
            <div className="px-6 pb-6 pt-3 space-y-3">
              <textarea
                value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder="Reason (optional — helps us improve)"
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary"
                data-testid="deactivate-reason"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeactivate(false)} disabled={busy}
                  className="flex-1 py-2.5 rounded-full border border-gray-200 font-semibold text-text-secondary hover:bg-gray-50 disabled:opacity-50">
                  Cancel
                </button>
                <button
                  onClick={handleDeactivate} disabled={busy}
                  className="flex-1 py-2.5 rounded-full bg-secondary text-primary font-bold hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2"
                  data-testid="deactivate-confirm-button">
                  {busy ? <Loader2 size={16} className="animate-spin" /> : null}
                  Deactivate
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete confirm modal */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => !busy && setShowDelete(false)} data-testid="delete-modal">
          <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="px-6 pt-6 pb-4 bg-gradient-to-br from-red-50 to-white border-b border-red-100">
              <div className="flex items-center gap-3 mb-2">
                <AlertTriangle size={22} className="text-red-600" />
                <h3 className="font-heading font-bold text-lg text-red-700">Delete account?</h3>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed">
                This schedules your account for deletion in <strong>30 days</strong>. You can cancel by logging in within that window. Type your username below to confirm.
              </p>
            </div>
            <div className="px-6 pb-6 pt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                  Type <span className="font-mono text-red-700">{expectedConfirm}</span> to confirm
                </label>
                <input
                  type="text"
                  value={confirmText} onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Your username"
                  autoComplete="off"
                  className="w-full px-3 py-2.5 border-2 border-red-200 rounded-xl outline-none focus:border-red-500 font-mono"
                  data-testid="delete-confirm-input"
                />
              </div>
              <textarea
                value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder="Reason (optional)"
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary"
                data-testid="delete-reason"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDelete(false)} disabled={busy}
                  className="flex-1 py-2.5 rounded-full border border-gray-200 font-semibold text-text-secondary hover:bg-gray-50 disabled:opacity-50">
                  Keep account
                </button>
                <button
                  onClick={handleDelete}
                  disabled={busy || confirmText.trim() !== expectedConfirm}
                  className="flex-1 py-2.5 rounded-full bg-red-600 text-white font-bold hover:bg-red-700 disabled:opacity-40 flex items-center justify-center gap-2"
                  data-testid="delete-confirm-button">
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  Delete in 30 days
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default AccountSettingsPage;
