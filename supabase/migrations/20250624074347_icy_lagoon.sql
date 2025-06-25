/*
  # 사용자 테이블 생성 (auth.users 참조용)

  1. New Tables
    - `users` (auth.users와 동일한 구조로 참조용 테이블)
      - `id` (uuid, primary key)
      - `email` (text)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `users` table
    - Add policies for authenticated users

  Note: 이 테이블은 실제로는 Supabase의 auth.users를 사용하지만,
  외래키 참조를 위해 public 스키마에 참조용 테이블을 생성합니다.
*/

-- 사용자 참조 테이블 생성 (auth.users 대신 사용)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  created_at timestamptz DEFAULT now()
);

-- RLS 활성화
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 인증된 사용자가 자신의 정보만 볼 수 있도록 정책 생성
CREATE POLICY "Users can view own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- 사용자가 자신의 정보를 삽입할 수 있도록 정책 생성
CREATE POLICY "Users can insert own data"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);