-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "layoutMode" TEXT NOT NULL DEFAULT 'stacked',
    "brandColor" TEXT NOT NULL DEFAULT '#008060',
    "buttonColor" TEXT NOT NULL DEFAULT '#008060',
    "buttonTextColor" TEXT NOT NULL DEFAULT '#ffffff',
    "popupType" TEXT NOT NULL DEFAULT 'partial',
    "showQuantity" BOOLEAN NOT NULL DEFAULT true,
    "cartRedirect" TEXT NOT NULL DEFAULT 'stay',
    "exportFormat" TEXT NOT NULL DEFAULT 'png',
    "dpiResolution" INTEGER NOT NULL DEFAULT 300,
    "customCss" TEXT,
    "customJs" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "AppSettings_shop_key" ON "AppSettings"("shop");
