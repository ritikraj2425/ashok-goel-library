'use client';

import { useState, useEffect, useCallback } from 'react';

export default function CountdownTimer({ targetDate, className = '' }) {
  const calcRemaining = useCallback(() => {
    if (!targetDate) return null;
    const diff = new Date(targetDate).getTime() - Date.now();
    if (diff <= 0) return null;
    return diff;
  }, [targetDate]);

  const [remaining, setRemaining] = useState(calcRemaining);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(calcRemaining());
    }, 1000);
    return () => clearInterval(interval);
  }, [calcRemaining]);

  if (remaining === null) {
    return <span className={`countdown ${className}`}>Expired</span>;
  }

  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

  let urgencyClass = '';
  if (remaining < 2 * 60 * 1000) urgencyClass = 'danger';
  else if (remaining < 5 * 60 * 1000) urgencyClass = 'warning';

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  parts.push(`${minutes.toString().padStart(2, '0')}m`);
  parts.push(`${seconds.toString().padStart(2, '0')}s`);

  return (
    <span className={`countdown ${urgencyClass} ${className}`}>
      {parts.join(' ')}
    </span>
  );
}
