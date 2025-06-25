const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface SaveDeploymentSnapshotRequest {
  deploymentNotes?: string;
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

    const { deploymentNotes }: SaveDeploymentSnapshotRequest = await req.json().catch(() => ({}));

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

    console.log('📸 배포 스냅샷 저장 시작:', {
      userId,
      hasNotes: !!deploymentNotes
    });

    try {
      // 현재 전역 메인 프롬프트 가져오기
      const { data: mainPromptData, error: mainPromptError } = await supabase
        .from('prompts_and_knowledge_base')
        .select('content')
        .eq('type', 'main_prompt')
        .eq('name', 'main_prompt')
        .single();

      if (mainPromptError) {
        throw new Error(`Failed to fetch main prompt: ${mainPromptError.message}`);
      }

      // 현재 전역 지식 기반 가져오기
      const { data: knowledgeBaseData, error: knowledgeBaseError } = await supabase
        .from('prompts_and_knowledge_base')
        .select('id, name, content, order_index')
        .eq('type', 'knowledge_base')
        .order('order_index', { ascending: true });

      if (knowledgeBaseError) {
        throw new Error(`Failed to fetch knowledge base: ${knowledgeBaseError.message}`);
      }

      // 배포 스냅샷 저장
      const { data: deploymentData, error: deploymentError } = await supabase
        .from('deployment_history')
        .insert({
          main_prompt_content: mainPromptData.content,
          knowledge_base_snapshot: knowledgeBaseData || [],
          deployed_by_user_id: userId,
          deployment_notes: deploymentNotes || null
        })
        .select('id, deployed_at')
        .single();

      if (deploymentError) {
        throw new Error(`Failed to save deployment snapshot: ${deploymentError.message}`);
      }

      console.log('✅ 배포 스냅샷 저장 완료:', {
        deploymentId: deploymentData.id,
        deployedAt: deploymentData.deployed_at
      });

      return new Response(
        JSON.stringify({ 
          success: true,
          message: "Deployment snapshot saved successfully",
          deployment: {
            id: deploymentData.id,
            deployedAt: deploymentData.deployed_at,
            mainPromptLength: mainPromptData.content.length,
            knowledgeBaseItems: knowledgeBaseData?.length || 0
          }
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
    console.error('Save Deployment Snapshot Error:', error);
    
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