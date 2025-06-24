/*
  # 채팅 메시지 테이블 생성

  1. New Tables
    - `chat_messages`
      - `id` (uuid, primary key)
      - `session_id` (uuid, foreign key to chat_sessions)
      - `content` (text, not null)
      - `role` (text, not null) - 'user' 또는 'assistant'
      - `created_at` (timestamptz, default now())

  2. Security
    - Enable RLS on `chat_messages` table
    - Add policies for authenticated users to manage messages in their own sessions

  3. Indexes
    - Index on session_id for efficient session message queries
    - Index on created_at for chronological ordering
*/

-- 채팅 메시지 테이블 생성
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES chat_sessions(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  created_at timestamptz DEFAULT now()
);

-- RLS 활성화
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- 사용자가 자신의 세션 메시지만 조회할 수 있도록 정책 생성
CREATE POLICY "Users can view messages from own sessions"
  ON chat_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_sessions 
      WHERE chat_sessions.id = chat_messages.session_id 
      AND chat_sessions.user_id = auth.uid()
    )
  );

-- 사용자가 자신의 세션에 메시지를 생성할 수 있도록 정책 생성
CREATE POLICY "Users can insert messages to own sessions"
  ON chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_sessions 
      WHERE chat_sessions.id = chat_messages.session_id 
      AND chat_sessions.user_id = auth.uid()
    )
  );

-- 사용자가 자신의 세션 메시지를 수정할 수 있도록 정책 생성
CREATE POLICY "Users can update messages in own sessions"
  ON chat_messages
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_sessions 
      WHERE chat_sessions.id = chat_messages.session_id 
      AND chat_sessions.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_sessions 
      WHERE chat_sessions.id = chat_messages.session_id 
      AND chat_sessions.user_id = auth.uid()
    )
  );

-- 사용자가 자신의 세션 메시지를 삭제할 수 있도록 정책 생성
CREATE POLICY "Users can delete messages from own sessions"
  ON chat_messages
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_sessions 
      WHERE chat_sessions.id = chat_messages.session_id 
      AND chat_sessions.user_id = auth.uid()
    )
  );

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);