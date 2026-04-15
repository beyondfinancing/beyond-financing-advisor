import { NextResponse } from "next/server";

type LanguageCode = "en" | "pt" | "es";

type ChatMessage = {
  role?: string;
  content?: string;
};

type LoanOfficerSelection = {
  id?: string;
  name?: string;
  nmls?: string;
  email?: string;
  assistantEmail?: string;
  mobile?: string;
  assistantMobile?: string;
  applyUrl?: string;
  scheduleUrl?: string;
};

type ConversationMessage = {
  role?: string;
  content?: string;
};

type RoutingPayload = {
  language?: LanguageCode;
  loanOfficerQuery?: string;
  selectedOfficer?: LoanOfficerSelection;
  borrower?: {
    name?: string;
    email?: string;
    credit?: string;
    income?: string;
    debt?: string;
  };
  scenario?: {
    homePrice?: string;
    downPayment?: string;
    estimatedLoanAmount?: string;
    estimatedLtv?: string;
  };
  conversation?: ConversationMessage[];
};

type RequestBody = {
  stage?: "initial_review" | "scenario_review" | "follow_up";
  routing?: RoutingPayload;
  messages?: ChatMessage[];
};

type LoanOfficerRecord = {
  id: string;
  name: string;
  nmls: string;
  email: string;
  assistantEmail: string;
  mobile: string;
  assistantMobile: string;
  applyUrl: string;
  scheduleUrl: string;
};

const LOAN_OFFICERS: LoanOfficerRecord[] = [
  {
    id: "sandro-pansini-souza",
    name: "Sandro Pansini Souza",
    nmls: "1625542",
    email: "pansini@beyondfinancing.com",
    assistantEmail: "myloan@beyondfinancing.com",
    mobile: "8576150836",
    assistantMobile: "8576150836",
    applyUrl: "https://www.beyondfinancing.com/apply-now",
    scheduleUrl: "https://calendly.com/sandropansini",
  },
  {
    id: "warren-wendt",
    name: "Warren Wendt",
    nmls: "18959",
    email: "warren@beyondfinancing.com",
    assistantEmail: "myloan@beyondfinancing.com",
    mobile: "9788212250",
    assistantMobile: "8576150836",
    applyUrl: "https://www.beyondfinancing.com/apply-now",
    scheduleUrl: "https://www.beyondfinancing.com",
  },
  {
    id: "finley-beyond",
    name: "Finley Beyond",
    nmls: "16255BF",
    email: "finley@beyondfinancing.com",
    assistantEmail: "myloan@beyondfinancing.com",
    mobile: "8576150836",
    assistantMobile: "8576150836",
    applyUrl: "https://www.beyondfinancing.com/apply-now",
    scheduleUrl: "https://www.beyondfinancing.com",
  },
];

const DEFAULT_LOAN_OFFICER =
  LOAN_OFFICERS.find((officer) => officer.id === "finley-beyond") ||
  LOAN_OFFICERS[0];

function getLatestUserMessage(messages: ChatMessage[]) {
  const reversed = [...messages].reverse();
  return reversed.find((message) => message.role === "user")?.content ?? "";
}

function resolveLoanOfficer(routing?: RoutingPayload): LoanOfficerRecord {
  const selected = routing?.selectedOfficer;

  if (selected?.id) {
    const byId = LOAN_OFFICERS.find((officer) => officer.id === selected.id);
    if (byId) return byId;
  }

  if (selected?.nmls) {
    const byNmls = LOAN_OFFICERS.find(
      (officer) => officer.nmls.toLowerCase() === selected.nmls?.toLowerCase()
    );
    if (byNmls) return byNmls;
  }

  if (selected?.name) {
    const byName = LOAN_OFFICERS.find(
      (officer) => officer.name.toLowerCase() === selected.name?.toLowerCase()
    );
    if (byName) return byName;
  }

  const query = routing?.loanOfficerQuery?.trim().toLowerCase();

  if (query) {
    const exact = LOAN_OFFICERS.find(
      (officer) =>
        officer.name.toLowerCase() === query ||
        officer.nmls.toLowerCase() === query
    );
    if (exact) return exact;

    const partial = LOAN_OFFICERS.find(
      (officer) =>
        officer.name.toLowerCase().includes(query) ||
        officer.nmls.toLowerCase().includes(query)
    );
    if (partial) return partial;
  }

  return DEFAULT_LOAN_OFFICER;
}

