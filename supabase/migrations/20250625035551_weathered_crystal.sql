/*
  # User Profiles 테이블 생성 및 Admin 권한 설정 (충돌 해결)

  1. 새 테이블
    - `user_profiles`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `role` (text) - 'admin' 또는 'user'
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. 보안
    - RLS 활성화
    - 사용자는 자신의 프로필만 조회/수정 가능
    - 역할 변경은 제한

  3. 자동화
    - 새 사용자 가입 시 자동으로 user_profiles 레코드 생성
    - admin@example.com 계정에 admin 역할 자동 부여
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

-- 기존 정책들 삭제 (존재하는 경우)
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;

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
  WITH CHECK (auth.uid() = user_id);

-- 새 사용자 가입 시 자동으로 프로필 생성을 위한 정책
CREATE POLICY "Users can insert own profile"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

-- updated_at 함수가 존재하지 않는 경우 생성
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 기존 트리거 삭제 후 재생성
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
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

-- 기존 트리거 삭제 후 재생성
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
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

-- admin@test.com 계정에도 admin 역할 부여 (추가)
DO $$
DECLARE
  admin_user_id uuid;
BEGIN
  -- admin@test.com 사용자 ID 찾기
  SELECT id INTO admin_user_id 
  FROM auth.users 
  WHERE email = 'admin@test.com';
  
  -- 사용자가 존재하면 admin 역할 부여
  IF admin_user_id IS NOT NULL THEN
    INSERT INTO user_profiles (user_id, role)
    VALUES (admin_user_id, 'admin')
    ON CONFLICT (user_id) 
    DO UPDATE SET role = 'admin', updated_at = now();
    
    RAISE NOTICE 'Admin role granted to admin@test.com';
  ELSE
    RAISE NOTICE 'admin@test.com user not found. Please create the user first, then run this migration again.';
  END IF;
END $$;