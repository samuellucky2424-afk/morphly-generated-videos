import { NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase/server'
import { bootstrapUser } from '@/src/lib/user-bootstrap'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const requestedNext = searchParams.get('next')
  const next =
    requestedNext?.startsWith('/') && !requestedNext.startsWith('//')
      ? requestedNext
      : '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // Upon successful verification, trigger the bootstrap_new_user function securely.
      // This function is idempotent, so calling it on every login is safe, 
      // but it will only grant the signup bonus once.
      
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        try {
          await bootstrapUser(user);
        } catch (bootstrapError) {
          console.error('Auth callback account setup failed:', bootstrapError);
          return NextResponse.redirect(
            `${origin}/?error=account-setup-failed`,
          );
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    } else {
      console.error("Auth callback error:", error)
    }
  }

  // return the user to an error page with some instructions
  return NextResponse.redirect(`${origin}/?error=auth-callback-failed`)
}
