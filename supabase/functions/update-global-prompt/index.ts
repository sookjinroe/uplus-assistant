const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface UpdateGlobalPromptRequest {
  mainPromptContent: string;
  knowledgeBaseItems: Array<{
    id: string;
    name: string;
    content: string;
    order_index: number;
  }>;
}

// 사용자가 관리자인지 확인하는 함수
async function verifyAdminUser(authHeader: string): Promise<string | null> {
  try {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Invalid authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Supabase 클라이언트 초기화
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }

    const { createClient } = await import('npm:@supabase/supabase-js@2');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 토큰으로 사용자 정보 가져오기
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Invalid user token');
    }

    // 사용자 역할 확인
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profileData || profileData.role !== 'admin') {
      throw new Error('User is not an admin');
    }

    return user.id;
  } catch (error) {
    console.error('Admin verification failed:', error);
    return null;
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

    // 관리자 권한 확인
    const authHeader = req.headers.get('Authorization');
    const userId = await verifyAdminUser(authHeader || '');
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - Admin access required" }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    const { mainPromptContent, knowledgeBaseItems }: UpdateGlobalPromptRequest = await req.json();

    if (!mainPromptContent || typeof mainPromptContent !== 'string') {
      return new Response(
        JSON.stringify({ error: "Main prompt content is required" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // Supabase 클라이언트 초기화
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Supabase configuration missing" }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    const { createClient } = await import('npm:@supabase/supabase-js@2');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🔄 전역 프롬프트 업데이트 시작:', {
      mainPromptLength: mainPromptContent.length,
      knowledgeBaseItems: knowledgeBaseItems?.length || 0,
      userId
    });

    // 트랜잭션으로 처리
    try {
      // 1. 메인 프롬프트 업데이트
      const { error: mainPromptError } = await supabase
        .from('prompts_and_knowledge_base')
        .upsert({
          name: 'main_prompt',
          content: mainPromptContent,
          type: 'main_prompt',
          order_index: 0,
          updated_at: new Date().toISOString()
        });

      if (mainPromptError) {
        throw new Error(`Failed to update main prompt: ${mainPromptError.message}`);
      }

      // 2. 기존 지식 기반 항목들 삭제
      const { error: deleteError } = await supabase
        .from('prompts_and_knowledge_base')
        .delete()
        .eq('type', 'knowledge_base');

      if (deleteError) {
        throw new Error(`Failed to delete existing knowledge base: ${deleteError.message}`);
      }

      // 3. 새로운 지식 기반 항목들 삽입
      if (knowledgeBaseItems && knowledgeBaseItems.length > 0) {
        const knowledgeBaseRecords = knowledgeBaseItems.map((item, index) => ({
          id: item.id,
          name: item.name,
          content: item.content,
          type: 'knowledge_base',
          order_index: item.order_index || index + 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));

        const { error: insertError } = await supabase
          .from('prompts_and_knowledge_base')
          .insert(knowledgeBaseRecords);

        if (insertError) {
          throw new Error(`Failed to insert knowledge base items: ${insertError.message}`);
        }
      }

      console.log('✅ 전역 프롬프트 업데이트 완료');

      return new Response(
        JSON.stringify({ 
          success: true,
          message: "Global prompt and knowledge base updated successfully",
          updatedAt: new Date().toISOString()
        }),
        {
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );

    } catch (dbError) {
      console.error('Database operation failed:', dbError);
      return new Response(
        JSON.stringify({ 
          error: "Database operation failed",
          details: dbError instanceof Error ? dbError.message : "Unknown database error"
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

  } catch (error) {
    console.error('Update Global Prompt Error:', error);
    
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