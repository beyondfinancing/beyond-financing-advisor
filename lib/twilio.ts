import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_FROM_NUMBER;
const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

function normalizePhone(value: string): string {
  const raw = String(value || "").trim();
  if (!raw) return "";

  if (raw.startsWith("+")) {
    const plusNormalized = `+${raw.slice(1).replace(/\D/g, "")}`;
    return plusNormalized === "+" ? "" : plusNormalized;
  }

  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";

  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;

  return `+${digits}`;
}

function getClient() {
  if (!accountSid || !authToken) {
    throw new Error("Missing Twilio credentials.");
  }

  return twilio(accountSid, authToken);
}

export async function sendSmsAlert(params: {
  to: string;
  body: string;
}) {
  const to = normalizePhone(params.to);
  const normalizedFrom = fromNumber ? normalizePhone(fromNumber) : "";
  const messageBody = String(params.body || "").trim();

  if (!to) {
    throw new Error("Missing or invalid destination phone number.");
  }

  if (!messageBody) {
    throw new Error("Missing SMS body.");
  }

  const client = getClient();

  const payload: {
    to: string;
    body: string;
    from?: string;
    messagingServiceSid?: string;
  } = {
    to,
    body: messageBody,
  };

  if (messagingServiceSid?.trim()) {
    payload.messagingServiceSid = messagingServiceSid.trim();
  } else if (normalizedFrom) {
    payload.from = normalizedFrom;
  } else {
    throw new Error(
      "Missing Twilio sender. Add TWILIO_FROM_NUMBER or TWILIO_MESSAGING_SERVICE_SID."
    );
  }

  try {
    const message = await client.messages.create(payload);

    console.log("TWILIO SMS SENT:", {
      sid: message.sid,
      to: message.to,
      from: message.from,
      status: message.status,
      messagingServiceSid: message.messagingServiceSid,
      errorCode: message.errorCode,
      errorMessage: message.errorMessage,
    });

    return message;
  } catch (error) {
    console.error("TWILIO SEND ERROR:", {
      to,
      usingMessagingServiceSid: !!payload.messagingServiceSid,
      from: payload.from || null,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      error,
    });

    throw error;
  }
}
