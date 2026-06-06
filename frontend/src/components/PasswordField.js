import React, { useMemo, useState } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';

/**
 * PasswordField — drop-in replacement for any `<input type="password" />`.
 * • Eye toggle to reveal/hide value (works on desktop + mobile)
 * • Built-in lock icon + brand styling matching login / signup
 * • Pass `showStrength` to render a 4-segment strength indicator below
 *
 * Used on AuthPage (login + signup), ResetPasswordPage, and the in-app
 * "Change password" flow. Keeps password handling consistent + secure.
 */
const PasswordField = ({
  name = 'password',
  value,
  onChange,
  placeholder = 'Password',
  required = true,
  autoComplete = 'current-password',
  showStrength = false,
  testid = 'password-input',
  className = '',
  toggleClassName = '',
}) => {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <div className={`relative ${className}`}>
        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
        <input
          type={visible ? 'text' : 'password'}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          className="w-full pl-12 pr-12 py-3 rounded-full border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
          data-testid={testid}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          tabIndex={-1}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-text-muted hover:text-text-primary rounded-full hover:bg-gray-100 transition-colors ${toggleClassName}`}
          data-testid={`${testid}-toggle`}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {showStrength && <PasswordStrengthMeter password={value || ''} testid={`${testid}-strength`} />}
    </>
  );
};

/**
 * Returns a 0–4 score + a human label.  Pure client-side hint — the server
 * enforces the actual policy (≥ 8 chars, letter + digit) in `_password_strength_ok`.
 */
export const scorePassword = (pw) => {
  let score = 0;
  if (!pw) return { score: 0, label: 'Too short' };
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  score = Math.min(score, 4);
  const labels = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
  return { score, label: labels[score] };
};

export const PasswordStrengthMeter = ({ password, testid }) => {
  const { score, label } = useMemo(() => scorePassword(password), [password]);
  if (!password) return null;
  const colors = ['bg-red-400', 'bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-green-500'];
  return (
    <div className="mt-1.5 px-1" data-testid={testid}>
      <div className="flex gap-1 mb-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`flex-1 h-1 rounded-full transition-colors ${i < score ? colors[score] : 'bg-gray-200'}`}
          />
        ))}
      </div>
      <p className="text-[11px] text-text-muted">
        Strength: <span className={`font-bold ${score >= 3 ? 'text-green-600' : score >= 2 ? 'text-yellow-600' : 'text-red-500'}`}>{label}</span>
        {score < 2 && <span className="ml-1 opacity-70">· min 8 chars, letter + digit</span>}
      </p>
    </div>
  );
};

export default PasswordField;
