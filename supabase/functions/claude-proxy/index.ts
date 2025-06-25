const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface ClaudeRequest {
  messages: Array<{role: 'user' | 'assistant', content: string}>;
  apiKey: string;
  stream?: boolean;
  playgroundMainPromptContent?: string;
  playgroundKnowledgeBaseSnapshot?: Array<{
    id: string;
    name: string;
    content: string;
    order_index: number;
  }>;
}

// 시스템 프롬프트 캐시 관련 변수들
let cachedSystemPrompt: string | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5분 (밀리초)

// 캐시 유효성 검사 함수
function isCacheValid(): boolean {
  return cachedSystemPrompt !== null && (Date.now() - cacheTimestamp) < CACHE_TTL;
}

// 시스템 프롬프트를 구성하는 함수 (플레이그라운드 우선순위 적용)
async function buildSystemPrompt(
  playgroundMainPromptContent?: string,
  playgroundKnowledgeBaseSnapshot?: Array<{
    id: string;
    name: string;
    content: string;
    order_index: number;
  }>
): Promise<string> {
  try {
    // 플레이그라운드 데이터가 있으면 우선 사용
    if (playgroundMainPromptContent !== undefined || playgroundKnowledgeBaseSnapshot !== undefined) {
      console.log('🎮 플레이그라운드 데이터로 시스템 프롬프트 구성:', {
        hasMainPrompt: !!playgroundMainPromptContent,
        knowledgeBaseItems: playgroundKnowledgeBaseSnapshot?.length || 0
      });

      let fullSystemPrompt = playgroundMainPromptContent || "You are Claude, a helpful AI assistant created by Anthropic. Please respond naturally and helpfully to the user's questions.";

      if (playgroundKnowledgeBaseSnapshot && playgroundKnowledgeBaseSnapshot.length > 0) {
        fullSystemPrompt += '\n\n---\n# Knowledge Base\n\n';
        
        // order_index로 정렬
        const sortedKnowledgeBase = [...playgroundKnowledgeBaseSnapshot].sort((a, b) => a.order_index - b.order_index);
        
        for (const item of sortedKnowledgeBase) {
          fullSystemPrompt += `## ${item.name}\n${item.content}\n\n`;
        }
      }

      console.log('✅ 플레이그라운드 시스템 프롬프트 구성 완료:', {
        totalLength: fullSystemPrompt.length
      });

      return fullSystemPrompt;
    }

    // 플레이그라운드 데이터가 없으면 전역 캐시 확인
    if (isCacheValid()) {
      console.log('💾 전역 시스템 프롬프트 캐시 히트:', {
        cacheAge: Math.round((Date.now() - cacheTimestamp) / 1000),
        promptLength: cachedSystemPrompt!.length
      });
      return cachedSystemPrompt!;
    }

    console.log('🌐 전역 시스템 프롬프트 캐시 미스 - 데이터베이스에서 새로 가져오는 중...');

    // Supabase 클라이언트 초기화
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase 환경 변수가 설정되지 않았습니다.');
      throw new Error('Supabase configuration missing');
    }

    // Supabase 클라이언트 동적 import (성능 최적화)
    const { createClient } = await import('npm:@supabase/supabase-js@2');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 메인 프롬프트와 지식 기반을 병렬로 가져오기 (성능 최적화)
    const [mainPromptResult, knowledgeBaseResult] = await Promise.all([
      supabase
        .from('prompts_and_knowledge_base')
        .select('content')
        .eq('type', 'main_prompt')
        .eq('name', 'main_prompt'),
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

    // 메인 프롬프트가 없으면 기본값 사용
    const mainPromptContent = mainPromptResult.data && mainPromptResult.data.length > 0 
      ? mainPromptResult.data[0].content 
      : "You are Claude, a helpful AI assistant created by Anthropic. Please respond naturally and helpfully to the user's questions.";

    // 시스템 프롬프트 구성
    let fullSystemPrompt = mainPromptContent;

    if (knowledgeBaseResult.data && knowledgeBaseResult.data.length > 0) {
      fullSystemPrompt += '\n\n---\n# Knowledge Base\n\n';
      
      for (const item of knowledgeBaseResult.data) {
        fullSystemPrompt += `## ${item.name}\n${item.content}\n\n`;
      }
    }

    // 캐시에 저장
    cachedSystemPrompt = fullSystemPrompt;
    cacheTimestamp = Date.now();

    console.log('✅ 전역 시스템 프롬프트 구성 및 캐싱 완료:', {
      mainPromptLength: mainPromptContent.length,
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

    const { 
      messages, 
      apiKey, 
      stream = false,
      playgroundMainPromptContent,
      playgroundKnowledgeBaseSnapshot
    }: ClaudeRequest = await req.json();

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "API key is required" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Messages array is required" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // 시스템 프롬프트 구성 (플레이그라운드 우선순위 적용)
    const systemPrompt = await buildSystemPrompt(playgroundMainPromptContent, playgroundKnowledgeBaseSnapshot);

    // Claude의 200K 토큰 컨텍스트 윈도우를 활용하여 더 많은 메시지 히스토리 유지
    const recentMessages = messages.slice(-100);

    // 토큰 사용량 최적화를 위한 메시지 길이 체크
    const totalLength = recentMessages.reduce((acc, msg) => acc + msg.content.length, 0);
    
    // 대략 150K 문자(약 37.5K 토큰) 이상이면 메시지 수를 줄임
    const finalMessages = totalLength > 150000 ? recentMessages.slice(-50) : recentMessages;

    const requestBody = {
      model: 'claude-3-5-sonnet-20241022', // 최신 Claude 3.5 Sonnet 사용
      max_tokens: 8192,
      temperature: 0.7,
      messages: finalMessages,
      system: systemPrompt, // 구성된 시스템 프롬프트 사용
      stream: stream,
    };

    console.log('Claude API Request:', {
      model: requestBody.model,
      messageCount: finalMessages.length,
      totalInputLength: totalLength,
      systemPromptLength: systemPrompt.length,
      maxTokens: requestBody.max_tokens,
      streaming: stream,
      playgroundMode: !!(playgroundMainPromptContent || playgroundKnowledgeBaseSnapshot),
      cacheHit: !playgroundMainPromptContent && !playgroundKnowledgeBaseSnapshot && isCacheValid()
    });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        ...(stream && { 'Accept': 'text/event-stream' }),
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Claude API Error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });
      
      return new Response(
        JSON.stringify({ 
          error: `Claude API request failed: ${response.status} ${response.statusText}`,
          details: errorData.error?.message || 'Unknown error from Claude API'
        }),
        {
          status: response.status,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // 스트리밍 응답 처리
    if (stream) {
      return new Response(response.body, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          ...corsHeaders,
        },
      });
    }

    // 일반 응답 처리
    const data = await response.json();
    
    // 응답 로깅 (디버깅용)
    console.log('Claude API Response:', {
      usage: data.usage,
      model: data.model,
      contentLength: data.content?.[0]?.text?.length || 0
    });
    
    return new Response(
      JSON.stringify({ 
        content: data.content[0].text,
        usage: data.usage,
        model: data.model
      }),
      {
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error('Claude API Proxy Error:', error);
    
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