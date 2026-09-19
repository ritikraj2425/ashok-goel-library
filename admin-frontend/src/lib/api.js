const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('admin_token');
}

function setToken(token) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('admin_token', token);
  }
}

function removeToken() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('admin_token');
  }
}

async function apiRequest(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');

  let data = null;
  if (isJson) {
    data = await response.json();
  }

  if (!response.ok) {
    const errorMessage = data?.error || (isJson ? 'Something went wrong' : `Server Error: ${response.status} ${response.statusText}`);
    const error = new Error(errorMessage);
    error.status = response.status;
    throw error;
  }

  return data;
}

// --- Auth ---
export async function adminLogin(username, password) {
  const data = await apiRequest('/api/admin/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  if (data.token) setToken(data.token);
  return data;
}

export async function adminLogout() {
  try {
    await apiRequest('/api/admin/auth/logout', { method: 'POST' });
  } catch (e) {}
  removeToken();
}

export async function getAdminMe() {
  return apiRequest('/api/admin/auth/me');
}

// --- Dashboard ---
export async function getDashboard() {
  return apiRequest('/api/admin/dashboard');
}

// --- Bookings ---
export async function getBookingDetail(id) {
  return apiRequest(`/api/admin/bookings/${id}`);
}

export async function approveBooking(bookingId) {
  return apiRequest(`/api/admin/bookings/${bookingId}/approve`, {
    method: 'POST',
  });
}

export async function approveBookingCancellation(bookingId) {
  return apiRequest(`/api/admin/bookings/${bookingId}/approve-cancel`, {
    method: 'POST',
  });
}

export async function rejectBooking(id, reason) {
  return apiRequest(`/api/admin/bookings/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function cancelBooking(id, reason) {
  return apiRequest(`/api/admin/bookings/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function checkInBooking(bookingId) {
  return apiRequest(`/api/admin/bookings/${bookingId}/check-in`, {
    method: 'POST',
  });
}

// --- Analytics ---
export async function getAnalytics(params = {}) {
  const query = new URLSearchParams(params).toString();
  return apiRequest(`/api/admin/analytics?${query}`);
}

export async function getAnalyticsBookings(params = {}) {
  const query = new URLSearchParams(params).toString();
  return apiRequest(`/api/admin/analytics/bookings?${query}`);
}

// --- Cabins ---
export async function getAdminCabins() {
  return apiRequest('/api/admin/cabins');
}

export async function createCabin(data) {
  return apiRequest('/api/admin/cabins', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateCabin(id, data) {
  return apiRequest(`/api/admin/cabins/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteCabin(id) {
  return apiRequest(`/api/admin/cabins/${id}`, { method: 'DELETE' });
}

export async function getCabinStatusForAdmin() {
  return apiRequest('/api/admin/cabins/status');
}

export async function createAdminBooking(data) {
  return apiRequest('/api/admin/bookings/admin-book', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// --- Admin Users ---
export async function getAdminUsers(page = 1, limit = 20) {
  return apiRequest(`/api/admin/users?page=${page}&limit=${limit}`);
}

export async function createAdminUser(data) {
  return apiRequest('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateAdminUser(id, data) {
  return apiRequest(`/api/admin/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteAdminUser(id) {
  return apiRequest(`/api/admin/users/${id}`, { method: 'DELETE' });
}

// --- Students ---
export async function getAllStudents(page = 1, limit = 20, search = '') {
  return apiRequest(`/api/admin/students?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`);
}

export async function getBlockedStudents(page = 1, limit = 20) {
  return apiRequest(`/api/admin/students/blocked?page=${page}&limit=${limit}`);
}

export async function unblockStudent(id) {
  return apiRequest(`/api/admin/students/${id}/unblock`, { method: 'POST' });
}

export async function blockStudent(email) {
  return apiRequest('/api/admin/students/block', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function searchStudents(query) {
  return apiRequest(`/api/admin/students/search?q=${encodeURIComponent(query)}`);
}

// --- System Settings ---
export async function getSystemSettings() {
  return apiRequest('/api/admin/settings');
}

export async function updateWeeklySchedule(weeklySchedule) {
  return apiRequest('/api/admin/settings/schedule', {
    method: 'PUT',
    body: JSON.stringify({ weeklySchedule }),
  });
}

export async function addException(data) {
  return apiRequest('/api/admin/settings/exceptions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function removeException(id) {
  return apiRequest(`/api/admin/settings/exceptions/${id}`, { method: 'DELETE' });
}

// --- Analytics CSV Download ---
export async function downloadAnalyticsCSV(params = {}) {
  const token = getToken();
  const response = await fetch(`${API_URL}/api/admin/analytics/download-csv`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    credentials: 'include',
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to download CSV');
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `analytics_report_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  a.remove();
}

export { getToken, removeToken };
