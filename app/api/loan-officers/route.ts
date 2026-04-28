// app/api/loan-officers/route.ts
//
// Public read-only endpoint for the borrower-facing officer picker.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export type PublicLoanOfficer = {
  id: string;
  name: string;
  nmls: string;
  email: string;
  assistantEmail: string;
  mobile: string;
  assistantMobile: string;
  applyUrl: string;
  scheduleUrl: string;
  isDefaultRouting: boolean;
};

type TeamUserRow = {
  id: string;
  full_name: string | null;
  nmls: string | null;
  email: string | null;
  assistant_email: string | null;
  mobile: string | null;
  phone: string | null;
  assistant_mobile: string | null;
  apply_url: string | null;
  schedule_url: string | null;
  calendly: string | null;
  is_default_routing: boolean | null;
  role: string | null;
  show_in_borrower_picker: boolean | null;
  is_active: boolean | null;
};

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { data, error } = await supabase
    .from('team_users')
    .select(
      'id, full_name, nmls, email, assistant_email, mobile, phone, assistant_mobile, apply_url, schedule_url, calendly, is_default_routing, role, show_in_borrower_picker, is_active',
    )
    .eq('is_active', true)
    .eq('show_in_borrower_picker', true)
    .eq('role', 'Loan Officer')
    .order('is_default_routing', { ascending: true })
    .order('full_name', { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: 'lookup_failed', detail: error.message },
      { status: 500 },
    );
  }

  const rows = (data ?? []) as unknown as TeamUserRow[];

  const officers: PublicLoanOfficer[] = rows.map((r) => ({
    id: r.id,
    name: r.full_name ?? '',
    nmls: r.nmls ?? '',
    email: r.email ?? '',
    assistantEmail: r.assistant_email ?? '',
    mobile: r.mobile ?? r.phone ?? '',
    assistantMobile: r.assistant_mobile ?? '',
    applyUrl: r.apply_url ?? 'https://www.beyondfinancing.com/apply-now',
    scheduleUrl:
      r.schedule_url ?? r.calendly ?? 'https://www.beyondfinancing.com',
    isDefaultRouting: Boolean(r.is_default_routing),
  }));

  // Default routing always last so it functions as the "I don't know" fallback
  const sorted = [
    ...officers.filter((o) => !o.isDefaultRouting),
    ...officers.filter((o) => o.isDefaultRouting),
  ];

  return NextResponse.json({ officers: sorted });
}
