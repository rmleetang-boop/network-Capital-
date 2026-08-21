import React from 'react';
import { useNavigate } from 'react-router-dom';

const TOKEN_RE = /(#[A-Za-z0-9_]{2,30}|@[A-Za-z0-9_]{2,30})/g;

/** Renders post content with clickable hashtags and @mentions. */
const HashtagText = ({ text = '', className = '' }) => {
  const navigate = useNavigate();
  const tokens = text.split(TOKEN_RE);
  return (
    <span className={className}>
      {tokens.map((tok, i) => {
        if (tok && tok[0] === '#' && tok.length > 1) {
          const tag = tok.slice(1);
          return (
            <button
              key={i}
              onClick={() => navigate(`/hashtag/${tag}`)}
              className="font-medium text-[#6fa8ff] hover:underline"
              data-testid={`hashtag-${tag}`}
            >
              {tok}
            </button>
          );
        }
        if (tok && tok[0] === '@' && tok.length > 1) {
          return (
            <span key={i} className="font-medium text-[#f1c768]">
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