function getLanguage(routing?: RoutingPayload): LanguageCode {
  return routing?.language || "en";
}

function conversationToText(conversation?: ConversationMessage[]) {
  if (!conversation || conversation.length === 0) return "";
  return conversation
    .map((item) => `${item.role || "unknown"}: ${item.content || ""}`)
    .join("\n");
}

function hasAny(text: string, patterns: string[]) {
  return patterns.some((pattern) => text.includes(pattern));
}

function determineNextQuestion(language: LanguageCode, routing?: RoutingPayload) {
  const borrower = routing?.borrower || {};
  const scenario = routing?.scenario || {};
  const convo = conversationToText(routing?.conversation).toLowerCase();

  const incomeAnswered =
    hasAny(convo, [
      "w-2",
      "w2",
      "salary",
      "salaried",
      "hourly",
      "self-employed",
      "self employed",
      "1099",
      "retired",
      "retirement",
      "commission",
      "autônomo",
      "autonomo",
      "aposentado",
      "comissão",
      "trabajador independiente",
      "jubilado",
      "salario",
      "asalariado",
      "comision",
    ]) || !!borrower.income;

  const occupancyAnswered = hasAny(convo, [
    "primary residence",
    "primary",
    "owner occupied",
    "investment",
    "second home",
    "vacation home",
    "residência principal",
    "moradia principal",
    "investimento",
    "segunda casa",
    "residencia principal",
    "inversión",
    "segunda vivienda",
  ]);

  const timelineAnswered = hasAny(convo, [
    "30 days",
    "60 days",
    "90 days",
    "as soon as possible",
    "this month",
    "next month",
    "30 dias",
    "60 dias",
    "90 dias",
    "o mais rápido possível",
    "este mês",
    "próximo mês",
    "lo antes posible",
    "este mes",
    "próximo mes",
  ]);

  const fundsSourceAnswered = hasAny(convo, [
    "saved",
    "savings",
    "gift",
    "gift funds",
    "sale of home",
    "retirement account",
    "economias",
    "presente",
    "doação",
    "gift funds",
    "venda da casa",
    "cuenta de retiro",
    "ahorros",
    "regalo",
    "venta de vivienda",
  ]);

  const firstTimeBuyerAnswered = hasAny(convo, [
    "first-time buyer",
    "first time buyer",
    "first-time homebuyer",
    "primeira casa",
    "primeiro imóvel",
    "comprador de primeira viagem",
    "primer comprador",
    "primera vivienda",
  ]);

  if (!incomeAnswered) {
    if (language === "pt") {
      return "Para ajudar seu loan officer a orientar os próximos passos, qual é o tipo da sua renda principal hoje: assalariado W-2, horista, autônomo, 1099, aposentadoria ou outra?";
    }
    if (language === "es") {
      return "Para ayudar a su loan officer a orientar los próximos pasos, ¿cuál es hoy su principal tipo de ingreso: asalariado W-2, por hora, independiente, 1099, jubilación u otro?";
    }
    return "To help your loan officer guide the next steps, what is your main income type today: W-2 salaried, hourly, self-employed, 1099, retirement, or something else?";
  }

  if (!occupancyAnswered) {
    if (language === "pt") {
      return "Esta compra seria para moradia principal, segunda casa ou imóvel de investimento?";
    }
    if (language === "es") {
      return "¿Esta compra sería para vivienda principal, segunda vivienda o propiedad de inversión?";
    }
    return "Would this purchase be for a primary residence, a second home, or an investment property?";
  }

  if (!timelineAnswered) {
    if (language === "pt") {
      return "Qual é o seu prazo ideal para comprar ou entrar em contrato: o quanto antes, nos próximos 30 a 60 dias, ou mais adiante?";
    }
    if (language === "es") {
      return "¿Cuál es su plazo ideal para comprar o entrar en contrato: lo antes posible, dentro de los próximos 30 a 60 días, o más adelante?";
    }
    return "What is your ideal timeline to buy or go under contract: as soon as possible, within the next 30 to 60 days, or later on?";
  }

  if (!fundsSourceAnswered) {
    if (language === "pt") {
      return "Os fundos para entrada e fechamento virão principalmente de economias, gift funds, venda de outro imóvel ou outra fonte?";
    }
    if (language === "es") {
      return "¿Los fondos para el pago inicial y el cierre provendrán principalmente de ahorros, gift funds, venta de otra propiedad u otra fuente?";
    }
    return "Will your down payment and closing funds come mainly from savings, gift funds, the sale of another property, or another source?";
  }

  if (!firstTimeBuyerAnswered) {
    if (language === "pt") {
      return "Esta seria sua primeira compra de imóvel ou você já teve imóvel antes?";
    }
    if (language === "es") {
      return "¿Esta sería su primera compra de vivienda o ya ha tenido una propiedad antes?";
    }
    return "Would this be your first home purchase, or have you owned property before?";
  }

  if (language === "pt") {
    return "Obrigado. Isso já ajuda bastante. Enquanto seu loan officer analisa o cenário, há alguma pergunta específica sobre documentação, prazo, fundos para fechamento ou pagamento mensal que você queira esclarecer?";
  }
  if (language === "es") {
    return "Gracias. Eso ya ayuda bastante. Mientras su loan officer revisa el escenario, ¿hay alguna pregunta específica sobre documentación, plazo, fondos para el cierre o pago mensual que quiera aclarar?";
  }
  return "Thank you. That already helps a lot. While your loan officer reviews the scenario, is there any specific question about documentation, timing, funds to close, or monthly payment that you would like to clarify?";
}

