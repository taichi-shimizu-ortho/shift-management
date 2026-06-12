import { create } from 'zustand';
import { Profile } from '../types';
import { supabase } from '../lib/supabaseClient';

interface AuthState {
  user: Profile | null;
  isLoading: boolean;
  isAdmin: boolean;
  setUser: (user: Profile | null) => void;
  logout: () => Promise<void>;
  initializeAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAdmin: false,

  setUser: (user) => {
    set({
      user,
      isAdmin: user?.role === 'admin' ?? false,
    });
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ user: null, isAdmin: false });
  },

  initializeAuth: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (profile) {
          set({
            user: profile,
            isAdmin: profile.role === 'admin',
            isLoading: false,
          });
        }
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      set({ isLoading: false });
    }
  },
}));
