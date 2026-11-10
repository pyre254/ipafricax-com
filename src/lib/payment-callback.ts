// Stable public app URL; callbacks must not depend on an untrusted request origin or editor URL.
export function listingPaymentCallbackUrl() {
  return "https://ip-africa-nexus.lovable.app/api/public/mpesa/callback";
}