function introductoryMessage(language: LanguageCode, officerName: string) {
  if (language === "pt") {
    return `Obrigado por compartilhar estas informações iniciais. Vou organizar este cenário para ${officerName}, que fará a análise pessoal e orientará os próximos passos. Para adiantar o processo, recomendo também clicar em Aplicar Agora.`;
  }
  if (language === "es") {
    return `Gracias por compartir esta información inicial. Voy a organizar este escenario para ${officerName}, quien realizará la revisión personal y le orientará sobre los próximos pasos. Para adelantar el proceso, también le recomiendo hacer clic en Aplicar Ahora.`;
  }
  return `Thank you for sharing this initial information. I will organize this scenario for ${officerName}, who will review it personally and advise the next steps. To help move things forward, I also recommend clicking Apply Now.`;
}

function scenarioAcknowledgement(language: LanguageCode, officerName: string) {
  if (language === "pt") {
    return `Perfeito. Agora já tenho um cenário de compra mais claro para encaminhar a ${officerName}. Estas informações serão enviadas para análise pessoal, e o loan officer orientará você sobre os próximos passos. Também recomendo clicar em Aplicar Agora para adiantar o processo.`;
  }
  if (language === "es") {
    return `Perfecto. Ahora ya tengo un escenario de compra más claro para enviar a ${officerName}. Esta información se enviará para revisión personal, y el loan officer le orientará sobre los próximos pasos. También le recomiendo hacer clic en Aplicar Ahora para avanzar el proceso.`;
  }
  return `Perfect. I now have a clearer purchase scenario to send to ${officerName}. This information will be forwarded for personal review, and the loan officer will advise you on the next steps. I also recommend clicking Apply Now to help move the process forward.`;
}

