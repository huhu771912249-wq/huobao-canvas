import request from '@/utils/request'

export const login = (username, password) => request.post('/auth/login', { username, password })
export const session = () => request.get('/auth/session')
export const logout = () => request.post('/auth/logout', {})
