-- AlterTable
ALTER TABLE "FileAsset" ADD COLUMN     "productId" TEXT,
ADD COLUMN     "sort" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "FileAsset_productId_idx" ON "FileAsset"("productId");

-- AddForeignKey
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
