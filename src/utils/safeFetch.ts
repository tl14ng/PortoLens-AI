export interface SafeJsonResult<T = any> {
  ok: boolean;
  status: number;
  data: T | null;
  isHtml: boolean;
  errorMessage?: string;
}

/**
 * Safely reads a Fetch Response as JSON without throwing `SyntaxError: Unexpected token '<'`
 * when an upstream proxy, cold-start container, or SPA fallback returns HTML (`<!doctype ...>`).
 */
export async function readJsonSafe<T = any>(res: Response): Promise<SafeJsonResult<T>> {
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  let rawText = '';
  try {
    rawText = await res.text();
  } catch (err: any) {
    return {
      ok: false,
      status: res.status,
      data: null,
      isHtml: false,
      errorMessage: err?.message || 'Gagal membaca respons server.',
    };
  }

  const trimmed = rawText.trim();
  const looksLikeHtml =
    contentType.includes('text/html') ||
    trimmed.startsWith('<!') ||
    trimmed.toLowerCase().startsWith('<html');

  if (looksLikeHtml || trimmed.length === 0) {
    return {
      ok: false,
      status: res.status,
      data: null,
      isHtml: looksLikeHtml,
      errorMessage: looksLikeHtml
        ? 'Server mengembalikan halaman HTML alih-alih data JSON.'
        : 'Respons server kosong.',
    };
  }

  try {
    const parsed = JSON.parse(trimmed) as T;
    const serverErr =
      parsed && typeof parsed === 'object' && 'error' in (parsed as any)
        ? String((parsed as any).error || '')
        : undefined;
    return {
      ok: res.ok,
      status: res.status,
      data: parsed,
      isHtml: false,
      errorMessage: res.ok ? undefined : serverErr || `Server status ${res.status}`,
    };
  } catch {
    return {
      ok: false,
      status: res.status,
      data: null,
      isHtml: false,
      errorMessage: 'Format respons server tidak valid (bukan JSON).',
    };
  }
}

export async function fetchJsonSafe<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<SafeJsonResult<T>> {
  try {
    const headers = new Headers(init?.headers);
    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json');
    }
    const res = await fetch(input, { ...init, headers });
    return await readJsonSafe<T>(res);
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      data: null,
      isHtml: false,
      errorMessage: err?.message || 'Koneksi jaringan gagal.',
    };
  }
}
