import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_BASE_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_BASE_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return document.cookie.split(';').map((cookie) => {
            const [name, ...rest] = cookie.trim().split('=');
            return { name, value: rest.join('=') };
          });
        },
        setAll(cookiesToSet: { name: string; value: string; options?: { secure?: boolean; sameSite?: string; path?: string; maxAge?: number } }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            const secure = options?.secure ? '; Secure' : '';
            const sameSite = options?.sameSite ? `; SameSite=${options.sameSite}` : '';
            const path = options?.path ? `; Path=${options.path}` : '; Path=/';
            const maxAge = options?.maxAge ? `; Max-Age=${options.maxAge}` : '';
            document.cookie = `${name}=${value}${path}${maxAge}${sameSite}${secure}`;
          });
        },
      },
    },
  );
}
