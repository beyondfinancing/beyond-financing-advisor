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
    applyUrl: "https://www.beyondfinancing.com",
    scheduleUrl: "https://www.beyondfinancing.com",
  },
  {
    id: "warren-wendt",
    name: "Warren Wendt",
    nmls: "18959",
    email: "warren@beyondfinancing.com",
    assistantEmail: "myloan@beyondfinancing.com",
    mobile: "9788212250",
    assistantMobile: "8576150836",
    applyUrl: "https://www.beyondfinancing.com",
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
    applyUrl: "https://www.beyondfinancing.com",
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

function buildInitialBorrowerReview(language: LanguageCode, userMessage: string) {
  const lower = userMessage.toLowerCase();

  const hasIncome =
    lower.includes("gross monthly income:") &&
    !lower.includes("gross monthly income: not provided");

  const hasCredit =
    lower.includes("estimated credit score:") &&
    !lower.includes("estimated credit score: not provided");

  const hasDebt =
    lower.includes("monthly debt:") &&
    !lower.includes("monthly debt: not provided");

  if (language === "pt") {
    const strengths: string[] = [];
    const attention: string[] = [];

    if (hasIncome) strengths.push("- A renda foi informada para análise preliminar");
    if (hasCredit) strengths.push("- A pontuação de crédito estimada foi informada");
    if (hasDebt) strengths.push("- A dívida mensal foi informada para contexto inicial");

    if (!hasIncome) attention.push("- A renda ainda precisa ser informada com clareza");
    if (!hasCredit) attention.push("- A pontuação de crédito estimada ainda precisa ser informada");
    if (!hasDebt) attention.push("- A dívida mensal ainda precisa ser informada");

    attention.push("- A elegibilidade final não pode ser determinada apenas com estas informações iniciais");
    attention.push("- Renda, ativos, crédito e ocupação ainda precisam ser documentados");
    attention.push("- A estrutura final do financiamento depende da revisão completa por um loan officer licenciado");

    return `
Revisão Preliminar de Finley Beyond

Pontos positivos gerais deste cenário:
${strengths.length > 0 ? strengths.join("\n") : "- As informações iniciais já permitem começar a conversa preliminar"}

Pontos que ainda podem exigir atenção:
${attention.join("\n")}

Próximos passos recomendados:
- Revisar o perfil inicial com um loan officer licenciado
- Informar agora o valor estimado do imóvel e a entrada estimada
- Preparar-se para conversar sobre pagamento mensal confortável, fundos disponíveis e documentação
- Permitir que o loan officer analise o cenário completo com base nas exigências atuais

Lembrete importante:
Esta é apenas uma orientação preliminar. A orientação final deve vir de um loan officer licenciado após a revisão completa do cenário e dos requisitos atuais.
    `.trim();
  }

  if (language === "es") {
    const strengths: string[] = [];
    const attention: string[] = [];

    if (hasIncome) strengths.push("- El ingreso fue informado para la revisión preliminar");
    if (hasCredit) strengths.push("- Se proporcionó el puntaje de crédito estimado");
    if (hasDebt) strengths.push("- La deuda mensual fue incluida para contexto inicial");

    if (!hasIncome) attention.push("- El ingreso aún debe informarse con claridad");
    if (!hasCredit) attention.push("- El puntaje de crédito estimado aún debe informarse");
    if (!hasDebt) attention.push("- La deuda mensual aún debe informarse");

    attention.push("- La elegibilidad final no puede determinarse solo con esta información inicial");
    attention.push("- Ingresos, activos, crédito y ocupación aún deben documentarse");
    attention.push("- La estructura final del financiamiento depende de la revisión completa por un loan officer con licencia");

    return `
Revisión Preliminar de Finley Beyond

Fortalezas generales de este escenario:
${strengths.length > 0 ? strengths.join("\n") : "- La información inicial ya permite comenzar la conversación preliminar"}

Aspectos que pueden requerir atención:
${attention.join("\n")}

Siguientes pasos recomendables:
- Revisar el perfil inicial con un loan officer con licencia
- Ingresar ahora el precio estimado de la vivienda y el pago inicial estimado
- Prepararse para hablar sobre el pago mensual cómodo, fondos disponibles y documentación
- Permitir que el loan officer revise el escenario completo conforme a los requisitos actuales

Recordatorio importante:
Esta es únicamente una orientación preliminar. La orientación final debe provenir de un loan officer con licencia después de revisar completamente el escenario y los requisitos vigentes.
    `.trim();
  }

  const strengths: string[] = [];
  const attention: string[] = [];

  if (hasIncome) {
    strengths.push(
      "- Income information has been entered, which helps begin the preliminary review"
    );
  } else {
    attention.push(
      "- Income details still need to be entered clearly for a more useful review"
    );
  }

  if (hasCredit) {
    strengths.push(
      "- Estimated credit information has been provided for preliminary context"
    );
  } else {
    attention.push(
      "- Estimated credit information is still needed for better initial context"
    );
  }

  if (hasDebt) {
    strengths.push(
      "- Monthly debt has been included, which helps frame the payment discussion"
    );
  } else {
    attention.push(
      "- Monthly debt details should be included to better understand the overall picture"
    );
  }

  attention.push("- Final eligibility cannot be determined from intake alone");
  attention.push(
    "- Income, assets, credit, and occupancy must still be fully documented"
  );
  attention.push(
    "- Final payment structure and overall options depend on full review by a licensed loan officer"
  );

  return `
Finley Beyond Preliminary Review

General strengths in this scenario:
${strengths.length > 0 ? strengths.join("\n") : "- Basic information can now start the preliminary conversation"}

General areas that may need attention:
${attention.join("\n")}

Reasonable next steps:
- Review the basic borrower profile with a licensed loan officer
- Enter the target home price and estimated down payment next
- Prepare to discuss monthly payment comfort, available funds, and documentation
- Allow the licensed loan officer to review the full scenario under current requirements

Important reminder:
This is preliminary guidance only. Final direction must come from a licensed loan officer after full review of the scenario and current program requirements.
  `.trim();
}

function buildScenarioReview(language: LanguageCode, userMessage: string) {
  const lower = userMessage.toLowerCase();

  const hasHomePrice =
    lower.includes("estimated home price:") &&
    !lower.includes("estimated home price: not provided");

  const hasDownPayment =
    lower.includes("estimated down payment:") &&
    !lower.includes("estimated down payment: not provided");

  const mentionsHighLtv =
    lower.includes("estimated ltv: 9") ||
    lower.includes("94%") ||
    lower.includes("95%");

  if (language === "pt") {
    const factors = [
      "- Conforto com o pagamento mensal",
      "- Renda documentada e obrigações mensais",
      "- Fundos disponíveis para fechamento e reservas",
      "- Revisão completa por um loan officer licenciado com base nas exigências atuais",
    ];

    if (mentionsHighLtv) {
      factors.push(
        "- Uma estrutura com LTV mais alto pode reduzir a flexibilidade e aumentar a sensibilidade do pagamento"
      );
    }

    return `
Revisão do Cenário por Finley Beyond

O que este cenário significa em termos gerais:
${
  hasHomePrice && hasDownPayment
    ? "Você já informou um cenário realista de compra, o que ajuda a orientar melhor a conversa preliminar sobre pagamento, fundos necessários para fechar e estrutura geral do financiamento."
    : "O cenário do imóvel ainda precisa ser completado para que a conversa seja baseada nos números que você realmente considera."
}

Itens que devem ser discutidos com um loan officer licenciado:
- Faixa de preço do imóvel que você pretende comprar
- Entrada que você espera ter disponível
- Valor mensal de pagamento com o qual você se sente confortável
- Se deseja manter reserva de caixa após o fechamento
- Qualquer detalhe de renda, dívida ou ativos que possa influenciar a análise

Fatores gerais que podem influenciar este cenário:
${factors.join("\n")}

Lembrete importante:
Isto continua sendo apenas orientação preliminar. A orientação final deve vir de um loan officer licenciado após a revisão completa do cenário.
    `.trim();
  }

  if (language === "es") {
    const factors = [
      "- Comodidad con el pago mensual",
      "- Ingresos documentados y obligaciones mensuales",
      "- Fondos disponibles para cierre y reservas",
      "- Revisión completa por un loan officer con licencia bajo los requisitos vigentes",
    ];

    if (mentionsHighLtv) {
      factors.push(
        "- Una estructura con LTV más alto puede reducir la flexibilidad y aumentar la sensibilidad del pago"
      );
    }

    return `
Revisión del Escenario por Finley Beyond

Qué significa este escenario a nivel general:
${
  hasHomePrice && hasDownPayment
    ? "Ahora ha proporcionado un escenario realista de compra, lo que ayuda a orientar mejor la conversación preliminar sobre pagos, fondos necesarios para cerrar y la estructura general del financiamiento."
    : "El escenario de la propiedad aún debe completarse para que la conversación se base en los números que realmente está considerando."
}

Aspectos que debe conversar con un loan officer con licencia:
- El rango de precio de vivienda que desea comprar
- El pago inicial que espera tener disponible
- El pago mensual con el que se siente cómodo
- Si desea conservar efectivo adicional después del cierre
- Cualquier detalle de ingresos, deudas o activos que pueda afectar la revisión

Factores generales que pueden influir en este escenario:
${factors.join("\n")}

Recordatorio importante:
Esto sigue siendo orientación preliminar. La orientación final debe provenir de un loan officer con licencia después de una revisión completa del escenario.
    `.trim();
  }

  const factors = [
    "- Overall monthly payment comfort",
    "- Documented income and monthly obligations",
    "- Available funds needed for closing and reserves",
    "- The complete review by a licensed loan officer under current requirements",
  ];

  if (mentionsHighLtv) {
    factors.push(
      "- A higher loan-to-value structure may reduce flexibility and increase payment sensitivity"
    );
  }

  return `
Finley Beyond Scenario Review

What this target scenario means at a high level:
${
  hasHomePrice && hasDownPayment
    ? "You have now provided a target purchase scenario, which helps frame a more realistic preliminary conversation around payment expectations, funds needed to close, and the overall structure of the file."
    : "The target purchase scenario still needs to be completed so the conversation can be tied to the actual numbers you are considering."
}

Items to be prepared to discuss with a licensed loan officer:
- The home price range you are truly targeting
- The down payment you expect to have available
- Your preferred monthly payment comfort range
- Whether you want to preserve additional cash after closing
- Any income, debt, or asset details that may affect the review

General factors that may influence whether this scenario is workable:
${factors.join("\n")}

Important reminder:
This remains preliminary guidance only. Final guidance must come from a licensed loan officer after complete review of the full scenario.
  `.trim();
}

function buildFollowUpReply(language: LanguageCode, userMessage: string) {
  const lower = userMessage.toLowerCase();

  if (
    lower.includes("voce fala portugues") ||
    lower.includes("você fala português") ||
    lower.includes("fala portugues") ||
    lower.includes("fala português")
  ) {
    return `
Sim. Eu posso responder em português.

Você pode continuar esta conversa em português, e eu vou fornecer orientação preliminar sobre o seu cenário de financiamento. A orientação final, no entanto, ainda deve ser confirmada por um loan officer licenciado com base nas diretrizes e requisitos atuais.
    `.trim();
  }

  if (
    lower.includes("do you speak portuguese") ||
    lower.includes("speak portuguese") ||
    lower.includes("hablas portugués") ||
    lower.includes("habla portugues")
  ) {
    if (language === "pt") {
      return `
Sim. Posso continuar em português.

Você pode fazer suas perguntas em português, e eu responderei em português com orientação preliminar. A orientação final ainda deve ser confirmada por um loan officer licenciado.
      `.trim();
    }

    if (language === "es") {
      return `
Sí. También puedo responder en portugués si así lo prefiere.

Puede continuar en portugués o en español. De cualquier manera, la orientación final deberá ser confirmada por un loan officer con licencia.
      `.trim();
    }

    return `
Yes. I can also respond in Portuguese.

You may continue in Portuguese, and I will respond accordingly. Final guidance must still be confirmed by a licensed loan officer.
    `.trim();
  }

  if (
    lower.includes("what do i need to purchase this home") ||
    lower.includes("what do i need to buy this home") ||
    lower.includes("o que eu preciso para comprar esta casa") ||
    lower.includes("que necesito para comprar esta casa")
  ) {
    if (language === "pt") {
      return `
Para avançar na compra deste imóvel, normalmente será importante estar preparado para apresentar e discutir:

- documentação de renda,
- documentação de ativos e fundos disponíveis,
- entrada estimada,
- dívida mensal atual,
- conforto com o pagamento mensal,
- e quaisquer detalhes que possam afetar a análise do financiamento.

Também será importante revisar o cenário completo com um loan officer licenciado, que poderá orientar você sobre a documentação necessária e os próximos passos apropriados.
      `.trim();
    }

    if (language === "es") {
      return `
Para avanzar con la compra de esta vivienda, normalmente será importante estar preparado para presentar y conversar sobre:

- documentación de ingresos,
- documentación de activos y fondos disponibles,
- pago inicial estimado,
- deuda mensual actual,
- comodidad con el pago mensual,
- y cualquier detalle que pueda afectar la revisión del financiamiento.

También será importante revisar el escenario completo con un loan officer con licencia, quien podrá orientarle sobre la documentación necesaria y los pasos adecuados a seguir.
      `.trim();
    }

    return `
To move forward with purchasing this home, it will usually be important to be prepared to provide and discuss:

- income documentation,
- asset documentation and available funds,
- estimated down payment,
- current monthly debt,
- monthly payment comfort,
- and any details that may affect financing review.

It will also be important to review the full scenario with a licensed loan officer, who can guide you on the exact documentation needed and the appropriate next steps.
    `.trim();
  }

  if (
    lower.includes("can i purchase a home") ||
    lower.includes("can i buy a house") ||
    lower.includes("can i purchase this home") ||
    lower.includes("posso comprar uma casa") ||
    lower.includes("posso comprar esta casa") ||
    lower.includes("puedo comprar una casa") ||
    lower.includes("puedo comprar esta casa")
  ) {
    if (language === "pt") {
      return `
Com base nas informações inseridas até agora, pode ser possível continuar explorando a compra de uma casa, mas isso não pode ser confirmado apenas com uma conversa preliminar.

O que será importante agora é revisar:
- sua renda completa,
- suas dívidas mensais,
- os fundos disponíveis para fechamento,
- o valor do imóvel que você deseja comprar,
- e o pagamento mensal com o qual você se sente confortável.

O melhor próximo passo é completar o cenário do imóvel e conversar com um loan officer licenciado para uma revisão completa.
      `.trim();
    }

    if (language === "es") {
      return `
Con base en la información ingresada hasta ahora, puede ser posible seguir explorando la compra de una vivienda, pero eso no puede confirmarse solo con una conversación preliminar.

Lo importante ahora será revisar:
- sus ingresos completos,
- sus deudas mensuales,
- los fondos disponibles para el cierre,
- el valor de la propiedad que desea comprar,
- y el pago mensual con el que se siente cómodo.

El mejor siguiente paso es completar el escenario de la propiedad y conversar con un loan officer con licencia para una revisión completa.
      `.trim();
    }

    return `
Based on the information entered so far, it may be possible to continue exploring the purchase of a home, but that cannot be confirmed through a preliminary conversation alone.

What will matter next is reviewing:
- your full income,
- your monthly obligations,
- the funds available for closing,
- the property price you are targeting,
- and the monthly payment you are comfortable with.

The best next step is to complete the property scenario and speak with a licensed loan officer for a full review.
    `.trim();
  }

  if (
    lower.includes("how can i apply") ||
    lower.includes("apply for mortgage") ||
    lower.includes("how do i apply") ||
    lower.includes("como aplicar") ||
    lower.includes("como posso aplicar") ||
    lower.includes("como solicito") ||
    lower.includes("cómo aplicar") ||
    lower.includes("cómo puedo aplicar")
  ) {
    if (language === "pt") {
      return `
Um próximo passo prático é concluir suas informações básicas e o cenário do imóvel e, em seguida, iniciar o processo formal com o loan officer atribuído.

Em geral, aplicar para um financiamento envolve:
- fornecer suas informações de contato e financeiras,
- apresentar documentação de renda e ativos,
- autorizar a análise de crédito quando apropriado,
- e revisar o cenário completo com um loan officer licenciado.

Você também pode usar o botão "Aplicar Agora" para seguir diretamente ao próximo passo.
      `.trim();
    }

    if (language === "es") {
      return `
Un siguiente paso práctico es completar su información básica y el escenario de la propiedad, y luego iniciar el proceso formal con el loan officer asignado.

En general, solicitar una hipoteca suele implicar:
- proporcionar su información de contacto y financiera,
- presentar documentación de ingresos y activos,
- autorizar la revisión de crédito cuando corresponda,
- y revisar el escenario completo con un loan officer con licencia.

También puede utilizar el botón "Aplicar Ahora" para avanzar directamente al siguiente paso.
      `.trim();
    }

    return `
A practical next step is to complete your basic information and property scenario and then begin the formal process with the assigned loan officer.

In general, applying for a mortgage usually involves:
- providing your contact and financial information,
- sharing income and asset documentation,
- authorizing credit review when appropriate,
- and reviewing the full scenario with a licensed loan officer.

You may also use the "Apply Now" button to move directly to the next step.
    `.trim();
  }

  if (
    lower.includes("speak with a loan officer") ||
    lower.includes("talk to a loan officer") ||
    lower.includes("contact a loan officer") ||
    lower.includes("falar com um loan officer") ||
    lower.includes("falar com o loan officer") ||
    lower.includes("hablar con un loan officer")
  ) {
    if (language === "pt") {
      return `
O melhor próximo passo é entrar em contato diretamente com o loan officer atribuído depois de concluir as informações do cliente e o cenário do imóvel.

Você pode usar:
- o botão "Agendar com o Loan Officer" para marcar um horário,
- ou o botão "Enviar Email ao Loan Officer" para entrar em contato por email.

Quando falar com o loan officer, esteja pronto para conversar sobre sua renda, dívidas mensais, entrada estimada, valor do imóvel e o pagamento mensal com o qual você se sente confortável.
      `.trim();
    }

    if (language === "es") {
      return `
El mejor siguiente paso es comunicarse directamente con el loan officer asignado después de completar la información del cliente y el escenario de la propiedad.

Puede usar:
- el botón "Agendar con el Loan Officer" para reservar una cita,
- o el botón "Enviar Correo al Loan Officer" para comunicarse por email.

Cuando hable con el loan officer, esté preparado para conversar sobre sus ingresos, deudas mensuales, pago inicial estimado, valor de la propiedad y el pago mensual con el que se siente cómodo.
      `.trim();
    }

    return `
The best next step is to connect directly with the assigned loan officer after completing your borrower information and property scenario.

You may use:
- the "Schedule with Loan Officer" button to book a time,
- or the "Email Loan Officer" button to contact them directly by email.

When you speak with the loan officer, be prepared to discuss your income, monthly debts, estimated down payment, target property price, and the monthly payment you are comfortable with.
    `.trim();
  }

  if (
    lower.includes("document") ||
    lower.includes("documents") ||
    lower.includes("prepare next") ||
    lower.includes("collect first") ||
    lower.includes("documentação") ||
    lower.includes("documentacion") ||
    lower.includes("documentación")
  ) {
    if (language === "pt") {
      return `
Um próximo passo forte é reunir a documentação principal com antecedência para que o loan officer possa revisar o cenário com mais eficiência.

Documentos úteis para separar:
- comprovantes recentes de renda,
- extratos recentes de ativos,
- documento de identificação,
- informações sobre dívidas atuais,
- e documentação relacionada a gift funds, depósitos grandes ou outros recursos usados na compra.

Seu loan officer poderá informar exatamente quais documentos adicionais serão necessários para o seu caso.
      `.trim();
    }

    if (language === "es") {
      return `
Un siguiente paso sólido es reunir la documentación principal con anticipación para que el loan officer pueda revisar el escenario con mayor eficiencia.

Documentos útiles para preparar:
- comprobantes recientes de ingresos,
- estados recientes de activos,
- identificación oficial,
- información sobre deudas actuales,
- y documentación relacionada con gift funds, depósitos grandes u otros recursos utilizados en la compra.

Su loan officer podrá indicarle exactamente qué documentación adicional será necesaria para su caso.
      `.trim();
    }

    return `
A strong next step is to gather the core documentation early so the loan officer can review the scenario more efficiently.

Helpful documents to prepare:
- recent income documentation,
- recent asset statements,
- government-issued identification,
- information about current debts,
- and documentation related to gift funds, large deposits, or other funds being used for the purchase.

Your loan officer can then tell you exactly what additional documentation may be needed for your specific case.
    `.trim();
  }

  if (
    lower.includes("improve") ||
    lower.includes("strengthen") ||
    lower.includes("make my file stronger") ||
    lower.includes("melhorar meu arquivo") ||
    lower.includes("fortalecer meu caso") ||
    lower.includes("mejorar mi perfil")
  ) {
    if (language === "pt") {
      return `
Para fortalecer um cenário, normalmente ajuda focar nos pontos que um loan officer analisará com mais atenção:

Formas comuns de fortalecer o perfil:
- manter bem documentados os fundos para fechamento e reservas,
- reduzir dívidas mensais quando possível,
- evitar mudanças relevantes no crédito durante a análise,
- apresentar documentação completa e consistente,
- e discutir com antecedência o pagamento mensal confortável e o cash-to-close esperado.

Seu loan officer poderá dizer quais fatores têm mais peso no seu caso específico.
      `.trim();
    }

    if (language === "es") {
      return `
Para fortalecer un escenario, normalmente ayuda enfocarse en los puntos que un loan officer revisará con mayor atención:

Formas comunes de fortalecer el perfil:
- mantener bien documentados los fondos para cierre y reservas,
- reducir deudas mensuales cuando sea posible,
- evitar cambios importantes en el crédito durante la revisión,
- presentar documentación completa y consistente,
- y conversar con anticipación sobre el pago mensual cómodo y el cash-to-close esperado.

Su loan officer podrá indicarle qué factores pesan más en su caso específico.
      `.trim();
    }

    return `
To strengthen a scenario, it usually helps to focus on the areas a loan officer will review most closely:

Common ways to strengthen the file:
- keep funds for closing and reserves well documented,
- reduce monthly debt where practical,
- avoid major credit changes during the review,
- provide complete and consistent documentation,
- and discuss monthly payment comfort and expected cash to close early.

Your loan officer can then explain which factors matter most in your specific case.
    `.trim();
  }

  if (
    lower.includes("down payment") ||
    lower.includes("put more down") ||
    lower.includes("increase the down payment") ||
    lower.includes("entrada") ||
    lower.includes("pago inicial")
  ) {
    if (language === "pt") {
      return `
Aumentar a entrada pode melhorar a estrutura geral do cenário.

Benefícios possíveis:
- menor valor financiado,
- menor LTV,
- menor impacto no pagamento mensal,
- e maior flexibilidade dependendo da revisão completa do cenário.

Seu loan officer poderá comparar os números atualizados e explicar como uma entrada maior pode afetar a estrutura do financiamento.
      `.trim();
    }

    if (language === "es") {
      return `
Aumentar el pago inicial puede mejorar la estructura general del escenario.

Posibles beneficios:
- menor monto financiado,
- menor LTV,
- menor impacto en el pago mensual,
- y mayor flexibilidad dependiendo de la revisión completa del escenario.

Su loan officer podrá comparar los números actualizados y explicarle cómo un pago inicial mayor puede afectar la estructura del financiamiento.
      `.trim();
    }

    return `
Increasing the down payment may improve the overall structure of the scenario.

Possible benefits may include:
- a lower financed amount,
- a lower LTV,
- a lower monthly payment impact,
- and greater flexibility depending on the complete review of the scenario.

Your loan officer can compare the updated numbers and explain how a larger down payment may affect the structure of the financing.
    `.trim();
  }

  if (
    lower.includes("monthly payment") ||
    lower.includes("payment") ||
    lower.includes("afford") ||
    lower.includes("pagamento mensal") ||
    lower.includes("pago mensual")
  ) {
    if (language === "pt") {
      return `
O conforto com o pagamento mensal deve ser analisado juntamente com a renda, as dívidas, os fundos necessários para fechar e a despesa total com habitação.

Um próximo passo útil é conversar sobre:
- a faixa ideal de pagamento mensal,
- quanto caixa você deseja manter após o fechamento,
- e qual nível de flexibilidade é mais importante para você.

Seu loan officer poderá ajudar a comparar cenários realistas com base nas condições atuais e na documentação completa.
      `.trim();
    }

    if (language === "es") {
      return `
La comodidad con el pago mensual debe revisarse junto con los ingresos, las deudas, los fondos necesarios para cerrar y el gasto total de vivienda.

Un siguiente paso útil es conversar sobre:
- el rango ideal de pago mensual,
- cuánto efectivo desea conservar después del cierre,
- y qué nivel de flexibilidad es más importante para usted.

Su loan officer podrá ayudarle a comparar escenarios realistas según las condiciones actuales y la documentación completa.
      `.trim();
    }

    return `
Monthly payment comfort should be reviewed together with income, debts, funds needed to close, and the total housing expense.

A helpful next step is to discuss:
- your ideal monthly payment range,
- how much cash you want to preserve after closing,
- and what level of flexibility matters most to you.

Your loan officer can help compare realistic scenarios based on current conditions and complete documentation.
    `.trim();
  }

  if (
    lower.includes("self-employed") ||
    lower.includes("self employed") ||
    lower.includes("1099") ||
    lower.includes("autônomo") ||
    lower.includes("autonomo") ||
    lower.includes("trabajador independiente")
  ) {
    if (language === "pt") {
      return `
Se a renda for de autônomo ou não assalariada, o processo de revisão pode exigir um caminho de documentação diferente.

Normalmente, o loan officer precisará revisar:
- como a renda é obtida,
- há quanto tempo ela é recebida,
- como ela é documentada,
- e se essa renda pode ser usada com base nas exigências atuais.

O melhor próximo passo é apresentar um quadro claro da fonte de renda para que o loan officer possa avaliá-la corretamente.
      `.trim();
    }

    if (language === "es") {
      return `
Si el ingreso es de trabajador independiente o no asalariado, el proceso de revisión puede requerir una ruta de documentación diferente.

Normalmente, el loan officer querrá revisar:
- cómo se obtiene el ingreso,
- cuánto tiempo lleva recibiéndose,
- cómo se documenta,
- y si ese ingreso puede utilizarse bajo los requisitos actuales.

El mejor siguiente paso es presentar un panorama claro de la fuente de ingreso para que el loan officer pueda evaluarla correctamente.
      `.trim();
    }

    return `
If the income is self-employed or non-salaried, the review process may require a different documentation path.

Typically, the loan officer will want to review:
- how the income is earned,
- how long it has been received,
- how it is documented,
- and whether that income can be used under current requirements.

The best next step is to present a clear picture of the income source so the loan officer can evaluate it properly.
    `.trim();
  }

  if (language === "pt") {
    return `
Essa é uma boa pergunta para ser analisada dentro do cenário completo.

O próximo passo mais prático é continuar refinando o perfil do cliente, completar o valor do imóvel e a entrada, e discutir o cenário completo com um loan officer licenciado.

Se quiser, você pode fazer uma pergunta mais específica sobre:
- se o cenário parece viável,
- como aplicar,
- como falar com um loan officer,
- documentação,
- estratégia de entrada,
- conforto com o pagamento,
- ou como fortalecer o seu perfil.
    `.trim();
  }

  if (language === "es") {
    return `
Esa es una buena pregunta para analizar dentro del escenario completo.

El siguiente paso más práctico es seguir refinando el perfil del cliente, completar el precio de la propiedad y el pago inicial, y conversar sobre el escenario completo con un loan officer con licencia.

Si desea, puede hacer una pregunta más específica sobre:
- si el escenario parece viable,
- cómo aplicar,
- cómo hablar con un loan officer,
- documentación,
- estrategia de pago inicial,
- comodidad con el pago,
- o cómo fortalecer su perfil.
    `.trim();
  }

  return `
That is a good question to review within the full scenario.

The most practical next step is to keep refining the borrower profile, complete the property price and down payment, and discuss the full scenario with a licensed loan officer.

If you want, you can ask a more specific follow-up question about:
- whether the scenario seems workable,
- how to apply,
- how to speak with a loan officer,
- documentation,
- down payment strategy,
- payment comfort,
- or how to strengthen the file.
  `.trim();
}

function buildInternalSummary(
  stage: string,
  assignedOfficer: LoanOfficerRecord,
  routing?: RoutingPayload
) {
  const borrower = routing?.borrower || {};
  const scenario = routing?.scenario || {};
  const language = routing?.language || "en";

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

Internal Follow-Up Direction:
- Review borrower contact information promptly
- Review conversation summary and scenario inputs
- Evaluate likely program directions internally
- Determine documentation needs and next borrower contact steps
- Confirm guidance under current investor guidelines and overlays
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

    const isInitialAnalysisRequest =
      lower.includes(
        "general strengths based on the borrower information currently entered"
      ) ||
      lower.includes("general areas that may need attention") ||
      lower.includes("clear next steps for the borrower");

    const isScenarioReviewRequest =
      lower.includes("the borrower has now entered the target property scenario") ||
      lower.includes("what this target scenario means at a high level") ||
      lower.includes(
        "general factors that may influence whether this target scenario is workable"
      );

    const assignedOfficer = resolveLoanOfficer(routing);

    const reply = isInitialAnalysisRequest
      ? buildInitialBorrowerReview(language, latestUserMessage)
      : isScenarioReviewRequest
      ? buildScenarioReview(language, latestUserMessage)
      : buildFollowUpReply(language, latestUserMessage);

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
