import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Auth API
export const authApi = {
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  changePassword: (data) => api.post('/auth/change-password', data),
}

// Transactions API
export const transactionsApi = {
  list: (params) => api.get('/transactions', { params }),
  get: (id) => api.get(`/transactions/${id}`),
  create: (data) => api.post('/transactions', data),
  update: (id, data) => api.put(`/transactions/${id}`, data),
  delete: (id) => api.delete(`/transactions/${id}`),
  stats: (params) => api.get('/transactions/stats/summary', { params }),
}

// Categories API
export const categoriesApi = {
  list: () => api.get('/categories'),
  listWithStats: (params) => api.get('/categories/with-stats', { params }),
  create: (data) => api.post('/categories', data),
  update: (code, data) => api.put(`/categories/${code}`, data),
  delete: (code) => api.delete(`/categories/${code}`),
}

// Budgets API
export const budgetsApi = {
  list: () => api.get('/budgets'),
  summary: () => api.get('/budgets/summary'),
  create: (data) => api.post('/budgets', data),
  update: (id, data) => api.put(`/budgets/${id}`, data),
  delete: (id) => api.delete(`/budgets/${id}`),
}

// Settings API
export const settingsApi = {
  list: () => api.get('/settings'),
  get: (key) => api.get(`/settings/${key}`),
  update: (key, value) => api.put(`/settings/${key}`, { value }),
  delete: (key) => api.delete(`/settings/${key}`),
}

// Import API
export const importApi = {
  preview: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/import/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  commit: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/import/commit', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  history: () => api.get('/import/history'),
}

// Analytics API
export const analyticsApi = {
  overview: (params) => api.get('/analytics/overview', { params }),
  monthly: () => api.get('/analytics/monthly'),
}

export default api
