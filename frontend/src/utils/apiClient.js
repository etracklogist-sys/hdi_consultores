export const getAuthToken = () => {
    // 1. Sesión admin (nuevo formato JWT)
    const adminSession = localStorage.getItem("admin_session");
    if (adminSession) {
      try {
        const parsed = JSON.parse(adminSession);
        if (parsed.token) return parsed.token;
      } catch (e) {
        console.warn("Invalid admin_session JSON");
      }
    }

    // 2. Token legado (clave directa "token")
    const legacyToken = localStorage.getItem("token");
    if (legacyToken) return legacyToken;
  
    // 3. Sesión empleado
    const employeeSession = localStorage.getItem("employee_session");
    if (employeeSession) {
      try {
        const parsed = JSON.parse(employeeSession);
        return parsed.token || null;
      } catch (e) {
        console.warn("Invalid employee_session JSON");
        return null;
      }
    }
  
    return null;
  };
  
export const authFetch = async (url, options = {}) => {
    const token = getAuthToken();
    const isFormData = options.body instanceof FormData;
  
    const headers = { ...options.headers };
  
    // Only set default Content-Type if it's not a FormData payload
    // fetch will automatically inject multipart/form-data boundary if body is FormData
    if (!isFormData && !headers["Content-Type"] && !headers["content-type"]) {
      headers["Content-Type"] = "application/json";
    }
  
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  
    const response = await fetch(url, {
      ...options,
      headers
    });
  
    if (response.status === 401) {
      console.warn("Unauthorized - possible expired session");
      // Depending on strictness, we could redirect, but throwing is enough to prevent cascades
    }
  
    return response;
};