function buildAnswer(language: LanguageCode, userMessage: string, officerName: string) {
  const lower = userMessage.toLowerCase();

  if (
    hasAny(lower, [
      "voce fala portugues",
      "você fala português",
      "fala portugues",
      "fala português",
      "do you speak portuguese",
      "speak portuguese",
      "hablas portugués",
      "habla portugues",
    ])
  ) {
    if (language === "pt") {
      return "Sim. Posso continuar toda a conversa em português e ajudar a reunir as informações para que seu loan officer faça a análise pessoal.";
    }
    if (language === "es") {
      return "Sí. También puedo continuar en portugués si lo prefiere y ayudar a reunir la información para que su loan officer haga la revisión personal.";
    }
    return "Yes. I can continue in Portuguese as well and help gather the information your loan officer needs for a personal review.";
  }

  if (
    hasAny(lower, [
      "can i purchase a home",
      "can i buy a house",
      "can i purchase this home",
      "posso comprar uma casa",
      "posso comprar esta casa",
      "puedo comprar una casa",
      "puedo comprar esta casa",
      "gostaria de comprar uma casa",
    ])
  ) {
    if (language === "pt") {
      return `Com base no que foi informado até aqui, ainda não seria apropriado confirmar compra, programa ou aprovação. O que posso dizer é que já temos uma base inicial para que ${officerName} analise seu cenário pessoalmente e oriente os próximos passos. Para adiantar o processo, recomendo clicar em Aplicar Agora.`;
    }
    if (language === "es") {
      return `Con base en lo informado hasta ahora, todavía no sería apropiado confirmar compra, programa o aprobación. Lo que sí puedo decir es que ya tenemos una base inicial para que ${officerName} revise su escenario personalmente y le oriente sobre los próximos pasos. Para avanzar el proceso, le recomiendo hacer clic en Aplicar Ahora.`;
    }
    return `Based on what has been shared so far, it would not be appropriate for me to confirm a purchase, a program, or an approval. What I can say is that we now have an initial foundation for ${officerName} to review your scenario personally and advise the next steps. To help move things forward, I recommend clicking Apply Now.`;
  }

  if (
    hasAny(lower, [
      "what do i need to purchase this home",
      "what do i need to buy this home",
      "o que eu preciso para comprar esta casa",
      "que necesito para comprar esta casa",
      "o que eu preciso para comprar uma casa",
    ])
  ) {
    if (language === "pt") {
      return `Para seguir adiante, normalmente será importante ter organizados seus documentos de renda, ativos, fundos para entrada e fechamento, além de um cenário claro do imóvel desejado. Seu loan officer também vai querer entender seu objetivo de prazo, ocupação do imóvel e conforto com o pagamento mensal. Essas informações serão enviadas para ${officerName}, que fará a análise pessoal e orientará você sobre o que fazer em seguida.`;
    }
    if (language === "es") {
      return `Para avanzar, normalmente será importante tener organizados sus documentos de ingresos, activos, fondos para pago inicial y cierre, además de un escenario claro de la propiedad deseada. Su loan officer también querrá entender su plazo, el uso de la propiedad y su comodidad con el pago mensual. Esta información se enviará a ${officerName}, quien hará la revisión personal y le indicará qué hacer después.`;
    }
    return `To move forward, it will usually be important to organize your income documentation, assets, funds for down payment and closing, and a clear picture of the property you want to buy. Your loan officer will also want to understand your timeline, intended occupancy, and monthly payment comfort. This information will be sent to ${officerName}, who will review it personally and advise what to do next.`;
  }

  if (
    hasAny(lower, [
      "how can i apply",
      "apply for mortgage",
      "how do i apply",
      "como aplicar",
      "como posso aplicar",
      "como solicito",
      "cómo aplicar",
      "cómo puedo aplicar",
    ])
  ) {
    if (language === "pt") {
      return "A melhor forma de seguir agora é clicar em Aplicar Agora. Isso ajuda seu loan officer a receber suas informações de forma mais completa e orientar os próximos passos com base na sua situação real.";
    }
    if (language === "es") {
      return "La mejor forma de continuar ahora es hacer clic en Aplicar Ahora. Eso ayuda a que su loan officer reciba su información de manera más completa y pueda orientarle sobre los próximos pasos según su situación real.";
    }
    return "The best way to move forward now is to click Apply Now. That helps your loan officer receive your information in a more complete format and advise the next steps based on your real situation.";
  }

  if (
    hasAny(lower, [
      "speak with a loan officer",
      "talk to a loan officer",
      "contact a loan officer",
      "falar com um loan officer",
      "falar com o loan officer",
      "hablar con un loan officer",
    ])
  ) {
    if (language === "pt") {
      return `Você pode usar o botão Agendar com o Loan Officer ou o botão Enviar Email ao Loan Officer. Como ${officerName} está designado ao seu cenário, esse contato será direcionado corretamente.`;
    }
    if (language === "es") {
      return `Puede usar el botón Agendar con el Loan Officer o el botón Enviar Correo al Loan Officer. Como ${officerName} está asignado a su escenario, ese contacto se dirigirá correctamente.`;
    }
    return `You can use the Schedule with Loan Officer button or the Email Loan Officer button. Since ${officerName} is assigned to your scenario, that contact will route correctly.`;
  }

  if (
    hasAny(lower, [
      "rate",
      "rates",
      "interest rate",
      "interest rates",
      "taxa",
      "taxas",
      "juros",
      "tasa",
      "tasas",
      "interés",
      "interes",
    ])
  ) {
    if (language === "pt") {
      return "As taxas mudam com frequência, e existe uma média nacional publicada no mercado, mas taxa personalizada, termos e programa adequado devem ser informados diretamente pelo loan officer licenciado após a revisão do seu cenário completo.";
    }
    if (language === "es") {
      return "Las tasas cambian con frecuencia, y existe un promedio nacional publicado en el mercado, pero la tasa personalizada, los términos y el programa adecuado deben ser informados directamente por el loan officer con licencia después de revisar su escenario completo.";
    }
    return "Rates change frequently, and there are published national average mortgage rates in the market, but your personalized rate, terms, and proper program direction should come directly from the licensed loan officer after reviewing your full scenario.";
  }

  if (
    hasAny(lower, [
      "document",
      "documents",
      "documentação",
      "documentacion",
      "documentación",
    ])
  ) {
    if (language === "pt") {
      return "Normalmente seu loan officer vai precisar revisar documentos de renda, ativos, identificação e qualquer informação relevante sobre dívidas ou fundos para fechamento. O que será exigido exatamente depende da análise pessoal do seu cenário.";
    }
    if (language === "es") {
      return "Normalmente su loan officer necesitará revisar documentos de ingresos, activos, identificación y cualquier información relevante sobre deudas o fondos para el cierre. Lo que se requiera exactamente dependerá de la revisión personal de su escenario.";
    }
    return "Typically your loan officer will need to review income documents, asset documents, identification, and any relevant information about debts or funds for closing. Exactly what will be required depends on the personal review of your scenario.";
  }

  if (language === "pt") {
    return `Obrigado. Vou registrar isso para que ${officerName} tenha um quadro melhor do seu cenário.`;
  }
  if (language === "es") {
    return `Gracias. Voy a registrar eso para que ${officerName} tenga un panorama más claro de su escenario.`;
  }
  return `Thank you. I will note that so ${officerName} has a clearer picture of your scenario.`;
}

