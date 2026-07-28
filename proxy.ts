import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Next.js 16 renamed the `middleware.ts` convention to `proxy.ts` (same
// functionality, nodejs runtime only). See node_modules/next/dist/docs/
// 01-app/02-guides/upgrading/version-16.md.
export async function proxy(request: NextRequest) {
  // Kept mutable: refreshing the session may issue new auth cookies, which
  // have to be written onto a response built from the *updated* request.
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Do not put logic between createServerClient and getUser(): getUser() is what
  // revalidates the token and triggers the cookie writes above. Anything that
  // returns early in between will ship a response with stale auth cookies.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'

    // Carry over any cookies the refresh attempt set (e.g. clearing a dead
    // session) so the redirect doesn't drop them.
    const redirectResponse = NextResponse.redirect(url)
    supabaseResponse.cookies
      .getAll()
      .forEach((cookie) => redirectResponse.cookies.set(cookie))

    return redirectResponse
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Run on every path except:
     * - _next/static (build output)
     * - _next/image (image optimizer)
     * - favicon.ico
     * - common image extensions
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
