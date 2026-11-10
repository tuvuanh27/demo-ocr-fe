/**
 * Document Intelligence API Service
 * Handles:
 * - POST /api/v1/convert (Document Conversion -> Markdown, HTML, JSON, Chunks)
 * - POST /api/v1/extract (Structured Extraction -> JSON via page_schema)
 * - GET  /api/v1/{endpoint}/{request_id} (Polling status)
 */

const IS_DEV = import.meta.env.DEV;
const API_BASE = IS_DEV ? '/api-service' : 'https://www.datalab.to/api/v1';

/**
 * Normalize check URL to use Vite proxy in dev mode to avoid CORS restrictions
 */
function normalizeCheckUrl(url) {
  if (IS_DEV && url && url.startsWith('https://www.datalab.to/api/v1')) {
    return url.replace('https://www.datalab.to/api/v1', '/api-service');
  }
  return url;
}

/**
 * Poll check URL until status is 'complete' or 'failed'
 */
async function pollResult(checkUrl, apiKey, onProgress) {
  const targetUrl = normalizeCheckUrl(checkUrl);
  const maxAttempts = 90;
  const pollIntervalMs = 2000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    onProgress?.({
      status: 'processing',
      attempt,
      message: `Đang phân tích tài liệu (Bước #${attempt})...`,
    });

    const res = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
      },
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Lỗi kết nối máy chủ (HTTP ${res.status}): ${errText || res.statusText}`);
    }

    const data = await res.json();

    if (data.status === 'complete') {
      return data;
    }

    if (data.status === 'failed') {
      throw new Error(data.error || 'Xử lý tài liệu thất bại');
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error('Hết thời gian chờ phản hồi từ máy chủ (Timeout sau 3 phút)');
}

/**
 * Convert Document (/api/v1/convert) - OCR, Markdown, HTML, JSON
 */
export async function convertDocument({
  apiKey,
  file,
  fileUrl,
  mode = 'balanced',
  outputFormat = 'markdown',
  wordBboxes = false,
  pageRange,
  paginate = false,
  onProgress,
}) {
  if (!apiKey) {
    throw new Error('Vui lòng nhập API Key để kích hoạt dịch vụ!');
  }

  const formData = new FormData();
  if (file) {
    formData.append('file', file);
  } else if (fileUrl) {
    formData.append('file_url', fileUrl);
  } else {
    throw new Error('Vui lòng tải lên tệp tài liệu cần chuyển đổi!');
  }

  formData.append('mode', mode);
  formData.append('output_format', outputFormat);
  if (wordBboxes) formData.append('word_bboxes', 'true');
  if (pageRange) formData.append('page_range', pageRange);
  if (paginate) formData.append('paginate', 'true');

  onProgress?.({
    status: 'submitting',
    message: 'Đang tải tệp lên hệ thống (POST /api/v1/convert)...',
  });

  const submitRes = await fetch(`${API_BASE}/convert`, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
    },
    body: formData,
  });

  if (!submitRes.ok) {
    const errText = await submitRes.text().catch(() => '');
    throw new Error(`Lỗi xử lý tài liệu (${submitRes.status}): ${errText || submitRes.statusText}`);
  }

  const submitData = await submitRes.json();
  const checkUrl = submitData.request_check_url;

  if (!checkUrl) {
    return submitData;
  }

  return await pollResult(checkUrl, apiKey, onProgress);
}

/**
 * Structured Extraction (/api/v1/extract) - JSON data based on page_schema
 */
export async function extractStructuredData({
  apiKey,
  file,
  fileUrl,
  pageSchema,
  mode = 'balanced',
  pageRange,
  onProgress,
}) {
  if (!apiKey) {
    throw new Error('Vui lòng nhập API Key để kích hoạt dịch vụ!');
  }

  const formData = new FormData();
  if (file) {
    formData.append('file', file);
  } else if (fileUrl) {
    formData.append('file_url', fileUrl);
  } else {
    throw new Error('Vui lòng tải lên tệp tài liệu cần bóc tách!');
  }

  // Ensure page_schema strictly conforms to JSON Schema format with 'properties' at root
  let finalSchemaStr;
  try {
    const parsed = typeof pageSchema === 'string' ? JSON.parse(pageSchema) : pageSchema;
    if (parsed && typeof parsed === 'object' && !parsed.properties) {
      finalSchemaStr = JSON.stringify({
        type: 'object',
        properties: parsed,
      });
    } else {
      finalSchemaStr = typeof pageSchema === 'string' ? pageSchema : JSON.stringify(pageSchema);
    }
  } catch {
    finalSchemaStr = typeof pageSchema === 'string' ? pageSchema : JSON.stringify(pageSchema);
  }

  formData.append('page_schema', finalSchemaStr);
  formData.append('mode', mode);
  if (pageRange) formData.append('page_range', pageRange);

  onProgress?.({
    status: 'submitting',
    message: 'Đang gửi schema trích xuất (POST /api/v1/extract)...',
  });

  const submitRes = await fetch(`${API_BASE}/extract`, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
    },
    body: formData,
  });

  if (!submitRes.ok) {
    const errText = await submitRes.text().catch(() => '');
    throw new Error(`Lỗi trích xuất dữ liệu (${submitRes.status}): ${errText || submitRes.statusText}`);
  }

  const submitData = await submitRes.json();
  const checkUrl = submitData.request_check_url;

  if (!checkUrl) {
    return submitData;
  }

  return await pollResult(checkUrl, apiKey, onProgress);
}