function buildInitialBorrowerReview(language: LanguageCode, officerName: string, routing?: RoutingPayload) {
  const intro = introductoryMessage(language, officerName);
  const nextQuestion = determineNextQuestion(language, routing);

  if (language === "pt") {
    return `${intro}

Próxima pergunta para ajudar na qualificação preliminar:
${nextQuestion}`;
  }

  if (language === "es") {
    return `${intro}

Siguiente pregunta para ayudar con la calificación preliminar:
${nextQuestion}`;
  }

  return `${intro}

Next question to help with the preliminary qualification conversation:
${nextQuestion}`;
}

function buildScenarioReview(language: LanguageCode, officerName: string, routing?: RoutingPayload) {
  const intro = scenarioAcknowledgement(language, officerName);
  const nextQuestion = determineNextQuestion(language, routing);

  if (language === "pt") {
    return `${intro}

Próxima pergunta para ajudar na preparação do seu loan officer:
${nextQuestion}`;
  }

  if (language === "es") {
    return `${intro}

Siguiente pregunta para ayudar en la preparación de su loan officer:
${nextQuestion}`;
  }

  return `${intro}

Next question to help prepare your loan officer:
${nextQuestion}`;
}

function buildFollowUpReply(language: LanguageCode, officerName: string, userMessage: string, routing?: RoutingPayload) {
  const answer = buildAnswer(language, userMessage, officerName);
  const nextQuestion = determineNextQuestion(language, routing);

  if (language === "pt") {
    return `${answer}

Próxima pergunta útil:
${nextQuestion}`;
  }

  if (language === "es") {
    return `${answer}

Siguiente pregunta útil:
${nextQuestion}`;
  }

  return `${answer}

Helpful next question:
${nextQuestion}`;
}

