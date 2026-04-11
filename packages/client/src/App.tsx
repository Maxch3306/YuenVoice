import { useEffect } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth-store';
import axios from 'axios';

// Layouts
import AuthLayout from '@/components/layouts/AuthLayout';
import MainLayout from '@/components/layouts/MainLayout';
import AdminLayout from '@/components/layouts/AdminLayout';

// Auth pages
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage';
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage';

// Report pages
import ReportListPage from '@/pages/reports/ReportListPage';
import CreateReportPage from '@/pages/reports/CreateReportPage';
import ReportDetailPage from '@/pages/reports/ReportDetailPage';

// Discussion pages
import BoardListPage from '@/pages/discussion/BoardListPage';
import PostListPage from '@/pages/discussion/PostListPage';
import CreatePostPage from '@/pages/discussion/CreatePostPage';
import PostDetailPage from '@/pages/discussion/PostDetailPage';

// OC pages
import DocumentListPage from '@/pages/oc/DocumentListPage';
import DocumentViewPage from '@/pages/oc/DocumentViewPage';

// Notification pages
import NotificationCenterPage from '@/pages/notifications/NotificationCenterPage';

// Admin pages
import DashboardPage from '@/pages/admin/DashboardPage';
import UserManagementPage from '@/pages/admin/UserManagementPage';
import FlatManagementPage from '@/pages/admin/FlatManagementPage';
import AuditLogPage from '@/pages/admin/AuditLogPage';

/** Redirects unauthenticated users to /login */
function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isInitialized = useAuthStore((s) => s.isInitialized);

  if (!isInitialized) {
    return (
      <div className="flex h-svh items-center justify-center">
        <p className="text-muted-foreground">載入中...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

/** Redirects non-admin users to / */
function AdminRoute() {
  const user = useAuthStore((s) => s.user);
  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}

export default function App() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const setInitialized = useAuthStore((s) => s.setInitialized);
  const isInitialized = useAuthStore((s) => s.isInitialized);

  useEffect(() => {
    if (isInitialized) return;

    // Try to restore session via refresh token cookie
    axios
      .post(
        `${import.meta.env.VITE_API_URL || ''}/api/auth/refresh`,
        {},
        { withCredentials: true },
      )
      .then((res) => {
        setAuth(res.data.user, res.data.accessToken);
      })
      .catch(() => {
        // No valid session — user needs to login
        setInitialized();
      });
  }, [isInitialized, setAuth, setInitialized]);

  return (
    <Routes>
      {/* ── Public auth routes ─────────────────────────────── */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>

      {/* ── Protected main routes ──────────────────────────── */}
      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route path="/reports" element={<ReportListPage />} />
          <Route path="/reports/new" element={<CreateReportPage />} />
          <Route path="/reports/:id" element={<ReportDetailPage />} />

          <Route path="/discussion" element={<BoardListPage />} />
          <Route path="/discussion/:boardId" element={<PostListPage />} />
          <Route path="/discussion/:boardId/new" element={<CreatePostPage />} />
          <Route path="/discussion/post/:postId" element={<PostDetailPage />} />

          <Route path="/oc" element={<DocumentListPage />} />
          <Route path="/oc/:id" element={<DocumentViewPage />} />

          <Route path="/notifications" element={<NotificationCenterPage />} />
        </Route>

        {/* ── Protected admin routes ─────────────────────────── */}
        <Route element={<AdminRoute />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<DashboardPage />} />
            <Route path="/admin/users" element={<UserManagementPage />} />
            <Route path="/admin/flats" element={<FlatManagementPage />} />
            <Route path="/admin/audit-logs" element={<AuditLogPage />} />
          </Route>
        </Route>
      </Route>

      {/* ── Root redirect ──────────────────────────────────── */}
      <Route path="/" element={<Navigate to="/reports" replace />} />

      {/* ── Catch-all → redirect to home ─────────────────── */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
