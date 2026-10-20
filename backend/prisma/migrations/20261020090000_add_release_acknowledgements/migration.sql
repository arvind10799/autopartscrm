CREATE TABLE "ReleaseAcknowledgement" (
    "userId" UUID NOT NULL,
    "releaseId" VARCHAR(40) NOT NULL,
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReleaseAcknowledgement_pkey" PRIMARY KEY ("userId", "releaseId")
);

ALTER TABLE "ReleaseAcknowledgement" ADD CONSTRAINT "ReleaseAcknowledgement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
