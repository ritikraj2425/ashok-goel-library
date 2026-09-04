const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('student_token');
}

function setToken(token) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('student_token', token);
  }
}

function removeToken() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('student_token');
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
export async function loginWithGoogle(idToken) {
  const data = await apiRequest('/api/auth/google', {
    method: 'POST',
    body: JSON.stringify({ idToken }),
  });
  if (data.token) {
    setToken(data.token);
  }
  return data;
}

export async function logout() {
  try {
    await apiRequest('/api/auth/logout', { method: 'POST' });
  } catch (e) {
    // Ignore logout errors
  }
  removeToken();
}

export async function getMe() {
  return apiRequest('/api/auth/me');
}

// --- Cabins ---
export async function getCabinStatus() {
  return apiRequest('/api/cabins/status');
}

export async function updateProfile(data) {
  return apiRequest('/api/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// --- Bookings ---
export async function createBookingRequest(data) {
  return apiRequest('/api/bookings/request', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export const getMyActiveBookings = async () => {
  return apiRequest('/api/bookings/my-active');
};

export async function getMyBookingHistory(page = 1, limit = 20) {
  return apiRequest(`/api/bookings/my-history?page=${page}&limit=${limit}`);
}

export async function cancelPendingBooking(bookingId) {
  return apiRequest(`/api/bookings/${bookingId}/cancel-pending`, {
    method: 'POST',
  });
}

export const cancelApprovedBooking = async (bookingId) => {
  return apiRequest(`/api/bookings/${bookingId}/cancel-approved`, {
    method: 'POST',
  });
};

export { getToken, setToken, removeToken };
