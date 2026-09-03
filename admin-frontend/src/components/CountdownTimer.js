'use client';

import { useState, useEffect, useCallback } from 'react';

export default function CountdownTimer({ targetDate, className = '' }) {
  const calcRemaining = useCallback(() => {
    if (!targetDate) return null;
    const diff = new Date(targetDate).getTime() - Date.now();
    return diff <= 0 ? null : diff;
  }, [targetDate]);

  const [remaining, setRemaining] = useState(calcRemaining);

  useEffect(() => {
    const interval = setInterval(() => setRemaining(calcRemaining()), 1000);
    return () => clearInterval(interval);
  }, [calcRemaining]);

  if (remaining === null) return <span className={`countdown danger ${className}`}>Expired</span>;

  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);

  let urgencyClass = '';
  if (remaining < 120000) urgencyClass = 'danger';
  else if (remaining < 300000) urgencyClass = 'warning';

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  parts.push(`${minutes.toString().padStart(2, '0')}m`);
  parts.push(`${seconds.toString().padStart(2, '0')}s`);

  return <span className={`countdown ${urgencyClass} ${className}`}>{parts.join(' ')}</span>;
}
