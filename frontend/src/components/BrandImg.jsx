import React from 'react';

/**
 * BrandImg — emits a <picture> with WebP source + PNG fallback.
 *
 * Pass `src` as the PNG path (e.g. "/brand/logo-mark.png"). A WebP sibling
 * (e.g. "/brand/logo-mark.webp") is assumed to live next to it. Modern browsers
 * (~96% global) will pick the WebP and save 50-65% bytes vs the PNG.
 *
 * Every other prop is forwarded to the underlying <img> (className, alt, style,
 * width, height, loading, decoding, …).
 */
const BrandImg = ({ src, alt = '', ...imgProps }) => {
  const webpSrc = src && src.endsWith('.png') ? src.replace(/\.png$/, '.webp') : null;
  return (
    <picture>
      {webpSrc && <source srcSet={webpSrc} type="image/webp" />}
      <img src={src} alt={alt} {...imgProps} />
    </picture>
  );
};

export default BrandImg;
