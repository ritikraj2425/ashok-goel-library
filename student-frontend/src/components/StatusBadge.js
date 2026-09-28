'use client';

export default function StatusBadge({ status }) {
  const statusMap = {
    available: { label: 'Available', className: 'badge-available' },
    pending_approval: { label: 'Pending Approval', className: 'badge-pending' },
    booked: { label: 'Booked', className: 'badge-booked' },
    inactive: { label: 'Inactive', className: 'badge-inactive' },
    pending_members: { label: 'Waiting for Group', className: 'badge-warning' },
    pending: { label: 'On Hold', className: 'badge-pending' },
    approved: { label: 'Approved', className: 'badge-available' },
    cancel_requested: { label: 'Cancel Requested', className: 'badge-warning' },
    awaiting_checkin: { label: 'Awaiting Check-in', className: 'badge-warning' },
    checked_in: { label: 'Checked In', className: 'badge-available' },
    no_show: { label: 'Missed Check-in', className: 'badge-rejected' },
    rejected: { label: 'Rejected', className: 'badge-rejected' },
    auto_rejected: { label: 'Auto-Rejected', className: 'badge-rejected' },
    cancelled_by_student: { label: 'User Cancelled', className: 'badge-inactive' },
    cancelled_by_admin: { label: 'Admin Cancelled', className: 'badge-rejected' },
    early_checkout: { label: 'Early Checkout', className: 'badge-inactive' },
    completed: { label: 'Completed', className: 'badge-completed' },
  };

  const config = statusMap[status] || { label: status, className: 'badge-inactive' };

  return <span className={`badge ${config.className}`}>{config.label}</span>;
}