function buildInternalSummary(
  stage: string,
  assignedOfficer: LoanOfficerRecord,
  routing?: RoutingPayload
) {
  const borrower = routing?.borrower || {};
  const scenario = routing?.scenario || {};
  const language = routing?.language || "en";
  const convo = conversationToText(routing?.conversation);

  return `
Beyond Intelligence Internal Summary

Stage:
${stage}

Preferred Language:
${language}

Assigned Loan Officer:
${assignedOfficer.name} — NMLS ${assignedOfficer.nmls}

Borrower:
- Name: ${borrower.name || "Not provided"}
- Email: ${borrower.email || "Not provided"}
- Estimated Credit Score: ${borrower.credit || "Not provided"}
- Gross Monthly Income: ${borrower.income || "Not provided"}
- Monthly Debt: ${borrower.debt || "Not provided"}

Target Scenario:
- Estimated Home Price: ${scenario.homePrice || "Not provided"}
- Estimated Down Payment: ${scenario.downPayment || "Not provided"}
- Estimated Loan Amount: ${scenario.estimatedLoanAmount || "Not provided"}
- Estimated LTV: ${scenario.estimatedLtv || "Not provided"}

Conversation Transcript:
${convo || "No additional conversation yet."}

Internal Follow-Up Direction:
- Borrower should be encouraged to complete the full application
- Licensed loan officer must determine program direction, terms, and next steps
- Review documentation needs, borrower goals, occupancy, timeline, and funds to close
- Reach out personally to the borrower with next steps
  `.trim();
}

async function sendResendEmail(args: {
  assignedOfficer: LoanOfficerRecord;
  summary: string;
  routing?: RoutingPayload;
}) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const resendFrom =
    process.env.RESEND_FROM_EMAIL || "Beyond Intelligence <noreply@beyondfinancing.com>";

  if (!resendApiKey) {
    console.log("RESEND_SKIPPED_NO_API_KEY");
    return;
  }

  const borrowerName = args.routing?.borrower?.name || "Unknown Borrower";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: resendFrom,
      to: [args.assignedOfficer.email],
      cc: [args.assignedOfficer.assistantEmail],
      subject: `Beyond Intelligence Interaction — ${borrowerName}`,
      text: args.summary,
    }),
  });

  const text = await response.text();

  if (!response.ok) {
    console.log("RESEND_ERROR", text);
  } else {
    console.log("RESEND_SUCCESS", text);
  }
}

