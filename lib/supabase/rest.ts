import { getServerEnv } from '@/lib/server/env';

type SupabaseQueryValue = string | number | boolean | null | undefined;

type SupabaseRequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH';
  query?: Record<string, SupabaseQueryValue>;
  body?: unknown;
  single?: boolean;
  maybeSingle?: boolean;
  prefer?: string;
};

function buildUrl(path: string, query?: Record<string, SupabaseQueryValue>) {
  const { supabaseUrl } = getServerEnv();
  const url = new URL(`${supabaseUrl}/rest/v1/${path}`);

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  return url;
}

export async function supabaseRequest<T>(
  path: string,
  {
    method = 'GET',
    query,
    body,
    single = false,
    maybeSingle = false,
    prefer,
  }: SupabaseRequestOptions = {}
): Promise<T> {
  const { supabaseServiceRoleKey } = getServerEnv();
  const response = await fetch(buildUrl(path, query), {
    method,
    headers: {
      apikey: supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
      'Content-Type': 'application/json',
      ...(single || maybeSingle
        ? { Accept: 'application/vnd.pgrst.object+json' }
        : { Accept: 'application/json' }),
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  });

  if (!response.ok) {
    if (maybeSingle && response.status === 406) {
      return null as T;
    }

    const details = await response.text();
    throw new Error(`Supabase request failed (${response.status}): ${details}`);
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
}
