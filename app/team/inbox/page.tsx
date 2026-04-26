// =============================================================================
// PASTE THIS FILE AT (new file):
//
//     app/team/inbox/page.tsx
//
// =============================================================================
//
// PHASE 5.4 — TEAM INBOX UI
//
// Two-pane master-detail interface for Loan Officers to triage borrower
// scenarios. Consumes:
//   - GET    /api/team/inbox             (Phase 5.2)
//   - GET    /api/team/scenarios/[id]    (5.4 detail endpoint)
//   - POST   /api/team/scenarios/[id]/claim
//   - POST   /api/team/scenarios/[id]/release
//   - POST   /api/team/scenarios/[id]/abandon
//
// Behaviors:
//   - Bucket tabs (Assigned / Pending / Claimed / Pool) with live counts.
//   - Click a row → detail loads in right pane (or full-screen on mobile).
//   - Claim opens modal: purpose dropdown (pre-filled from borrower_path),
//     optional target close date, optional property address.
//   - Release uses window.confirm() — quick gate, reversible action.
//   - Abandon opens modal with optional reason textarea + "Are you sure?"
//     gate. Terminal action, so the friction is intentional.
//   - On any successful action: detail closes, inbox refetches, toast
//     confirms (claim toast includes "Open workflow file →" link).
//   - Refresh: manual button + auto-refresh on tab focus.
//   - 401 from any call → redirect to /team (login page).
//
// =============================================================================

'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type Bucket = 'assigned' | 'pending' | 'claimed' | 'pool'
type ScenarioStatus =
  | 'awaiting_assignment'
  | 'assigned_pending_claim'
  | 'claimed'
  | 'abandoned'

type Counts = {
  assigned: number
  pending: number
  claimed: number
  pool: number
}

type Viewer = {
  id: string
  name: string | null
  email: string | null
  role: string
}

type ScenarioListItem = {
  scenarioId: string
  createdAt: string
  updatedAt: string
  status: ScenarioStatus
  assignmentMethod: string | null
  borrowerPath: string | null
  triggerEvent: string | null
  language: string | null
  sourcePage: string | null
  borrower: {
    id: string | null
    name: string | null
    email: string | null
    phone: string | null
    preferredLanguage: string | null
  }
  realtor: {
    id: string
    name: string | null
    email: string | null
    phone: string | null
  } | null
  intakeData: Record<string, unknown>
  scenarioData: Record<string, unknown>
  scenarioSummary: {
    homePrice: number | null
    downPayment: number | null
    estimatedLoanAmount: number | null
    estimatedLtv: number | null
  }
  msgCount: number
  lastMessagePreview: string | null
  claimedAt: string | null
  claimedByWorkflowFileId: string | null
  abandonedAt: string | null
}

type ChatMessage = { role: 'user' | 'assistant'; content: string }

type ScenarioDetail = {
  id: string
  status: ScenarioStatus
  assignment_method: string | null
  borrower_path: string | null
  language: string | null
  intake_data: Record<string, unknown>
  scenario_data: Record<string, unknown>
  conversation: ChatMessage[]
  trigger_event: string | null
  source_page: string | null
  claimed_at: string | null
  claimed_by_workflow_file_id: string | null
  abandoned_at: string | null
  abandoned_reason: string | null
  assigned_loan_officer_id: string | null
  created_at: string
  updated_at: string
  borrower: {
    id: string
    full_name: string | null
    email: string | null
    phone: string | null
    preferred_language: string | null
  } | null
  realtor: {
    id: string
    full_name: string | null
    email: string | null
    phone: string | null
  } | null
}

type Toast =
  | {
      kind: 'success' | 'error' | 'info'
      message: string
      link?: { href: string; label: string }
    }
  | null

type ClaimForm = {
  purpose: string
  targetClose: string
  propertyAddress: string
}

