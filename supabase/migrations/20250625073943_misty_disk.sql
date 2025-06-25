/*
  # 배포 이력 관리 테이블 생성

  1. 새 테이블
    - `deployment_history`
      - `id` (uuid, primary key)
      - `deployed_at` (timestamp, 기본값 now())
      - `main_prompt_content` (text) - 배포 시점의 메인 프롬프트 스냅샷
      - `knowledge_base_snapshot` (jsonb) - 배포 시점의 지식 기반 스냅샷
      - `deployed_by_user_id` (uuid, foreign key to auth.users) - 배포한 관리자
      - `deployment_notes` (text, nullable) - 배포 메모

  2. 보안
    - RLS 활성화
    - 관리자만 조회/삽입 가능

  3. 인덱스
    - 배포 시점 기준 정렬을 위한 인덱스
    - 배포한 사용자 기준 조회를 위한 인덱스
*/

-- 배포 이력 테이블 생성
CREATE TABLE IF NOT EXISTS deployment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deployed_at timestamptz DEFAULT now(),
  main_prompt_content text NOT NULL,
  knowledge_base_snapshot jsonb DEFAULT '[]'::jsonb,
  deployed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deployment_notes text,
  created_at timestamptz DEFAULT now()
);

-- RLS 활성화
ALTER TABLE deployment_history ENABLE ROW LEVEL SECURITY;

-- 관리자만 배포 이력을 조회할 수 있는 정책
CREATE POLICY "Admin users can read deployment history"
  ON deployment_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.user_id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  );

-- 관리자만 배포 이력을 삽입할 수 있는 정책
CREATE POLICY "Admin users can insert deployment history"
  ON deployment_history
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.user_id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  );

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_deployment_history_deployed_at ON deployment_history(deployed_at DESC);
CREATE INDEX IF NOT EXISTS idx_deployment_history_deployed_by ON deployment_history(deployed_by_user_id);

-- 초기 배포 스냅샷 생성 (현재 전역 설정을 첫 번째 배포로 기록)
DO $$
DECLARE
  current_main_prompt text;
  current_knowledge_base jsonb;
BEGIN
  -- 현재 메인 프롬프트 가져오기
  SELECT content INTO current_main_prompt
  FROM prompts_and_knowledge_base
  WHERE type = 'main_prompt' AND name = 'main_prompt'
  LIMIT 1;

  -- 현재 지식 기반 가져오기
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'name', name,
        'content', content,
        'order_index', order_index
      ) ORDER BY order_index
    ),
    '[]'::jsonb
  ) INTO current_knowledge_base
  FROM prompts_and_knowledge_base
  WHERE type = 'knowledge_base';

  -- 초기 배포 기록 삽입 (시스템 초기화로 기록)
  IF current_main_prompt IS NOT NULL THEN
    INSERT INTO deployment_history (
      main_prompt_content,
      knowledge_base_snapshot,
      deployed_by_user_id,
      deployment_notes
    ) VALUES (
      current_main_prompt,
      current_knowledge_base,
      NULL, -- 시스템 초기화이므로 사용자 없음
      'System initialization - Initial deployment snapshot'
    );
    
    RAISE NOTICE 'Initial deployment snapshot created successfully';
  ELSE
    RAISE NOTICE 'No main prompt found - skipping initial deployment snapshot';
  END IF;
END $$;