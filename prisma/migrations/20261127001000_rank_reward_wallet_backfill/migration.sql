-- Move rank SP credits that were posted directly to Available before the
-- dedicated Rank Reward wallet existed. The original ledger entry is kept;
-- this migration appends a balanced pair of reclassification entries.
DO $$
DECLARE
  achievement RECORD;
  wallet_row RECORD;
  available_after BIGINT;
  rank_after BIGINT;
  debit_key TEXT;
  credit_key TEXT;
BEGIN
  FOR achievement IN
    SELECT
      a."id" AS achievement_id,
      a."memberId" AS member_id,
      a."rankKey" AS rank_key,
      a."rewardSpPaisa" AS amount
    FROM "RankAchievement" a
    WHERE a."rewardType" = 'SP'
      AND a."walletCreditedAt" IS NOT NULL
      AND a."rewardSpPaisa" > 0
      AND EXISTS (
        SELECT 1
        FROM "LedgerEntry" le
        WHERE le."idempotencyKey" = 'rank-reward:' || a."id" || ':credit'
          AND le."category" = 'AVAILABLE'
          AND le."direction" = 'CREDIT'
      )
    ORDER BY a."achievedAt"
  LOOP
    SELECT
      w."id" AS wallet_id,
      w."availablePaisa" AS available_before,
      w."rankRewardPaisa" AS rank_before
    INTO wallet_row
    FROM "Wallet" w
    WHERE w."memberId" = achievement.member_id;

    -- Never push Available below zero. Spent historical rewards stay historical.
    IF NOT FOUND OR wallet_row.available_before < achievement.amount THEN
      CONTINUE;
    END IF;

    debit_key := 'rank-reward-reclassify:' || achievement.achievement_id || ':available-debit';
    credit_key := 'rank-reward-reclassify:' || achievement.achievement_id || ':rank-credit';

    IF EXISTS (
      SELECT 1
      FROM "LedgerEntry" le
      WHERE le."idempotencyKey" IN (debit_key, credit_key)
    ) THEN
      CONTINUE;
    END IF;

    available_after := wallet_row.available_before - achievement.amount;
    rank_after := wallet_row.rank_before + achievement.amount;

    UPDATE "Wallet"
    SET
      "availablePaisa" = available_after,
      "rankRewardPaisa" = rank_after,
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = wallet_row.wallet_id;

    INSERT INTO "LedgerEntry" (
      "id",
      "walletId",
      "memberId",
      "category",
      "direction",
      "amountPaisa",
      "balanceAfterPaisa",
      "type",
      "referenceType",
      "referenceId",
      "idempotencyKey",
      "description",
      "createdBy",
      "createdAt"
    )
    VALUES (
      'reclassify-' || achievement.achievement_id || ':available-debit',
      wallet_row.wallet_id,
      achievement.member_id,
      'AVAILABLE',
      'DEBIT',
      achievement.amount,
      available_after,
      'RANK_REWARD_RECLASSIFY',
      'RankAchievement',
      achievement.achievement_id,
      debit_key,
      'Rank reward moved to Rank Reward wallet: ' || achievement.rank_key,
      NULL,
      CURRENT_TIMESTAMP
    );

    INSERT INTO "LedgerEntry" (
      "id",
      "walletId",
      "memberId",
      "category",
      "direction",
      "amountPaisa",
      "balanceAfterPaisa",
      "type",
      "referenceType",
      "referenceId",
      "idempotencyKey",
      "description",
      "createdBy",
      "createdAt"
    )
    VALUES (
      'reclassify-' || achievement.achievement_id || ':rank-credit',
      wallet_row.wallet_id,
      achievement.member_id,
      'RANK_REWARD',
      'CREDIT',
      achievement.amount,
      rank_after,
      'RANK_REWARD_RECLASSIFY',
      'RankAchievement',
      achievement.achievement_id,
      credit_key,
      'Rank reward moved to Rank Reward wallet: ' || achievement.rank_key,
      NULL,
      CURRENT_TIMESTAMP
    );
  END LOOP;
END $$;
