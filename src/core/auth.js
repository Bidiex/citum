// auth.js — Control de Sesión y Autenticación (Simulado)

export const auth = {
  login: async (email, password) => {
    console.log('Login simulado con:', email);
    return { user: { email }, error: null };
  },
  logout: async () => {
    console.log('Cierre de sesión simulado.');
    return { error: null };
  },
  getCurrentUser: () => {
    return { email: 'demo@citum.app', full_name: 'Álvaro de Alba' };
  }
};
