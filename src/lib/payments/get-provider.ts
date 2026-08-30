import { ManualPaymentProvider } from "./providers/manual-payment-provider";
import { MobileMoneyStubProvider } from "./providers/mobile-money-provider";
import type { PaymentProvider } from "./provider";
import type { PaymentMethod } from "@prisma/client";

const manual = new ManualPaymentProvider();
const orangeMoney = new MobileMoneyStubProvider("Orange Money");
const moovMoney = new MobileMoneyStubProvider("Moov Money");
const wave = new MobileMoneyStubProvider("Wave");

export function getPaymentProvider(method: PaymentMethod): PaymentProvider {
  switch (method) {
    case "CASH":
    case "BANK_TRANSFER":
    case "OTHER":
      return manual;
    case "ORANGE_MONEY":
      return orangeMoney;
    case "MOOV_MONEY":
      return moovMoney;
    case "WAVE":
      return wave;
  }
}
