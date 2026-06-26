import axios from "axios";
import { logger } from "../lib/logger";

const MPESA_BASE_URL = process.env["MPESA_ENV"] === "production"
  ? "https://api.safaricom.co.ke"
  : "https://sandbox.safaricom.co.ke";

function getTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    now.getFullYear().toString() +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds())
  );
}

async function getAccessToken(): Promise<string> {
  const consumerKey = process.env["MPESA_CONSUMER_KEY"];
  const consumerSecret = process.env["MPESA_CONSUMER_SECRET"];

  if (!consumerKey || !consumerSecret) {
    throw new Error("MPESA_CONSUMER_KEY and MPESA_CONSUMER_SECRET are required");
  }

  const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");

  const response = await axios.get(
    `${MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
    {
      headers: { Authorization: `Basic ${credentials}` },
    }
  );

  return response.data.access_token as string;
}

export function normalizePhone(phone: string): string {
  // Convert 07XXXXXXXX to 2547XXXXXXXX
  const cleaned = phone.replace(/\s+/g, "");
  if (cleaned.startsWith("0")) {
    return "254" + cleaned.slice(1);
  }
  if (cleaned.startsWith("+254")) {
    return cleaned.slice(1);
  }
  return cleaned;
}

export interface StkPushResult {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

export async function initiateSTKPush(params: {
  phone: string;
  amount: number;
  orderId: string;
  description: string;
}): Promise<StkPushResult> {
  const shortcode = process.env["MPESA_SHORTCODE"];
  const passkey = process.env["MPESA_PASSKEY"];
  const callbackUrl = process.env["MPESA_CALLBACK_URL"];

  if (!shortcode || !passkey || !callbackUrl) {
    throw new Error("MPESA_SHORTCODE, MPESA_PASSKEY, and MPESA_CALLBACK_URL are required");
  }

  const timestamp = getTimestamp();
  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");
  const normalizedPhone = normalizePhone(params.phone);

  const accessToken = await getAccessToken();

  const payload = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: Math.ceil(params.amount),
    PartyA: normalizedPhone,
    PartyB: shortcode,
    PhoneNumber: normalizedPhone,
    CallBackURL: callbackUrl,
    AccountReference: `ORDER-${params.orderId}`,
    TransactionDesc: params.description.slice(0, 13),
  };

  logger.info({ phone: normalizedPhone, amount: params.amount }, "Initiating M-Pesa STK push");

  const response = await axios.post(
    `${MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  return response.data as StkPushResult;
}

export async function queryStkStatus(checkoutRequestId: string): Promise<{
  ResultCode: string;
  ResultDesc: string;
}> {
  const shortcode = process.env["MPESA_SHORTCODE"];
  const passkey = process.env["MPESA_PASSKEY"];

  if (!shortcode || !passkey) {
    throw new Error("MPESA_SHORTCODE and MPESA_PASSKEY are required");
  }

  const timestamp = getTimestamp();
  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");

  const accessToken = await getAccessToken();

  const response = await axios.post(
    `${MPESA_BASE_URL}/mpesa/stkpushquery/v1/query`,
    {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  return response.data as { ResultCode: string; ResultDesc: string };
}
