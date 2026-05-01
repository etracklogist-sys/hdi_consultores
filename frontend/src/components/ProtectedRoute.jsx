import React from 'react';
import { Navigate } from 'react-router-dom';
import { adminAuthService } from '../services/authService';

/**
 * AdminRoute — protege rutas que requieren rol admin.
 * Si no hay sesión válida, redirige a "/" (Login).
 */
export default function AdminRoute({ children }) {
  if (!adminAuthService.isAuthenticated()) {
    return <Navigate to="/admin-login" replace />;
  }
  return children;
}
