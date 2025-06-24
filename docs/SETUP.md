# 개발 환경 설정 가이드

## 1. 개발용 Supabase 프로젝트 생성

### 단계별 설정

1. **Supabase 대시보드 접속**
   - [https://supabase.com/dashboard](https://supabase.com/dashboard) 접속
   - 로그인 후 "New Project" 클릭

2. **프로젝트 생성**
   ```
   Project Name: uplus-assistant-dev
   Organization: 본인 조직 선택
   Database Password: 안전한 비밀번호 설정
   Region: Northeast Asia (Seoul) - ap-northeast-2
   ```

3. **프로젝트 정보 확인**
   - 프로젝트 생성 완료 후 Settings > API 메뉴 이동
   - Project URL과 anon public key 복사

4. **환경 변수 설정**
   ```bash
   # .env.development 파일 수정
   VITE_SUPABASE_URL=https://your-dev-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-dev-anon-key
   ```

5. **현재 작업 환경 설정**
   ```bash
   # 개발 환경으로 설정
   cp .env.development .env
   ```

## 2. 데이터베이스 마이그레이션

### SQL Editor에서 마이그레이션 실행

Supabase 대시보드의 SQL Editor에서 다음 파일들을 순서대로 실행:

1. **프롬프트 및 지식 기반 테이블**
   - `supabase/migrations/20250618102305_polished_sunset.sql`

2. **초기 데이터 삽입**
   - `supabase/migrations/20250618102312_jolly_rice.sql`

3. **채팅 세션 및 메시지 테이블**
   - `supabase/migrations/20250623075309_light_truth.sql`

4. **사용자 프로필 테이블**
   - `supabase/migrations/20250624072533_falling_gate.sql`

### 마이그레이션 확인

```sql
-- 테이블 생성 확인
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';

-- 데이터 확인
SELECT * FROM prompts_and_knowledge_base LIMIT 5;
```

## 3. Edge Functions 배포

### 개발용 Edge Functions 설정

1. **claude-proxy 함수**
   - `supabase/functions/claude-proxy/index.ts` 내용을 복사
   - Supabase 대시보드 > Edge Functions에서 새 함수 생성
   - 함수명: `claude-proxy`

2. **get-system-prompt 함수**
   - `supabase/functions/get-system-prompt/index.ts` 내용을 복사
   - 함수명: `get-system-prompt`

## 4. 개발 서버 실행

```bash
# 개발 환경으로 서버 실행
npm run dev

# 프로덕션 환경으로 서버 실행 (테스트용)
npm run dev:prod
```

## 5. 테스트 계정 생성

개발 환경에서 테스트용 계정 생성:

```
이메일: dev-test@example.com
비밀번호: test123456
```

## 6. 환경 전환

### 개발 → 프로덕션
```bash
cp .env.production .env
npm run dev:prod
```

### 프로덕션 → 개발
```bash
cp .env.development .env
npm run dev
```

## 7. 문제 해결

### 일반적인 문제들

1. **환경 변수 인식 안됨**
   - 서버 재시작: `Ctrl+C` 후 `npm run dev`
   - 브라우저 캐시 클리어

2. **Supabase 연결 오류**
   - URL과 키 재확인
   - 프로젝트 상태 확인 (일시 중지되지 않았는지)

3. **마이그레이션 오류**
   - SQL Editor에서 오류 메시지 확인
   - 테이블 존재 여부 확인

### 로그 확인

```bash
# 개발 서버 로그
npm run dev

# 브라우저 개발자 도구 콘솔 확인
```