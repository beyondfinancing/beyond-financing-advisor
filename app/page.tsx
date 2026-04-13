'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

type PreferredLanguage = 'English' | 'Português' | 'Español'
type LoanOfficerId = 'finley' | 'sandro' | 'warren'
type SummaryTrigger = 'ai' | 'apply' | 'schedule' | 'contact'

type LeadForm = {
  fullName: string
  email: string
  phone: string
  preferredLanguage: PreferredLanguage
  loanOfficer: LoanOfficerId
}

type TranslationSet = {
  heroTitle: string
  heroSubtitle: string
  stayConnectedTitle: string
  stayConnectedSubtitle: string
  fullNamePlaceholder: string
  emailPlaceholder: string
  phonePlaceholder: string
  languageLabel: string
  loanOfficerLabel: string
  languageEnglish: string
  languagePortuguese: string
  languageSpanish: string
  loanOfficerFinley: string
  loanOfficerSandro: string
  loanOfficerWarren: string
  leadError: string
  unlockButton: string
  savingButton: string
  unlockedMessage: string
  chatLockedTitle: string
  chatLockedSubtitle: string
  advisorName: string
  advisorSubtitle: string
  tryAsking: string
  example1: string
  example2: string
  example3: string
  textareaPlaceholder: string
  sendButton: string
  thinking: string
  readyTitle: string
  readySubtitle: string
  startApplication: string
  scheduleConsultation: string
  talkToBeyond: string
  preapprovalNote: string
  disclaimer: string
  genericLeadFailure: string
  genericConnectionFailure: string
  genericAiFailure: string
  genericAiConnectionFailure: string
}

const START_APPLICATION_URL = 'https://www.beyondfinancing.com/apply-now'
const SCHEDULE_CONSULTATION_URL = 'https://calendly.com/sandropansini'
const TALK_TO_BEYOND_URL = 'https://www.beyondfinancing.com'
const SUMMARY_TRIGGER_MARKER = '[[FINLEY_SEND_SUMMARY]]'

const loanOfficerOptions: Record<
  LoanOfficerId,
  {
    email: string
    label: Record<PreferredLanguage, string>
  }
> = {
  finley: {
    email: 'finley@beyondfinancing.com',
    label: {
      English: 'Finley Beyond (If None Below)',
      Português: 'Finley Beyond (Se Nenhum Abaixo)',
      Español: 'Finley Beyond (Si Ninguno Abajo)',
    },
  },
  sandro: {
    email: 'pansini@beyondfinancing.com',
    label: {
      English: 'Sandro Pansini Souza',
      Português: 'Sandro Pansini Souza',
      Español: 'Sandro Pansini Souza',
    },
  },
  warren: {
    email: 'warren@beyondfinancing.com',
    label: {
      English: 'Warren Wendt',
      Português: 'Warren Wendt',
      Español: 'Warren Wendt',
    },
  },
}

