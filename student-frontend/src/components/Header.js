'use client';

import { useAuth } from '@/lib/auth';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';

export default function Header() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const headerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (headerRef.current && !headerRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  return (
    <header className="header" ref={headerRef}>
      <div className="header-inner">
        <Link href="/dashboard" style={{ color: 'inherit', textDecoration: 'none' }}>
          <div className="header-brand">
            <h1>Ashok Goel Library</h1>
            <span>Cabin Booking Portal</span>
          </div>
        </Link>
        
        {/* Hamburger Icon */}
        <button 
          className="mobile-menu-btn" 
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Toggle menu"
        >
          ☰
        </button>

        <div className={`header-user ${isMenuOpen ? 'open' : ''}`}>
          <nav className="header-nav">
            <Link
              href="/dashboard"
              className={`header-nav-link ${pathname === '/dashboard' ? 'active' : ''}`}
              onClick={() => setIsMenuOpen(false)}
            >
              Dashboard
            </Link>
            <Link
              href="/my-bookings"
              className={`header-nav-link ${pathname === '/my-bookings' ? 'active' : ''}`}
              onClick={() => setIsMenuOpen(false)}
            >
              My Bookings
            </Link>
          </nav>
          <Link href="/profile" className="header-user-name" style={{ cursor: 'pointer', color: 'inherit', textDecoration: 'none' }} title="View Profile" onClick={() => setIsMenuOpen(false)}>
            {user.name}
          </Link>
          <button className="btn btn-ghost btn-sm" onClick={() => { setIsMenuOpen(false); logout(); }}>
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}
