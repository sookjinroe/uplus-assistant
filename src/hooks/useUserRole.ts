import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../utils/supabase';

export const useUserRole = (user: User | null) => {
  const [role, setRole] = useState<'admin' | 'user' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user) {
        setRole(null);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('user_id', user.id);

        if (error) {
          console.error('Error fetching user role:', error);
          setRole('user'); // 기본값으로 user 설정
        } else if (!data || data.length === 0) {
          // No user profile found, set default role
          setRole('user');
        } else {
          setRole(data[0]?.role || 'user');
        }
      } catch (error) {
        console.error('Error in fetchUserRole:', error);
        setRole('user');
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();
  }, [user]);

  return { role, loading };
};