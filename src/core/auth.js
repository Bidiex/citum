// auth.js — Control de Sesión y Autenticación (Supabase real)
import { supabase } from './supabase.js';

export const auth = {
  /**
   * Login con email/password
   */
  login: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { user: null, error };
    return { user: data.user, error: null };
  },

  /**
   * Login con Google Auth
   */
  loginWithGoogle: async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/panel.html'
      }
    });
    return { data, error };
  },

  /**
   * Registro de nuevo usuario
   */
  register: async (email, password, fullName) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } }
    });
    if (error) return { user: null, error };
    return { user: data.user, error: null };
  },

  /**
   * Logout
   */
  logout: async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  /**
   * Obtener sesión activa
   */
  getSession: async () => {
    const { data, error } = await supabase.auth.getSession();
    return { session: data?.session, error };
  },

  /**
   * Obtener usuario actual (desde la sesión cacheada)
   */
  getCurrentUser: async () => {
    const { data } = await supabase.auth.getUser();
    return data?.user || null;
  },

  /**
   * Escuchar cambios de sesión
   */
  onAuthStateChange: (callback) => {
    return supabase.auth.onAuthStateChange((_event, session) => {
      callback(session?.user || null);
    });
  }
};

