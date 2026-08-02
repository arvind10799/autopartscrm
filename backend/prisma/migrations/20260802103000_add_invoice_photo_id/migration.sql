ALTER TABLE "Invoice"
ADD COLUMN "photoIdRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "photoIdDocument" TEXT,
ADD COLUMN "photoIdFileName" VARCHAR(255),
ADD COLUMN "photoIdMimeType" VARCHAR(80),
ADD COLUMN "photoIdUploadedAt" TIMESTAMP(3);
