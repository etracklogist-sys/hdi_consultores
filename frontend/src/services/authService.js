const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// ─── Employee Auth (DNI) ─────────────────────────────────────

export const authService = {
  loginDNI: async (dni, empresaId) => {
    const response = await fetch(`${API_URL}/auth/dni-access`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dni: dni.trim(),
        empresa_id: parseInt(empresaId, 10)
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'DNI o Código de Empresa incorrecto');
    }

    const data = await response.json();
    const session = { token: data.access_token, empleado: data.empleado };
    localStorage.setItem('employee_session', JSON.stringify(session));
    return session;
  },

  logout: () => {
    localStorage.removeItem('employee_session');
  },

  getCurrentUser: () => {
    const data = localStorage.getItem('employee_session');
    return data ? JSON.parse(data) : null;
  },

  getEmployeeToken: () => {
    const session = authService.getCurrentUser();
    return session?.token || null;
  },
};

// ─── Admin Auth (Email + Password) ───────────────────────────

export const adminAuthService = {
  login: async (email, password) => {
    const response = await fetch(`${API_URL}/auth/admin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), password })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Credenciales incorrectas');
    }

    const data = await response.json();
    const session = {
      token: data.access_token,
      user: data.user,
    };
    localStorage.setItem('admin_session', JSON.stringify(session));
    return session;
  },

  logout: () => {
    localStorage.removeItem('admin_session');
  },

  getSession: () => {
    const data = localStorage.getItem('admin_session');
    return data ? JSON.parse(data) : null;
  },

  getToken: () => {
    const session = adminAuthService.getSession();
    return session?.token || null;
  },

  isAuthenticated: () => {
    const session = adminAuthService.getSession();
    if (!session?.token) return false;
    // Verificar expiración del JWT (sin librería: decodificar payload)
    try {
      const payload = JSON.parse(atob(session.token.split('.')[1]));
      return payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  },
};

// ─── Helper: Authorization header para fetch ─────────────────

export function getAdminAuthHeaders() {
  const token = adminAuthService.getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function getEmployeeAuthHeaders() {
  const token = authService.getEmployeeToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
