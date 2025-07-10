/*
  # 플레이그라운드 인덱스 문제 해결

  1. 문제 해결
    - `idx_chat_sessions_playground_data` 인덱스 제거
    - 긴 텍스트 컬럼에 대한 B-tree 인덱스로 인한 크기 제한 오류 해결

  2. 대안 인덱스
    - `playground_main_prompt_content IS NOT NULL` 조건 검색을 위한 부분 인덱스 생성
    - 전체 텍스트 내용이 아닌 존재 여부만 인덱싱

  3. 성능 최적화
    - 불필요한 인덱스 제거로 INSERT/UPDATE 성능 향상
*/

-- 문제가 되는 인덱스 제거
DROP INDEX IF EXISTS idx_chat_sessions_playground_data;

-- 플레이그라운드 데이터 존재 여부만 확인하는 부분 인덱스 생성
-- 전체 텍스트 내용이 아닌 NULL/NOT NULL 상태만 인덱싱
CREATE INDEX IF NOT EXISTS idx_chat_sessions_has_playground_data 
ON chat_sessions(id) 
WHERE playground_main_prompt_content IS NOT NULL;

-- 성능 최적화를 위한 추가 인덱스
-- 사용자별 세션 조회 성능 향상
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_updated 
ON chat_sessions(user_id, updated_at DESC);