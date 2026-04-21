import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_FROM_NUMBER;
const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";

  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (value.startsWith("+")) return value;

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

  if (!to) {
    throw new Error("Missing or invalid destination phone number.");
  }

  const client = getClient();

  const payload: {
    to: string;
    body: string;
    from?: string;
    messagingServiceSid?: string;
  } = {
    to,
    body: params.body,
  };

  if (messagingServiceSid) {
    payload.messagingServiceSid = messagingServiceSid;
  } else if (fromNumber) {
    payload.from = normalizePhone(fromNumber);
  } else {
    throw new Error(
      "Missing Twilio sender. Add TWILIO_FROM_NUMBER or TWILIO_MESSAGING_SERVICE_SID."
    );
  }

  return client.messages.create(payload);
}
