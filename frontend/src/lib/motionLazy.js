/**
 * motionLazy — defer the framer-motion module load until after first paint.
 *
 * Provides drop-in `MotionDiv`, `MotionSpan`, `AnimatePresenceLazy` components
 * that render plain HTML elements on the first frame, then swap to the real
 * framer-motion components once the chunk has finished downloading.
 *
 * Why: framer-motion is ~60 KB gzipped. Even though FeedPage is itself lazy-
 * loaded, framer-motion was being eagerly required by FeedPage's top-level
 * imports. With this shim, framer-motion is fetched in the background ONLY
 * AFTER FeedPage has already painted its first frame.
 */
import React, { useEffect, useState } from 'react';

let cachedModule = null;
let inflight = null;

const loadMotion = () => {
  if (cachedModule) return Promise.resolve(cachedModule);
  if (inflight) return inflight;
  inflight = import('framer-motion').then((m) => {
    cachedModule = m;
    return m;
  });
  return inflight;
};

const useMotion = () => {
  const [mod, setMod] = useState(cachedModule);
  useEffect(() => {
    if (cachedModule) {
      setMod(cachedModule);
      return;
    }
    let alive = true;
    loadMotion().then((m) => {
      if (alive) setMod(m);
    });
    return () => { alive = false; };
  }, []);
  return mod;
};

const passthroughDOMProps = (props) => {
  // Strip framer-motion-specific props so they don't end up as DOM attributes
  // when we render a plain div/span during the load window.
  const stripped = { ...props };
  delete stripped.initial;
  delete stripped.animate;
  delete stripped.exit;
  delete stripped.transition;
  delete stripped.whileHover;
  delete stripped.whileTap;
  delete stripped.whileInView;
  delete stripped.viewport;
  delete stripped.variants;
  delete stripped.layout;
  delete stripped.layoutId;
  delete stripped.drag;
  delete stripped.dragConstraints;
  delete stripped.dragElastic;
  delete stripped.onAnimationComplete;
  delete stripped.onUpdate;
  return stripped;
};

export const MotionDiv = (props) => {
  const mod = useMotion();
  if (mod?.motion?.div) {
    const Motion = mod.motion.div;
    return <Motion {...props} />;
  }
  return <div {...passthroughDOMProps(props)} />;
};

export const MotionSpan = (props) => {
  const mod = useMotion();
  if (mod?.motion?.span) {
    const Motion = mod.motion.span;
    return <Motion {...props} />;
  }
  return <span {...passthroughDOMProps(props)} />;
};

export const AnimatePresenceLazy = ({ children, ...rest }) => {
  const mod = useMotion();
  if (mod?.AnimatePresence) {
    const AP = mod.AnimatePresence;
    return <AP {...rest}>{children}</AP>;
  }
  // While framer-motion is loading, just render children (no exit animations).
  return <>{children}</>;
};

// Compatibility re-export for callers that expect a LazyMotion wrapper —
// it's a no-op pass-through here since the motion lib is already deferred.
export const LazyMotion = ({ children }) => <>{children}</>;
