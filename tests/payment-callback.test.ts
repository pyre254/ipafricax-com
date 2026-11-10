import { expect, test } from "bun:test";
import { listingPaymentCallbackUrl } from "../src/lib/payment-callback";

test("Daraja callbacks target the app's public payment verification endpoint", () => {
  expect(listingPaymentCallbackUrl()).toBe("https://ip-africa-nexus.lovable.app/api/public/mpesa/callback");
});