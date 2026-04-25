type ServerEnv = {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
};

export function getServerEnv(): ServerEnv {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      'Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
    );
  }

  return {
    supabaseUrl: supabaseUrl.replace(/\/$/, ''),
    supabaseServiceRoleKey,
  };
}
