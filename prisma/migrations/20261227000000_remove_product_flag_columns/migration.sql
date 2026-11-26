-- Products are no longer tagged as "new arrivals" or "activation products".
-- Every active product can be purchased for activation; storefront freshness is
-- derived from createdAt and featured placement remains an explicit choice.
ALTER TABLE "Product"
  DROP COLUMN IF EXISTS "isNewArrival",
  DROP COLUMN IF EXISTS "isActivationProduct";
