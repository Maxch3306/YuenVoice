import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../helpers/setup'
import LoginPage from '@/pages/auth/LoginPage'

// Mock the auth service module
vi.mock('@/services/auth', () => ({
  login: vi.fn(),
}))

// Mock react-router-dom's useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the email input', () => {
    renderWithProviders(<LoginPage />)
    const emailInput = screen.getByPlaceholderText('name@example.com')
    expect(emailInput).toBeInTheDocument()
    expect(emailInput).toHaveAttribute('type', 'email')
  })

  it('renders the password input', () => {
    renderWithProviders(<LoginPage />)
    const passwordInput = screen.getByLabelText('密碼 (Password)')
    expect(passwordInput).toBeInTheDocument()
  })

  it('renders the login submit button', () => {
    renderWithProviders(<LoginPage />)
    const button = screen.getByRole('button', { name: '登入' })
    expect(button).toBeInTheDocument()
    expect(button).toBeEnabled()
  })

  it('shows validation error when email is empty on submit', async () => {
    const user = userEvent.setup()
    renderWithProviders(<LoginPage />)

    // Fill only password, leave email empty
    const passwordInput = screen.getByLabelText('密碼 (Password)')
    await user.type(passwordInput, 'password123')

    const button = screen.getByRole('button', { name: '登入' })
    await user.click(button)

    expect(screen.getByText('請輸入電郵地址')).toBeInTheDocument()
  })

  it('shows validation error when password is empty on submit', async () => {
    const user = userEvent.setup()
    renderWithProviders(<LoginPage />)

    // Fill only email, leave password empty
    const emailInput = screen.getByPlaceholderText('name@example.com')
    await user.type(emailInput, 'test@example.com')

    const button = screen.getByRole('button', { name: '登入' })
    await user.click(button)

    expect(screen.getByText('請輸入密碼')).toBeInTheDocument()
  })

  it('shows validation error for invalid email format', async () => {
    const user = userEvent.setup()
    renderWithProviders(<LoginPage />)

    const emailInput = screen.getByPlaceholderText('name@example.com')
    await user.type(emailInput, 'not-an-email')

    const passwordInput = screen.getByLabelText('密碼 (Password)')
    await user.type(passwordInput, 'password123')

    const button = screen.getByRole('button', { name: '登入' })
    await user.click(button)

    expect(screen.getByText('電郵格式不正確')).toBeInTheDocument()
  })

  it('renders link to register page', () => {
    renderWithProviders(<LoginPage />)
    const link = screen.getByText('立即註冊')
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/register')
  })

  it('renders link to forgot password page', () => {
    renderWithProviders(<LoginPage />)
    const link = screen.getByText('忘記密碼？')
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/forgot-password')
  })

  it('has a password visibility toggle button', () => {
    renderWithProviders(<LoginPage />)
    const toggleBtn = screen.getByLabelText(/顯示密碼|隱藏密碼/)
    expect(toggleBtn).toBeInTheDocument()
  })
})
