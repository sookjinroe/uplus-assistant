// Claude Sonnet 4 API integration via Edge Function proxy
export interface ApiOptions {
  stream?: boolean;
  maxTokens?: number;
  temperature?: number;
}

export interface StreamCallback {
  onChunk: (chunk: string) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
}

export const generateResponse = async (
  messages: Array<{role: 'user' | 'assistant', content: string}>,
  options: ApiOptions = {}
): Promise<string> => {
  const apiKey = import.meta.env.VITE_CLAUDE_API_KEY;

  if (!apiKey) {
    throw new Error(
      'Claude API key not found. Please set VITE_CLAUDE_API_KEY in your environment variables.'
    );
  }

  try {
    // Use the Edge Function proxy instead of direct API call
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/claude-proxy`;
    
    const requestBody = {
      messages,
      apiKey,
      stream: options.stream || false,
    };

    console.log('Claude Sonnet 4 API Request:', {
      messageCount: messages.length,
      streaming: options.stream || false
    });
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Proxy request failed: ${response.status} ${response.statusText}. ${errorData.error || ''}`);
    }

    const data = await response.json();
    
    // 토큰 사용량 로깅 (개발 환경에서만)
    if (import.meta.env.DEV && data.usage) {
      console.log('Claude Sonnet 4 Token Usage:', {
        input: data.usage.input_tokens,
        output: data.usage.output_tokens,
        total: data.usage.input_tokens + data.usage.output_tokens,
        model: data.model
      });
    }
    
    return data.content;
  } catch (error) {
    console.error('Claude Sonnet 4 API Error:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to get response from Claude Sonnet 4 API');
  }
};

// Helper function to check if an error is an abort error
const isAbortError = (error: any): boolean => {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    error.name === 'AbortError' ||
    error.message === 'Request was aborted' ||
    error.message?.toLowerCase().includes('aborted') ||
    error.message?.toLowerCase().includes('bodystreamBuffer was aborted')
  );
};

// 스트리밍 응답을 위한 함수 (AbortSignal 지원)
export const generateStreamingResponse = async (
  messages: Array<{role: 'user' | 'assistant', content: string}>,
  callback: StreamCallback,
  signal?: AbortSignal
): Promise<void> => {
  const apiKey = import.meta.env.VITE_CLAUDE_API_KEY;

  if (!apiKey) {
    callback.onError(new Error('Claude API key not found. Please set VITE_CLAUDE_API_KEY in your environment variables.'));
    return;
  }

  try {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/claude-proxy`;
    
    const requestBody = {
      messages,
      apiKey,
      stream: true,
    };

    console.log('Claude Sonnet 4 Streaming Request:', {
      messageCount: messages.length
    });
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(requestBody),
      signal, // AbortSignal 추가
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      callback.onError(new Error(`Proxy request failed: ${response.status} ${response.statusText}. ${errorData.error || ''}`));
      return;
    }

    if (!response.body) {
      callback.onError(new Error('No response body received'));
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        // AbortSignal 체크
        if (signal?.aborted) {
          console.log('Request was aborted by user');
          callback.onComplete();
          break;
        }

        const { done, value } = await reader.read();
        
        if (done) {
          callback.onComplete();
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              callback.onComplete();
              return;
            }

            try {
              const parsed = JSON.parse(data);
              
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                callback.onChunk(parsed.delta.text);
              }
            } catch (parseError) {
              // JSON 파싱 에러는 무시 (일부 이벤트는 파싱할 필요 없음)
              continue;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  } catch (error) {
    // AbortError는 사용자가 의도적으로 중단한 것이므로 에러로 처리하지 않음
    if (isAbortError(error)) {
      console.log('Request was aborted by user');
      callback.onComplete();
      return;
    }
    
    console.error('Claude Sonnet 4 Streaming Error:', error);
    callback.onError(error instanceof Error ? error : new Error('Failed to get streaming response from Claude Sonnet 4 API'));
  }
};

// 기본 시스템 프롬프트 (Edge Function이 사용 불가능할 때 사용)
const DEFAULT_SYSTEM_PROMPT = `You are Claude, a helpful AI assistant created by Anthropic. You are knowledgeable, thoughtful, and aim to be helpful while being honest about the limitations of your knowledge.

Please respond naturally and helpfully to the user's questions. If you're unsure about something, it's better to acknowledge that uncertainty rather than guess.`;

// 시스템 프롬프트를 가져오는 함수 (향상된 에러 처리 및 fallback)
export const fetchSystemPrompt = async (): Promise<string> => {
  // 환경 변수 확인
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase 환경 변수가 설정되지 않았습니다. 기본 시스템 프롬프트를 사용합니다.');
    return DEFAULT_SYSTEM_PROMPT;
  }

  try {
    const apiUrl = `${supabaseUrl}/functions/v1/get-system-prompt`;
    
    console.log('Fetching system prompt from Edge Function...');
    
    // 타임아웃 설정 (10초)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.warn(`System prompt Edge Function 응답 오류 (${response.status}):`, errorText);
      console.log('기본 시스템 프롬프트를 사용합니다.');
      return DEFAULT_SYSTEM_PROMPT;
    }

    const data = await response.json();
    
    if (!data.systemPrompt) {
      console.warn('Edge Function에서 시스템 프롬프트를 받지 못했습니다. 기본 프롬프트를 사용합니다.');
      return DEFAULT_SYSTEM_PROMPT;
    }
    
    console.log('System prompt fetched successfully:', {
      length: data.promptLength || data.systemPrompt.length,
      timestamp: data.timestamp,
      cached: data.cache?.valid || false
    });
    
    return data.systemPrompt;
  } catch (error) {
    // 네트워크 오류, 타임아웃, Edge Function 미배포 등의 경우
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.warn('System prompt 요청 타임아웃. 기본 시스템 프롬프트를 사용합니다.');
      } else if (error.message.includes('Failed to fetch')) {
        console.warn('Edge Function에 연결할 수 없습니다. get-system-prompt 함수가 배포되었는지 확인하세요.');
        console.log('기본 시스템 프롬프트를 사용합니다.');
      } else {
        console.warn('System prompt 가져오기 실패:', error.message);
        console.log('기본 시스템 프롬프트를 사용합니다.');
      }
    } else {
      console.warn('System prompt 가져오기 중 알 수 없는 오류:', error);
      console.log('기본 시스템 프롬프트를 사용합니다.');
    }
    
    return DEFAULT_SYSTEM_PROMPT;
  }
};