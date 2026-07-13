ALTER TABLE "Invoice"
  ADD COLUMN "customerSignatureImage" TEXT,
  ADD COLUMN "signedAt" TIMESTAMP(3),
  ADD COLUMN "signatureIpAddress" VARCHAR(64),
  ADD COLUMN "signatureTokenHash" VARCHAR(128),
  ADD COLUMN "signatureTokenExpiresAt" TIMESTAMP(3),
  ADD COLUMN "signatureRequestedAt" TIMESTAMP(3),
  ADD COLUMN "signatureLastSentAt" TIMESTAMP(3);

ALTER TABLE "Invoice"
  ALTER COLUMN "customerSignature" TYPE TEXT;

CREATE UNIQUE INDEX "Invoice_signatureTokenHash_key" ON "Invoice"("signatureTokenHash");
CREATE INDEX "Invoice_signatureTokenExpiresAt_idx" ON "Invoice"("signatureTokenExpiresAt");
