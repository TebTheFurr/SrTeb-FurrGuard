import axios from 'axios'

const api = axios.create({
  baseURL: '/admin/api.php',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = '/admin/index.php?logout=1'
    }
    return Promise.reject(error)
  },
)

export async function apiRequest<T = any>(
  action: string,
  params: Record<string, any> = {},
): Promise<T> {
  const { data } = await api.post('', { action, ...params })
  return data
}

export default api
