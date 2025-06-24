const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface ClaudeRequest {
  messages: Array<{role: 'user' | 'assistant', content: string}>;
  apiKey: string;
  stream?: boolean;
}

// 시스템 프롬프트 캐시 관련 변수들
let cachedSystemPrompt: string | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5분 (밀리초)

// 캐시 유효성 검사 함수
function isCacheValid(): boolean {
  return cachedSystemPrompt !== null && (Date.now() - cacheTimestamp) < CACHE_TTL;
}

// 시스템 프롬프트를 직접 구성하는 함수 (네트워크 호출 제거)
async function buildSystemPromptDirect(): Promise<string> {
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

    // Supabase 클라이언트 초기화 - 자동으로 사용 가능한 환경 변수 사용
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'http://localhost:54321';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase 환경 변수가 설정되지 않았습니다.');
      console.log('Available env vars:', Object.keys(Deno.env.toObject()));
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
      throw new Error(`Failed to fetch main prompt: ${mainPromptResult.error.message}`);
    }

    if (knowledgeBaseResult.error) {
      console.error('지식 기반 가져오기 실패:', knowledgeBaseResult.error);
      throw new Error(`Failed to fetch knowledge base: ${knowledgeBaseResult.error.message}`);
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

    const { messages, apiKey, stream = false }: ClaudeRequest = await req.json();

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

    // 시스템 프롬프트를 직접 구성 (네트워크 호출 제거로 지연 시간 단축)
    const systemPrompt = await buildSystemPromptDirect();

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
      system: systemPrompt, // 캐시된 시스템 프롬프트 사용
      stream: stream,
    };

    console.log('Claude API Request:', {
      model: requestBody.model,
      messageCount: finalMessages.length,
      totalInputLength: totalLength,
      systemPromptLength: systemPrompt.length,
      maxTokens: requestBody.max_tokens,
      streaming: stream,
      cacheHit: isCacheValid()
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