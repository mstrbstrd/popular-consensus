-- Isolated local admission store. Never baseline existing demo tables as signed history.
CREATE TABLE "AdmissionNetwork" (
  "id" VARCHAR(128) NOT NULL,
  "bootstrapHash" VARCHAR(71) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdmissionNetwork_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AdmissionPrincipal" (
  "networkId" VARCHAR(128) NOT NULL,
  "id" VARCHAR(128) NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'Active',
  "nextNonce" VARCHAR(20) NOT NULL DEFAULT '0',
  CONSTRAINT "AdmissionPrincipal_pkey" PRIMARY KEY ("networkId", "id"),
  CONSTRAINT "AdmissionPrincipal_status_check" CHECK ("status" IN ('Active', 'Suspended', 'Revoked')),
  CONSTRAINT "AdmissionPrincipal_nonce_check" CHECK ("nextNonce" ~ '^(0|[1-9][0-9]{0,19})$')
);
CREATE TABLE "AdmissionVerificationMethod" (
  "networkId" VARCHAR(128) NOT NULL,
  "id" VARCHAR(128) NOT NULL,
  "principalId" VARCHAR(128) NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'Active',
  "publicKeyPem" VARCHAR(1024) NOT NULL,
  "validFrom" TIMESTAMPTZ(3) NOT NULL,
  "validUntil" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "AdmissionVerificationMethod_pkey" PRIMARY KEY ("networkId", "id"),
  CONSTRAINT "AdmissionVerificationMethod_status_check" CHECK ("status" IN ('Active', 'Suspended', 'Revoked')),
  CONSTRAINT "AdmissionVerificationMethod_window_check" CHECK ("validFrom" < "validUntil"),
  CONSTRAINT "AdmissionVerificationMethod_public_only" CHECK (position('PRIVATE KEY' in "publicKeyPem") = 0)
);
CREATE TABLE "AdmissionCommunity" (
  "networkId" VARCHAR(128) NOT NULL,
  "id" VARCHAR(128) NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'Active',
  "emergencySuspended" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "AdmissionCommunity_pkey" PRIMARY KEY ("networkId", "id"),
  CONSTRAINT "AdmissionCommunity_status_check" CHECK ("status" IN ('Active', 'Suspended', 'Archived'))
);
CREATE TABLE "AdmissionQuestion" (
  "networkId" VARCHAR(128) NOT NULL,
  "id" VARCHAR(128) NOT NULL,
  "communityId" VARCHAR(128) NOT NULL,
  "proposerPrincipalId" VARCHAR(128) NOT NULL,
  "revision" BIGINT NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" VARCHAR(16) NOT NULL DEFAULT 'Submitted',
  "intentJson" TEXT NOT NULL,
  "challengeWindowEndsAt" TIMESTAMPTZ(3) NOT NULL,
  "unresolvedChallenges" INTEGER NOT NULL DEFAULT 0,
  "unresolvedAppeals" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "AdmissionQuestion_pkey" PRIMARY KEY ("networkId", "id"),
  CONSTRAINT "AdmissionQuestion_revision_check" CHECK ("revision" BETWEEN 0 AND 9007199254740991),
  CONSTRAINT "AdmissionQuestion_version_check" CHECK ("version" > 0),
  CONSTRAINT "AdmissionQuestion_disputes_check" CHECK ("unresolvedChallenges" >= 0 AND "unresolvedAppeals" >= 0),
  CONSTRAINT "AdmissionQuestion_status_check" CHECK ("status" IN ('Submitted', 'Challenged', 'Amendment', 'Accepted', 'Open', 'Closed', 'Tallied', 'Finalized', 'Archived', 'Rejected'))
);
CREATE TABLE "AdmissionCapabilityGrant" (
  "networkId" VARCHAR(128) NOT NULL,
  "id" VARCHAR(128) NOT NULL,
  "principalId" VARCHAR(128) NOT NULL,
  "communityId" VARCHAR(128) NOT NULL,
  "questionId" VARCHAR(128),
  "action" VARCHAR(32) NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'Active',
  "validFrom" TIMESTAMPTZ(3) NOT NULL,
  "validUntil" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "AdmissionCapabilityGrant_pkey" PRIMARY KEY ("networkId", "id"),
  CONSTRAINT "AdmissionCapabilityGrant_status_check" CHECK ("status" IN ('Active', 'Suspended', 'Revoked')),
  CONSTRAINT "AdmissionCapabilityGrant_action_check" CHECK ("action" = 'QuestionAccept'),
  CONSTRAINT "AdmissionCapabilityGrant_window_check" CHECK ("validFrom" < "validUntil")
);
CREATE TABLE "AdmissionCommandReceipt" (
  "networkId" VARCHAR(128) NOT NULL,
  "commandId" VARCHAR(128) NOT NULL,
  "commandHash" VARCHAR(71) NOT NULL,
  "envelopeHash" VARCHAR(71) NOT NULL,
  "envelopeJson" TEXT NOT NULL,
  "principalId" VARCHAR(128) NOT NULL,
  "keyId" VARCHAR(128) NOT NULL,
  "capabilityId" VARCHAR(128) NOT NULL,
  "nonce" VARCHAR(20) NOT NULL,
  "questionId" VARCHAR(128) NOT NULL,
  "communityId" VARCHAR(128) NOT NULL,
  "revision" BIGINT NOT NULL,
  "acceptedAt" TIMESTAMPTZ(3) NOT NULL,
  "eventHash" VARCHAR(71) NOT NULL,
  CONSTRAINT "AdmissionCommandReceipt_pkey" PRIMARY KEY ("networkId", "commandId"),
  CONSTRAINT "AdmissionCommandReceipt_revision_check" CHECK ("revision" BETWEEN 1 AND 9007199254740991),
  CONSTRAINT "AdmissionCommandReceipt_nonce_check" CHECK ("nonce" ~ '^(0|[1-9][0-9]{0,19})$')
);
CREATE TABLE "AdmissionAcceptanceEvent" (
  "networkId" VARCHAR(128) NOT NULL,
  "commandId" VARCHAR(128) NOT NULL,
  "questionId" VARCHAR(128) NOT NULL,
  "revision" BIGINT NOT NULL,
  "eventHash" VARCHAR(71) NOT NULL,
  "payloadJson" TEXT NOT NULL,
  CONSTRAINT "AdmissionAcceptanceEvent_pkey" PRIMARY KEY ("networkId", "commandId")
);

