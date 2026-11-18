-- CreateEnum
CREATE TYPE "ApiAccess" AS ENUM ('READ', 'WRITE');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "cost" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "lineCost" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "cost" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "expiredAt" TIMESTAMP(3),
ADD COLUMN     "renewedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "QuoteLine" ADD COLUMN     "lineCost" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "access" "ApiAccess" NOT NULL DEFAULT 'READ',
    "userId" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "uses" INTEGER NOT NULL DEFAULT 0,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_hash_key" ON "ApiKey"("hash");

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
