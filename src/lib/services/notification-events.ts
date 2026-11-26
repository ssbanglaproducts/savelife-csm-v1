import { NotificationKind as Kind } from "../../generated/prisma/enums";
import { formatSP, type Paisa } from "@/lib/money";
import { createNotification } from "./notifications";

/**
 * Central bank of member-facing event copy. Amounts use the SP denomination in
 * both locales so a notification never introduces another currency symbol.
 */

export function notifyWelcome(memberId: string, memberIdLabel: string) {
  return createNotification({
    memberId,
    kind: Kind.NOTICE,
    title: { en: "Welcome to Savelife CSM", bn: "সেভলাইফ সিএসএমে স্বাগতম" },
    body: {
      en: `Your membership ${memberIdLabel} is ready. Add SP or shop from the store to get started.`,
      bn: `আপনার সদস্যপদ ${memberIdLabel} প্রস্তুত। শুরু করতে SP যোগ করুন বা স্টোর থেকে কিনুন।`,
    },
    href: "/member/dashboard",
  });
}

export function notifyTopUpRequested(
  memberId: string,
  requestNumber: string,
  amountPaisa: Paisa,
) {
  const amount = formatSP(amountPaisa);
  return createNotification({
    memberId,
    kind: Kind.WALLET,
    title: { en: "Top-up request received", bn: "টপ-আপ অনুরোধ পৌঁছেছে" },
    body: {
      en: `${requestNumber} · ${amount} is waiting for admin approval.`,
      bn: `${requestNumber} · ${amount} অনুমোদনের অপেক্ষায় আছে।`,
    },
    href: "/member/top-up",
  });
}

export function notifyTopUpApproved(
  memberId: string,
  requestNumber: string,
  amountPaisa: Paisa,
) {
  const amount = formatSP(amountPaisa);
  return createNotification({
    memberId,
    kind: Kind.WALLET,
    title: { en: "Top-up approved", bn: "টপ-আপ অনুমোদিত" },
    body: {
      en: `${amount} for ${requestNumber} was added to your Available Balance.`,
      bn: `${requestNumber} এর ${amount} আপনার অ্যাভেইলেবেল ব্যালেন্সে যোগ করা হয়েছে।`,
    },
    href: "/member/wallet",
  });
}

export function notifyTopUpRejected(memberId: string, requestNumber: string, note?: string | null) {
  return createNotification({
    memberId,
    kind: Kind.ALERT,
    title: { en: "Top-up request declined", bn: "টপ-আপ অনুরোধ প্রত্যাখ্যাত" },
    body: {
      en: `${requestNumber} was declined.${note ? ` Reason: ${note}` : ""}`,
      bn: `${requestNumber} প্রত্যাখ্যাত হয়েছে।${note ? ` কারণ: ${note}` : ""}`,
    },
    href: "/member/top-up",
  });
}

export function notifyMoneySent(memberId: string, recipient: string, amountPaisa: Paisa) {
  const amount = formatSP(amountPaisa);
  return createNotification({
    memberId,
    kind: Kind.WALLET,
    title: { en: "SP sent", bn: "SP পাঠানো হয়েছে" },
    body: {
      en: `${amount} was sent to ${recipient} from your Available Balance.`,
      bn: `আপনার অ্যাভেইলেবেল ব্যালেন্স থেকে ${recipient} কে ${amount} পাঠানো হয়েছে।`,
    },
    href: "/member/transactions",
  });
}

export function notifyMoneyReceived(sender: string, memberId: string, amountPaisa: Paisa) {
  const amount = formatSP(amountPaisa);
  return createNotification({
    memberId,
    kind: Kind.WALLET,
    title: { en: "SP received", bn: "SP পেয়েছেন" },
    body: {
      en: `${sender} sent you ${amount}. It is now in your Available Balance.`,
      bn: `${sender} আপনাকে ${amount} পাঠিয়েছেন। SP এখন আপনার অ্যাভেইলেবেল ব্যালেন্সে আছে।`,
    },
    href: "/member/wallet",
  });
}

export function notifyOrderConfirmed(
  memberId: string,
  orderNumber: string,
  activated: boolean,
) {
  return createNotification({
    memberId,
    kind: Kind.ORDER,
    title: {
      en: activated ? "Membership activated" : "Order confirmed",
      bn: activated ? "সদস্যপদ সক্রিয় হয়েছে" : "অর্ডার নিশ্চিত হয়েছে",
    },
    body: {
      en: activated
        ? `Order ${orderNumber} was paid from your wallet and your membership is now ACTIVE.`
        : `Order ${orderNumber} was paid from your Available Balance and is CONFIRMED.`,
      bn: activated
        ? `অর্ডার ${orderNumber} ওয়ালেট থেকে প্রদত্ত হয়েছে এবং আপনার সদস্যপদ এখন ACTIVE।`
        : `অর্ডার ${orderNumber} অ্যাভেইলেবেল ব্যালেন্স থেকে প্রদত্ত হয়ে CONFIRMED হয়েছে।`,
    },
    href: "/member/orders",
  });
}

export function notifyOrderStatus(
  memberId: string,
  orderNumber: string,
  status: string,
) {
  return createNotification({
    memberId,
    kind: Kind.ORDER,
    title: { en: "Order update", bn: "অর্ডার আপডেট" },
    body: {
      en: `Order ${orderNumber} is now ${status}.`,
      bn: `অর্ডার ${orderNumber} এখন ${status}।`,
    },
    href: "/member/orders",
  });
}

