import React from 'react';
import { useNavigate } from 'react-router-dom';

const HASHTAG_RE = /(#[A-Za-z0-9_]{2,30})/g;
const MENTION_RE = /(@[A-Za-z0-9_]{2,30})/g;

/** Renders post content with clickable hashtags and @mentions. */
const HashtagText = ({ text = '', className = '' }) => {
  const navigate = useNavigate();
  // Split by both hashtags and mentions while keeping the matches
  const tokens = text.split(/(#[A-Za-z0-9_]{2,30}|@[A-Za-z0-9_]{2,30})/g);
  return (
    <span className={className}>
      {tokens.map((tok, i) => {
        if (HASHTAG_RE.test(tok)) {
          HASHTAG_RE.lastIndex = 0;
          const tag = tok.slice(1);
          return (
            <button
              key={i}
              onClick={() => navigate(`/hashtag/${tag}`)}
              className="text-primary font-medium hover:underline"
              data-testid={`hashtag-${tag}`}
            >
              {tok}
            </button>
          );
        }
        if (MENTION_RE.test(tok)) {
          MENTION_RE.lastIndex = 0;
          return (
            <span key={i} className="text-secondary font-medium">
              {tok}
            </span>
          );
        }
        return <span key={i}>{tok}</span>;
      })}
    </span>
  );
};

export default HashtagText;
