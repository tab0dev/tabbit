import React, { useState } from 'react';

// shared favicon with graceful fallback on load error.
// renders either the favicon image or a placeholder div.
export interface FaviconProps {
  src?: string | null;
  size?: number;
  className?: string;
  fallbackClass?: string;
}

export default function Favicon({ src, size = 14, className, fallbackClass }: FaviconProps) {
  const [err, setErr] = useState<boolean>(false);

  if (src && !err) {
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className={className}
        onError={() => setErr(true)}
      />
    );
  }

  return (
    <div
      className={fallbackClass}
      style={fallbackClass ? undefined : { width: size, height: size }}
    />
  );
}
