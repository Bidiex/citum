// supabase.js — Cliente Supabase (Simulado)

// Por ahora, se omite Supabase como se solicitó para realizar pruebas en local.
export const supabase = {
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
  },
  from: () => ({
    select: () => ({
      eq: () => Promise.resolve({ data: [], error: null })
    })
  })
};
