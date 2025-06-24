# U+ Assistant

LG유플러스 "당신의 U+" 앱 마케터들을 위한 AI 인사이트 파트너

## 환경 설정

### 개발 환경
```bash
# 개발 서버 실행 (개발용 Supabase 프로젝트 사용)
npm run dev

# 개발용 빌드
npm run build:dev
```

### 프로덕션 환경
```bash
# 프로덕션 모드로 개발 서버 실행
npm run dev:prod

# 프로덕션 빌드
npm run build
```

## Supabase 프로젝트 설정

### 개발용 프로젝트 설정
1. [Supabase Dashboard](https://supabase.com/dashboard)에서 새 프로젝트 생성
2. 프로젝트명: `uplus-assistant-dev`
3. `.env.development` 파일에 새 프로젝트 정보 입력:
   ```
   VITE_SUPABASE_URL=https://your-dev-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-dev-anon-key
   ```

### 프로덕션용 프로젝트 설정
1. `.env.production` 파일에 기존 프로덕션 프로젝트 정보 입력
2. `.env` 파일은 현재 작업 중인 환경에 맞게 설정

## 데이터베이스 마이그레이션

### 개발 환경 초기 설정
새로운 개발용 Supabase 프로젝트에 다음 마이그레이션들을 순서대로 실행:

1. `20250618102305_polished_sunset.sql` - 프롬프트 및 지식 기반 테이블
2. `20250618102312_jolly_rice.sql` - 초기 데이터 삽입
3. `20250623075309_light_truth.sql` - 채팅 세션 및 메시지 테이블
4. `20250624072533_falling_gate.sql` - 사용자 프로필 테이블

### 환경별 데이터 관리
- **개발**: 테스트 데이터, 실험적 기능
- **프로덕션**: 실제 사용자 데이터

## 브랜치 전략

- `main`: 프로덕션 배포용
- `develop`: 개발 브랜치 (개발용 Supabase 사용)
- `feature/*`: 기능 개발 브랜치

## 환경 변수

### 필수 환경 변수
- `VITE_CLAUDE_API_KEY`: Claude API 키
- `VITE_SUPABASE_URL`: Supabase 프로젝트 URL
- `VITE_SUPABASE_ANON_KEY`: Supabase 익명 키

### 환경별 파일
- `.env.development`: 개발 환경 설정
- `.env.production`: 프로덕션 환경 설정
- `.env`: 현재 작업 환경 설정 (개발 시에는 .env.development 내용 복사)