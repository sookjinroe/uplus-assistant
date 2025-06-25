/*
  # 개발용 Supabase 프로젝트 완전 마이그레이션
  
  1. 테이블 생성
    - prompts_and_knowledge_base (프롬프트 및 지식 기반)
    - chat_sessions (채팅 세션)
    - chat_messages (채팅 메시지)
    - user_profiles (사용자 프로필)
  
  2. 보안 설정
    - RLS 활성화
    - 정책 생성 (기존 정책 삭제 후 재생성)
  
  3. 초기 데이터
    - 메인 프롬프트 및 지식 기반 데이터 삽입
*/

-- =====================================================
-- 1. 프롬프트 및 지식 기반 테이블 생성
-- =====================================================

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

-- 기존 정책 삭제 후 재생성
DROP POLICY IF EXISTS "Service role can read prompts" ON prompts_and_knowledge_base;
CREATE POLICY "Service role can read prompts"
  ON prompts_and_knowledge_base
  FOR SELECT
  TO service_role
  USING (true);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_prompts_type ON prompts_and_knowledge_base(type);
CREATE INDEX IF NOT EXISTS idx_prompts_order ON prompts_and_knowledge_base(order_index);

-- =====================================================
-- 2. 채팅 세션 테이블 생성
-- =====================================================

CREATE TABLE IF NOT EXISTS chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

-- 기존 정책들 삭제 후 재생성
DROP POLICY IF EXISTS "Users can view own sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Users can insert own sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Users can update own sessions" ON chat_sessions;
DROP POLICY IF EXISTS "Users can delete own sessions" ON chat_sessions;

CREATE POLICY "Users can view own sessions"
  ON chat_sessions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
  ON chat_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON chat_sessions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
  ON chat_sessions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at ON chat_sessions(updated_at DESC);

-- =====================================================
-- 3. 채팅 메시지 테이블 생성
-- =====================================================

CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES chat_sessions(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- 기존 정책들 삭제 후 재생성
DROP POLICY IF EXISTS "Users can view messages from own sessions" ON chat_messages;
DROP POLICY IF EXISTS "Users can insert messages to own sessions" ON chat_messages;
DROP POLICY IF EXISTS "Users can update messages in own sessions" ON chat_messages;
DROP POLICY IF EXISTS "Users can delete messages from own sessions" ON chat_messages;

CREATE POLICY "Users can view messages from own sessions"
  ON chat_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_sessions 
      WHERE chat_sessions.id = chat_messages.session_id 
      AND chat_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages to own sessions"
  ON chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_sessions 
      WHERE chat_sessions.id = chat_messages.session_id 
      AND chat_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update messages in own sessions"
  ON chat_messages
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_sessions 
      WHERE chat_sessions.id = chat_messages.session_id 
      AND chat_sessions.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_sessions 
      WHERE chat_sessions.id = chat_messages.session_id 
      AND chat_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete messages from own sessions"
  ON chat_messages
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_sessions 
      WHERE chat_sessions.id = chat_messages.session_id 
      AND chat_sessions.user_id = auth.uid()
    )
  );

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

-- =====================================================
-- 4. 사용자 프로필 테이블 생성
-- =====================================================

CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 기존 정책들 삭제 후 재생성
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;

CREATE POLICY "Users can view own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

-- =====================================================
-- 5. 트리거 함수 및 트리거 생성
-- =====================================================

-- updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 기존 트리거들 삭제 후 재생성
DROP TRIGGER IF EXISTS update_chat_sessions_updated_at ON chat_sessions;
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;

CREATE TRIGGER update_chat_sessions_updated_at
  BEFORE UPDATE ON chat_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 새 사용자 가입 시 자동으로 user_profiles 레코드 생성하는 함수
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, role)
  VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 기존 트리거 삭제 후 재생성
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =====================================================
-- 6. 초기 데이터 삽입
-- =====================================================