export function notifyInvestmentApproved(
  memberId: string,
  investmentNumber: string,
  amountPaisa: Paisa,
) {
  const amount = formatSP(amountPaisa);
  return createNotification({
    memberId,
    kind: Kind.INVESTMENT,
    title: { en: "Investment approved", bn: "বিনিয়োগ অনুমোদিত" },
    body: {
      en: `${investmentNumber} · ${amount} is now ACTIVE. Returns follow the published schedule.`,
      bn: `${investmentNumber} · ${amount} এখন ACTIVE। রিটার্ম নির্ধারিত সময়সূচি অনুসারে দেওয়া হবে।`,
    },
    href: "/member/investments",
  });
}

export function notifyInvestmentRejected(memberId: string, investmentNumber: string) {
  return createNotification({
    memberId,
    kind: Kind.ALERT,
    title: { en: "Investment declined", bn: "বিনিয়োগ প্রত্যাখ্যাত" },
    body: {
      en: `Investment ${investmentNumber} was declined by the administrator.`,
      bn: `বিনিয়োগ ${investmentNumber} অ্যাডমিন প্রত্যাখ্যাত করেছেন।`,
    },
    href: "/member/investments",
  });
}

export function notifyProfitDistributed(memberId: string, amountPaisa: Paisa, month: string) {
  const amount = formatSP(amountPaisa);
  return createNotification({
    memberId,
    kind: Kind.INVESTMENT,
    title: { en: "Profit credited", bn: "লাভ যোগ করা হয়েছে" },
    body: {
      en: `${amount} for ${month} was credited to your Profit wallet.`,
      bn: `${month} এর ${amount} আপনার লাভ ওয়ালেটে যোগ করা হয়েছে।`,
    },
    href: "/member/wallet",
  });
}

export function notifyWithdrawalRequested(memberId: string, amountPaisa: Paisa) {
  const amount = formatSP(amountPaisa);
  return createNotification({
    memberId,
    kind: Kind.WALLET,
    title: { en: "Withdrawal requested", bn: "উত্তোলন অনুরোধ" },
    body: {
      en: `Your ${amount} withdrawal request is awaiting review.`,
      bn: `আপনার ${amount} উত্তোলন অনুরোধ পর্যালোচনার অপেক্ষায় আছে।`,
    },
    href: "/member/withdrawals",
  });
}

export function notifyWithdrawalResolved(
  memberId: string,
  amountPaisa: Paisa,
  status: "APPROVED" | "REJECTED" | "PAID",
) {
  const amount = formatSP(amountPaisa);
  const approved = status === "APPROVED" || status === "PAID";
  return createNotification({
    memberId,
    kind: approved ? Kind.WALLET : Kind.ALERT,
    title: {
      en: approved ? "Withdrawal approved" : "Withdrawal declined",
      bn: approved ? "উত্তোলন অনুমোদিত" : "উত্তোলন প্রত্যাখ্যাত",
    },
    body: {
      en: `Your ${amount} withdrawal request is now ${status}.`,
      bn: `আপনার ${amount} উত্তোলন অনুরোধ এখন ${status}।`,
    },
    href: "/member/withdrawals",
  });
}

export function notifyStatusChanged(
  memberId: string,
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED",
  note?: string | null,
) {
  const title =
    status === "ACTIVE"
      ? { en: "Account activated", bn: "অ্যাকাউন্ট সক্রিয়" }
      : status === "SUSPENDED"
        ? { en: "Account deactivated", bn: "অ্যাকাউন্ট নিষ্ক্রিয়" }
        : { en: "Account status updated", bn: "অ্যাকাউন্ট স্ট্যাটাস আপডেট" };
  return createNotification({
    memberId,
    kind: status === "ACTIVE" ? Kind.NOTICE : Kind.SECURITY,
    title,
    body: {
      en: `Your membership status is now ${status}.${note ? ` ${note}` : ""}`,
      bn: `আপনার সদস্যপদের স্ট্যাটাস এখন ${status}।${note ? ` ${note}` : ""}`,
    },
    href: "/member/dashboard",
  });
}

export function notifyTPinReset(memberId: string, note: string) {
  return createNotification({
    memberId,
    kind: Kind.SECURITY,
    title: { en: "T-PIN reset by admin", bn: "অ্যাডমিন দ্বারা টি-পিন রিসেট" },
    body: {
      en: `Your 6-digit T-PIN was reset by an administrator. Reason: ${note}. Never share your T-PIN.`,
      bn: `অ্যাডমিন আপনার ৬ ডিজিটের টি-পিন রিসেট করেছেন। কারণ: ${note}। টি-পিন কাউকে বলবেন না।`,
    },
    href: "/member/profile",
  });
}

export function notifyAdminAdjustment(memberId: string, amountPaisa: Paisa) {
  const amount = formatSP(amountPaisa);
  return createNotification({
    memberId,
    kind: Kind.WALLET,
    title: { en: "Wallet adjustment", bn: "ওয়ালেট সমন্বয়" },
    body: {
      en: `An administrator adjusted your Available Balance by ${amount}.`,
      bn: `অ্যাডমিন আপনার অ্যাভেইলেবেল ব্যালেন্স ${amount} দ্বারা সমন্বয় করেছেন।`,
    },
    href: "/member/wallet",
  });
}
