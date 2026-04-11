import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from '@/stores/auth-store'
import type { User } from '@/types'

const mockUser: User = {
  id: 'user-1',
  email: 'test@example.com',
  phone: null,
  name: 'Test User',
  flat_id: 'flat-1',
  role: 'resident',
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

describe('useAuthStore', () => {
  beforeEach(() => {
    // Reset store between tests
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isInitialized: false,
    })
  })

  describe('setAuth', () => {
    it('sets user and accessToken', () => {
      useAuthStore.getState().setAuth(mockUser, 'test-token-123')

      const state = useAuthStore.getState()
      expect(state.user).toEqual(mockUser)
      expect(state.accessToken).toBe('test-token-123')
    })

    it('sets isAuthenticated to true', () => {
      expect(useAuthStore.getState().isAuthenticated).toBe(false)

      useAuthStore.getState().setAuth(mockUser, 'token')

      expect(useAuthStore.getState().isAuthenticated).toBe(true)
    })

    it('sets isInitialized to true', () => {
      expect(useAuthStore.getState().isInitialized).toBe(false)

      useAuthStore.getState().setAuth(mockUser, 'token')

      expect(useAuthStore.getState().isInitialized).toBe(true)
    })
  })

  describe('logout', () => {
    it('clears user, accessToken, and isAuthenticated', () => {
      useAuthStore.getState().setAuth(mockUser, 'token')
      expect(useAuthStore.getState().isAuthenticated).toBe(true)

      useAuthStore.getState().logout()

      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
      expect(state.accessToken).toBeNull()
      expect(state.isAuthenticated).toBe(false)
    })
  })

  describe('updateUser', () => {
    it('merges partial user data into existing user', () => {
      useAuthStore.getState().setAuth(mockUser, 'token')

      useAuthStore.getState().updateUser({ name: 'Updated Name', phone: '12345678' })

      const state = useAuthStore.getState()
      expect(state.user?.name).toBe('Updated Name')
      expect(state.user?.phone).toBe('12345678')
      // Other fields unchanged
      expect(state.user?.email).toBe(mockUser.email)
      expect(state.user?.role).toBe(mockUser.role)
    })

    it('does nothing when no user is set', () => {
      useAuthStore.getState().updateUser({ name: 'Should not work' })

      expect(useAuthStore.getState().user).toBeNull()
    })
  })

  describe('setInitialized', () => {
    it('sets isInitialized to true', () => {
      expect(useAuthStore.getState().isInitialized).toBe(false)

      useAuthStore.getState().setInitialized()

      expect(useAuthStore.getState().isInitialized).toBe(true)
    })
  })
})
