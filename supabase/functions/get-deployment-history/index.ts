const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

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

    console.log('📋 배포 이력 조회 시작');

    try {
      // 배포 이력 조회 (최신순)
      const { data: deploymentHistory, error: historyError } = await supabase
        .from('deployment_history')
        .select(`
          id,
          deployed_at,
          main_prompt_content,
          knowledge_base_snapshot,
          deployed_by_user_id,
          deployment_notes,
          created_at
        `)
        .order('deployed_at', { ascending: false })
        .limit(50); // 최근 50개만 조회

      if (historyError) {
        throw new Error(`Failed to fetch deployment history: ${historyError.message}`);
      }

      // 배포한 사용자 정보 가져오기
      const userIds = deploymentHistory
        ?.filter(item => item.deployed_by_user_id)
        .map(item => item.deployed_by_user_id) || [];

      let userEmails: Record<string, string> = {};
      
      if (userIds.length > 0) {
        const { data: userData, error: userError } = await supabase.auth.admin.listUsers();
        
        if (!userError && userData?.users) {
          userEmails = userData.users.reduce((acc, user) => {
            if (user.id && user.email) {
              acc[user.id] = user.email;
            }
            return acc;
          }, {} as Record<string, string>);
        }
      }

      // 응답 데이터 구성
      const formattedHistory = deploymentHistory?.map(item => ({
        id: item.id,
        deployedAt: item.deployed_at,
        mainPromptLength: item.main_prompt_content?.length || 0,
        knowledgeBaseItems: Array.isArray(item.knowledge_base_snapshot) 
          ? item.knowledge_base_snapshot.length 
          : 0,
        deployedByEmail: item.deployed_by_user_id 
          ? userEmails[item.deployed_by_user_id] || 'Unknown User'
          : 'System',
        deploymentNotes: item.deployment_notes,
        createdAt: item.created_at,
        // 상세 데이터는 별도 요청으로 처리하기 위해 제외
      })) || [];

      console.log('✅ 배포 이력 조회 완료:', {
        totalItems: formattedHistory.length
      });

      return new Response(
        JSON.stringify({ 
          success: true,
          deploymentHistory: formattedHistory,
          totalCount: formattedHistory.length
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
    console.error('Get Deployment History Error:', error);
    
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