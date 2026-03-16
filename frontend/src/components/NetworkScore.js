import React from 'react';
import { motion } from 'framer-motion';

const NetworkScore = ({ score, size = 'large', animate = true }) => {
  const sizeClasses = {
    small: 'text-sm',
    medium: 'text-2xl',
    large: 'text-4xl',
  };

  const content = (
    <span className={`font-bold text-secondary tracking-tighter ${sizeClasses[size]}`}>
      {score.toLocaleString()}
    </span>
  );

  if (!animate) return content;

  return (
    <motion.div
      initial={{ scale: 1 }}
      animate={{ scale: [1, 1.1, 1] }}
      transition={{ duration: 0.3 }}
    >
      {content}
    </motion.div>
  );
};

export default NetworkScore;