export interface UserProfile {
  id: string;
  user_id: string;
  role: 'admin' | 'user';
  created_at: string;
  updated_at: string;
}

export interface AuthUser {
  id: string;
  email: string;
  role?: 'admin' | 'user';
}