type AbandonForm = {
  reason: string
  confirmed: boolean
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const PURPOSE_OPTIONS = [
  'Purchase',
  'Refinance',
  'Cash-Out Refinance',
  'HELOC',
  'Investment',
] as const

const BUCKET_LABELS: Record<Bucket, string> = {
  assigned: 'Assigned',
  pending: 'Pending Claim',
  claimed: 'Claimed',
  pool: 'Pool',
}

const STATUS_LABELS: Record<ScenarioStatus, string> = {
  awaiting_assignment: 'Pool',
  assigned_pending_claim: 'Pending claim',
  claimed: 'Claimed',
  abandoned: 'Abandoned',
}

const STATUS_COLORS: Record<ScenarioStatus, { bg: string; fg: string }> = {
  awaiting_assignment: { bg: '#f1f5f9', fg: '#475569' },
  assigned_pending_claim: { bg: '#fef3c7', fg: '#92400e' },
  claimed: { bg: '#dbeafe', fg: '#1e40af' },
  abandoned: { bg: '#fee2e2', fg: '#991b1b' },
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function formatCurrency(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value <= 0) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value < 0) return '—'
  return `${Math.round(value * 100)}%`
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  const now = Date.now()
  const seconds = Math.max(0, Math.round((now - then) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.round(days / 30)
  if (months < 12) return `${months}mo ago`
  const years = Math.round(days / 365)
  return `${years}y ago`
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function defaultPurposeFor(borrowerPath: string | null): string {
  if (borrowerPath === 'Refinance') return 'Refinance'
  if (borrowerPath === 'Investment') return 'Investment'
  return 'Purchase'
}

// -----------------------------------------------------------------------------
// Page component
// -----------------------------------------------------------------------------

export default function InboxPage() {
  // Data state
  const [viewer, setViewer] = useState<Viewer | null>(null)
  const [bucket, setBucket] = useState<Bucket>('assigned')
  const [counts, setCounts] = useState<Counts>({
    assigned: 0,
    pending: 0,
    claimed: 0,
    pool: 0,
  })
  const [items, setItems] = useState<ScenarioListItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ScenarioDetail | null>(null)

  // Loading / error
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [topError, setTopError] = useState<string | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)

  // Modals + actions
  const [claimModalOpen, setClaimModalOpen] = useState(false)
  const [abandonModalOpen, setAbandonModalOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)

  const [claimForm, setClaimForm] = useState<ClaimForm>({
    purpose: 'Purchase',
    targetClose: '',
    propertyAddress: '',
  })
  const [abandonForm, setAbandonForm] = useState<AbandonForm>({
    reason: '',
    confirmed: false,
  })

  // Toast
  const [toast, setToast] = useState<Toast>(null)

  // Mobile view toggle
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list')

  // ---------------------------------------------------------------------------
  // Data loaders
  // ---------------------------------------------------------------------------

  const loadInbox = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true)
      else setRefreshing(true)
      setTopError(null)

      try {
        const res = await fetch(`/api/team/inbox?bucket=${bucket}`, {
          method: 'GET',
          credentials: 'include',
        })

        if (res.status === 401) {
          window.location.href = '/team'
          return
        }

        const data = await res.json()
        if (!res.ok || !data?.success) {
          throw new Error(data?.error || 'Failed to load inbox.')
        }

        setViewer(data.viewer)
        setCounts(data.counts)
        setItems(data.items || [])
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to load inbox.'
        setTopError(message)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [bucket]
  )

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true)
    setDetailError(null)
    setDetail(null)

    try {
      const res = await fetch(`/api/team/scenarios/${id}`, {
        method: 'GET',
        credentials: 'include',
      })

      if (res.status === 401) {
        window.location.href = '/team'
        return
      }

      const data = await res.json()
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to load scenario.')
      }

      setDetail(data.scenario as ScenarioDetail)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load scenario.'
      setDetailError(message)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  // Initial load + bucket changes.
  useEffect(() => {
    loadInbox()
  }, [loadInbox])

  // Detail when selection changes.
  useEffect(() => {
    if (selectedId) {
      loadDetail(selectedId)
    } else {
      setDetail(null)
      setDetailError(null)
    }
  }, [selectedId, loadDetail])

  // Refresh on tab focus, throttled to once every 5s.
  const lastFocusRefreshRef = useRef<number>(0)
  useEffect(() => {
    const onFocus = () => {
      const now = Date.now()
      if (now - lastFocusRefreshRef.current < 5000) return
      lastFocusRefreshRef.current = now
      loadInbox({ silent: true })
      if (selectedId) loadDetail(selectedId)
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [loadInbox, loadDetail, selectedId])

  // Toast auto-dismiss after 6 seconds.
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(t)
  }, [toast])

  // ---------------------------------------------------------------------------
  // Selection
  // ---------------------------------------------------------------------------

  const handleSelect = (id: string) => {
    setSelectedId(id)
    setMobileView('detail')
  }

  const handleBackToList = () => {
    setMobileView('list')
  }

  const handleBucketChange = (next: Bucket) => {
    setBucket(next)
    setSelectedId(null)
    setMobileView('list')
  }

  const handleRefresh = () => {
    loadInbox({ silent: true })
    if (selectedId) loadDetail(selectedId)
  }

  // ---------------------------------------------------------------------------
  // Action handlers
  // ---------------------------------------------------------------------------

  const openClaimModal = () => {
    if (!detail) return
    setClaimForm({
      purpose: defaultPurposeFor(detail.borrower_path),
      targetClose: '',
      propertyAddress: '',
    })
    setModalError(null)
    setClaimModalOpen(true)
  }

  const openAbandonModal = () => {
    setAbandonForm({ reason: '', confirmed: false })
    setModalError(null)
    setAbandonModalOpen(true)
  }

  const closeAfterAction = () => {
    setClaimModalOpen(false)
    setAbandonModalOpen(false)
    setActionLoading(false)
    setSelectedId(null)
    setDetail(null)
    setMobileView('list')
  }

  const submitClaim = async () => {
    if (!selectedId) return
    setActionLoading(true)
    setModalError(null)

    try {
      const res = await fetch(`/api/team/scenarios/${selectedId}/claim`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purpose: claimForm.purpose,
          targetClose: claimForm.targetClose || null,
          propertyAddress: claimForm.propertyAddress || null,
        }),
      })

      if (res.status === 401) {
        window.location.href = '/team'
        return
      }

      const data = await res.json()
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to claim scenario.')
      }

      const wfId = data.workflowFile?.id
      const wfNumber = data.workflowFile?.file_number

      closeAfterAction()
      await loadInbox({ silent: true })

      setToast({
        kind: 'success',
        message: wfNumber
          ? `Scenario claimed. Workflow file ${wfNumber} created.`
          : 'Scenario claimed. Workflow file created.',
        link: wfId
          ? { href: `/workflow/${wfId}`, label: 'Open workflow file →' }
          : undefined,
      })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to claim scenario.'
      setModalError(message)
      setActionLoading(false)
    }
  }

  const submitRelease = async () => {
    if (!selectedId) return
    const ok = window.confirm(
      'Release this scenario back to your pending bucket? The workflow file will be archived.'
    )
    if (!ok) return

    setActionLoading(true)

    try {
      const res = await fetch(`/api/team/scenarios/${selectedId}/release`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      if (res.status === 401) {
        window.location.href = '/team'
        return
      }

      const data = await res.json()
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to release scenario.')
      }

      closeAfterAction()
      await loadInbox({ silent: true })
      setToast({
        kind: 'success',
        message: 'Scenario released. Workflow file archived.',
      })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to release scenario.'
      setActionLoading(false)
      setToast({ kind: 'error', message })
    }
  }

  const submitAbandon = async () => {
    if (!selectedId) return
    if (!abandonForm.confirmed) {
      setModalError('Please confirm the abandon action.')
      return
    }

    setActionLoading(true)
    setModalError(null)

    try {
      const res = await fetch(`/api/team/scenarios/${selectedId}/abandon`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: abandonForm.reason || null,
        }),
      })

      if (res.status === 401) {
        window.location.href = '/team'
        return
      }

      const data = await res.json()
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to abandon scenario.')
      }

      closeAfterAction()
      await loadInbox({ silent: true })
      setToast({ kind: 'success', message: 'Scenario abandoned.' })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to abandon scenario.'
      setModalError(message)
      setActionLoading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------

  const detailWorkflowHref = useMemo(() => {
    if (!detail?.claimed_by_workflow_file_id) return null
    return `/workflow/${detail.claimed_by_workflow_file_id}`
  }, [detail])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <main style={styles.page}>
      <style>{responsiveCss}</style>

      <div className="bf-inbox-wrap" style={styles.pageWrap}>
        <header className="bf-inbox-header" style={styles.header}>
          <div>
            <h1 style={styles.title}>Inbox</h1>
            <p style={styles.subtitle}>
              {viewer
                ? `Welcome, ${viewer.name || viewer.email}`
                : 'Loading…'}
            </p>
          </div>

          <button
            onClick={handleRefresh}
            disabled={loading || refreshing}
            style={{
              ...styles.refreshButton,
              cursor: loading || refreshing ? 'not-allowed' : 'pointer',
              opacity: loading || refreshing ? 0.6 : 1,
            }}
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </header>

        {topError && <div style={styles.errorBox}>{topError}</div>}

        <div className="bf-bucket-tabs" style={styles.bucketTabs}>
          {(Object.keys(BUCKET_LABELS) as Bucket[]).map((b) => {
            const active = b === bucket
            const count = counts[b]
            return (
              <button
                key={b}
                onClick={() => handleBucketChange(b)}
                style={{
                  ...styles.bucketTab,
                  borderBottomColor: active ? '#263366' : 'transparent',
                  color: active ? '#263366' : '#64748b',
                  fontWeight: active ? 700 : 500,
                }}
              >
                {BUCKET_LABELS[b]}
                <span
                  style={{
                    ...styles.bucketBadge,
                    backgroundColor: active ? '#263366' : '#e2e8f0',
                    color: active ? '#ffffff' : '#475569',
                  }}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {bucket === 'pool' && (
          <div style={styles.poolNotice}>
            Pool scenarios are routed by Beyond Intelligence. They become
            actionable once an LO is assigned.
          </div>
        )}

        <div
          className="bf-inbox-grid"
          data-mobile-view={mobileView}
          style={styles.mainGrid}
        >
          <section
            className="bf-list-pane"
            data-active={mobileView === 'list'}
            style={styles.listPane}
          >
            {loading && items.length === 0 ? (
              <div style={styles.placeholder}>Loading inbox…</div>
            ) : items.length === 0 ? (
              <div style={styles.placeholder}>{emptyMessageFor(bucket)}</div>
            ) : (
              items.map((item) => (
                <ScenarioCard
                  key={item.scenarioId}
                  item={item}
                  selected={selectedId === item.scenarioId}
                  onSelect={() => handleSelect(item.scenarioId)}
                />
              ))
            )}
          </section>

          <section
            className="bf-detail-pane"
            data-active={mobileView === 'detail'}
            style={styles.detailPane}
          >
            <button
              className="bf-back-button"
              onClick={handleBackToList}
              style={styles.backButton}
            >
              ← Back to list
            </button>

            {!selectedId && (
              <div style={styles.placeholder}>
                Select a scenario from the list to view details.
              </div>
            )}

            {selectedId && detailLoading && (
              <div style={styles.placeholder}>Loading scenario…</div>
            )}

            {selectedId && detailError && (
              <div style={styles.errorBox}>{detailError}</div>
            )}

            {selectedId && !detailLoading && !detailError && detail && (
              <DetailView
                detail={detail}
                workflowHref={detailWorkflowHref}
                onClaim={openClaimModal}
                onRelease={submitRelease}
                onAbandon={openAbandonModal}
                actionLoading={actionLoading}
              />
            )}
          </section>
        </div>
      </div>

      {claimModalOpen && detail && (
        <ClaimModal
          detail={detail}
          form={claimForm}
          onChange={setClaimForm}
          onConfirm={submitClaim}
          onCancel={() => setClaimModalOpen(false)}
          loading={actionLoading}
          error={modalError}
        />
      )}

      {abandonModalOpen && detail && (
        <AbandonModal
          detail={detail}
          form={abandonForm}
          onChange={setAbandonForm}
          onConfirm={submitAbandon}
          onCancel={() => setAbandonModalOpen(false)}
          loading={actionLoading}
          error={modalError}
        />
      )}

      {toast && <ToastView toast={toast} onDismiss={() => setToast(null)} />}
    </main>
  )
}

// -----------------------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------------------

function ScenarioCard({
  item,
  selected,
  onSelect,
}: {
  item: ScenarioListItem
  selected: boolean
  onSelect: () => void
}) {
  const colors = STATUS_COLORS[item.status]

  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        ...styles.scenarioCard,
        backgroundColor: selected ? '#eff6ff' : '#ffffff',
        borderColor: selected ? '#0096C7' : '#e2e8f0',
        cursor: 'pointer',
      }}
    >
      <div style={styles.scenarioCardHeader}>
        <div style={styles.scenarioCardName}>
          {item.borrower.name || 'Unnamed borrower'}
        </div>
        <span
          style={{
            ...styles.statusPill,
            backgroundColor: colors.bg,
            color: colors.fg,
          }}
        >
          {STATUS_LABELS[item.status]}
        </span>
      </div>

      <div style={styles.scenarioCardMeta}>
        {item.borrowerPath || '—'} · {formatCurrency(item.scenarioSummary.homePrice)}
        {' · '}
        {formatRelativeTime(item.updatedAt)}
      </div>

      {item.lastMessagePreview && (
        <div style={styles.scenarioCardPreview}>
          {item.lastMessagePreview}
        </div>
      )}

      <div style={styles.scenarioCardFooter}>
        <span>{item.msgCount} message{item.msgCount === 1 ? '' : 's'}</span>
        {item.realtor && <span>· Realtor: {item.realtor.name}</span>}
      </div>
    </button>
  )
}

