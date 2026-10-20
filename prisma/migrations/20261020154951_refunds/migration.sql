-- CreateTable
CREATE TABLE "PaymentTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reference" TEXT NOT NULL,
    "merchantName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "orderNumber" TEXT,
    "amount" INTEGER NOT NULL,
    "taxAmount" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "paymentMethod" TEXT NOT NULL,
    "purchasedAt" DATETIME NOT NULL,
    "lineItems" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "RefundCase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reference" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerSince" DATETIME NOT NULL,
    "amountRequested" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "reasonCategory" TEXT NOT NULL,
    "complaint" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "supportAgentName" TEXT NOT NULL,
    "supportAgentTeam" TEXT NOT NULL,
    "supportTicketRef" TEXT NOT NULL,
    "eligibilityNote" TEXT,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "decidedAt" DATETIME,
    "transactionId" TEXT NOT NULL,
    CONSTRAINT "RefundCase_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "PaymentTransaction" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RefundNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT NOT NULL,
    "authorTitle" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RefundNote_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "RefundCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RefundNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RefundDecision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RefundDecision_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "RefundCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RefundDecision_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RefundPayout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerRefundId" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "requestedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    CONSTRAINT "RefundPayout_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "RefundCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RefundPayout_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTransaction_reference_key" ON "PaymentTransaction"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "RefundCase_reference_key" ON "RefundCase"("reference");

-- CreateIndex
CREATE INDEX "RefundCase_status_idx" ON "RefundCase"("status");

-- CreateIndex
CREATE INDEX "RefundCase_submittedAt_idx" ON "RefundCase"("submittedAt");

-- CreateIndex
CREATE INDEX "RefundCase_transactionId_idx" ON "RefundCase"("transactionId");

-- CreateIndex
CREATE INDEX "RefundNote_caseId_idx" ON "RefundNote"("caseId");

-- CreateIndex
CREATE INDEX "RefundDecision_caseId_idx" ON "RefundDecision"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "RefundPayout_caseId_key" ON "RefundPayout"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "RefundPayout_idempotencyKey_key" ON "RefundPayout"("idempotencyKey");