-- 메인 프롬프트 삽입
INSERT INTO prompts_and_knowledge_base (name, content, type, order_index) VALUES (
  'main_prompt',
  '# Role

당신은 LG유플러스 "당신의 U+" 앱 마케터들이 **고객을 더 깊이 이해하고**, **놓치고 있던 기회를 발견할 수 있도록** 돕는 **마케터의 사고를 확장시키는 인사이트 파트너**입니다. 

**논리적 추론과 창조적 사고를 결합**하여 **새로운 해석**을 만들어내고, **예상치 못한 연결점을 발굴**함으로써 마케터에게 **실행 가능한 돌파구**를 제시해야 합니다.

# Instructions

### 🔍 데이터 해석의 시각
주어진 세그먼트 데이터나 행동 패턴을 **단순한 분류가 아닌 심리적 단서**로 바라보세요. "왜 이런 행동을 할까?"라는 질문에서 시작하여, **표면적 특징 뒤에 숨은 진짜 동기**를 추론해내야 합니다.

### 🔄 다른 관점의 탐색
"당연하다고 여겨지는 것"에 의문을 제기하세요. **일반적인 마케팅 상식이나 세그먼트에 대한 고정관념을 의심**하고, 데이터를 다른 각도에서 해석할 가능성을 탐색하세요.

### 🔗 연결의 발견
서로 관련 없어 보이는 정보들 사이의 **의외의 연결고리**를 찾아내세요. 세그먼트 특성과 앱 기능, 고객 심리와 비즈니스 기회 사이의 **창조적 조합**을 만들어야 합니다.

### ⚡ 압축된 논리
복잡한 추론 과정을 **핵심만 추려서** 전달하세요. 논리적 비약 없이도 핵심을 관통하는 인사이트를 **즉시 이해 가능한 형태**로 압축해야 합니다.

# Rules
### 📊 Knowledge Base 활용 원칙
- **데이터 너머 읽기**: 세그먼트 특성을 단순 나열하지 말고, **행동 패턴에서 심리적 동기를 추론**하세요
- **교차 분석**: 여러 세그먼트를 비교하여 **차별화 포인트와 공통 패턴**을 발견하세요
- **기능-니즈 매칭**: 앱 기능을 단순 소개하지 말고, **특정 고객 상황과의 연결점**을 찾아내세요

### 🎯 세그먼트 활용
- **기존 세그먼트 우선**: Knowledge Base의 기존 세그먼트를 우선적으로 활용하세요
- **필요시 확장**: 기존 세그먼트로 충분하지 않다면, 9개 지표(ARPU, 약정만료일, 가입기간, 최종로그인, 요금제타입, 기기교체주기, 결제실패, 콜센터문의, 멤버십등급)를 조합하여 새로운 세그먼트를 제안하세요
- **심리 분석**: 세그먼트 선택 후 해당 상황에서의 심리적 동기와 예상 반응까지 분석하세요

### 🎯 인사이트 품질 기준
- **논리적 확신**: 추측이 아닌 **데이터 기반 추론**으로 신뢰성을 확보하세요
- **참신한 관점**: **일반적 예상을 뛰어넘는** 새로운 해석을 제시하세요
- **즉시 활용성**: 마케터가 **당장 실행하고 싶어지는** 구체적 방향을 제시하세요

# Conversation Style
### 💬 대화 방식
- **핵심 우선**: 가장 강력한 인사이트를 **첫 문장에** 배치하세요
- **자연스런 흐름**: 마케터의 질문에 직접적으로 답하며, 가독성 좋게 구조화하여 답변하세요
- **간결함 유지**: 3-4문장 내외로 핵심을 전달하고, 긴 설명은 지양하세요
- **확신 있는 어조**: "~할 것 같아요"보다는 "~하거든요"로 확실한 근거를 제시하세요

### 🎯 대화 연결 기법
- **호기심 자극**: "재미있는 건...", "더 흥미로운 점은..." 등으로 추가 관심 유발하세요
- **사고 확장 질문**: 제시한 인사이트를 다른 관점이나 상황으로 확장할 수 있는 질문을 던져보세요
- **열린 결말**: "~일 수도 있어요", "~해볼 기회예요" 등으로 다음 대화로 이어질 여지를 남기세요
- **즉각적 공감**: 마케터가 "아, 맞다!"고 즉시 수긍할 수 있는 논리로 구성하세요',
  'main_prompt',
  0
) ON CONFLICT (name) DO UPDATE SET 
  content = EXCLUDED.content,
  updated_at = now();

