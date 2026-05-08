import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Premium loading screen — deep black with gold accents.
 * Logo shimmers in, particles drift up, faint sweep, "Powered by Mici Business Pty Ltd" at the bottom.
 */
const PremiumLoadingScreen = ({ minDuration = 1800, onDone }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => { setVisible(false); onDone?.(); }, minDuration);
    return () => clearTimeout(t);
  }, [minDuration, onDone]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
          data-testid="premium-loading-screen"
          style={{
            background: 'radial-gradient(ellipse at center, #0a1628 0%, #050b15 60%, #000000 100%)',
          }}
        >
          {/* Faint network nodes background */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.07]" viewBox="0 0 800 800" preserveAspectRatio="xMidYMid slice" fill="none">
            <g stroke="#f5d76e" strokeWidth="0.4">
              <line x1="120" y1="220" x2="280" y2="160" />
              <line x1="280" y1="160" x2="450" y2="240" />
              <line x1="450" y1="240" x2="640" y2="180" />
              <line x1="200" y1="500" x2="380" y2="420" />
              <line x1="380" y1="420" x2="560" y2="500" />
              <line x1="560" y1="500" x2="700" y2="420" />
              <line x1="120" y1="220" x2="200" y2="500" />
              <line x1="450" y1="240" x2="380" y2="420" />
              <line x1="640" y1="180" x2="560" y2="500" />
            </g>
            <g fill="#f5d76e">
              {[
                [120,220],[280,160],[450,240],[640,180],
                [200,500],[380,420],[560,500],[700,420],
              ].map(([x,y], i) => <circle key={i} cx={x} cy={y} r="2.5" />)}
            </g>
          </svg>

          {/* Drifting gold particles */}
          <div className="absolute inset-0 pointer-events-none">
            {Array.from({ length: 24 }).map((_, i) => (
              <motion.span
                key={i}
                className="absolute rounded-full"
                style={{
                  left: `${(i * 37) % 100}%`,
                  bottom: `-8px`,
                  width: i % 4 === 0 ? '3px' : '2px',
                  height: i % 4 === 0 ? '3px' : '2px',
                  background: 'rgba(245, 215, 110, 0.6)',
                  boxShadow: '0 0 8px rgba(245,215,110,0.7)',
                }}
                animate={{
                  y: ['-10vh', '-100vh'],
                  opacity: [0, 0.9, 0],
                }}
                transition={{
                  duration: 8 + (i % 6),
                  repeat: Infinity,
                  delay: (i * 0.3) % 4,
                  ease: 'linear',
                }}
              />
            ))}
          </div>

          {/* Diagonal gold sweep */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            initial={{ x: '-150%' }}
            animate={{ x: '150%' }}
            transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              background: 'linear-gradient(120deg, transparent 30%, rgba(245,215,110,0.10) 50%, transparent 70%)',
            }}
          />

          {/* Soft pulsing glow halo */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            animate={{ opacity: [0.5, 0.85, 0.5] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              background: 'radial-gradient(circle at center, rgba(245,215,110,0.10) 0%, transparent 50%)',
            }}
          />

          {/* Center: logo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.4, ease: [0.2, 0.8, 0.2, 1] }}
            className="relative z-10 flex flex-col items-center"
          >
            <div className="relative">
              {/* Glow halo behind logo */}
              <div
                className="absolute inset-0 -m-10 rounded-full pointer-events-none"
                style={{ background: 'radial-gradient(circle, rgba(245,215,110,0.32) 0%, transparent 60%)', filter: 'blur(24px)' }}
              />
              <img
                src="https://customer-assets.emergentagent.com/job_fc3cb5f0-3a8d-48cd-b3b3-8fcdd6e615e4/artifacts/3x79ttpx_Network%20Capital_Secondary%20Logo.png"
                alt="Network Capital"
                className="h-32 sm:h-36 w-auto relative"
                style={{ filter: 'drop-shadow(0 0 18px rgba(245,215,110,0.45))' }}
              />
              {/* Shimmer pass over the logo */}
              <motion.div
                className="absolute inset-0 pointer-events-none rounded-xl overflow-hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0] }}
                transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 0.6 }}
              >
                <motion.div
                  className="absolute inset-0"
                  initial={{ x: '-100%' }}
                  animate={{ x: '100%' }}
                  transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 0.6, ease: 'easeInOut' }}
                  style={{ background: 'linear-gradient(110deg, transparent 35%, rgba(255,235,170,0.4) 50%, transparent 65%)', mixBlendMode: 'overlay' }}
                />
              </motion.div>
            </div>

            {/* Wordmark hidden — secondary logo already includes brand + tagline */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              transition={{ duration: 1.4, delay: 1.0 }}
              className="mt-5 text-[11px] tracking-[0.3em] uppercase text-white/50"
            >
              Connect · Participate · Elevate
            </motion.p>
          </motion.div>

          {/* Bottom credit */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.55 }}
            transition={{ duration: 1.2, delay: 1.4 }}
            className="absolute bottom-6 left-0 right-0 text-center"
          >
            <p
              className="text-[11px] sm:text-xs tracking-[0.2em] text-white/55"
              style={{ fontFamily: '"Cormorant Garamond", "Playfair Display", Georgia, serif', fontStyle: 'italic' }}
            >
              Powered by Mici Business Pty Ltd
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PremiumLoadingScreen;