CREATE INDEX "AdmissionCapabilityGrant_networkId_principalId_communityId_idx" ON "AdmissionCapabilityGrant"("networkId", "principalId", "communityId");
CREATE UNIQUE INDEX "AdmissionCommandReceipt_networkId_principalId_nonce_key" ON "AdmissionCommandReceipt"("networkId", "principalId", "nonce");
CREATE UNIQUE INDEX "AdmissionAcceptanceEvent_networkId_questionId_revision_key" ON "AdmissionAcceptanceEvent"("networkId", "questionId", "revision");
CREATE UNIQUE INDEX "AdmissionAcceptanceEvent_networkId_eventHash_key" ON "AdmissionAcceptanceEvent"("networkId", "eventHash");
ALTER TABLE "AdmissionPrincipal" ADD CONSTRAINT "AdmissionPrincipal_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "AdmissionNetwork"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "AdmissionCommunity" ADD CONSTRAINT "AdmissionCommunity_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "AdmissionNetwork"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "AdmissionVerificationMethod" ADD CONSTRAINT "AdmissionVerificationMethod_networkId_principalId_fkey" FOREIGN KEY ("networkId", "principalId") REFERENCES "AdmissionPrincipal"("networkId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "AdmissionQuestion" ADD CONSTRAINT "AdmissionQuestion_networkId_communityId_fkey" FOREIGN KEY ("networkId", "communityId") REFERENCES "AdmissionCommunity"("networkId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "AdmissionQuestion" ADD CONSTRAINT "AdmissionQuestion_networkId_proposerPrincipalId_fkey" FOREIGN KEY ("networkId", "proposerPrincipalId") REFERENCES "AdmissionPrincipal"("networkId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "AdmissionCapabilityGrant" ADD CONSTRAINT "AdmissionCapabilityGrant_networkId_principalId_fkey" FOREIGN KEY ("networkId", "principalId") REFERENCES "AdmissionPrincipal"("networkId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "AdmissionCapabilityGrant" ADD CONSTRAINT "AdmissionCapabilityGrant_networkId_communityId_fkey" FOREIGN KEY ("networkId", "communityId") REFERENCES "AdmissionCommunity"("networkId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "AdmissionCommandReceipt" ADD CONSTRAINT "AdmissionCommandReceipt_networkId_principalId_fkey" FOREIGN KEY ("networkId", "principalId") REFERENCES "AdmissionPrincipal"("networkId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "AdmissionCommandReceipt" ADD CONSTRAINT "AdmissionCommandReceipt_networkId_questionId_fkey" FOREIGN KEY ("networkId", "questionId") REFERENCES "AdmissionQuestion"("networkId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "AdmissionAcceptanceEvent" ADD CONSTRAINT "AdmissionAcceptanceEvent_networkId_commandId_fkey" FOREIGN KEY ("networkId", "commandId") REFERENCES "AdmissionCommandReceipt"("networkId", "commandId") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "AdmissionAcceptanceEvent" ADD CONSTRAINT "AdmissionAcceptanceEvent_networkId_questionId_fkey" FOREIGN KEY ("networkId", "questionId") REFERENCES "AdmissionQuestion"("networkId", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- These guards are intentionally SQL-managed; Prisma cannot express them.
CREATE FUNCTION admission_history_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'ADMISSION_HISTORY_IMMUTABLE';
END;
$$;
CREATE TRIGGER admission_receipt_immutable BEFORE UPDATE OR DELETE ON "AdmissionCommandReceipt"
FOR EACH ROW EXECUTE FUNCTION admission_history_immutable();
CREATE TRIGGER admission_event_immutable BEFORE UPDATE OR DELETE ON "AdmissionAcceptanceEvent"
FOR EACH ROW EXECUTE FUNCTION admission_history_immutable();

CREATE FUNCTION admission_receipt_complete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "AdmissionAcceptanceEvent" e
    WHERE e."networkId" = NEW."networkId" AND e."commandId" = NEW."commandId"
      AND e."eventHash" = NEW."eventHash" AND e."questionId" = NEW."questionId" AND e."revision" = NEW."revision"
  ) THEN
    RAISE EXCEPTION 'ADMISSION_EVENT_REQUIRED';
  END IF;
  RETURN NEW;
END;
$$;
CREATE CONSTRAINT TRIGGER admission_receipt_complete AFTER INSERT ON "AdmissionCommandReceipt"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION admission_receipt_complete();