-- 세그먼트 정보 삽입
INSERT INTO prompts_and_knowledge_base (name, content, type, order_index) VALUES (
  'segments',
  '| 세그명        | 특징 및 행동 패턴                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 합리적 통신 플래너 | 1. 체계적인 요금 관리형 사용: 요금제 변경, 청구 요금 납부, 데이터 사용량 확인 등 통신 및 요금 사용량 관리를 위해 앱 활용 요금제 최적화를 중요하게 여기며, 본인의 통신/소비 패턴을 지속적으로 점검 이벤트 및 혜택 또한 합리적 소비 관점에서 최대한 활용하려는 성향 보임 2. 데이터 및 요금제 최적화에 관심: 사용량을 체크하고 요금제 변경 여부를 탐색하며, 가족결합 및 부가서비스 혜택을 고려 나의 사용 패턴에 맞는 합리적인 요금제로의 변경을 고민하며, 적절한 서비스와 요금제를 유지하려는 경향이 있음 3. 목적성 방문이 뚜렷한 고객: 특정 니즈(요금 납부, 데이터 사용량 확인, 부가서비스 점검)가 발생할 때만 앱에 방문하며, 방문 후 즉시 이탈하는 경향이 강함 실질적인 비용 절감과 관련된 기능을 중심으로 사용                                                                                                                     |
| 통신 눈팅러     | 1. 목적성 방문 중심: 요금제 변경, 데이터 사용량 점검, 청구 요금 확인 시에만 앱 방문 방문 후 빠르게 이탈하며, 다른 기능(혜택, 이벤트 등)을 탐색하지 않음 2. 비정기적 사용: 분기 별 1회 정도 방문 앱 자체를 자주 사용할 필요성을 느끼지 않으며, 요금제 변경 주기가 길기 때문에 방문 빈도 낮음 3. 서비스 탐색 제한적: 앱 내 다양한 기능(데이터 선물, 멤버십 혜택, 이벤트)에 대한 인식과 필요성이 낮음 방문 목적을 달성하면 추가 탐색 없이 바로 이탈                                                                                                                                                                                                                                                                   |
| 헬프CS       | 1. 유선 및 대면 상담 중심 사용자 CS 요청 시, 유선 고객센터(전화)나 대리점 방문을 선호하며, 앱을 통한 문제 해결보다는 직접적인 상호작용을 신뢰 요금제 변경, 청구 요금 문의, 부가서비스 변경 등을 대리점이나 고객센터를 통해 해결 앱에서 문제를 해결할 수 있어도 "고객센터 직원과 직접 이야기하는 게 더 편하다"는 인식이 강함 2. 디지털 채널 사용 제한적 앱을 다운로드했더라도 사용 경험이 거의 없거나 제한적 기능이 너무 많고 복잡해서 필요한 기능을 쉽게 찾지 못하는 경우가 많음 웹사이트(PC) 사용을 선호하는 고객도 일부 존재, 앱 대신 PC 홈페이지에서 정보 확인 3. 복잡한 요청 해결 우선 가족결합, 위약금 조회, 부가서비스 변경 등 한 번에 해결해야 하는 요청이 많음 앱에서 해결이 가능한 기능도 있지만, 어떤 기능이 어디에 있는지 몰라 결국 전화 상담을 선택                                                                                    |
| 홈라이프플래너    | 1. 대면 및 유선 상담 중심 사용자 홈 서비스 관련 문의나 문제 해결을 위해 고객센터(전화)나 대리점 방문을 주로 이용 셀프 해결보다는 직접적인 상담을 통해 문제를 해결하는 방식이 익숙 앱에서 할 수 있는 기능을 알지 못하거나, 인지하더라도 굳이 사용할 필요성을 느끼지 않음 2. 홈 서비스만 사용, 모바일 서비스는 타 통신사 유지 유플러스 홈 서비스를 이용하지만, 모바일은 기존 타사 유지하며 통신사 변경의 필요성을 느끼지 않는 경우가 많음 "현재 이용 중인 통신사에서 제공하는 장기 고객 혜택이나 가족결합 할인 등의 장점이 더 크다고 판단"하여 모바일 전환 가능성이 낮음 3. 결합 혜택에 대한 정보 부족 및 무관심 모바일+홈 결합 할인에 대한 정보가 부족하거나, 할인 폭이 크지 않다고 판단하여 관심을 가지지 않는 경우가 많음 결합 할인 외의 다른 혜택(콘텐츠, 추가 서비스 등)에 대한 정보가 부족하여 전환을 고려하지 않음 "유플러스 홈을 선택한 이유도 가장 저렴한 가격 때문이며, 이후 추가적인 혜택 탐색을 하지 않음" |
| OTT구독매니아   | 1. 다양한 OTT 구독 및 가격 비교 습관 넷플릭스, 디즈니+, 티빙, 웨이브, 유튜브 프리미엄 등 다수의 OTT를 동시에 사용 OTT별 자체 콘텐츠(오리지널 시리즈 등)가 주요 선택 기준이며, 플랫폼 자체보다는 보고 싶은 콘텐츠에 따라 구독 여부를 결정함 가격을 절약하기 위해 구독 공유, 가족 플랜, 할인 프로모션 등을 적극 활용 2. OTT 구독의 유동성이 높음 특정 OTT를 지속해서 사용하기보다는 보고 싶은 콘텐츠가 있을 때만 구독하고, 다 본 후 해지하는 경향 월 단위 또는 1년 단위로 할인된 장기 구독 옵션을 탐색하며,  플랫폼 간 이동(구독 변경)이 잦음 3. OTT 결합 상품에 대한 관심 OTT 요금이 부담스럽다고 느끼는 경우가 많아, 통신사 결합 혜택이나 번들 서비스(유독, 프리미어 플러스 요금제 등)에 대한 관심도가 높을 가능성 있음 그러나 OTT 결합 상품이 실제로 가격 경쟁력이 있는지에 대한 의구심이 있음                                                     |
| 혜택만진심러     | 1. 멤버십 혜택 중심 사용 유플러스 멤버십 앱을 출석체크, 유플투쁠, VIP 콕, 영화 할인 등 주요 혜택을 위해 주기적으로 방문 단순 정보 조회(요금제, 데이터 사용량 등)보다 할인, 적립, 쿠폰 획득 등의 직접적인 금전적 혜택을 더 중요하게 여김 2. 혜택 탐색과 활용에 적극적이지만, UX/UI 불편에 대한 피로감 존재 혜택을 찾는 과정에서 찾기 어려움, 쿠폰 소진, 응모 방식의 번거로움 등을 경험하며 불편함을 느낌 타사(SK, KT) 대비 혜택이 부족하거나 탐색이 어렵다고 인식하는 경우도 있음 3. 당유 앱(당신의 유플러스) 사용 저조, 그러나 통합 시 활용 가능성 있음 현재 멤버십 앱을 주로 사용하고 있으며, 당유 앱 존재를 모르거나,  멤버십과 동일한 기능이 있다고 인식하지 않음 향후 멤버십 앱이 통합될 경우, 멤버십 기능이 원활하게 제공된다면 기존 사용자들도 유입될 가능성 존재 다만, 앱이 무겁거나, 혜택 접근이 불편하면 이탈할 우려가 있음                                      |',
  'knowledge_base',
  1
) ON CONFLICT (name) DO UPDATE SET 
  content = EXCLUDED.content,
  updated_at = now();

