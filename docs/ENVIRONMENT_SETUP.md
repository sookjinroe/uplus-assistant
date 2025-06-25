# 환경 설정 가이드

## 1. Supabase 프로젝트 생성

### 개발용 프로젝트 생성
1. [Supabase Dashboard](https://supabase.com/dashboard) 접속
2. "New Project" 클릭
3. 프로젝트 설정:
   ```
   Project Name: uplus-assistant-dev
   Organization: 본인 조직
   Database Password: 안전한 비밀번호
   Region: Northeast Asia (Seoul)
   ```

### 환경 변수 설정
1. 개발용 프로젝트 생성 후 Settings > API에서 정보 복사
2. `.env.development` 파일에 새 프로젝트 정보 입력
3. 현재 작업 환경에 맞게 `.env` 파일 설정:
   ```bash
   # 개발 환경으로 작업
   cp .env.development .env
   
   # 프로덕션 환경으로 작업
   cp .env.production .env
   ```

## 2. 데이터베이스 마이그레이션

### 개발 환경 초기 설정
새 개발용 Supabase 프로젝트에서 SQL Editor로 마이그레이션 실행:

```sql
-- 통합 마이그레이션 파일 실행
-- supabase/migrations/20250624080021_quiet_sunset.sql
```

### Edge Functions 배포
개발용 프로젝트에도 Edge Functions 배포:
1. `claude-proxy` 함수
2. `get-system-prompt` 함수

## 3. 개발 워크플로우

### 환경별 명령어
```bash
# 개발 환경
npm run dev              # 개발용 Supabase 사용
npm run build:dev        # 개발용 빌드

# 프로덕션 환경
npm run dev:prod         # 프로덕션 Supabase 사용
npm run build            # 프로덕션 빌드
```

### Git 브랜치 전략
```bash
# 새 기능 개발
git checkout -b develop
git checkout -b feature/new-feature

# 개발 완료 후
git checkout develop
git merge feature/new-feature
git push origin develop

# 릴리즈 준비
git checkout main
git merge develop
git tag v2.0.0
git push origin main --tags
```

## 4. Netlify 배포 설정

### 환경별 사이트 설정
1. **프로덕션 사이트** (기존):
   - Branch: `main`
   - Environment: `.env.production`
   
2. **개발 사이트** (새로 생성):
   - Branch: `develop`
   - Environment: `.env.development`
   - Site name: `uplus-assistant-dev`

### 환경 변수 설정
각 Netlify 사이트에서 Site settings > Environment variables에 해당 환경의 변수들 설정

## 5. 데이터 마이그레이션 전략

### 개발 → 프로덕션 마이그레이션
1. 개발 환경에서 새 마이그레이션 파일 작성
2. 개발 환경에서 테스트
3. 프로덕션 환경에 적용

### 주의사항
- 항상 백업 후 마이그레이션 실행
- 롤백 계획 수립
- 단계별 적용 (큰 변경사항은 여러 단계로 분할)

## 6. 문제 해결

### 환경 변수 확인
```bash
# 현재 환경 확인
echo $NODE_ENV

# Vite 모드 확인 (개발자 도구 콘솔)
console.log(import.meta.env.MODE)
```

### 데이터베이스 연결 확인
```sql
-- 현재 연결된 프로젝트 확인
SELECT current_database();
```