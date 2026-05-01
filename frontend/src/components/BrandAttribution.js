import React from 'react';

/**
 * Subtle brand attribution shown on key entry / public screens.
 * Adapts color contrast to dark or light backgrounds via the `tone` prop.
 *
 * Usage:
 *   <BrandAttribution />            // dark backgrounds (default)
 *   <BrandAttribution tone="light"/> // light/white backgrounds
 *   <BrandAttribution position="static"/> // inline (no fixed positioning)
 */
const BrandAttribution = ({ tone = 'dark', position = 'fixed' }) => {
  const colorClass =
    tone === 'light'
      ? 'text-gray-400 hover:text-gray-500'
      : 'text-white/40 hover:text-white/60';

  const positionClass =
    position === 'fixed'
      ? 'fixed bottom-3 left-0 right-0 z-30 pointer-events-none'
      : 'w-full';

  return (
    <div
      className={`${positionClass} flex justify-center px-4`}
      data-testid="brand-attribution"
      aria-label="Powered by Mici Business"
    >
      <p
        className={`text-[11px] sm:text-xs font-medium tracking-wide select-none transition-colors ${colorClass}`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        Powered by Mici Business
      </p>
    </div>
  );
};

export default BrandAttribution;
