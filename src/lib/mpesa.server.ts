import { z } from "zod";
import { normalizeMpesaPhone, RENEWAL_AMOUNT_KES } from "./listing-visibility";
function configuration() {
  const key = process.env["MPESA_CONSUMER_KEY"],
    secret = process.env["MPESA_CONSUMER_SECRET"],
    passkey = process.env["MPESA_PASSKEY"],
    shortcode = process.env["MPESA_SHORTCODE"];
  if (!key || !secret || !passkey || !shortcode)
    throw new Error("M-Pesa payment setup is not complete yet.");
  const live = process.env["MPESA_ENVIRONMENT"] === "live";
  return {
    key,
    secret,
    passkey,
    shortcode,
    environment: live ? ("live" as const) : ("sandbox" as const),
    base: live ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke",
  };
}
export function mpesaAvailable() {
  return Boolean(
    process.env["MPESA_CONSUMER_KEY"] &&
    process.env["MPESA_CONSUMER_SECRET"] &&
    process.env["MPESA_PASSKEY"] &&
    process.env["MPESA_SHORTCODE"],
  );
}
export function mpesaEnvironment() {
  return process.env["MPESA_ENVIRONMENT"] === "live" ? ("live" as const) : ("sandbox" as const);
}
export async function darajaPreflight() {
  const c = configuration();
  await authorize(c);
  return { environment: c.environment };
}
async function authorize(config: ReturnType<typeof configuration>) {
  const r = await fetch(`${config.base}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.key}:${config.secret}`).toString("base64")}`,
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`Daraja authorization unavailable (${r.status}).`);
  return z.object({ access_token: z.string().min(1) }).parse(await r.json()).access_token;
}
function timestamp() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(new Date())
    .replace(/\D/g, "");
}
export async function pushRenewal(phone: string, reference: string, callbackUrl: string) {
  const c = configuration(),
    token = await authorize(c),
    stamp = timestamp();
  const r = await fetch(`${c.base}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      BusinessShortCode: c.shortcode,
      Password: Buffer.from(`${c.shortcode}${c.passkey}${stamp}`).toString("base64"),
      Timestamp: stamp,
      TransactionType:
        process.env["MPESA_TRANSACTION_TYPE"] === "CustomerBuyGoodsOnline"
          ? "CustomerBuyGoodsOnline"
          : "CustomerPayBillOnline",
      Amount: RENEWAL_AMOUNT_KES,
      PartyA: normalizeMpesaPhone(phone),
      PartyB: c.shortcode,
      PhoneNumber: normalizeMpesaPhone(phone),
      CallBackURL: callbackUrl,
      AccountReference: reference.slice(0, 12),
      TransactionDesc: "IP listing renewal",
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error(`M-Pesa prompt unavailable (${r.status}). Check Daraja settings.`);
  const result = z
    .object({
      ResponseCode: z.string(),
      ResponseDescription: z.string().optional(),
      MerchantRequestID: z.string().optional(),
      CheckoutRequestID: z.string().optional(),
    })
    .parse(await r.json());
  if (result.ResponseCode !== "0" || !result.CheckoutRequestID || !result.MerchantRequestID)
    throw new Error("Daraja did not accept the payment prompt. No renewal has been applied.");
  return { checkout: result.CheckoutRequestID, merchant: result.MerchantRequestID };
}
export async function verifyRenewal(paymentId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: claimed, error } = await supabaseAdmin.rpc("claim_listing_payment_check", {
    p_id: paymentId,
  });
  if (error) throw error;
  if (!claimed) return { status: "pending" };
  const { data: p } = await supabaseAdmin
    .from("listing_payments")
    .select("*")
    .eq("id", paymentId)
    .single();
  if (!p?.checkout_request_id) return { status: "pending" };
  try {
    const c = configuration();
    if (c.environment !== p.environment)
      throw new Error("Payment environment does not match current Daraja settings.");
    const token = await authorize(c),
      stamp = timestamp();
    const r = await fetch(`${c.base}/mpesa/stkpushquery/v1/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        BusinessShortCode: c.shortcode,
        Password: Buffer.from(`${c.shortcode}${c.passkey}${stamp}`).toString("base64"),
        Timestamp: stamp,
        CheckoutRequestID: p.checkout_request_id,
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) throw new Error(`Daraja payment verification unavailable (${r.status}).`);
    const response = z
      .object({
        CheckoutRequestID: z.string().optional(),
        MerchantRequestID: z.string().optional(),
        ResultCode: z.union([z.string(), z.number()]).optional(),
        ResultDesc: z.string().optional(),
        errorCode: z.string().optional(),
      })
      .parse(await r.json());
    if (response.ResultCode === undefined) return { status: "pending" };
    if (
      response.CheckoutRequestID !== p.checkout_request_id ||
      response.MerchantRequestID !== p.merchant_request_id
    )
      throw new Error("Provider checkout identifiers did not match. No renewal applied.");
    const code = String(response.ResultCode);
    if (code === "0") {
      const { error: applyError } = await supabaseAdmin.rpc("apply_verified_listing_payment", {
        p_id: p.id,
        p_confirmed_at: new Date().toISOString(),
        p_code: code,
        p_message: "Successful Daraja STK status verification",
      });
      if (applyError) throw applyError;
      return { status: "succeeded" };
    }
    const { error: failed } = await supabaseAdmin
      .from("listing_payments")
      .update({
        status: "failed",
        provider_result_code: code,
        provider_message: "M-Pesa payment did not complete.",
        updated_at: new Date().toISOString(),
      })
      .eq("id", p.id);
    if (failed) throw failed;
    return { status: "failed" };
  } finally {
    await supabaseAdmin
      .from("listing_payments")
      .update({ check_lease_until: null })
      .eq("id", paymentId);
  }
}