async function sendTwilioSms(args: {
  assignedOfficer: LoanOfficerRecord;
  routing?: RoutingPayload;
}) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!sid || !token || !from) {
    console.log("TWILIO_SKIPPED_MISSING_CONFIG");
    return;
  }

  const borrowerName = args.routing?.borrower?.name || "Unknown Borrower";
  const messageToOfficer = `New Beyond Intelligence interaction received for ${borrowerName}. Review your email summary and follow up promptly.`;
  const messageToAssistant = `New Beyond Intelligence interaction received for ${borrowerName}. Review the assigned loan officer email summary.`;

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");

  const sendOne = async (to: string, body: string) => {
    const payload = new URLSearchParams();
    payload.append("To", `+1${to}`);
    payload.append("From", from);
    payload.append("Body", body);

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: payload.toString(),
      }
    );

    const text = await response.text();

    if (!response.ok) {
      console.log("TWILIO_ERROR", text);
    } else {
      console.log("TWILIO_SUCCESS", text);
    }
  };

  await sendOne(args.assignedOfficer.mobile, messageToOfficer);
  await sendOne(args.assignedOfficer.assistantMobile, messageToAssistant);
}

async function queueInternalNotifications(args: {
  stage: string;
  assignedOfficer: LoanOfficerRecord;
  summary: string;
  routing?: RoutingPayload;
}) {
  console.log("EMAIL_NOTIFICATION_READY", {
    to: args.assignedOfficer.email,
    cc: args.assignedOfficer.assistantEmail,
  });

  console.log("SMS_NOTIFICATION_READY", {
    toOfficer: args.assignedOfficer.mobile,
    toAssistant: args.assignedOfficer.assistantMobile,
  });

  await sendResendEmail({
    assignedOfficer: args.assignedOfficer,
    summary: args.summary,
    routing: args.routing,
  });

  await sendTwilioSms({
    assignedOfficer: args.assignedOfficer,
    routing: args.routing,
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;
    const messages = body?.messages;
    const routing = body?.routing;
    const stage = body?.stage || "follow_up";

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { reply: "Missing or invalid messages array." },
        { status: 400 }
      );
    }

    const latestUserMessage = getLatestUserMessage(messages);

    if (!latestUserMessage.trim()) {
      return NextResponse.json(
        { reply: "The latest message content is empty." },
        { status: 400 }
      );
    }

    const lower = latestUserMessage.toLowerCase();
    const language = getLanguage(routing);
    const assignedOfficer = resolveLoanOfficer(routing);

    const isInitialAnalysisRequest =
      lower.includes("start the borrower conversation as a loan officer assistant") ||
      lower.includes("briefly acknowledge the borrower information already entered");

    const isScenarioReviewRequest =
      lower.includes("the borrower has now entered the target property scenario") ||
      lower.includes("acknowledge it briefly");

    const reply = isInitialAnalysisRequest
      ? buildInitialBorrowerReview(language, assignedOfficer.name, routing)
      : isScenarioReviewRequest
      ? buildScenarioReview(language, assignedOfficer.name, routing)
      : buildFollowUpReply(language, assignedOfficer.name, latestUserMessage, routing);

    const internalSummary = buildInternalSummary(stage, assignedOfficer, routing);

    await queueInternalNotifications({
      stage,
      assignedOfficer,
      summary: internalSummary,
      routing,
    });

    return NextResponse.json({
      reply,
      assignedOfficer: {
        name: assignedOfficer.name,
        nmls: assignedOfficer.nmls,
        email: assignedOfficer.email,
        assistantEmail: assignedOfficer.assistantEmail,
        applyUrl: assignedOfficer.applyUrl,
        scheduleUrl: assignedOfficer.scheduleUrl,
      },
      internalSummaryPrepared: true,
    });
  } catch {
    return NextResponse.json(
      { reply: "Server error processing request." },
      { status: 500 }
    );
  }
}
