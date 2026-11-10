/**
 * LLM API Service
 * Supports any OpenAI-compatible API endpoint (OpenAI, OpenRouter, Groq, Ollama, vLLM, etc.)
 * Supports Server-Sent Events (SSE) streaming with non-streaming fallback.
 */

export const LLM_PRESETS = [
  {
    id: 'openai',
    label: 'OpenAI (Default)',
    baseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o', 'o1-mini', 'gpt-3.5-turbo'],
    helperText: 'Yêu cầu OpenAI API Key',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseURL: 'https://openrouter.ai/api/v1',
    defaultModel: 'openai/gpt-4o-mini',
    models: [
      'openai/gpt-4o-mini',
      'anthropic/claude-3.5-sonnet',
      'google/gemini-2.0-flash-exp:free',
      'deepseek/deepseek-chat',
      'meta-llama/llama-3.3-70b-instruct',
    ],
    helperText: 'Hỗ trợ đa dạng model từ OpenAI, Anthropic, Google, Meta, DeepSeek',
  },
  {
    id: 'groq',
    label: 'Groq (Cực nhanh)',
    baseURL: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
    helperText: 'Tốc độ phản hồi cực nhanh, miễn phí hoặc chi phí thấp',
  },
  {
    id: 'ollama',
    label: 'Ollama (Local)',
    baseURL: 'http://localhost:11434/v1',
    defaultModel: 'llama3.2',
    models: ['llama3.2', 'qwen2.5:7b', 'mistral', 'gemma2'],
    helperText: 'Chạy trực tiếp trên máy cục bộ, không cần API Key',
  },
  {
    id: 'custom',
    label: 'Tùy chỉnh (Custom BaseURL)',
    baseURL: '',
    defaultModel: '',
    models: [],
    helperText: 'Bất kỳ máy chủ API nào tương thích định dạng OpenAI Chat Completions',
  },
];

export const DEFAULT_SYSTEM_PROMPT = `Bạn là một trợ lý phân tích tài liệu thông minh, chuyên nghiệp và chuẩn xác.
Bạn được cung cấp nội dung của các tài liệu đính kèm (đã được OCR nhận dạng sang Markdown kèm phân tách trang).

QUY TẮC BẮT BUỘC KHI TRẢ LỜI:
1. CĂN CỨ VÀO TÀI LIỆU: Chỉ trả lời dựa trên thông tin có trong các tài liệu được cung cấp dưới đây. Nếu tài liệu không đề cập đến thông tin mà người dùng hỏi, hãy trả lời rõ ràng rằng tài liệu không có thông tin đó, tuyệt đối không suy đoán hoặc tự bịa đặt.
2. TRÍCH DẪN (CITATION): Mọi thông tin, số liệu, điều khoản, kết luận bạn đưa ra đều BẮT BUỘC phải kèm trích dẫn nguồn theo định dạng:
   [tên_tệp, Trang X] (Ví dụ: [hop_dong.pdf, Trang 2])
   Nếu thông tin được tổng hợp từ nhiều trang hoặc nhiều tệp, hãy liệt kê tất cả các trích dẫn tương ứng (Ví dụ: [tai_lieu_1.pdf, Trang 1] [tai_lieu_2.pdf, Trang 4]).
3. ĐỊNH DẠNG: Sử dụng cú pháp Markdown rõ ràng (gạch đầu dòng, in đậm từ khóa quan trọng, bảng biểu Markdown khi cần so sánh số liệu).
4. NGÔN NGỮ: Trả lời bằng ngôn ngữ mà người dùng hỏi (ưu tiên tiếng Việt).`;

/**
 * Send chat message to OpenAI-compatible endpoint
 */
export async function sendChatMessage({
  baseURL = 'https://api.openai.com/v1',
  apiKey = '',
  model = 'gpt-4o-mini',
  messages = [],
  systemPrompt = DEFAULT_SYSTEM_PROMPT,
  documentsContext = '',
  temperature = 0.2,
  onChunk,
  signal,
}) {
  const trimmedKey = (apiKey || '').trim();
  const trimmedBase = (baseURL || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const trimmedModel = (model || 'gpt-4o-mini').trim();

  // Ollama local doesn't strictly need apiKey, but external APIs do
  if (!trimmedKey && !trimmedBase.includes('localhost') && !trimmedBase.includes('127.0.0.1')) {
    throw new Error('Vui lòng nhập API Key cho mô hình AI trong phần Cài đặt (Settings)!');
  }

  // Format system message with documents context
  const fullSystemMessage = [
    systemPrompt.trim(),
    documentsContext
      ? `\n\n================ TÀI LIỆU THAM KHẢO (ĐÃ ĐƯỢC OCR) ================\n${documentsContext}\n================ HẾT PHẦN TÀI LIỆU THAM KHẢO ================`
      : '\n\n(Hiện tại chưa có tài liệu nào được cung cấp).',
  ].join('');

  const finalMessages = [
    { role: 'system', content: fullSystemMessage },
    ...messages,
  ];

  const headers = {
    'Content-Type': 'application/json',
  };
  if (trimmedKey) {
    headers['Authorization'] = `Bearer ${trimmedKey}`;
  }

  const payload = {
    model: trimmedModel,
    messages: finalMessages,
    temperature,
    stream: Boolean(onChunk),
  };

  const endpoint = `${trimmedBase}/chat/completions`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errObj = JSON.parse(errorText);
      errorMessage = errObj.error?.message || errObj.message || errorText;
    } catch {
      if (errorText) errorMessage = errorText;
    }
    throw new Error(`Lỗi gọi API AI: ${errorMessage}`);
  }

  // Streaming via SSE reader
  if (onChunk && response.body && typeof response.body.getReader === 'function') {
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let accumulated = '';
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;
          if (trimmed === 'data: [DONE]') continue;

          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6);
            try {
              const parsed = JSON.parse(dataStr);
              const delta = parsed.choices?.[0]?.delta?.content || '';
              if (delta) {
                accumulated += delta;
                onChunk(accumulated, delta);
              }
            } catch {
              // Ignore incomplete json chunk
            }
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        return accumulated;
      }
      throw err;
    }

    return accumulated;
  }

  // Non-streaming fallback
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  if (onChunk) {
    onChunk(content, content);
  }
  return content;
}

