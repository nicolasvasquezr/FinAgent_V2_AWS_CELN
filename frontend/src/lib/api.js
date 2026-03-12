const BASE = '/api'

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Error desconocido')
  }
  return res.status === 204 ? null : res.json()
}

export const api = {
  getTransactions: (params = {}) => {
    const q = new URLSearchParams(Object.entries(params).filter(([,v]) => v))
    return request(`/transactions${q.toString() ? '?' + q : ''}`)
  },
  createTransaction: (data) => request('/transactions', { method: 'POST', body: JSON.stringify(data) }),
  updateTransaction: (id, data) => request(`/transactions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTransaction: (id) => request(`/transactions/${id}`, { method: 'DELETE' }),
  getCategories: () => request('/categories'),
  createCategory: (data) => request('/categories', { method: 'POST', body: JSON.stringify(data) }),
  updateCategory: (id, data) => request(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCategory: (id) => request(`/categories/${id}`, { method: 'DELETE' }),
  getStats: (month) => request(`/stats${month ? '?month=' + month : ''}`),
  classifyDescription: (description) => request('/ai/classify', { method: 'POST', body: JSON.stringify({ description }) }),
  retrainAI: () => request('/ai/retrain', { method: 'POST' }),
  getAIInfo: () => request('/ai/info'),
}