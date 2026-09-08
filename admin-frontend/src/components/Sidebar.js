'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAdminAuth } from '@/lib/auth';

export default function Sidebar() {
  const { admin, logout } = useAdminAuth();
  const pathname = usePathname();

  if (!admin) return null;

  const links = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/analytics', label: 'Analytics' },
    { href: '/all-users', label: 'All Users' },
    { href: '/blocked-students', label: 'Blocked Students' },
  ];

  if (admin.role === 'root') {
    links.push({ href: '/cabins', label: 'Cabins' });
    links.push({ href: '/users', label: 'Admin Users' });
  }

  return (
    <aside className="sidebar">
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
  );
}
