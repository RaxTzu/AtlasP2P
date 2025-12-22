import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || !user.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Check ADMIN_EMAILS environment variable
    if (!process.env.ADMIN_EMAILS) {
      console.warn('ADMIN_EMAILS environment variable not set');
      return NextResponse.json({ error: 'Not admin' }, { status: 403 });
    }

    const adminEmails = process.env.ADMIN_EMAILS.split(',').map(email => email.trim());
    const isAdmin = adminEmails.includes(user.email);

    if (!isAdmin) {
      return NextResponse.json({ error: 'Not admin' }, { status: 403 });
    }

    return NextResponse.json({ isAdmin: true });
  } catch (error) {
    console.error('Admin check error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
