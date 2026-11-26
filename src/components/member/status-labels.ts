/** Maps stored enum values to memberPanel translation keys. */
const statusKeys: Record<string, string> = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  PAID: "paid",
  CONFIRMED: "approved",
  PROCESSING: "processing",
  SHIPPED: "processing",
  DELIVERED: "completed",
  CANCELLED: "cancelled",
  RETURNED: "returned",
  ACTIVE: "active",
  INACTIVE: "inactive",
  SUSPENDED: "suspended",
  MATURED: "completed",
  CLOSED: "completed",
};

const ledgerTypeKeys: Record<string, string> = {
  ORDER_REFUND: "orderRefund",
  INVESTMENT_PRINCIPAL: "investmentPrincipal",
  INSTALLMENT_PAYMENT: "installmentPayment",
  PROFIT_DISTRIBUTION: "profitDistribution",
  AFFILIATE_REWARD: "affiliateReward",
  PRINCIPAL_RETURN: "principalReturn",
  BALANCE_TRANSFER: "balanceTransfer",
  WITHDRAWAL: "withdrawalPayout",
  WITHDRAWAL_FEE: "withdrawalFee",
  ADMIN_ADJUSTMENT: "adminAdjustment",
  REWARD_COLLECTION: "rewardCollection",
  RANK_REWARD_CREDIT: "rankRewardCredit",
  RANK_REWARD_RECLASSIFY: "rankRewardReclassify",
  SALARY_PAYMENT: "salaryPayment",
  ROI_COMMISSION_CREDIT: "roiCommissionCredit",
  MEMBER_TRANSFER_OUT: "memberTransferOut",
  MEMBER_TRANSFER_IN: "memberTransferIn",
  ORDER_WALLET_PAYMENT: "orderWalletPayment",
  WALLET_TOP_UP: "walletTopUp",
};

const directionKeys: Record<string, string> = {
  CREDIT: "directionIn",
  DEBIT: "directionOut",
};

const walletCategoryKeys: Record<string, string> = {
  AVAILABLE: "available",
  PROFIT: "profit",
  AFFILIATE: "affiliate",
  RANK_REWARD: "rankReward",
  SALARY: "salary",
  ROI_COMMISSION: "roiCommission",
};

/** Dedicated delivery labels so SHIPPED is not shown as a generic "processing". */
const orderStatusKeys: Record<string, string> = {
  PENDING: "orderStatusPending",
  CONFIRMED: "orderStatusConfirmed",
  PROCESSING: "orderStatusProcessing",
  SHIPPED: "orderStatusShipped",
  OUT_FOR_DELIVERY: "orderStatusOutForDelivery",
  PICKED_UP: "pickedUp",
  DELIVERED: "orderStatusDelivered",
  CANCELLED: "orderStatusCancelled",
  RETURNED: "orderStatusReturned",
};

export function statusLabelKey(status: string) {
  return statusKeys[status] ?? status.toLowerCase();
}

export function orderStatusKey(status: string) {
  return orderStatusKeys[status] ?? statusLabelKey(status);
}

export function ledgerTypeLabelKey(type: string) {
  return ledgerTypeKeys[type] ?? type;
}

export function directionLabelKey(direction: string) {
  return directionKeys[direction] ?? direction;
}

export function walletCategoryLabelKey(category: string) {
  return walletCategoryKeys[category] ?? category.toLowerCase();
}
