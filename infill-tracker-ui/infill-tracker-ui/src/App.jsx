import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import NavBar from './components/NavBar';
import ProtectedRoute from './components/ProtectedRoute';
import HomePage from './pages/HomePage';
import SignInPage from './pages/SignInPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import DashboardPage from './pages/DashboardPage';
import ProjectsPage from './pages/ProjectsPage';
import TaskListPage from './pages/TaskListPage';
import TaskDetailPage from './pages/TaskDetailPage';
import NextAvailableTasksPage from './pages/NextAvailableTasksPage';
import NotificationsPage from './pages/NotificationsPage';
import AdminPage from './pages/AdminPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <NavBar />
        <Routes>
          {/* ── Public routes ─────────────────────────────────────── */}
          <Route path="/"         element={<HomePage />}   />
          <Route path="/signin"   element={<SignInPage />} />

          {/* ── Authenticated routes ───────────────────────────────── */}
          <Route path="/change-password" element={
            <ProtectedRoute><ChangePasswordPage /></ProtectedRoute>
          } />
          <Route path="/dashboard" element={
            <ProtectedRoute><DashboardPage /></ProtectedRoute>
          } />
          <Route path="/projects" element={
            <ProtectedRoute><ProjectsPage /></ProtectedRoute>
          } />
          <Route path="/projects/:projectId/tasks" element={
            <ProtectedRoute><TaskListPage /></ProtectedRoute>
          } />
          <Route path="/projects/:projectId/tasks/:taskId" element={
            <ProtectedRoute><TaskDetailPage /></ProtectedRoute>
          } />
          <Route path="/projects/:projectId/next-tasks" element={
            <ProtectedRoute><NextAvailableTasksPage /></ProtectedRoute>
          } />
          <Route path="/notifications" element={
            <ProtectedRoute><NotificationsPage /></ProtectedRoute>
          } />

          {/* ── Administrator only ─────────────────────────────────── */}
          <Route path="/admin" element={
            <ProtectedRoute role="Administrator"><AdminPage /></ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
