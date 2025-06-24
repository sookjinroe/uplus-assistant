/*
  # User Profiles 테이블 생성 및 Admin 권한 설정

  1. 새 테이블
    - `user_profiles`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `role` (text) - 'admin' 또는 'user'
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. 보안
    - RLS 활성화
    - 사용자는 자신의 프로필만 조회 가능
    - 관리자는 모든 프로필 조회 가능

  3. 초기 데이터
    - admin@example.com 계정에 admin 역할 부여
*/

-- User Profiles 테이블 생성
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS 활성화
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 정책 생성
-- 사용자는 자신의 프로필만 조회 가능
CREATE POLICY "Users can view own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 사용자는 자신의 프로필만 업데이트 가능 (role 제외)
CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND role = OLD.role);

-- 새 사용자 가입 시 자동으로 프로필 생성을 위한 정책
CREATE POLICY "Users can insert own profile"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

-- updated_at 트리거 생성
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 새 사용자 가입 시 자동으로 user_profiles 레코드 생성하는 함수
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, role)
  VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- auth.users 테이블에 트리거 생성
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- admin@example.com 계정에 admin 역할 부여
-- 이 부분은 실제 admin@example.com 계정이 생성된 후에 실행되어야 합니다
DO $$
DECLARE
  admin_user_id uuid;
BEGIN
  -- admin@example.com 사용자 ID 찾기
  SELECT id INTO admin_user_id 
  FROM auth.users 
  WHERE email = 'admin@example.com';
  
  -- 사용자가 존재하면 admin 역할 부여
  IF admin_user_id IS NOT NULL THEN
    INSERT INTO user_profiles (user_id, role)
    VALUES (admin_user_id, 'admin')
    ON CONFLICT (user_id) 
    DO UPDATE SET role = 'admin', updated_at = now();
    
    RAISE NOTICE 'Admin role granted to admin@example.com';
  ELSE
    RAISE NOTICE 'admin@example.com user not found. Please create the user first, then run this migration again.';
  END IF;
END $$;