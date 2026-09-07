import { create } from 'zustand';
import type { Profile } from '../types';
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
      isAdmin: user?.role === 'admin',
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
        let { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        // If profile doesn't exist (e.g. first time Google login), create it
        if (!profile) {
          const { data: newProfile } = await supabase
            .from('profiles')
            .insert({
              id: session.user.id,
              full_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Unknown',
              role: 'doctor',
              is_active: true,
            })
            .select()
            .single();
            
          profile = newProfile;
        }

        if (profile) {
          set({
            user: profile,
            isAdmin: profile.role === 'admin',
            isLoading: false,
          });

          // Trigger calendar sync if provider token is present
          if (session.provider_token) {
            import('../services/googleCalendar').then((m) => {
              m.syncGoogleCalendar(session.provider_token);
            });
          }
        } else {
          set({ isLoading: false });
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
