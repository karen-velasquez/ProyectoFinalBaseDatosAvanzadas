const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(data?.error?.message || `Error ${response.status}`);
  return data;
}

export const api = {
  health: () => request('/health'),

  searchVideos: (params) => request(`/api/videos?${new URLSearchParams(params)}`),
  createVideo: (video) => request('/api/videos', { method: 'POST', body: video }),
  addCopies: (videoId, quantity) => request(`/api/videos/${videoId}/copies`, { method: 'POST', body: { quantity } }),
  availableCopies: (videoId) => request(`/api/videos/${videoId}/copies/available`),
  removeCopy: (copyId, reason) => request(`/api/videos/copies/${copyId}/removal`, { method: 'POST', body: { reason } }),

  listCustomers: (blocked) => request(`/api/customers${blocked === undefined ? '' : `?blocked=${blocked}`}`),
  createCustomer: (customer) => request('/api/customers', { method: 'POST', body: customer }),
  updateCustomer: (id, patch) => request(`/api/customers/${id}`, { method: 'PATCH', body: patch }),
  blockCustomer: (id, reason) => request(`/api/customers/${id}/block`, { method: 'POST', body: { reason } }),

  rent: (payload) => request('/api/loans', { method: 'POST', body: payload }),
  activeLoans: () => request('/api/loans/active'),
  returnLoan: (id) => request(`/api/loans/${id}/return`, { method: 'POST' }),

  getPolicy: () => request('/api/settings/rental-policy'),
  updatePolicy: (policy) => request('/api/settings/rental-policy', { method: 'PATCH', body: policy })
};
