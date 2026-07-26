import { NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // Upon successful verification, trigger the bootstrap_new_user function securely.
      // This function is idempotent, so calling it on every login is safe, 
      // but it will only grant the signup bonus once.
      
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.rpc('bootstrap_new_user', {
          p_user_id: user.id,
          p_email: user.email,
          p_display_name: user.user_metadata?.full_name || 'User',
          p_referral_code_used: user.user_metadata?.referral_code_used || null
        });
      }

      return NextResponse.redirect(`${origin}${next}`)
    } else {
      console.error("Auth callback error:", error)
    }
  }

  // return the user to an error page with some instructions
  return NextResponse.redirect(`${origin}/?error=auth-callback-failed`)
}
