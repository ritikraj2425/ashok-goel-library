'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/lib/auth';
import { getAdminUsers, createAdminUser, updateAdminUser, deleteAdminUser } from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import ConfirmDialog from '@/components/ConfirmDialog';

export default function UsersPage() {
  const { admin, loading: authLoading } = useAdminAuth();
  const router = useRouter();

  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ username: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [resetId, setResetId] = useState(null);
  const [resetPassword, setResetPassword] = useState('');
  const [confirm, setConfirm] = useState(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchAdmins = useCallback(async (p) => {
    try {
      const data = await getAdminUsers(p);
      setAdmins(data.admins || []);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !admin) { router.push('/login'); return; }
    if (admin && admin.role !== 'root') { router.push('/dashboard'); return; }
    if (admin) fetchAdmins(page);
  }, [admin, authLoading, router, fetchAdmins, page]);

  const showMsg = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await createAdminUser(newAdmin);
      setShowCreate(false);
      setNewAdmin({ username: '', password: '' });
      showMsg('Admin created');
      fetchAdmins(page);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (id, isActive) => {
    try {
      await updateAdminUser(id, { isActive: !isActive });
      showMsg(isActive ? 'Admin deactivated' : 'Admin activated');
      fetchAdmins(page);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleResetPassword = async (id) => {
    if (!resetPassword || resetPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setSaving(true);
    try {
      await updateAdminUser(id, { password: resetPassword });
      setResetId(null);
      setResetPassword('');
      showMsg('Password reset successfully');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id, username) => {
    setConfirm({
      title: 'Delete Admin',
      message: `Are you sure you want to delete admin "${username}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      confirmClass: 'btn-danger',
      onConfirm: async () => {
        await deleteAdminUser(id);
        setConfirm(null);
        showMsg('Admin deleted');
        fetchAdmins(page);
      },
    });
  };

  if (authLoading || loading) {
    return (
      <div className="admin-layout">
        <Sidebar />
        <main className="admin-content"><div className="loading-container"><div className="spinner" /></div></main>
      </div>
    );
  }

  return (
    <div className="admin-layout">
      <Sidebar />
      <main className="admin-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
          <h1 className="page-title">Admin Users</h1>
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? 'Cancel' : 'Add Admin'}
          </button>
        </div>
        <p className="page-subtitle">Manage administrator accounts.</p>

        {success && <div className="alert alert-success">{success}</div>}
        {error && <div className="alert alert-error">{error}</div>}

        {showCreate && (
          <div className="card" style={{ marginBottom: 'var(--space-xl)' }}>
            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, marginBottom: 'var(--space-lg)' }}>New Admin</h3>
            <form onSubmit={handleCreate}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                <div className="form-group"><label className="form-label">Username</label><input className="form-input" value={newAdmin.username} onChange={(e) => setNewAdmin(p => ({...p, username: e.target.value}))} required minLength={3} /></div>
                <div className="form-group"><label className="form-label">Password</label><input className="form-input" type="password" value={newAdmin.password} onChange={(e) => setNewAdmin(p => ({...p, password: e.target.value}))} required minLength={6} /></div>
              </div>
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? 'Creating...' : 'Create Admin'}</button>
            </form>
          </div>
        )}

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a._id}>
                  <td><strong>{a.username}</strong></td>
                  <td><span className={`badge ${a.role === 'root' ? 'badge-root' : 'badge-completed'}`}>{a.role}</span></td>
                  <td><span className={`badge ${a.isActive ? 'badge-available' : 'badge-inactive'}`}>{a.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td style={{ fontSize: 'var(--font-size-xs)' }}>{a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString() : 'Never'}</td>
                  <td>
                    {a.role !== 'root' && (
                      <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleToggleActive(a._id, a.isActive)}>
                          {a.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        {resetId === a._id ? (
                          <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                            <input className="inline-input" type="password" placeholder="New password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} style={{ width: 120 }} />
                            <button className="btn btn-primary btn-sm" onClick={() => handleResetPassword(a._id)} disabled={saving}>Set</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => { setResetId(null); setResetPassword(''); }}>X</button>
                          </div>
                        ) : (
                          <button className="btn btn-ghost btn-sm" onClick={() => setResetId(a._id)}>Reset Password</button>
                        )}
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-error)' }} onClick={() => handleDelete(a._id, a.username)}>Delete</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-md)', marginTop: 'var(--space-xl)' }}>
          <button
            className="btn btn-secondary btn-sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center' }}>
            Page {page} of {totalPages}
          </span>
          <button
            className="btn btn-secondary btn-sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>

        {confirm && (
          <ConfirmDialog
            title={confirm.title}
            message={confirm.message}
            confirmLabel={confirm.confirmLabel}
            confirmClass={confirm.confirmClass}
            onConfirm={confirm.onConfirm}
            onCancel={() => setConfirm(null)}
          />
        )}
      </main>
    </div>
  );
}