function DetailView({
  detail,
  workflowHref,
  onClaim,
  onRelease,
  onAbandon,
  actionLoading,
}: {
  detail: ScenarioDetail
  workflowHref: string | null
  onClaim: () => void
  onRelease: () => void
  onAbandon: () => void
  actionLoading: boolean
}) {
  const colors = STATUS_COLORS[detail.status]
  const sd = detail.scenario_data as { homePrice?: unknown; downPayment?: unknown }
  const id = detail.intake_data as {
    estimatedCreditScore?: unknown
    monthlyIncome?: unknown
    monthlyDebt?: unknown
    currentState?: unknown
    targetState?: unknown
  }

  const homePrice = Number(sd?.homePrice) || null
  const downPayment = Number(sd?.downPayment) || null
  const loanAmount =
    homePrice && downPayment !== null && downPayment >= 0
      ? Math.max(homePrice - downPayment, 0)
      : null
  const ltv =
    homePrice && homePrice > 0 && loanAmount !== null
      ? loanAmount / homePrice
      : null

  return (
    <>
      <div style={styles.detailHeader}>
        <div>
          <div style={styles.detailEyebrow}>Scenario</div>
          <h2 style={styles.detailTitle}>
            {detail.borrower?.full_name || 'Unnamed borrower'}
          </h2>
          <div style={styles.detailSubtitle}>
            {detail.borrower_path || '—'} · Created{' '}
            {formatDate(detail.created_at)}
          </div>
        </div>
        <span
          style={{
            ...styles.statusPill,
            backgroundColor: colors.bg,
            color: colors.fg,
          }}
        >
          {STATUS_LABELS[detail.status]}
        </span>
      </div>

      <section style={styles.detailSection}>
        <div style={styles.sectionHeader}>Borrower</div>
        <FieldRow label="Email" value={detail.borrower?.email} />
        <FieldRow label="Phone" value={detail.borrower?.phone} />
        <FieldRow
          label="Preferred language"
          value={detail.borrower?.preferred_language}
        />
        <FieldRow
          label="Estimated credit"
          value={fmt(id?.estimatedCreditScore)}
        />
        <FieldRow
          label="Monthly income"
          value={
            Number(id?.monthlyIncome) > 0
              ? formatCurrency(Number(id?.monthlyIncome))
              : null
          }
        />
        <FieldRow
          label="Monthly debt"
          value={
            Number(id?.monthlyDebt) > 0
              ? formatCurrency(Number(id?.monthlyDebt))
              : null
          }
        />
        <FieldRow label="Current state" value={fmt(id?.currentState)} />
        <FieldRow label="Target state" value={fmt(id?.targetState)} />
      </section>

      {detail.realtor && (
        <section style={styles.detailSection}>
          <div style={styles.sectionHeader}>Realtor</div>
          <FieldRow label="Name" value={detail.realtor.full_name} />
          <FieldRow label="Email" value={detail.realtor.email} />
          <FieldRow label="Phone" value={detail.realtor.phone} />
        </section>
      )}

      <section style={styles.detailSection}>
        <div style={styles.sectionHeader}>Scenario</div>
        <FieldRow label="Home price" value={formatCurrency(homePrice)} />
        <FieldRow label="Down payment" value={formatCurrency(downPayment)} />
        <FieldRow label="Estimated loan" value={formatCurrency(loanAmount)} />
        <FieldRow label="Estimated LTV" value={formatPercent(ltv)} />
      </section>

      {detail.status === 'claimed' && (
        <section style={styles.detailSection}>
          <div style={styles.sectionHeader}>Claim</div>
          <FieldRow label="Claimed at" value={formatDate(detail.claimed_at)} />
          {workflowHref && (
            <FieldRow
              label="Workflow file"
              value={
                <a href={workflowHref} style={styles.linkText}>
                  Open workflow file →
                </a>
              }
            />
          )}
        </section>
      )}

      {detail.status === 'abandoned' && (
        <section style={styles.detailSection}>
          <div style={styles.sectionHeader}>Abandoned</div>
          <FieldRow
            label="Abandoned at"
            value={formatDate(detail.abandoned_at)}
          />
          <FieldRow
            label="Reason"
            value={detail.abandoned_reason || 'No reason provided.'}
          />
        </section>
      )}

      <section style={styles.detailSection}>
        <div style={styles.sectionHeader}>
          Conversation ({detail.conversation?.length || 0} messages)
        </div>
        <div style={styles.transcript}>
          {(detail.conversation || []).map((msg, i) => (
            <div
              key={i}
              style={{
                ...styles.transcriptBubble,
                alignSelf:
                  msg.role === 'user' ? 'flex-end' : 'stretch',
                backgroundColor:
                  msg.role === 'user' ? '#263366' : '#f8fbff',
                color: msg.role === 'user' ? '#ffffff' : '#1e293b',
                border:
                  msg.role === 'user'
                    ? '1px solid #263366'
                    : '1px solid #dbeafe',
              }}
            >
              <div style={styles.transcriptRole}>
                {msg.role === 'user' ? 'Borrower' : 'Finley'}
              </div>
              <div>{msg.content}</div>
            </div>
          ))}
          {(!detail.conversation || detail.conversation.length === 0) && (
            <div style={styles.placeholder}>
              No conversation captured.
            </div>
          )}
        </div>
      </section>

      <ActionBar
        status={detail.status}
        actionLoading={actionLoading}
        onClaim={onClaim}
        onRelease={onRelease}
        onAbandon={onAbandon}
        workflowHref={workflowHref}
      />
    </>
  )
}