const translations: Record<PreferredLanguage, TranslationSet> = {
  English: {
    heroTitle: 'Connect With Finley Beyond Advisor — Instantly',
    heroSubtitle: 'Clear guidance. Real scenarios. One step at a time.',
    stayConnectedTitle: 'Stay Connected',
    stayConnectedSubtitle:
      'Enter your contact details to unlock the advisor experience.',
    fullNamePlaceholder: 'Full Name',
    emailPlaceholder: 'Email',
    phonePlaceholder: 'Phone Number',
    languageLabel: 'Preferred Language',
    loanOfficerLabel: 'Select Your Loan Officer',
    languageEnglish: 'English',
    languagePortuguese: 'Português',
    languageSpanish: 'Español',
    loanOfficerFinley: 'Finley Beyond (If None Below)',
    loanOfficerSandro: 'Sandro Pansini Souza',
    loanOfficerWarren: 'Warren Wendt',
    leadError:
      'Please complete Full Name, Email, Phone Number, Language, and Loan Officer to continue.',
    unlockButton: 'Unlock Your Mortgage AI Advisor',
    savingButton: 'Saving...',
    unlockedMessage:
      'Thank you. Your information has been recorded for this session. You may now chat with Finley Beyond Advisor below.',
    chatLockedTitle: 'Unlock Your Mortgage Guidance',
    chatLockedSubtitle:
      'Complete your contact details above to continue.',
    advisorName: 'Connect with Finley Beyond Advisor',
    advisorSubtitle:
      'Ask a mortgage question and get guided step by step.',
    tryAsking: 'Try asking something like:',
    example1: "I'm self-employed. Can I qualify?",
    example2: 'I had a recent credit issue',
    example3: 'I want to buy with 10% down',
    textareaPlaceholder: 'Describe your situation...',
    sendButton: 'Send',
    thinking: 'Thinking...',
    readyTitle: 'Ready to Move Forward?',
    readySubtitle: 'Take the next step with Beyond Financing.',
    startApplication: 'Start Application',
    scheduleConsultation: 'Schedule Consultation',
    talkToBeyond: 'Talk to Beyond Financing',
    preapprovalNote:
      'A pre-approval review typically starts with income, asset, and credit evaluation. If you are self-employed, tax returns and supporting documentation may be required.',
    disclaimer:
      'This tool provides general information and does not constitute a loan approval or commitment to lend. All mortgage applications are subject to review by a licensed Mortgage Loan Originator.',
    genericLeadFailure: 'Unable to submit your information right now.',
    genericConnectionFailure: 'Unable to connect right now. Please try again.',
    genericAiFailure:
      'I was unable to generate a response. Please try again.',
    genericAiConnectionFailure: 'Error connecting to AI.',
  },
  Português: {
    heroTitle: 'Conecte-se com o Finley Beyond Advisor — Instantaneamente',
    heroSubtitle: 'Orientação clara. Cenários reais. Um passo de cada vez.',
    stayConnectedTitle: 'Mantenha-se Conectado',
    stayConnectedSubtitle:
      'Informe seus dados de contato para desbloquear a experiência com o advisor.',
    fullNamePlaceholder: 'Nome Completo',
    emailPlaceholder: 'Email',
    phonePlaceholder: 'Telefone',
    languageLabel: 'Idioma Preferido',
    loanOfficerLabel: 'Selecione Seu Loan Officer',
    languageEnglish: 'English',
    languagePortuguese: 'Português',
    languageSpanish: 'Español',
    loanOfficerFinley: 'Finley Beyond (Se Nenhum Abaixo)',
    loanOfficerSandro: 'Sandro Pansini Souza',
    loanOfficerWarren: 'Warren Wendt',
    leadError:
      'Por favor, preencha Nome Completo, Email, Telefone, Idioma e Loan Officer para continuar.',
    unlockButton: 'Desbloquear seu Mortgage AI Advisor',
    savingButton: 'Salvando...',
    unlockedMessage:
      'Obrigado. Suas informações foram registradas nesta sessão. Agora você pode conversar com o Finley Beyond Advisor abaixo.',
    chatLockedTitle: 'Desbloqueie sua Orientação Hipotecária',
    chatLockedSubtitle:
      'Complete seus dados de contato acima para continuar.',
    advisorName: 'Conecte-se com o Finley Beyond Advisor',
    advisorSubtitle:
      'Faça uma pergunta sobre hipoteca e receba orientação passo a passo.',
    tryAsking: 'Tente perguntar algo como:',
    example1: 'Sou autônomo. Posso me qualificar?',
    example2: 'Tive um problema recente de crédito',
    example3: 'Quero comprar com 10% de entrada',
    textareaPlaceholder: 'Descreva sua situação...',
    sendButton: 'Enviar',
    thinking: 'Pensando...',
    readyTitle: 'Pronto para Seguir em Frente?',
    readySubtitle: 'Dê o próximo passo com a Beyond Financing.',
    startApplication: 'Iniciar Aplicação',
    scheduleConsultation: 'Agendar Consulta',
    talkToBeyond: 'Falar com a Beyond Financing',
    preapprovalNote:
      'Uma análise de pré-aprovação normalmente começa com avaliação de renda, ativos e crédito. Se você é autônomo, declarações de imposto e documentação de suporte podem ser necessárias.',
    disclaimer:
      'Esta ferramenta fornece informações gerais e não constitui aprovação de empréstimo nem compromisso de conceder crédito. Todas as aplicações de hipoteca estão sujeitas à análise e aprovação por um Mortgage Loan Originator licenciado.',
    genericLeadFailure: 'Não foi possível enviar suas informações agora.',
    genericConnectionFailure:
      'Não foi possível conectar agora. Tente novamente.',
    genericAiFailure:
      'Não consegui gerar uma resposta agora. Tente novamente.',
    genericAiConnectionFailure: 'Erro ao conectar com a IA.',
  },
  Español: {
    heroTitle: 'Conéctese con Finley Beyond Advisor — Al Instante',
    heroSubtitle: 'Orientación clara. Escenarios reales. Un paso a la vez.',
    stayConnectedTitle: 'Manténgase Conectado',
    stayConnectedSubtitle:
      'Ingrese sus datos de contacto para desbloquear la experiencia con el advisor.',
    fullNamePlaceholder: 'Nombre Completo',
    emailPlaceholder: 'Correo Electrónico',
    phonePlaceholder: 'Número de Teléfono',
    languageLabel: 'Idioma Preferido',
    loanOfficerLabel: 'Seleccione Su Loan Officer',
    languageEnglish: 'English',
    languagePortuguese: 'Português',
    languageSpanish: 'Español',
    loanOfficerFinley: 'Finley Beyond (Si Ninguno Abajo)',
    loanOfficerSandro: 'Sandro Pansini Souza',
    loanOfficerWarren: 'Warren Wendt',
    leadError:
      'Por favor complete Nombre Completo, Correo Electrónico, Número de Teléfono, Idioma y Loan Officer para continuar.',
    unlockButton: 'Desbloquee su Mortgage AI Advisor',
    savingButton: 'Guardando...',
    unlockedMessage:
      'Gracias. Su información ha sido registrada para esta sesión. Ahora puede chatear con Finley Beyond Advisor abajo.',
    chatLockedTitle: 'Desbloquee su Guía Hipotecaria',
    chatLockedSubtitle:
      'Complete sus datos de contacto arriba para continuar.',
    advisorName: 'Conéctese con Finley Beyond Advisor',
    advisorSubtitle:
      'Haga una pregunta sobre hipotecas y reciba orientación paso a paso.',
    tryAsking: 'Pruebe preguntando algo como:',
    example1: 'Soy trabajador independiente. ¿Puedo calificar?',
    example2: 'Tuve un problema reciente de crédito',
    example3: 'Quiero comprar con 10% de entrada',
    textareaPlaceholder: 'Describa su situación...',
    sendButton: 'Enviar',
    thinking: 'Pensando...',
    readyTitle: '¿Listo para Avanzar?',
    readySubtitle: 'Dé el siguiente paso con Beyond Financing.',
    startApplication: 'Comenzar Solicitud',
    scheduleConsultation: 'Programar Consulta',
    talkToBeyond: 'Hablar con Beyond Financing',
    preapprovalNote:
      'Una revisión de preaprobación normalmente comienza con la evaluación de ingresos, activos y crédito. Si trabaja por cuenta propia, pueden requerirse declaraciones de impuestos y documentación de respaldo.',
    disclaimer:
      'Esta herramienta proporciona información general y no constituye una aprobación de préstamo ni un compromiso de otorgarlo. Todas las solicitudes hipotecarias están sujetas a revisión y aprobación por un Mortgage Loan Originator autorizado.',
    genericLeadFailure:
      'No fue posible enviar su información en este momento.',
    genericConnectionFailure:
      'No fue posible conectarse en este momento. Inténtelo de nuevo.',
    genericAiFailure:
      'No pude generar una respuesta en este momento. Inténtelo de nuevo.',
    genericAiConnectionFailure: 'Error al conectar con la IA.',
  },
}

