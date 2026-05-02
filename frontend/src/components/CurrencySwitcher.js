import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useCurrency } from '../context/CurrencyContext';

const CurrencySwitcher = ({ compact = false, testId = 'currency-switcher' }) => {
  const { currency, currencies, setCurrency } = useCurrency();

  if (!currencies.length) return null;

  return (
    <Select value={currency} onValueChange={setCurrency}>
      <SelectTrigger
        className={compact ? 'h-8 text-xs w-[110px]' : 'h-10 w-[140px]'}
        data-testid={testId}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {currencies.map((c) => (
          <SelectItem key={c.code} value={c.code} data-testid={`currency-option-${c.code}`}>
            <span className="font-medium">{c.code}</span>{' '}
            <span className="text-text-muted">· {c.symbol}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default CurrencySwitcher;
