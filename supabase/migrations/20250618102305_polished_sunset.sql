/*
  # 프롬프트 및 지식 기반 관리 테이블 생성

  1. 새 테이블
    - `prompts_and_knowledge_base`
      - `id` (uuid, primary key)
      - `name` (text, unique) - 프롬프트/지식 기반 항목의 고유 이름
      - `content` (text) - 실제 내용
      - `type` (text) - 'main_prompt' 또는 'knowledge_base'
      - `order_index` (integer) - 지식 기반 항목들의 정렬 순서
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. 보안
    - RLS 활성화
    - 서비스 역할에 대한 읽기 권한 정책 추가
*/

CREATE TABLE IF NOT EXISTS prompts_and_knowledge_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  content text NOT NULL,
  type text NOT NULL CHECK (type IN ('main_prompt', 'knowledge_base')),
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE prompts_and_knowledge_base ENABLE ROW LEVEL SECURITY;

-- 서비스 역할에 대한 읽기 권한 정책
CREATE POLICY "Service role can read prompts"
  ON prompts_and_knowledge_base
  FOR SELECT
  TO service_role
  USING (true);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_prompts_type ON prompts_and_knowledge_base(type);
CREATE INDEX IF NOT EXISTS idx_prompts_order ON prompts_and_knowledge_base(order_index);