'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '@/lib/auth';
import { getAllStudents } from '@/lib/api';
import Sidebar from '@/components/Sidebar';

export default function AllUsersPage() {
  const { admin, loading: authLoading } = useAdminAuth();

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalStudents, setTotalStudents] = useState(0);

  const fetchStudents = useCallback(async (p, search) => {
    setLoading(true);
    setError('');
    try {
      const data = await getAllStudents(p, 20, search);
      setStudents(data.students || []);
      setTotalPages(data.totalPages || 1);
      setTotalStudents(data.totalStudents || 0);
    } catch (err) {
      setError(err.message || 'Failed to fetch students');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (admin) {
      fetchStudents(page, appliedSearch);
    }
  }, [admin, fetchStudents, page, appliedSearch]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setAppliedSearch(searchQuery);
  };

  if (authLoading || (loading && students.length === 0)) {
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
        <h1 className="page-title">All Users</h1>
        <p className="page-subtitle">View and search all registered students in the platform. Total: {totalStudents}</p>

        {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-md)' }}>{error}</div>}

        <div className="dashboard-section card" style={{ marginBottom: 'var(--space-xl)' }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Search by name, email, or enrollment..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '300px' }}
            />
            <button type="submit" className="btn btn-primary">
              Search
            </button>
            {appliedSearch && (
              <button type="button" className="btn btn-ghost" onClick={() => { setSearchQuery(''); setAppliedSearch(''); setPage(1); }}>
                Clear
              </button>
            )}
          </form>
        </div>

        <div className="dashboard-section">
          {students.length === 0 ? (
            <div className="empty-state">
              <p>No students found.</p>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'x-auto' }}>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Enrollment No.</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => {
                      const isBlockedTemp = student.blockedUntil && new Date(student.blockedUntil) > new Date();
                      const isBlockedPerm = student.isBlocked;
                      
                      let statusBadge = <span className="badge badge-available">Active</span>;
                      if (isBlockedPerm) statusBadge = <span className="badge badge-rejected">Permanently Blocked</span>;
                      else if (isBlockedTemp) statusBadge = <span className="badge badge-rejected">Temporarily Blocked</span>;

                      return (
                        <tr key={student._id}>
                          <td>{student.name}</td>
                          <td>{student.email}</td>
                          <td>{student.enrollmentNumber || '-'}</td>
                          <td>{statusBadge}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
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
      </main>
    </div>
  );
}
