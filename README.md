# U+ Assistant

LG유플러스 "당신의 U+" 앱 마케터들을 위한 AI 인사이트 파트너

## 기능

- **AI 채팅**: Claude Sonnet 4를 활용한 마케팅 인사이트 제공
- **세션 관리**: 채팅 기록 저장 및 관리
- **플레이그라운드**: 관리자용 프롬프트 및 지식 기반 테스트 환경
- **전역 프롬프트 관리**: 관리자용 시스템 프롬프트 및 지식 기반 관리
- **사용자 인증**: Supabase Auth를 통한 안전한 로그인

## 기술 스택

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions)
- **AI**: Claude Sonnet 4 API
- **Deployment**: Netlify

## 배포 가이드

### 1. Supabase 프로젝트 설정

1. [Supabase](https://supabase.com)에서 새 프로젝트 생성
2. 프로젝트 URL과 Anon Key 확인
3. 데이터베이스 마이그레이션 실행

### 2. 환경 변수 설정

배포 플랫폼에서 다음 환경 변수를 설정하세요:

```
VITE_CLAUDE_API_KEY=your_claude_api_key
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Edge Functions 배포

Supabase CLI를 사용하여 Edge Functions를 배포하세요:

```bash
# 모든 함수 배포
supabase functions deploy

# 또는 개별 함수 배포
supabase functions deploy claude-proxy
supabase functions deploy update-global-prompt
supabase functions deploy save-deployment-snapshot
supabase functions deploy get-deployment-history
```

### 4. 프론트엔드 배포

#### Netlify 배포

1. GitHub 저장소를 Netlify에 연결
2. 빌드 설정:
   - Build command: `npm run build`
   - Publish directory: `dist`
3. 환경 변수 설정
4. 배포 실행

#### 수동 배포

```bash
# 빌드
npm run build

# dist 폴더를 호스팅 서비스에 업로드
```

## 개발 환경 설정

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env` 파일을 생성하고 필요한 환경 변수를 설정하세요:

```
VITE_CLAUDE_API_KEY=your_claude_api_key
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. 개발 서버 실행

```bash
npm run dev
```

## 관리자 계정 설정

첫 번째로 가입하는 사용자가 자동으로 관리자 권한을 받습니다. 추가 관리자를 설정하려면 데이터베이스에서 `user_profiles` 테이블의 `role` 필드를 `admin`으로 변경하세요.

## 라이선스

이 프로젝트는 LG유플러스의 내부 사용을 위한 것입니다.