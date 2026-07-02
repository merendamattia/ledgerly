-- CreateTable
CREATE TABLE "rebalance_group" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetPct" DECIMAL(5,2) NOT NULL,
    "thresholdPct" DECIMAL(5,2) NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rebalance_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rebalance_member" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "tickerId" TEXT NOT NULL,

    CONSTRAINT "rebalance_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pillar" (
    "id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pillar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pillar_member" (
    "id" TEXT NOT NULL,
    "pillarId" TEXT NOT NULL,
    "cashAccountId" TEXT,
    "tickerId" TEXT,

    CONSTRAINT "pillar_member_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rebalance_member_tickerId_key" ON "rebalance_member"("tickerId");

-- CreateIndex
CREATE INDEX "rebalance_member_groupId_idx" ON "rebalance_member"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "pillar_position_key" ON "pillar"("position");

-- CreateIndex
CREATE INDEX "pillar_member_pillarId_idx" ON "pillar_member"("pillarId");

-- CreateIndex
CREATE UNIQUE INDEX "pillar_member_pillarId_cashAccountId_key" ON "pillar_member"("pillarId", "cashAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "pillar_member_pillarId_tickerId_key" ON "pillar_member"("pillarId", "tickerId");

-- AddForeignKey
ALTER TABLE "rebalance_member" ADD CONSTRAINT "rebalance_member_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "rebalance_group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rebalance_member" ADD CONSTRAINT "rebalance_member_tickerId_fkey" FOREIGN KEY ("tickerId") REFERENCES "ticker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pillar_member" ADD CONSTRAINT "pillar_member_pillarId_fkey" FOREIGN KEY ("pillarId") REFERENCES "pillar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pillar_member" ADD CONSTRAINT "pillar_member_cashAccountId_fkey" FOREIGN KEY ("cashAccountId") REFERENCES "cash_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pillar_member" ADD CONSTRAINT "pillar_member_tickerId_fkey" FOREIGN KEY ("tickerId") REFERENCES "ticker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
