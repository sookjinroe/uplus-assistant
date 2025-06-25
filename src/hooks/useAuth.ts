import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../utils/supabase';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'user' | null>(null);
  const [loading, setLoading] = useState(true);

  // 사용자 역할을 가져오는 함수
  const fetchUserRole = async (userId: string): Promise<'admin' | 'user'> => {
    try {
      console.log('Fetching user role for:', userId);
      
      const { data, error } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Error fetching user role:', error);
        
        // 프로필이 없는 경우 기본 프로필 생성 시도
        if (error.code === 'PGRST116') {
          console.log('No profile found, creating default profile...');
          
          const { error: insertError } = await supabase
            .from('user_profiles')
            .insert({
              user_id: userId,
              role: 'user'
            });
          
          if (insertError) {
            console.error('Error creating user profile:', insertError);
          } else {
            console.log('Default profile created successfully');
          }
        }
        
        return 'user'; // 기본값
      }

      console.log('User role fetched:', data?.role);
      return data?.role || 'user';
    } catch (error) {
      console.error('Error in fetchUserRole:', error);
      return 'user';
    }
  };

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        console.log('Getting initial session...');
        
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
        } else {
          console.log('Initial session:', session?.user?.email || 'No user');
          
          setSession(session);
          setUser(session?.user ?? null);
          
          // 사용자가 있으면 역할 가져오기
          if (session?.user) {
            try {
              const role = await fetchUserRole(session.user.id);
              setUserRole(role);
            } catch (error) {
              console.error('Error fetching user role in initial session:', error);
              setUserRole('user'); // 기본값 설정
            }
          } else {
            setUserRole(null);
          }
        }
      } catch (error) {
        console.error('Error in getInitialSession:', error);
      } finally {
        console.log('Setting loading to false');
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email || 'No user');
        
        setSession(session);
        setUser(session?.user ?? null);
        
        // 사용자가 있으면 역할 가져오기
        if (session?.user) {
          try {
            const role = await fetchUserRole(session.user.id);
            setUserRole(role);
          } catch (error) {
            console.error('Error fetching user role in auth state change:', error);
            setUserRole('user'); // 기본값 설정
          }
        } else {
          setUserRole(null);
        }
        
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Error signing out:', error);
        throw error;
      }
      // 로그아웃 시 역할 초기화
      setUserRole(null);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  };

  return {
    user,
    session,
    userRole,
    loading,
    signOut,
  };
};