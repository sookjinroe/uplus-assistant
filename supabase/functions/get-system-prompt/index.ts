import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// 캐시 관련 변수들
let cachedSystemPrompt: string | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5분 (밀리초)

// 캐시 유효성 검사 함수
function isCacheValid(): boolean {
  return cachedSystemPrompt !== null && (Date.now() - cacheTimestamp) < CACHE_TTL;
}

// Supabase 데이터베이스에서 프롬프트와 지식 기반을 가져와서 시스템 프롬프트를 구성하는 함수
async function buildSystemPrompt(): Promise<string> {
  try {
    // 캐시가 유효하면 캐시된 프롬프트 반환
    if (isCacheValid()) {
      console.log('시스템 프롬프트 캐시 히트:', {
        cacheAge: Math.round((Date.now() - cacheTimestamp) / 1000),
        promptLength: cachedSystemPrompt!.length
      });
      return cachedSystemPrompt!;
    }

    console.log('시스템 프롬프트 캐시 미스 - 데이터베이스에서 새로 가져오는 중...');

    // Supabase 클라이언트 초기화
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase 환경 변수가 설정되지 않았습니다.');
      throw new Error('Supabase configuration missing');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 메인 프롬프트와 지식 기반을 병렬로 가져오기 (성능 최적화)
    const [mainPromptResult, knowledgeBaseResult] = await Promise.all([
      supabase
        .from('prompts_and_knowledge_base')
        .select('content')
        .eq('type', 'main_prompt')
        .eq('name', 'main_prompt')
        .single(),
      supabase
        .from('prompts_and_knowledge_base')
        .select('name, content')
        .eq('type', 'knowledge_base')
        .order('order_index', { ascending: true })
    ]);

    if (mainPromptResult.error) {
      console.error('메인 프롬프트 가져오기 실패:', mainPromptResult.error);
      throw new Error('Failed to fetch main prompt');
    }

    if (knowledgeBaseResult.error) {
      console.error('지식 기반 가져오기 실패:', knowledgeBaseResult.error);
      throw new Error('Failed to fetch knowledge base');
    }

    // 시스템 프롬프트 구성
    let fullSystemPrompt = mainPromptResult.data.content;

    if (knowledgeBaseResult.data && knowledgeBaseResult.data.length > 0) {
      fullSystemPrompt += '\n\n---\n# Knowledge Base\n\n';
      
      for (const item of knowledgeBaseResult.data) {
        fullSystemPrompt += `## ${item.name}\n${item.content}\n\n`;
      }
    }

    // 캐시에 저장
    cachedSystemPrompt = fullSystemPrompt;
    cacheTimestamp = Date.now();

    console.log('시스템 프롬프트 구성 및 캐싱 완료:', {
      mainPromptLength: mainPromptResult.data.content.length,
      knowledgeBaseItems: knowledgeBaseResult.data?.length || 0,
      totalLength: fullSystemPrompt.length,
      cached: true
    });

    return fullSystemPrompt;
  } catch (error) {
    console.error('시스템 프롬프트 구성 중 오류:', error);
    
    // 캐시된 프롬프트가 있다면 만료되었어도 사용 (fallback)
    if (cachedSystemPrompt) {
      console.log('오류 발생으로 만료된 캐시 사용:', {
        cacheAge: Math.round((Date.now() - cacheTimestamp) / 1000),
        promptLength: cachedSystemPrompt.length
      });
      return cachedSystemPrompt;
    }
    
    // 기본 프롬프트 반환
    const fallbackPrompt = "You are Claude, a helpful AI assistant created by Anthropic. Please respond naturally and helpfully to the user's questions.";
    console.log('기본 프롬프트 사용');
    return fallbackPrompt;
  }
}

// 캐시 상태 조회 함수 (디버깅용)
function getCacheStatus() {
  return {
    cached: cachedSystemPrompt !== null,
    valid: isCacheValid(),
    age: cachedSystemPrompt ? Math.round((Date.now() - cacheTimestamp) / 1000) : 0,
    ttl: Math.round(CACHE_TTL / 1000),
    size: cachedSystemPrompt?.length || 0
  };
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: corsHeaders,
      });
    }

    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // 시스템 프롬프트 구성 (캐시 활용)
    const systemPrompt = await buildSystemPrompt();
    const cacheStatus = getCacheStatus();

    return new Response(
      JSON.stringify({ 
        systemPrompt,
        timestamp: new Date().toISOString(),
        promptLength: systemPrompt.length,
        cache: cacheStatus
      }),
      {
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error('System Prompt API Error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error"
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }
});