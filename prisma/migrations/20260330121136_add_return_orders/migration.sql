-- CreateTable
CREATE TABLE "return_orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "sale_order_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "return_no" TEXT NOT NULL,
    "total_amount" DECIMAL NOT NULL DEFAULT 0,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "return_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "return_orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "return_orders_sale_order_id_fkey" FOREIGN KEY ("sale_order_id") REFERENCES "sale_orders" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "return_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "return_order_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "return_order_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL NOT NULL,
    "subtotal" DECIMAL NOT NULL,
    CONSTRAINT "return_order_items_return_order_id_fkey" FOREIGN KEY ("return_order_id") REFERENCES "return_orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "return_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "return_orders_tenant_id_idx" ON "return_orders"("tenant_id");

-- CreateIndex
CREATE INDEX "return_orders_tenant_id_return_date_idx" ON "return_orders"("tenant_id", "return_date");

-- CreateIndex
CREATE INDEX "return_order_items_return_order_id_idx" ON "return_order_items"("return_order_id");
