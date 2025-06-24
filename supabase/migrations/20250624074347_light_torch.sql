/*
  # 채팅 세션 테이블 생성

  1. New Tables
    - `chat_sessions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `title` (text, not null)
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

  2. Security
    - Enable RLS on `chat_sessions` table
    - Add policies for authenticated users to manage their own sessions

  3. Indexes
    - Index on user_id for efficient user session queries
    - Index on updated_at for sorting by recent activity
*/

-- 채팅 세션 테이블 생성
CREATE TABLE IF NOT EXISTS chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS 활성화
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

-- 사용자가 자신의 세션만 조회할 수 있도록 정책 생성
CREATE POLICY "Users can view own sessions"
  ON chat_sessions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 사용자가 자신의 세션을 생성할 수 있도록 정책 생성
CREATE POLICY "Users can insert own sessions"
  ON chat_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 사용자가 자신의 세션을 수정할 수 있도록 정책 생성
CREATE POLICY "Users can update own sessions"
  ON chat_sessions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 사용자가 자신의 세션을 삭제할 수 있도록 정책 생성
CREATE POLICY "Users can delete own sessions"
  ON chat_sessions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at ON chat_sessions(updated_at DESC);

-- updated_at 트리거 생성
DROP TRIGGER IF EXISTS update_chat_sessions_updated_at ON chat_sessions;
CREATE TRIGGER update_chat_sessions_updated_at
  BEFORE UPDATE ON chat_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();