'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/lib/auth';
import { getAnalytics, getAnalyticsBookings, getBookingDetail, downloadAnalyticsCSV } from '@/lib/api';
import Sidebar from '@/components/Sidebar';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

function formatDuration(ms) {
  if (!ms) return '-';
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMin = minutes % 60;
  return `${hours}h ${remainingMin}m`;
}

const formatTimeSlot = (slotStr) => {
  if (!slotStr) return '';
  const formatTime = (time24) => {
    const [h, m] = time24.split(':');
    if (!h || !m) return time24;
    const hour = parseInt(h, 10);
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${m} ${suffix}`;
  };

  if (slotStr.includes('-')) {
    return slotStr.split('-').map(t => formatTime(t.trim())).join(' - ');
  }
  return formatTime(slotStr);
};

const formatBookingTimeSlot = (booking) => {
  if (booking.timeSlotIds && booking.timeSlotIds.length > 1) {
    const firstSlot = booking.timeSlotIds[0];
    const lastSlot = booking.timeSlotIds[booking.timeSlotIds.length - 1];
    const start = firstSlot.split('-')[0];
    const end = lastSlot.split('-')[1];
    return formatTimeSlot(`${start}-${end}`);
  }
  return formatTimeSlot(booking.timeSlotId);
};

const statusMap = {
  pending: { label: 'Pending', className: 'badge-pending' },
  approved: { label: 'Approved', className: 'badge-available' },

  awaiting_checkin: { label: 'Awaiting Check-in', className: 'badge-warning' },
  checked_in: { label: 'Checked In', className: 'badge-available' },
  no_show: { label: 'Missed Check-in', className: 'badge-rejected' },
  rejected: { label: 'Rejected', className: 'badge-rejected' },
  auto_rejected: { label: 'Auto-Rejected', className: 'badge-rejected' },
  cancelled_by_student: { label: 'User Cancelled', className: 'badge-inactive' },
  cancelled_by_admin: { label: 'Admin Cancelled', className: 'badge-inactive' },
  early_checkout: { label: 'Early Checkout', className: 'badge-inactive' },
  completed: { label: 'Completed', className: 'badge-completed' },
};

export default function AnalyticsPage() {
  const { admin, loading: authLoading } = useAdminAuth();
  const router = useRouter();

  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('daily');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [statusBookings, setStatusBookings] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalStudentsInModal, setTotalStudentsInModal] = useState(0);

  const [detailBooking, setDetailBooking] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadColumns, setDownloadColumns] = useState({
    date: true, slot: true, cabin: true, student_name: true, enrollment: true,
    phone: true, email: false, people_count: false, group_members: false,
    status: true, requested_at: false, approved_at: false, checked_in_at: false,
    completed_at: false, cancellation_reason: false,
  });
  const [downloadStatuses, setDownloadStatuses] = useState([]);

  const COLUMN_LABELS = {
    date: 'Date', slot: 'Time Slot', cabin: 'Cabin', student_name: 'Student Name',
    enrollment: 'Enrollment No.', phone: 'Phone', email: 'Email',
    people_count: 'People Count', group_members: 'Group Members', status: 'Status',
    requested_at: 'Requested At', approved_at: 'Approved At',
    checked_in_at: 'Checked In At', completed_at: 'Completed At',
    cancellation_reason: 'Cancellation Reason',
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const selectedCols = Object.entries(downloadColumns).filter(([, v]) => v).map(([k]) => k);
      if (selectedCols.length === 0) { alert('Please select at least one column.'); setDownloading(false); return; }

      const params = { columns: selectedCols, period, search: appliedSearch };
      if (downloadStatuses.length > 0) {
        params.statuses = downloadStatuses;
      }
      if (period === 'custom' && startDate && endDate) {
        params.startDate = new Date(startDate).toISOString();
        params.endDate = new Date(endDate).toISOString();
      }
      await downloadAnalyticsCSV(params);
      setShowDownloadModal(false);
    } catch (e) {
      alert(e.message);
    } finally {
      setDownloading(false);
    }
  };

  const fetchBookings = async (status, p, query = appliedSearch) => {
    setLoadingBookings(true);
    try {
      const params = { period, status, page: p, search: query };
      if (period === 'custom' && startDate && endDate) {
        params.startDate = new Date(startDate).toISOString();
        params.endDate = new Date(endDate).toISOString();
      }
      const data = await getAnalyticsBookings(params);
      setStatusBookings(data.bookings || []);
      setTotalPages(data.totalPages || 1);
      setTotalStudentsInModal(data.totalStudents || 0);
    } catch (e) {
      console.error(e);
      alert(e.message);
      if (p === 1) setSelectedStatus(null);
    } finally {
      setLoadingBookings(false);
    }
  };

  const handleBadgeClick = async (status, count) => {
    if (count === 0) return;
    setSelectedStatus(status);
    setPage(1);
    fetchBookings(status, 1);
  };

  const handleViewDetail = async (id) => {
    setLoadingDetail(true);
    try {
      const b = await getBookingDetail(id);
      setDetailBooking(b.booking);
    } catch (e) {
      alert(e.message);
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !admin) { router.push('/login'); return; }
  }, [admin, authLoading, router]);

  useEffect(() => {
    if (!admin) return;
    
    const params = { period, search: appliedSearch };
    if (period === 'custom') {
      if (!startDate || !endDate) return;
      params.startDate = new Date(startDate).toISOString();
      params.endDate = new Date(endDate).toISOString();
    }
    
    setLoading(true);
    getAnalytics(params)
      .then(setAnalytics)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [admin, period, appliedSearch, startDate, endDate]);

  if (authLoading || loading) {
    return (
      <div className="admin-layout">
        <Sidebar />
        <main className="admin-content"><div className="loading-container"><div className="spinner" /></div></main>
      </div>
    );
  }

  if (!analytics) return null;

  const { counts, cabinUsage, popularSlots, studentCounts = {} } = analytics;

  const mockBooking = {
    bookingDate: new Date().toISOString().split('T')[0],
    timeSlotId: '09:30-10:30',
    cabinId: { name: 'Demo Cabin' },
    mainStudent: { name: 'John Doe', enrollmentNumber: '123456', phoneNumber: '9876543210' },
    studentUserId: { email: 'john.doe@example.com' },
    peopleCount: 3,
    groupMembers: [{ name: 'Jane Doe' }, { name: 'Jim Doe' }],
    status: 'completed',
    requestedAt: new Date().toISOString()
  };

  return (
    <div className="admin-layout">
      <Sidebar />
      <main className="admin-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 className="page-title">Analytics</h1>
            <p className="page-subtitle">Booking statistics and usage patterns.</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowDownloadModal(true)}>
            Download CSV
          </button>
        </div>

        <div className="filters" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {['daily', 'weekly', 'monthly', 'custom'].map((p) => (
              <button key={p} className={`filter-btn ${period === p ? 'active' : ''}`} onClick={() => setPeriod(p)}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
            {period === 'custom' && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: '8px' }}>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--color-border)' }} />
                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>to</span>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--color-border)' }} />
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder="Search by name or enrollment..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setAppliedSearch(searchQuery);
                }
              }}
              style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--color-border)', width: '250px' }}
            />
            <button
              className="btn btn-primary"
              onClick={() => {
                setAppliedSearch(searchQuery);
              }}
            >
              Search
            </button>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="stats-grid">
          <div className="card stat-card" style={{ cursor: counts.total > 0 ? 'pointer' : 'default' }} onClick={() => handleBadgeClick('total', counts.total)}>
            <div className="stat-value">{counts.total || 0}</div>
            <div className="stat-label">Total Bookings</div>
            {studentCounts.total > 0 && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>{studentCounts.total} Students</div>}
          </div>
          <div className="card stat-card" style={{ cursor: counts.cancelled_by_student > 0 ? 'pointer' : 'default' }} onClick={() => handleBadgeClick('cancelled_by_student', counts.cancelled_by_student)}>
            <div className="stat-value">{counts.cancelled_by_student || 0}</div>
            <div className="stat-label">User Cancelled</div>
            {studentCounts.cancelled_by_student > 0 && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>{studentCounts.cancelled_by_student} Students</div>}
          </div>
          <div className="card stat-card" style={{ cursor: counts.no_show > 0 ? 'pointer' : 'default' }} onClick={() => handleBadgeClick('no_show', counts.no_show)}>
            <div className="stat-value" style={{ color: 'var(--color-error)' }}>{counts.no_show || 0}</div>
            <div className="stat-label">Check In Delay</div>
            {studentCounts.no_show > 0 && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>{studentCounts.no_show} Students</div>}
          </div>
          <div className="card stat-card" style={{ cursor: counts.completed > 0 ? 'pointer' : 'default' }} onClick={() => handleBadgeClick('completed', counts.completed)}>
            <div className="stat-value" style={{ color: 'var(--color-status-available)' }}>{counts.completed || 0}</div>
            <div className="stat-label">Completed Session</div>
            {studentCounts.completed > 0 && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>{studentCounts.completed} Students</div>}
          </div>
          <div className="card stat-card" style={{ cursor: counts.cancelled_by_admin > 0 ? 'pointer' : 'default' }} onClick={() => handleBadgeClick('cancelled_by_admin', counts.cancelled_by_admin)}>
            <div className="stat-value">{counts.cancelled_by_admin || 0}</div>
            <div className="stat-label">Admin Cancelled</div>
            {studentCounts.cancelled_by_admin > 0 && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>{studentCounts.cancelled_by_admin} Students</div>}
          </div>
          <div className="card stat-card" style={{ cursor: counts.early_checkout > 0 ? 'pointer' : 'default' }} onClick={() => handleBadgeClick('early_checkout', counts.early_checkout)}>
            <div className="stat-value">{counts.early_checkout || 0}</div>
            <div className="stat-label">Early Checkout</div>
            {studentCounts.early_checkout > 0 && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>{studentCounts.early_checkout} Students</div>}
          </div>
          <div className="card stat-card" style={{ cursor: counts.rejected > 0 ? 'pointer' : 'default' }} onClick={() => handleBadgeClick('rejected', counts.rejected)}>
            <div className="stat-value" style={{ color: 'var(--color-error)' }}>{counts.rejected || 0}</div>
            <div className="stat-label">Admin Rejected</div>
            {studentCounts.rejected > 0 && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>{studentCounts.rejected} Students</div>}
          </div>
          <div className="card stat-card" style={{ cursor: counts.auto_rejected > 0 ? 'pointer' : 'default' }} onClick={() => handleBadgeClick('auto_rejected', counts.auto_rejected)}>
            <div className="stat-value" style={{ color: 'var(--color-error)' }}>{counts.auto_rejected || 0}</div>
            <div className="stat-label">Auto-Rejected</div>
            {studentCounts.auto_rejected > 0 && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>{studentCounts.auto_rejected} Students</div>}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 'var(--space-xl)', marginTop: 'var(--space-2xl)' }}>
          {/* Cabin-wise Usage Chart */}
          <div className="dashboard-section">
            <h3 className="section-title">Cabin-wise Usage</h3>
            <div className="card" style={{ height: '350px' }}>
              {(!cabinUsage || cabinUsage.length === 0) ? (
                <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}><p className="text-muted">No usage data available.</p></div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--color-text-secondary)', marginBottom: '-20px', zIndex: 1, paddingRight: '10px', paddingTop: '10px', display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
                    <span>Total Bookings: {cabinUsage.reduce((sum, cabin) => sum + (cabin.bookingCount || 0), 0)}</span>
                    <span>Total Students: {cabinUsage.reduce((sum, cabin) => sum + (cabin.totalPeople || 0), 0)}</span>
                  </div>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={cabinUsage} 
                        dataKey="bookingCount" 
                        nameKey="cabinName" 
                        cx="50%" cy="50%" outerRadius={100} 
                        label={({ cabinName, bookingCount, totalPeople }) => `${cabinName}: ${bookingCount} B / ${totalPeople} S`}
                      >
                        {cabinUsage.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'][index % 5]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div style={{ backgroundColor: 'var(--color-bg-primary)', padding: 'var(--space-md)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)' }}>
                                <p style={{ fontWeight: 'bold', margin: '0 0 var(--space-xs) 0', color: 'var(--color-text-primary)' }}>{data.cabinName}</p>
                                <p style={{ margin: '0', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>Bookings: <strong>{data.bookingCount}</strong></p>
                                <p style={{ margin: '0', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>Students: <strong>{data.totalPeople}</strong></p>
                              </div>
                            );
                          }
                          return null;
                        }} 
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Popular Slots Chart */}
          <div className="dashboard-section">
            <h3 className="section-title">Popular Slots (Peak Hours)</h3>
            <div className="card" style={{ height: '350px' }}>
              {(!popularSlots || popularSlots.length === 0) ? (
                <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}><p className="text-muted">No slots data available.</p></div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={popularSlots.map(s => ({ ...s, formattedSlot: formatTimeSlot(s.slot) }))} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="formattedSlot" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip cursor={{ fill: 'var(--color-bg-secondary)' }} />
                    <Bar dataKey="count" fill="var(--color-primary)" radius={[4, 4, 0, 0]} name="Bookings" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Booking List Modal */}
        {selectedStatus && (
          <div className="modal-overlay" onClick={() => setSelectedStatus(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
              <div className="modal-header" style={{ alignItems: 'flex-start' }}>
                <div>
                  <h2 style={{ textTransform: 'capitalize', marginBottom: 'var(--space-xs)' }}>{selectedStatus.replace(/_/g, ' ')} Bookings</h2>
                  {totalStudentsInModal > 0 && (
                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                      Total Students: {totalStudentsInModal}
                    </div>
                  )}
                </div>
                <button className="btn btn-ghost" onClick={() => setSelectedStatus(null)}>Close</button>
              </div>
              <div className="modal-body">
                {loadingBookings ? (
                  <div className="loading-container"><div className="spinner" /></div>
                ) : (
                  <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Slot</th>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Phone</th>
                          <th>Status</th>
                          <th>Reason</th>
                          <th>Resolution Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {statusBookings.map(b => (
                          <tr key={b._id} onClick={() => handleViewDetail(b._id)} style={{ cursor: 'pointer' }} className="table-row-hover">
                            <td>{b.bookingDate}</td>
                            <td>{formatBookingTimeSlot(b)}</td>
                            <td>{b.studentUserId?.name || b.mainStudent?.name}</td>
                            <td>{b.studentUserId?.email || '-'}</td>
                            <td>{b.mainStudent?.phoneNumber || '-'}</td>
                            <td>
                              <span className={`badge ${statusMap[b.status]?.className || 'badge-default'}`}>
                                {statusMap[b.status]?.label || b.status.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td style={{ maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {b.rejectionReason || b.cancellationReason || '-'}
                            </td>
                            <td>
                              {b.status === 'completed' && b.expiresAt ? (
                                <span style={{ fontSize: '12px' }}>{new Date(b.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (Checkout)</span>
                              ) : (b.status === 'cancelled_by_student' || b.status === 'cancelled_by_admin') && b.cancelledAt ? (
                                <span style={{ fontSize: '12px' }}>{new Date(b.cancelledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (Cancelled)</span>
                              ) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {!loadingBookings && totalPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-md)', marginTop: 'var(--space-lg)' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={page <= 1}
                      onClick={() => {
                        const newPage = page - 1;
                        setPage(newPage);
                        fetchBookings(selectedStatus, newPage);
                      }}
                    >
                      Previous
                    </button>
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center' }}>
                      Page {page} of {totalPages}
                    </span>
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={page >= totalPages}
                      onClick={() => {
                        const newPage = page + 1;
                        setPage(newPage);
                        fetchBookings(selectedStatus, newPage);
                      }}
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Booking Detail Modal */}
        {detailBooking && (
          <div className="modal-overlay" onClick={() => setDetailBooking(null)} style={{ zIndex: 1100 }}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Booking Details</h2>
                <button className="btn btn-ghost" onClick={() => setDetailBooking(null)}>Close</button>
              </div>
              <div className="modal-body">
                {loadingDetail ? (
                  <div className="loading-container"><div className="spinner" /></div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                    <div><strong>Cabin:</strong> {detailBooking.cabinId?.name}</div>
                    <div><strong>Date:</strong> {detailBooking.bookingDate}</div>
                    <div><strong>Slot:</strong> {formatBookingTimeSlot(detailBooking)}</div>
                    <div><strong>Status:</strong> <span className={`badge ${statusMap[detailBooking.status]?.className || 'badge-default'}`}>{statusMap[detailBooking.status]?.label || detailBooking.status}</span></div>
                    <div><strong>Main Student:</strong> {detailBooking.mainStudent?.name}</div>
                    <div><strong>Enrollment:</strong> {detailBooking.mainStudent?.enrollmentNumber}</div>
                    <div><strong>Phone:</strong> {detailBooking.mainStudent?.phoneNumber}</div>
                    <div><strong>People Count:</strong> {detailBooking.peopleCount}</div>
                    {detailBooking.groupMembers?.length > 0 && (
                      <div>
                        <strong>Group Members:</strong>
                        <ul style={{ paddingLeft: 'var(--space-lg)', marginTop: 'var(--space-xs)' }}>
                          {detailBooking.groupMembers.map((m, i) => (
                            <li key={i} style={{ fontSize: 'var(--font-size-sm)' }}>{m.name} ({m.enrollmentNumber})</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {detailBooking.rejectionReason && <div><strong>Rejection Reason:</strong> {detailBooking.rejectionReason}</div>}
                    {detailBooking.cancellationReason && <div><strong>Cancellation Reason:</strong> {detailBooking.cancellationReason}</div>}
                    <div><strong>Requested:</strong> {new Date(detailBooking.requestedAt).toLocaleString()}</div>
                    {detailBooking.approvedAt && <div><strong>Approved:</strong> {new Date(detailBooking.approvedAt).toLocaleString()}</div>}
                    {detailBooking.expiresAt && <div><strong>Expires:</strong> {new Date(detailBooking.expiresAt).toLocaleString()}</div>}
                    {detailBooking.approvedBy && <div><strong>Approved By:</strong> {detailBooking.approvedBy.username}</div>}
                    {detailBooking.studentUserId && <div><strong>Account:</strong> {detailBooking.studentUserId.email}</div>}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Download CSV Modal */}
        {showDownloadModal && (
          <div className="modal-overlay" onClick={() => setShowDownloadModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', width: '90vw' }}>
              <div className="modal-header">
                <h2>Download Analytics Report</h2>
                <button className="btn btn-ghost" onClick={() => setShowDownloadModal(false)}>Close</button>
              </div>
              <div className="modal-body">
                <p style={{ marginBottom: 'var(--space-md)' }}>Select the columns you want to include in the CSV download:</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
                  {Object.entries(COLUMN_LABELS).map(([key, label]) => (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={downloadColumns[key]}
                        onChange={(e) => setDownloadColumns(prev => ({ ...prev, [key]: e.target.checked }))}
                      />
                      <span style={{ fontSize: 'var(--font-size-sm)' }}>{label}</span>
                    </label>
                  ))}
                </div>

                <div style={{ borderTop: '1px solid var(--color-border)', margin: 'var(--space-md) 0' }}></div>

                <p style={{ marginBottom: 'var(--space-md)' }}>Filter by Status (leave all unchecked to include all):</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
                  {[
                    'pending', 'approved', 'rejected', 'auto_rejected',
                    'cancelled_by_student', 'cancelled_by_admin', 'completed',
                    'cancel_requested', 'awaiting_checkin', 'checked_in', 'no_show', 'early_checkout'
                  ].map((status) => (
                    <label key={status} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={downloadStatuses.includes(status)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setDownloadStatuses([...downloadStatuses, status]);
                          } else {
                            setDownloadStatuses(downloadStatuses.filter(s => s !== status));
                          }
                        }}
                      />
                      <span style={{ fontSize: 'var(--font-size-sm)', textTransform: 'capitalize' }}>
                        {status.replace(/_/g, ' ')}
                      </span>
                    </label>
                  ))}
                </div>

                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-md)' }}>
                  <h3 style={{ fontSize: 'var(--font-size-md)', marginBottom: 'var(--space-sm)' }}>Live Preview</h3>
                  <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-sm)' }}>
                    Sample of how your CSV will look (showing current data).
                  </p>
                  <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}>
                    <table className="data-table" style={{ fontSize: '12px' }}>
                      <thead>
                        <tr>
                          {Object.entries(downloadColumns).filter(([, v]) => v).map(([k]) => (
                            <th key={k} style={{ whiteSpace: 'nowrap' }}>{COLUMN_LABELS[k]}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[mockBooking].map((b, i) => (
                          <tr key={i}>
                            {Object.entries(downloadColumns).filter(([, v]) => v).map(([k]) => {
                              let val = '';
                              if (k === 'date') val = b.bookingDate;
                              else if (k === 'slot') val = formatBookingTimeSlot(b);
                              else if (k === 'cabin') val = b.cabinId?.name;
                              else if (k === 'student_name') val = b.mainStudent?.name;
                              else if (k === 'enrollment') val = b.mainStudent?.enrollmentNumber;
                              else if (k === 'phone') val = b.mainStudent?.phoneNumber;
                              else if (k === 'email') val = b.studentUserId?.email;
                              else if (k === 'people_count') val = b.peopleCount;
                              else if (k === 'group_members') val = (b.groupMembers || []).map(m => m.name).join(', ');
                              else if (k === 'status') val = b.status?.replace(/_/g, ' ');
                              else if (k === 'requested_at') val = b.requestedAt ? new Date(b.requestedAt).toLocaleString() : '';
                              return <td key={k} style={{ whiteSpace: 'nowrap' }}>{val || '-'}</td>;
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-md)' }}>
                <button className="btn btn-secondary" onClick={() => setShowDownloadModal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleDownload} disabled={downloading}>
                  {downloading ? 'Downloading...' : 'Download CSV'}
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
