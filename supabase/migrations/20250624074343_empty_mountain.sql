/*
  # 프롬프트 및 지식 기반 테이블 생성

  1. New Tables
    - `prompts_and_knowledge_base`
      - `id` (uuid, primary key)
      - `name` (text, unique, not null)
      - `content` (text, not null)
      - `type` (text, not null) - 'main_prompt' 또는 'knowledge_base'
      - `order_index` (integer, default 0)
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

  2. Security
    - Enable RLS on `prompts_and_knowledge_base` table
    - Add policy for service role to read prompts

  3. Indexes
    - Index on type for efficient filtering
    - Index on order_index for sorting
    - Unique constraint on name
*/

-- 프롬프트 및 지식 기반 테이블 생성
CREATE TABLE IF NOT EXISTS prompts_and_knowledge_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  content text NOT NULL,
  type text NOT NULL CHECK (type IN ('main_prompt', 'knowledge_base')),
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS 활성화
ALTER TABLE prompts_and_knowledge_base ENABLE ROW LEVEL SECURITY;

-- 서비스 역할이 프롬프트를 읽을 수 있도록 정책 생성
CREATE POLICY "Service role can read prompts"
  ON prompts_and_knowledge_base
  FOR SELECT
  TO service_role
  USING (true);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_prompts_type ON prompts_and_knowledge_base(type);
CREATE INDEX IF NOT EXISTS idx_prompts_order ON prompts_and_knowledge_base(order_index);

-- updated_at 트리거를 위한 함수 생성 (존재하지 않는 경우에만)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- updated_at 트리거 생성
DROP TRIGGER IF EXISTS update_prompts_updated_at ON prompts_and_knowledge_base;
CREATE TRIGGER update_prompts_updated_at
  BEFORE UPDATE ON prompts_and_knowledge_base
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();