-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ownerTeam" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "FeatureFlagEnvironment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "flagId" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" TEXT,
    CONSTRAINT "FeatureFlagEnvironment_flagId_fkey" FOREIGN KEY ("flagId") REFERENCES "FeatureFlag" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FeatureFlagEnvironment_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_key_key" ON "FeatureFlag"("key");

-- CreateIndex
CREATE INDEX "FeatureFlagEnvironment_environment_idx" ON "FeatureFlagEnvironment"("environment");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlagEnvironment_flagId_environment_key" ON "FeatureFlagEnvironment"("flagId", "environment");