-- 진심체 가이드라인 삽입
INSERT INTO prompts_and_knowledge_base (name, content, type, order_index) VALUES (
  'jinshim_guide',
  '진심체 가이드라인
1.	''우리''와 ''함께''를 써서 고객과 같은 편이라고 말해주세요.
2.	소중한 고객은 이름과 함께 불러주세요.
3.	전달이 아닌 대화를 하기 위해 질문으로 시작해보세요.
4.	공감해주는 말, ''안심하세요'', ''아쉽게도'', ''양해해주세요''를 써보세요.
5.	''합니다''보다 ''해요''가 더 친밀해요.
6.	딱딱한 말 대신 쉽고 편한 ''일상''의 말을 써요.
7.	힘을 빼고 감성을 한 스푼 담아보세요.
8.	때로는 용기 내어 약점도 솔직하게 말해보세요.
9.	''나''를 넣으면 귀 기울여 듣게 돼요.
10.	 ''해준다''고 생색내지 않아요
11.	 ''혜택 ''이란 단어보다는 실질적인 내용을 말해주세요.
12.	''편리한'', ''다양한'', ''특별한''처럼 막연한 말보다는 구체적인 이유와 숫자 또는 데이터가 믿음을 줘요.
13.	최고, 1등, 최초, 최대 등을 쓸 때는 고객에게 좋은 점과 정확한 근거를 밝혀주세요.
14.	소외되는 사람이 없도록 유형이나 신조어는 적절할 때만 써요.
15.	등급, 고급, 우수, 선정 등 차별적인 언어에 주의해요.
16.	유의, 주의, 차단, 종료, 불가는 제한이나 불이익을 받는 느낌을 줘요.
17.	청구나 부과 같은 말은 부담을 줄 수 있어요.
18.	임대료와 통신요금을 둘 다 쓰는 건 친절보다 쓰임새가 중요하기 때문이에요.
19.	명사구를 만들려다 부자연스러운 말이 돼요.
20.	먼저 말로 해본 다음 쓸 수 없어요.

📝 요약본 (핵심만)_GPT
유플러스다움 언어 스타일: 진심체
•	따뜻한 구어체 톤
•	고객과 동등한 관점, 솔직함, 구체성
•	딱딱한 말 지양, 일상어 사용
진심체 원칙
•	고객을 이름+우리로 부르기
•	질문형 대화 시작
•	''합니다'' 대신 ''해요''
•	숫자, 데이터로 신뢰 확보
•	추상적 표현, 형식적 단어 지양
•	친절보다 실용성 중시
•	쉽고 부드러운 문장 사용
•	부정적 표현(차단, 종료 등) 최소화
•	명확하고 편안한 언어',
  'knowledge_base',
  2
) ON CONFLICT (name) DO UPDATE SET 
  content = EXCLUDED.content,
  updated_at = now();

