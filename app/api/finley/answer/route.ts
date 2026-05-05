import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySessionToken } from '@/lib/team-auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/finley/answer
 *
 * Saves a borrower/LO answer to a Finley discovery question.
 *
 * Body:
 *   {
 *     scenario_id: string (uuid),
 *     question_key: string (must exist in finley_question_bank with active=true),
 *     answer_value: any (JSON; validated loosely here, schema-tightened in Phase 4-2),
 *     answered_by_role: 'borrower' | 'loan_officer' | 'system'
 *   }
 *
 * Auth: bf_team_session cookie required (LO/team only — borrower-facing answer
 *       intake will be added in Phase 4-2 via the borrower handoff flow).
 *
 * Response 200:
 *   { success: true, saved: { ...row }, next_question_hint: string | null }
 *
 * Response 400/401/500 with { error: string }
 */
export async function POST(req: NextRequest) {
  try {
    // ---- 1. Auth gate ---------------------------------------------------
    const cookieStore = await cookies();
    const token = cookieStore.get('bf_team_session')?.value;
    if (!token) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    const session = await verifySessionToken(token);
    if (!session || !session.tenantId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    // ---- 2. Body validation --------------------------------------------
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
    }

    const { scenario_id, question_key, answer_value, answered_by_role } = body || {};

    if (!scenario_id || typeof scenario_id !== 'string') {
      return NextResponse.json({ error: 'scenario_id_required' }, { status: 400 });
    }
    // Loose UUID shape check
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(scenario_id)) {
      return NextResponse.json({ error: 'scenario_id_invalid_uuid' }, { status: 400 });
    }
    if (!question_key || typeof question_key !== 'string') {
      return NextResponse.json({ error: 'question_key_required' }, { status: 400 });
    }
    if (typeof answer_value === 'undefined') {
      return NextResponse.json({ error: 'answer_value_required' }, { status: 400 });
    }
    const ALLOWED_ROLES = ['borrower', 'loan_officer', 'system'];
    if (!answered_by_role || !ALLOWED_ROLES.includes(answered_by_role)) {
      return NextResponse.json({ error: 'answered_by_role_invalid' }, { status: 400 });
    }

    // ---- 3. Whitelist question_key against active question bank --------
    const { data: q, error: qErr } = await supabaseAdmin
      .from('finley_question_bank')
      .select('question_key, active')
      .eq('question_key', question_key)
      .eq('active', true)
      .maybeSingle();

    if (qErr) {
      return NextResponse.json(
        { error: 'question_lookup_failed', detail: qErr.message },
        { status: 500 }
      );
    }
    if (!q) {
      return NextResponse.json({ error: 'question_key_unknown_or_inactive' }, { status: 400 });
    }

    // ---- 4. Upsert answer ----------------------------------------------
    // UNIQUE (tenant_id, scenario_id, question_key) — see Phase 2b migration.
    const upsertRow = {
      tenant_id: session.tenantId,
      scenario_id,
      question_key,
      answer_value,
      answered_by_role,
      answered_at: new Date().toISOString(),
    };

    const { data: saved, error: upErr } = await supabaseAdmin
      .from('scenario_qualifying_answers')
      .upsert(upsertRow, { onConflict: 'tenant_id,scenario_id,question_key' })
      .select()
      .single();

    if (upErr) {
      return NextResponse.json(
        { error: 'upsert_failed', detail: upErr.message },
        { status: 500 }
      );
    }

    // ---- 5. Hint at the next question (best-effort, non-fatal) ---------
    let next_question_hint: string | null = null;
    try {
      const { data: answered } = await supabaseAdmin
        .from('scenario_qualifying_answers')
        .select('question_key')
        .eq('tenant_id', session.tenantId)
        .eq('scenario_id', scenario_id);

      const answeredKeys = new Set((answered || []).map((r: any) => r.question_key));

      const { data: nextRow } = await supabaseAdmin
        .from('finley_question_bank')
        .select('question_key, ask_order')
        .eq('active', true)
        .order('ask_order', { ascending: true });

      const next = (nextRow || []).find((r: any) => !answeredKeys.has(r.question_key));
      next_question_hint = next ? next.question_key : null;
    } catch {
      next_question_hint = null;
    }

    return NextResponse.json({
      success: true,
      saved,
      next_question_hint,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: 'internal_error', detail: e?.message || String(e) },
      { status: 500 }
    );
  }
}
