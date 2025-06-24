/*
  # 새로운 기능을 위한 마이그레이션 예시

  1. 새 테이블 또는 컬럼 추가
  2. 기존 데이터 보존
  3. 하위 호환성 유지
*/

-- 예시: 사용자 설정 테이블 추가
CREATE TABLE IF NOT EXISTS user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  theme text DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
  language text DEFAULT 'ko' CHECK (language IN ('ko', 'en')),
  notifications_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS 활성화
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- 정책 생성
CREATE POLICY "Users can manage own settings"
  ON user_settings
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- 트리거 생성 (updated_at 자동 업데이트)
CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();