function ActionBar({
  status,
  actionLoading,
  onClaim,
  onRelease,
  onAbandon,
  workflowHref,
}: {
  status: ScenarioStatus
  actionLoading: boolean
  onClaim: () => void
  onRelease: () => void
  onAbandon: () => void
  workflowHref: string | null
}) {
  if (status === 'awaiting_assignment') {
    return (
      <div style={styles.actionBar}>
        <div style={styles.actionBarMessage}>
          Pool scenarios are assigned by Beyond Intelligence.
        </div>
      </div>
    )
  }

  if (status === 'abandoned') {
    return (
      <div style={styles.actionBar}>
        <div style={styles.actionBarMessage}>
          This scenario is terminal. Contact an admin to restore.
        </div>
      </div>
    )
  }

  return (
    <div style={styles.actionBar}>
      {status === 'assigned_pending_claim' && (
        <button
          onClick={onClaim}
          disabled={actionLoading}
          style={{
            ...styles.primaryAction,
            cursor: actionLoading ? 'not-allowed' : 'pointer',
            opacity: actionLoading ? 0.6 : 1,
          }}
        >
          Claim
        </button>
      )}

      {status === 'claimed' && workflowHref && (
        <a href={workflowHref} style={styles.primaryActionLink}>
          Open workflow file
        </a>
      )}

      {status === 'claimed' && (
        <button
          onClick={onRelease}
          disabled={actionLoading}
          style={{
            ...styles.secondaryAction,
            cursor: actionLoading ? 'not-allowed' : 'pointer',
            opacity: actionLoading ? 0.6 : 1,
          }}
        >
          Release
        </button>
      )}

      <button
        onClick={onAbandon}
        disabled={actionLoading}
        style={{
          ...styles.destructiveAction,
          cursor: actionLoading ? 'not-allowed' : 'pointer',
          opacity: actionLoading ? 0.6 : 1,
        }}
      >
        Abandon
      </button>
    </div>
  )
}

