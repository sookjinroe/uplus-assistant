/*
  # 플레이그라운드 접근을 위한 RLS 정책 추가

  1. 정책 추가
    - 관리자 사용자가 prompts_and_knowledge_base 테이블을 읽을 수 있도록 정책 추가
    - 관리자 사용자가 prompts_and_knowledge_base 테이블을 수정할 수 있도록 정책 추가

  2. 보안
    - admin 역할을 가진 사용자만 접근 가능
    - 일반 사용자는 접근 불가
*/

-- 관리자가 프롬프트 및 지식 기반을 읽을 수 있는 정책
CREATE POLICY "Admin users can read prompts and knowledge base"
  ON prompts_and_knowledge_base
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.user_id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  );

-- 관리자가 프롬프트 및 지식 기반을 수정할 수 있는 정책
CREATE POLICY "Admin users can update prompts and knowledge base"
  ON prompts_and_knowledge_base
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.user_id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.user_id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  );

-- 관리자가 프롬프트 및 지식 기반을 삽입할 수 있는 정책
CREATE POLICY "Admin users can insert prompts and knowledge base"
  ON prompts_and_knowledge_base
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.user_id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  );

-- 관리자가 프롬프트 및 지식 기반을 삭제할 수 있는 정책
CREATE POLICY "Admin users can delete prompts and knowledge base"
  ON prompts_and_knowledge_base
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.user_id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  );