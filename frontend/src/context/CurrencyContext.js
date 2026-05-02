import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { axiosInstance } from '../App';

const CurrencyContext = createContext({
  currency: 'USD',
  symbol: '$',
  rate: 1,
  currencies: [],
  setCurrency: () => {},
  format: (v) => `$${v}`,
  premiumUnlocked: false,
  premiumFeeUsd: 10,
  refreshUser: () => {},
});

export const CurrencyProvider = ({ children, user, setUser }) => {
  const [currencies, setCurrencies] = useState([]);
  const [premiumFeeUsd, setPremiumFeeUsd] = useState(10);
  const currency = user?.currency || 'USD';
  const meta = currencies.find((c) => c.code === currency) || { symbol: '$', rate: 1, code: 'USD' };
  const premiumUnlocked = !!user?.premium_unlocked;

  useEffect(() => {
    axiosInstance
      .get('/currencies')
      .then((r) => {
        setCurrencies(r.data.currencies || []);
        setPremiumFeeUsd(r.data.premium_fee_usd || 10);
      })
      .catch(() => {});
  }, []);

  const setCurrency = useCallback(
    async (newCurrency) => {
      try {
        const res = await axiosInstance.put('/users/me', { currency: newCurrency });
        if (setUser) setUser(res.data);
      } catch (e) {
        console.error('Currency switch failed', e);
      }
    },
    [setUser]
  );

  const refreshUser = useCallback(async () => {
    try {
      const res = await axiosInstance.get('/users/me');
      if (setUser) setUser(res.data);
    } catch (e) {}
  }, [setUser]);

  const format = useCallback(
    (usdValue, opts = {}) => {
      const v = (Number(usdValue) || 0) * meta.rate;
      const decimals = opts.decimals ?? (meta.code === 'JPY' || meta.code === 'NGN' ? 0 : 2);
      const formatted = v.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
      return `${meta.symbol}${formatted}`;
    },
    [meta]
  );

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        symbol: meta.symbol,
        rate: meta.rate,
        currencies,
        setCurrency,
        format,
        premiumUnlocked,
        premiumFeeUsd,
        refreshUser,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => useContext(CurrencyContext);