-- 앱 기능 목록 삽입
INSERT INTO prompts_and_knowledge_base (name, content, type, order_index) VALUES (
  'usp_list',
  '### 마이페이지 (셀프 CS) > 나의 통신 생활 > 통신 리포트

지금 사용하고 있는 요금제가 나와 얼마나 잘 맞는지 데이터 사용량, 데이터 사용처, 멤버십 혜택, 요금 할인 내역 등을 진단하고, 적합한 요금제를 추천

### 요금/납부 > 요금/납부 조회

월 별 청구서와 요금 납부 여부, 내역을 확인할 수 있음

### 실시간 요금

당월 1일부터 현재까지 사용한 요금을 확인할 수 있음

### 이번 달 청구서 확인

요금, 결제 수단, 할인 금액 등 이번 달 청구서 상세 내역을 확인할 수 있음

### 납부 방법 변경

요금 납부 방법 및 결제일을 변경할 수 있음

### 가입/사용 현황 > 가입 정보 조회/변경

요금제, 납부 정보, 선택 약정, 해지 반환금, 부가서비스 등 가입 정보를 한 눈에 보고 변경할 수 있음

### 요금제 조회/변경

현재 이용 중인 요금제를 확인하고 요금제를 변경할 수 있음

### 부가서비스 조회/변경/해지

현재 이용 중인 부가서비스를 확인하고 부가 서비스를 가입, 변경, 해지할 수 있음

### 데이터/통화 사용량

데이터, 통화, 문자 실시간 사용량을 확인할 수 있음

### 사용 내역 조회

실시간 사용 요금, 월별 사용 요금, 통화 상세 내역 등 사용한 내역을 상세히 확인할 수 있음

### 데이터 선물/충전 > 데이터 선물

가족 및 친구에 내 데이터를 선물할 수 있음

### 데이터 충전

가지고 있는 데이터 쿠폰 혹은 가족 공용 데이터로 내 데이터를 충전할 수 있음

### 혜택/멤버십 > 나의 혜택 생활 > 혜택 리포트

멤버십 혜택, 요금제 혜택, 기기 및 요금 할인 등 현재 받고 있는 할인 및 혜택 내역을 한 눈에 확인할 수 있음

### 멤버십 > 나의 멤버십

현재 나의 멤버십 등급과 이용 중인 멤버십 혜택을 확인할 수 있음

### 선택 약정 할인

휴대폰을 구매할 때 공시지원금(휴대폰 가격 할인)을 받지 않은 고객에게 통신요금을 할인해주는 혜택을 신청할 수 있음

### 모바일 > 모바일 기기 > 휴대폰

다양한 휴대폰 기기를 확인하고 구매 시 월 예상 요금 혹은 혜택을 확인할 수 있으며, 원하는 휴대폰 기기를 구매할 수 있음

### 모바일 요금제 > 5G/LTE (모바일 요금제)

다양한 모바일 요금제를 확인하고 현재 요금제와 비교할 수 있으며 원하는 요금제로 변경할 수 있음

### 유심/eSIM > 유심

휴대폰을 구매하지 않아도 유심 구매를 통해, 기존에 사용하던 휴대폰에 새로운 번호로 가입하거나(신규가입), 번호를 유지하며 유플러스로 옮길(번호 이동) 수 있음

### 인터넷/IPTV > 인터넷/IPTV 가입 > 홈 상품 가입

나에게 필요한 상품, 활용 방법, 요금제를 선택하여 나에게 맞는 다양한 상품을 확인하고 원하는 상품에 가입할 수 있음

### 홈 서비스 설치 변경 신청

이사나 집 안에서 인터넷 기기 설치 장소 이동이 필요할 시 원하는 날짜를 선택하여 이동 신청을 할 수 있음

### 인터넷/IPTV 간편조치

인터넷 혹은 IPTV에 문제가 발생했을 때 가이드를 따라 간편하게 조치해 보거나 A/S 방문 신청을 할 수 있음

### 안전한 보안생활 > 보안 챙기기

피싱, 스팸 등으로부터 통신 서비스를 이용하며 보안을 지킬 수 있도록 서비스를 제공 및 관련 안내를 확인할 수 있음',
  'knowledge_base',
  3
) ON CONFLICT (name) DO UPDATE SET 
  content = EXCLUDED.content,
  updated_at = now();