function FieldRow({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div style={styles.fieldRow}>
      <div style={styles.fieldLabel}>{label}</div>
      <div style={styles.fieldValue}>{value || '—'}</div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Modals
// -----------------------------------------------------------------------------

function ClaimModal({
  detail,
  form,
  onChange,
  onConfirm,
  onCancel,
  loading,
  error,
}: {
  detail: ScenarioDetail
  form: ClaimForm
  onChange: (next: ClaimForm) => void
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
  error: string | null
}) {
  return (
    <div style={styles.modalOverlay} onClick={onCancel}>
      <div
        style={styles.modalCard}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h3 style={styles.modalTitle}>Claim scenario</h3>
        <p style={styles.modalDescription}>
          Creating a workflow file for{' '}
          <strong>{detail.borrower?.full_name || 'this borrower'}</strong>.
          Purpose is required; close date and address are optional.
        </p>

        <div style={styles.modalFieldGroup}>
          <label style={styles.modalLabel}>Purpose *</label>
          <select
            value={form.purpose}
            onChange={(e) => onChange({ ...form, purpose: e.target.value })}
            style={styles.modalInput}
            disabled={loading}
          >
            {PURPOSE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <div style={styles.modalFieldGroup}>
          <label style={styles.modalLabel}>Target close date (optional)</label>
          <input
            type="date"
            value={form.targetClose}
            onChange={(e) =>
              onChange({ ...form, targetClose: e.target.value })
            }
            style={styles.modalInput}
            disabled={loading}
          />
        </div>

        <div style={styles.modalFieldGroup}>
          <label style={styles.modalLabel}>Property address (optional)</label>
          <input
            type="text"
            value={form.propertyAddress}
            onChange={(e) =>
              onChange({ ...form, propertyAddress: e.target.value })
            }
            placeholder="123 Main St, City, ST"
            style={styles.modalInput}
            disabled={loading}
          />
        </div>

        {error && <div style={styles.modalError}>{error}</div>}

        <div style={styles.modalActions}>
          <button
            onClick={onCancel}
            disabled={loading}
            style={{
              ...styles.modalSecondaryButton,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading || !form.purpose}
            style={{
              ...styles.modalPrimaryButton,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Claiming…' : 'Confirm claim'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AbandonModal({
  detail,
  form,
  onChange,
  onConfirm,
  onCancel,
  loading,
  error,
}: {
  detail: ScenarioDetail
  form: AbandonForm
  onChange: (next: AbandonForm) => void
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
  error: string | null
}) {
  return (
    <div style={styles.modalOverlay} onClick={onCancel}>
      <div
        style={styles.modalCard}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h3 style={styles.modalTitle}>Abandon scenario</h3>
        <p style={styles.modalDescription}>
          This is terminal. Abandoning{' '}
          <strong>{detail.borrower?.full_name || 'this scenario'}</strong>{' '}
          cannot be undone from the inbox. If the scenario was claimed, the
          workflow file will be archived.
        </p>

        <div style={styles.modalFieldGroup}>
          <label style={styles.modalLabel}>Reason (optional)</label>
          <textarea
            value={form.reason}
            onChange={(e) => onChange({ ...form, reason: e.target.value })}
            placeholder="Why is this scenario being abandoned?"
            rows={4}
            style={{ ...styles.modalInput, resize: 'vertical' }}
            disabled={loading}
          />
        </div>

        <label style={styles.modalCheckboxRow}>
          <input
            type="checkbox"
            checked={form.confirmed}
            onChange={(e) =>
              onChange({ ...form, confirmed: e.target.checked })
            }
            disabled={loading}
          />
          I understand this action is terminal.
        </label>

        {error && <div style={styles.modalError}>{error}</div>}

        <div style={styles.modalActions}>
          <button
            onClick={onCancel}
            disabled={loading}
            style={{
              ...styles.modalSecondaryButton,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading || !form.confirmed}
            style={{
              ...styles.modalDestructiveButton,
              cursor:
                loading || !form.confirmed ? 'not-allowed' : 'pointer',
              opacity: loading || !form.confirmed ? 0.6 : 1,
            }}
          >
            {loading ? 'Abandoning…' : 'Confirm abandon'}
          </button>
        </div>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Toast
// -----------------------------------------------------------------------------

function ToastView({
  toast,
  onDismiss,
}: {
  toast: NonNullable<Toast>
  onDismiss: () => void
}) {
  const bg =
    toast.kind === 'success'
      ? '#0a7d4a'
      : toast.kind === 'error'
      ? '#9f1239'
      : '#263366'

  return (
    <div style={{ ...styles.toast, backgroundColor: bg }} role="status">
      <div style={styles.toastMessage}>{toast.message}</div>
      {toast.link && (
        <a href={toast.link.href} style={styles.toastLink}>
          {toast.link.label}
        </a>
      )}
      <button
        onClick={onDismiss}
        style={styles.toastDismiss}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Helpers used by JSX
// -----------------------------------------------------------------------------

function emptyMessageFor(bucket: Bucket): string {
  if (bucket === 'assigned')
    return 'No scenarios assigned to you yet. New scenarios appear here when borrowers select you.'
  if (bucket === 'pending')
    return 'No pending claims. New scenarios assigned to you will appear here.'
  if (bucket === 'claimed')
    return 'No active claims. Claimed scenarios appear here while you work them.'
  return 'No scenarios in the assignment pool.'
}

function fmt(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const s = String(value).trim()
  return s || null
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const responsiveCss = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }

  .bf-back-button { display: none; }

  @media (max-width: 1024px) {
    .bf-inbox-grid {
      grid-template-columns: 1fr !important;
    }
    .bf-inbox-grid[data-mobile-view="list"] .bf-detail-pane { display: none; }
    .bf-inbox-grid[data-mobile-view="detail"] .bf-list-pane { display: none; }
    .bf-inbox-grid[data-mobile-view="detail"] .bf-back-button { display: inline-flex !important; }
  }

  @media (max-width: 640px) {
    .bf-inbox-wrap { padding: 16px 12px !important; }
    .bf-inbox-header { flex-direction: column; align-items: stretch !important; }
    .bf-bucket-tabs { flex-wrap: wrap; }
  }
`

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#f4f6fb',
    fontFamily: 'Inter, Arial, Helvetica, sans-serif',
    color: '#1f2937',
  },
  pageWrap: {
    maxWidth: 1400,
    margin: '0 auto',
    padding: '24px 20px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
    flexWrap: 'wrap',
    gap: 12,
  },
  title: {
    margin: 0,
    fontSize: 28,
    fontWeight: 700,
    color: '#263366',
  },
  subtitle: {
    margin: '4px 0 0 0',
    fontSize: 14,
    color: '#475569',
  },
  refreshButton: {
    backgroundColor: '#ffffff',
    color: '#263366',
    border: '1px solid #cbd5e1',
    borderRadius: 10,
    padding: '10px 16px',
    fontSize: 14,
    fontWeight: 600,
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    color: '#991b1b',
    border: '1px solid #fecaca',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    fontSize: 14,
  },
  bucketTabs: {
    display: 'flex',
    gap: 4,
    marginBottom: 16,
    borderBottom: '1px solid #e2e8f0',
    overflowX: 'auto',
  },
  bucketTab: {
    background: 'transparent',
    border: 'none',
    borderBottom: '3px solid transparent',
    padding: '12px 16px',
    fontSize: 14,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    whiteSpace: 'nowrap',
  },
  bucketBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 22,
    height: 22,
    padding: '0 8px',
    borderRadius: 11,
    fontSize: 12,
    fontWeight: 700,
  },
  poolNotice: {
    backgroundColor: '#f8fbff',
    border: '1px solid #dbeafe',
    color: '#1e40af',
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    marginBottom: 14,
  },
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1.4fr',
    gap: 16,
    alignItems: 'start',
  },
  listPane: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    boxShadow: '0 6px 18px rgba(15, 23, 42, 0.06)',
    maxHeight: 'calc(100vh - 220px)',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  detailPane: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    boxShadow: '0 6px 18px rgba(15, 23, 42, 0.06)',
    maxHeight: 'calc(100vh - 220px)',
    overflowY: 'auto',
  },
  backButton: {
    background: 'transparent',
    border: 'none',
    color: '#263366',
    fontWeight: 600,
    fontSize: 14,
    padding: '0 0 12px 0',
    cursor: 'pointer',
  },
  scenarioCard: {
    width: '100%',
    textAlign: 'left',
    border: '1px solid #e2e8f0',
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#ffffff',
    display: 'block',
  },
  scenarioCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  scenarioCardName: {
    fontSize: 15,
    fontWeight: 700,
    color: '#111827',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  scenarioCardMeta: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 8,
  },
  scenarioCardPreview: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 1.5,
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  scenarioCardFooter: {
    display: 'flex',
    gap: 6,
    fontSize: 12,
    color: '#64748b',
  },
  statusPill: {
    display: 'inline-block',
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  detailHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 18,
    paddingBottom: 18,
    borderBottom: '1px solid #f1f5f9',
  },
  detailEyebrow: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: '#64748b',
    fontWeight: 700,
    marginBottom: 4,
  },
  detailTitle: {
    margin: 0,
    fontSize: 22,
    fontWeight: 700,
    color: '#263366',
  },
  detailSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#475569',
  },
  detailSection: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottom: '1px solid #f1f5f9',
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: 700,
    color: '#263366',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  fieldRow: {
    display: 'grid',
    gridTemplateColumns: '160px 1fr',
    gap: 12,
    padding: '6px 0',
    fontSize: 14,
  },
  fieldLabel: {
    color: '#64748b',
  },
  fieldValue: {
    color: '#111827',
    wordBreak: 'break-word',
  },
  linkText: {
    color: '#0096C7',
    textDecoration: 'none',
    fontWeight: 600,
  },
  transcript: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    maxHeight: 360,
    overflowY: 'auto',
    padding: 4,
  },
  transcriptBubble: {
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
    maxWidth: '92%',
  },
  transcriptRole: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    opacity: 0.7,
  },
  actionBar: {
    position: 'sticky',
    bottom: 0,
    background: '#ffffff',
    paddingTop: 16,
    marginTop: 16,
    borderTop: '1px solid #f1f5f9',
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionBarMessage: {
    color: '#475569',
    fontSize: 14,
    fontStyle: 'italic',
  },
  primaryAction: {
    backgroundColor: '#263366',
    color: '#ffffff',
    border: 'none',
    borderRadius: 10,
    padding: '12px 22px',
    fontSize: 14,
    fontWeight: 700,
  },
  primaryActionLink: {
    backgroundColor: '#0096C7',
    color: '#ffffff',
    textDecoration: 'none',
    border: 'none',
    borderRadius: 10,
    padding: '12px 22px',
    fontSize: 14,
    fontWeight: 700,
    display: 'inline-flex',
    alignItems: 'center',
  },
  secondaryAction: {
    backgroundColor: '#ffffff',
    color: '#263366',
    border: '1px solid #263366',
    borderRadius: 10,
    padding: '12px 22px',
    fontSize: 14,
    fontWeight: 700,
  },
  destructiveAction: {
    backgroundColor: '#ffffff',
    color: '#b91c1c',
    border: '1px solid #b91c1c',
    borderRadius: 10,
    padding: '12px 22px',
    fontSize: 14,
    fontWeight: 700,
  },
  placeholder: {
    backgroundColor: '#f8fafc',
    border: '1px dashed #cbd5e1',
    borderRadius: 12,
    padding: 18,
    color: '#475569',
    fontSize: 14,
    lineHeight: 1.6,
    textAlign: 'center',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 50,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 24,
    width: '100%',
    maxWidth: 520,
    boxShadow: '0 20px 50px rgba(15, 23, 42, 0.25)',
  },
  modalTitle: {
    margin: '0 0 8px 0',
    fontSize: 22,
    fontWeight: 700,
    color: '#263366',
  },
  modalDescription: {
    margin: '0 0 18px 0',
    fontSize: 14,
    lineHeight: 1.6,
    color: '#475569',
  },
  modalFieldGroup: {
    marginBottom: 14,
  },
  modalLabel: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: '#334155',
    marginBottom: 6,
  },
  modalInput: {
    width: '100%',
    boxSizing: 'border-box',
    border: '1px solid #cbd5e1',
    borderRadius: 10,
    padding: '11px 13px',
    fontSize: 14,
    backgroundColor: '#ffffff',
    color: '#111827',
  },
  modalCheckboxRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    fontSize: 14,
    color: '#334155',
    marginTop: 4,
    marginBottom: 14,
  },
  modalError: {
    backgroundColor: '#fef2f2',
    color: '#991b1b',
    border: '1px solid #fecaca',
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    marginBottom: 14,
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  modalSecondaryButton: {
    backgroundColor: '#ffffff',
    color: '#475569',
    border: '1px solid #cbd5e1',
    borderRadius: 10,
    padding: '11px 20px',
    fontSize: 14,
    fontWeight: 600,
  },
  modalPrimaryButton: {
    backgroundColor: '#263366',
    color: '#ffffff',
    border: 'none',
    borderRadius: 10,
    padding: '11px 20px',
    fontSize: 14,
    fontWeight: 700,
  },
  modalDestructiveButton: {
    backgroundColor: '#b91c1c',
    color: '#ffffff',
    border: 'none',
    borderRadius: 10,
    padding: '11px 20px',
    fontSize: 14,
    fontWeight: 700,
  },
  toast: {
    position: 'fixed',
    bottom: 24,
    right: 24,
    color: '#ffffff',
    borderRadius: 12,
    padding: '14px 16px',
    boxShadow: '0 12px 28px rgba(15, 23, 42, 0.25)',
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    zIndex: 60,
    maxWidth: 420,
  },
  toastMessage: {
    fontSize: 14,
    lineHeight: 1.5,
  },
  toastLink: {
    color: '#ffffff',
    textDecoration: 'underline',
    fontWeight: 700,
    fontSize: 14,
    whiteSpace: 'nowrap',
  },
  toastDismiss: {
    background: 'transparent',
    border: 'none',
    color: '#ffffff',
    fontSize: 24,
    lineHeight: 1,
    cursor: 'pointer',
    padding: 0,
    marginLeft: 'auto',
  },
}

