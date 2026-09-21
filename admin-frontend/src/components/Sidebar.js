'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAdminAuth } from '@/lib/auth';

export default function Sidebar() {
  const { admin, logout } = useAdminAuth();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  if (!admin) return null;

  const links = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/analytics', label: 'Analytics' },
    { href: '/book-cabin', label: 'Book Cabin' },
    { href: '/all-users', label: 'All Users' },
    { href: '/blocked-students', label: 'Blocked Students' },
  ];

  if (admin.role === 'root') {
    links.push({ href: '/cabins', label: 'Cabins' });
    links.push({ href: '/users', label: 'Admin Users' });
  }

  const closeSidebar = () => setIsOpen(false);

  return (
    <>
      <div className="mobile-topbar">
        <div className="mobile-brand">Ashok Goel Library</div>
        <button className="mobile-menu-btn" onClick={() => setIsOpen(!isOpen)}>
          ☰
        </button>
      </div>

      {isOpen && <div className="sidebar-overlay" onClick={closeSidebar} />}

      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <h2>Ashok Goel Library</h2>
          <p>Admin Portal</p>
        </div>

        <nav className="sidebar-nav">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`sidebar-link ${pathname === link.href ? 'active' : ''}`}
              onClick={closeSidebar}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="admin-info">
            {admin.username} {admin.role === 'root' && <span className="badge badge-root" style={{ marginLeft: 4 }}>Root</span>}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={logout} style={{ width: '100%' }}>
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