-- 카피 작성 가이드 삽입
INSERT INTO prompts_and_knowledge_base (name, content, type, order_index) VALUES (
  'copy_guide',
  '### 네이버 스마트채널 광고 카피 작성 가이드

✅ 메인카피 작성 가이드
- 글자수: 18자 이하 (공백 포함)
- 문장 형태:
  - 의문형 (호기심 자극)
    예: 지금 쓰는 요금제 최선일까요?
  - 간결한 평서문 (제안/강조)
    예: 혜택도, 통신도 앱 하나면 끝
- 톤 & 스타일:
  - 구어체, 친근하고 부드러운 느낌
  - 쉬운 단어 사용 (중학생 수준 어휘)
  - 긍정적이고 유도적인 어조
- 특징:
  - 쉼표(,) 적극 사용해 리듬감 부여
  - 한 문장에 1메시지만 집중
  - "지금", "바로" 같은 긴급성 키워드 사용
  - 이중 부정, 복잡한 구조 지양

✅ 서브카피 작성 가이드
- 글자수: 22자 이하 (공백 포함)
- 문장 형태:
  - 완결형 평서문
  - 조건/가능성 암시형 선호
    예: 더 좋은 요금제 놓치고 있을지 몰라요
- 톤 & 스타일:
  - 메인보다 설명적이고 부드러운 톤
  - 가벼운 어미 사용 (~요, ~봐요)
  - 강요 없이 행동을 부드럽게 유도
- 특징:
  - 행동 제안 또는 혜택 암시
    예: 앱에서 바로 확인하고 신청해보세요
  - 구체적이고 자연스러운 표현
  - 복잡하거나 딱딱한 표현 지양

✅ 공통 작성 규칙
- 띄어쓰기:
  - 공식 띄어쓰기 준수
  - 쉼표(,) 뒤 띄어쓰기 필수
  - 자연스러운 리듬 우선 (관용적 표현은 약한 생략 가능)
- 마침표: 생략
- 이모티콘/특수문자: 사용 금지
- 언어 스타일:
  - 한글 기준 작성
  - 한자어나 어려운 단어 사용 지양
- 브랜드 언급:
  - "유플러스" 국문 표기, 줄임말 사용 금지
- 말줄임표(…): 사용 금지 (문장은 명확히 끝맺음)

✅ 추가 작성 팁
- 메인/서브 연결성:
  - 메인은 질문, 서브는 답변
  - 메인은 문제 제시, 서브는 해결책 제시
- 행동 유도:
  - "앱에서", "지금", "확인해보세요" 등 행동 촉구형 표현 적극 사용
- 대상 독자:
  - 모바일 사용자 대상
  - 짧고 명확한 정보 선호

### 카카오 비즈보드 광고 카피 작성 가이드

✅ 메인카피 작성 가이드
- 글자수: 15자 이하 (공백 포함)
- 문장 형태:
  - 의문형 위주 (호기심 자극)
    예: 지금 요금제 최선일까요?
- 톤 & 스타일:
  - 구어체, 자연스러운 질문
  - 짧고 리듬감 있는 구조
- 특징:
  - 쉼표(,) 적극 활용해 리듬감 부여
  - 한 문장에 1메시지만 담기
  - "~할 땐?", "~했나요?" 등 의문형 마무리
  - 긴급성이나 필요성 유도하는 표현 사용

✅ 서브카피 작성 가이드
- 글자수: 17자 이하 (공백 포함)
- 문장 형태:
  - 평서문
  - 혜택, 기능 설명
    예: 더 좋은 요금제를 놓치고 있을지도!
- 톤 & 스타일:
  - 구어체, 설명적 어조
  - 부드럽고 명확한 어미 (~요, ~지도)
- 특징:
  - 행동 촉구보다는 정보 전달 중심
  - 느낌표 활용해 자연스러운 마무리
  - 긍정적이고 가벼운 어조 유지

✅ 공통 작성 규칙
- 띄어쓰기:
  - 공식 띄어쓰기 준수
  - 쉼표(,) 뒤 띄어쓰기 필수
  - 자연스러운 리듬 우선
- 마침표: 생략 (느낌표 사용 가능)
- 이모티콘/특수문자: 사용 금지
- 언어 스타일:
  - 한글 기준 작성
  - 한자어 지양, 쉬운 말 선택
- 브랜드 언급:
  - 필요시 "U+" 표기 사용
- 말줄임표(…): 사용 금지 (문장은 명확히 끝맺음)

✅ 추가 작성 팁
- 메인/서브 간 연결성:
  - 메인은 문제 제시, 서브는 솔루션 암시
- 행동 유도는 서브보다는 메인에 집중
- 대상 독자:
  - 모바일 사용자
- 직관적이고 빠르게 이해 가능한 표현
### 구글/메타 광고 카피 작성 가이드 

✅ 메인카피 작성 가이드
- 글자수: 30자 이하 (공백 포함)
- 문장 형태:
  - 의문형 주로 사용 (호기심 자극)
    예: 지금 이용중인 요금제, 내 사용 패턴에 딱 맞을까?
- 톤 & 스타일:
  - 구어체, 자연스러운 질문 어조
  - 리듬감 있는 쉼표(,) 사용
  - 사용자 니즈를 직접 자극하는 구조
- 특징:
  - 1메시지 1문장
  - "할까?", "맞나요?", "필요하다면?" 등

✅ 서브카피 작성 가이드
- 글자수: **30자 이하** (공백 포함)
- 문장 형태:
  - 구체적인 행동 촉구형
  - 혜택, 절차, 기능 설명
    예: 최적 요금제, 지금 비교해보세요!
- 톤 & 스타일:
  - 구어체, 명확한 제안 (~보세요, ~확인하세요)
  - 부드럽고 명확한 흐름
- 특징:
  - 서비스의 이점, 편리성 강조
  - 자연스러운 CTA (Call to Action) 삽입
  - 느낌표 사용 가능

✅ 공통 작성 규칙
- 띄어쓰기:
  - 공식 띄어쓰기 준수
  - 쉼표(,) 뒤 띄어쓰기 필수
  - 자연스러운 문장 흐름 우선
- 마침표: 생략 (느낌표 사용 가능)
- 이모티콘/특수문자: 사용 금지
- 언어 스타일:
  - 한글 기준 작성
  - 한자어, 복잡한 단어 사용 지양
- 브랜드 언급:
  - "U+" 국문 표기 고정
- 말줄임표(…): 사용 금지

✅ 추가 작성 팁
- 메인/서브 연결성:
  - 메인은 문제/니즈 제기
  - 서브는 해결방안/혜택 제시
- 메인은 임팩트 있게, 서브는 구체적으로 설득
- 대상 독자:
  - 모바일 사용자
  - 빠르고 직관적인 정보 제공',
  'knowledge_base',
  4
) ON CONFLICT (name) DO UPDATE SET 
  content = EXCLUDED.content,
  updated_at = now();

-- 마이그레이션 완료 확인
SELECT 
  'Migration completed successfully!' as status,
  (SELECT COUNT(*) FROM prompts_and_knowledge_base) as total_knowledge_items,
  (SELECT COUNT(*) FROM prompts_and_knowledge_base WHERE type = 'main_prompt') as main_prompts,
  (SELECT COUNT(*) FROM prompts_and_knowledge_base WHERE type = 'knowledge_base') as knowledge_base_items;