function stripSummaryMarker(content: string): string {
  return content.replace(SUMMARY_TRIGGER_MARKER, '').trim()
}

function renderMessageContent(content: string) {
  const parts = content.split(/(https?:\/\/[^\s]+)/g)

  return parts.map((part, index) => {
    const isLink = /^https?:\/\/[^\s]+$/.test(part)

    if (isLink) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noreferrer"
          className="break-all font-medium underline"
        >
          {part}
        </a>
      )
    }

    const lines = part.split('\n')

    return (
      <Fragment key={index}>
        {lines.map((line, lineIndex) => (
          <Fragment key={`${index}-${lineIndex}`}>
            {line}
            {lineIndex < lines.length - 1 ? <br /> : null}
          </Fragment>
        ))}
      </Fragment>
    )
  })
}

export default function Home() {
  const [input, setInput] = useState<string>('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [chatEnabled, setChatEnabled] = useState<boolean>(false)
  const [leadSubmitting, setLeadSubmitting] = useState<boolean>(false)
  const [leadError, setLeadError] = useState<string>('')
  const [summarySent, setSummarySent] = useState<boolean>(false)
  const [leadForm, setLeadForm] = useState<LeadForm>({
    fullName: '',
    email: '',
    phone: '',
    preferredLanguage: 'English',
    loanOfficer: 'finley',
  })

  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const t = useMemo(
    () => translations[leadForm.preferredLanguage],
    [leadForm.preferredLanguage]
  )

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleLeadChange = <K extends keyof LeadForm>(
    field: K,
    value: LeadForm[K]
  ): void => {
    setLeadForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const sendConversationSummary = async (
    transcript: ChatMessage[],
    trigger: SummaryTrigger
  ): Promise<void> => {
    if (summarySent || transcript.length === 0) return

    try {
      const res = await fetch('/api/chat-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lead: {
            ...leadForm,
            assignedEmail: loanOfficerOptions[leadForm.loanOfficer].email,
          },
          messages: transcript,
          trigger,
        }),
      })

      if (res.ok) {
        setSummarySent(true)
      }
    } catch {
      // Intentionally silent so the borrower experience is not interrupted.
    }
  }

  const handleLeadUnlock = async (): Promise<void> => {
    const { fullName, email, phone, preferredLanguage, loanOfficer } = leadForm

    if (
      !fullName.trim() ||
      !email.trim() ||
      !phone.trim() ||
      !preferredLanguage.trim() ||
      !loanOfficer.trim()
    ) {
      setLeadError(t.leadError)
      return
    }

    setLeadError('')
    setLeadSubmitting(true)

    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(leadForm),
      })

      const data: { success?: boolean; error?: string } = await res.json()

      if (!res.ok) {
        setLeadError(data.error || t.genericLeadFailure)
        return
      }

      setChatEnabled(true)
    } catch {
      setLeadError(t.genericConnectionFailure)
    } finally {
      setLeadSubmitting(false)
    }
  }

  const handleSend = async (): Promise<void> => {
    if (!input.trim() || loading || !chatEnabled) return

    const currentInput = input.trim()
    const updatedMessages: ChatMessage[] = [
      ...messages,
      { role: 'user', content: currentInput },
    ]

    setMessages(updatedMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: currentInput,
          messages: updatedMessages,
          lead: {
            ...leadForm,
            assignedEmail: loanOfficerOptions[leadForm.loanOfficer].email,
          },
        }),
      })

      const data: { reply?: string } = await res.json()
      const rawReply = data?.reply || t.genericAiFailure
      const shouldSendSummary = rawReply.includes(SUMMARY_TRIGGER_MARKER)
      const cleanReply = stripSummaryMarker(rawReply)

      const aiMessage: ChatMessage = {
        role: 'assistant',
        content: cleanReply,
      }

      const finalTranscript = [...updatedMessages, aiMessage]
      setMessages(finalTranscript)

      if (shouldSendSummary) {
        void sendConversationSummary(finalTranscript, 'ai')
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: t.genericAiConnectionFailure,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleActionClick = async (
    url: string,
    trigger: SummaryTrigger
  ): Promise<void> => {
    if (chatEnabled && messages.length > 0 && !summarySent) {
      await sendConversationSummary(messages, trigger)
    }

    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <main className="min-h-screen bg-[#F1F3F8] text-[#263366] px-3 py-5 sm:px-4 sm:py-8">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-5 text-center sm:mb-6">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            {t.heroTitle}
          </h1>
          <p className="mt-2 text-sm text-[#263366]/75 sm:mt-3 sm:text-base">
            {t.heroSubtitle}
          </p>
        </div>

        <div className="mb-5 rounded-2xl border border-[#263366]/15 bg-white p-4 shadow-sm sm:mb-6 sm:p-5">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-[#263366] sm:text-xl">
              {t.stayConnectedTitle}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#263366]/70">
              {t.stayConnectedSubtitle}
            </p>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              type="text"
              placeholder={t.fullNamePlaceholder}
              value={leadForm.fullName}
              onChange={(e) => handleLeadChange('fullName', e.target.value)}
              className="rounded-xl border border-[#263366]/20 px-4 py-3 text-sm outline-none focus:border-[#263366]/40"
            />

            <input
              type="email"
              placeholder={t.emailPlaceholder}
              value={leadForm.email}
              onChange={(e) => handleLeadChange('email', e.target.value)}
              className="rounded-xl border border-[#263366]/20 px-4 py-3 text-sm outline-none focus:border-[#263366]/40"
            />

            <input
              type="text"
              placeholder={t.phonePlaceholder}
              value={leadForm.phone}
              onChange={(e) => handleLeadChange('phone', e.target.value)}
              className="rounded-xl border border-[#263366]/20 px-4 py-3 text-sm outline-none focus:border-[#263366]/40"
            />

            <select
              value={leadForm.preferredLanguage}
              onChange={(e) =>
                handleLeadChange(
                  'preferredLanguage',
                  e.target.value as PreferredLanguage
                )
              }
              aria-label={t.languageLabel}
              className="rounded-xl border border-[#263366]/20 px-4 py-3 text-sm outline-none focus:border-[#263366]/40"
            >
              <option value="English">{t.languageEnglish}</option>
              <option value="Português">{t.languagePortuguese}</option>
              <option value="Español">{t.languageSpanish}</option>
            </select>

            <select
              value={leadForm.loanOfficer}
              onChange={(e) =>
                handleLeadChange(
                  'loanOfficer',
                  e.target.value as LoanOfficerId
                )
              }
              aria-label={t.loanOfficerLabel}
              className="rounded-xl border border-[#263366]/20 px-4 py-3 text-sm outline-none focus:border-[#263366]/40 sm:col-span-2"
            >
              <option value="finley">{t.loanOfficerFinley}</option>
              <option value="sandro">{t.loanOfficerSandro}</option>
              <option value="warren">{t.loanOfficerWarren}</option>
            </select>
          </div>

          {leadError && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {leadError}
            </div>
          )}

          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => void handleLeadUnlock()}
              disabled={leadSubmitting}
              className="w-full rounded-xl bg-[#263366] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {leadSubmitting ? t.savingButton : t.unlockButton}
            </button>
          </div>

          {chatEnabled && (
            <div className="mt-4 rounded-xl bg-[#F8FAFC] px-4 py-3 text-sm text-[#263366]/75">
              {t.unlockedMessage}
            </div>
          )}
        </div>

        {chatEnabled && (
          <div className="overflow-hidden rounded-2xl border border-[#263366]/20 bg-white shadow-sm">
            <div className="border-b border-[#263366]/10 px-4 py-4 sm:px-5">
              <div className="text-sm font-semibold text-[#263366] sm:text-base">
                {t.advisorName}
              </div>
              <div className="mt-1 text-xs text-[#263366]/65 sm:text-sm">
                {t.advisorSubtitle}
              </div>
            </div>

            <div className="h-[360px] overflow-y-auto px-3 py-3 sm:h-[430px] sm:px-4 sm:py-4 lg:h-[500px] lg:px-5">
              <div className="space-y-3 sm:space-y-4">
                {messages.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-[#263366]/20 bg-[#F8FAFC] p-4 text-sm text-[#263366]/70 sm:p-5">
                    <div className="font-medium">{t.tryAsking}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setInput(t.example1)}
                        className="rounded-full border border-[#263366]/15 bg-white px-3 py-2 text-xs hover:bg-[#F1F3F8] sm:text-sm"
                      >
                        {t.example1}
                      </button>
                      <button
                        type="button"
                        onClick={() => setInput(t.example2)}
                        className="rounded-full border border-[#263366]/15 bg-white px-3 py-2 text-xs hover:bg-[#F1F3F8] sm:text-sm"
                      >
                        {t.example2}
                      </button>
                      <button
                        type="button"
                        onClick={() => setInput(t.example3)}
                        className="rounded-full border border-[#263366]/15 bg-white px-3 py-2 text-xs hover:bg-[#F1F3F8] sm:text-sm"
                      >
                        {t.example3}
                      </button>
                    </div>
                  </div>
                )}

                {messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex ${
                      msg.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[92%] rounded-2xl px-3 py-2.5 text-sm leading-6 whitespace-pre-wrap shadow-sm sm:max-w-[85%] sm:px-4 sm:py-3 sm:text-[15px] sm:leading-7 ${
                        msg.role === 'user'
                          ? 'bg-[#DCEAFE] text-right text-[#263366]'
                          : 'bg-[#F3F4F6] text-left text-[#263366]'
                      }`}
                    >
                      {renderMessageContent(msg.content)}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex justify-start">
                    <div className="max-w-[92%] rounded-2xl bg-[#F3F4F6] px-3 py-2.5 text-sm leading-6 text-[#263366] shadow-sm sm:max-w-[85%] sm:px-4 sm:py-3 sm:text-[15px] sm:leading-7">
                      {t.thinking}
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="border-t border-[#263366]/10 px-3 py-3 sm:px-4 sm:py-4 lg:px-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void handleSend()
                    }
                  }}
                  placeholder={t.textareaPlaceholder}
                  rows={3}
                  className="min-h-[88px] w-full resize-none rounded-xl border border-[#263366]/20 px-4 py-3 text-sm text-[#263366] outline-none placeholder:text-[#263366]/45 focus:border-[#263366]/40 sm:flex-1 sm:text-[15px]"
                />
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={loading}
                  className="w-full rounded-xl bg-[#263366] px-5 py-3 text-sm font-medium text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  {t.sendButton}
                </button>
              </div>
            </div>
          </div>
        )}

        {!chatEnabled && (
          <div className="rounded-2xl border border-[#263366]/15 bg-white p-6 text-center shadow-sm">
            <h2 className="text-lg font-semibold text-[#263366]">
              {t.chatLockedTitle}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#263366]/70">
              {t.chatLockedSubtitle}
            </p>
          </div>
        )}

        <div className="mt-5 rounded-2xl border border-[#263366]/15 bg-white p-4 shadow-sm sm:mt-6 sm:p-5">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-[#263366] sm:text-xl">
              {t.readyTitle}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#263366]/70">
              {t.readySubtitle}
            </p>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <button
              type="button"
              onClick={() => void handleActionClick(START_APPLICATION_URL, 'apply')}
              className="rounded-xl bg-[#263366] px-4 py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
            >
              {t.startApplication}
            </button>

            <button
              type="button"
              onClick={() =>
                void handleActionClick(SCHEDULE_CONSULTATION_URL, 'schedule')
              }
              className="rounded-xl border border-[#263366]/20 bg-[#F8FAFC] px-4 py-3 text-center text-sm font-semibold text-[#263366] transition hover:bg-[#EEF2F7]"
            >
              {t.scheduleConsultation}
            </button>

            <button
              type="button"
              onClick={() => void handleActionClick(TALK_TO_BEYOND_URL, 'contact')}
              className="rounded-xl border border-[#263366]/20 bg-[#F8FAFC] px-4 py-3 text-center text-sm font-semibold text-[#263366] transition hover:bg-[#EEF2F7] sm:col-span-2 lg:col-span-1"
            >
              {t.talkToBeyond}
            </button>
          </div>

          <div className="mt-4 rounded-xl bg-[#F8FAFC] px-4 py-3 text-sm leading-6 text-[#263366]/75">
            {t.preapprovalNote}
          </div>
        </div>

        <p className="mx-auto mt-5 max-w-2xl text-center text-[11px] leading-5 text-[#263366]/60 sm:text-xs sm:leading-6">
          {t.disclaimer}
        </p>
      </div>
    </main>
  )
}
