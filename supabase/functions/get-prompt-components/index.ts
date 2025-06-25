import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// 프롬프트 구성 요소들을 개별적으로 가져오는 함수
async function fetchPromptComponents(): Promise<{
  mainPrompt: string;
  knowledgeBaseItems: Array<{ name: string; content: string }>;
}> {
  try {
    // Supabase 클라이언트 초기화
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase 환경 변수가 설정되지 않았습니다.');
      throw new Error('Supabase configuration missing');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 메인 프롬프트와 지식 기반을 병렬로 가져오기
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

    const mainPrompt = mainPromptResult.data?.content || '';
    const knowledgeBaseItems = (knowledgeBaseResult.data || []).map(item => ({
      name: item.name,
      content: item.content
    }));

    console.log('프롬프트 구성 요소 가져오기 완료:', {
      mainPromptLength: mainPrompt.length,
      knowledgeBaseItems: knowledgeBaseItems.length
    });

    return {
      mainPrompt,
      knowledgeBaseItems
    };
  } catch (error) {
    console.error('프롬프트 구성 요소 가져오기 중 오류:', error);
    throw error;
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

    // 프롬프트 구성 요소들 가져오기
    const components = await fetchPromptComponents();

    return new Response(
      JSON.stringify({ 
        mainPrompt: components.mainPrompt,
        knowledgeBaseItems: components.knowledgeBaseItems,
        timestamp: new Date().toISOString()
      }),
      {
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error('Prompt Components API Error:', error);
    
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