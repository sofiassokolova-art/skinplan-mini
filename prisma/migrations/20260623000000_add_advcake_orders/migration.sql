-- CreateTable
CREATE TABLE "advcake_orders" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "offer" TEXT,
    "offer_id" TEXT,
    "click_id" TEXT,
    "clicked_at" TIMESTAMP(3),
    "order_date" TIMESTAMP(3),
    "date_change" TIMESTAMP(3),
    "price" DECIMAL(12,2),
    "commission" DECIMAL(12,2),
    "status" INTEGER,
    "ip" TEXT,
    "reason" TEXT,
    "paid" TEXT,
    "invoice_id" TEXT,
    "payment_id" TEXT,
    "payment_status" TEXT,
    "bid" TEXT,
    "category" TEXT,
    "customer" TEXT,
    "course" TEXT,
    "link_hash" TEXT,
    "landing_id" TEXT,
    "keyword" TEXT,
    "sub1" TEXT,
    "raw" JSONB,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advcake_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advcake_order_items" (
    "id" TEXT NOT NULL,
    "order_ref" TEXT NOT NULL,
    "pid" TEXT,
    "name" TEXT,
    "unit_price" DECIMAL(12,2),
    "category" TEXT,
    "qty" INTEGER,
    "commission" DECIMAL(12,2),

    CONSTRAINT "advcake_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "advcake_orders_order_id_key" ON "advcake_orders"("order_id");

-- CreateIndex
CREATE INDEX "advcake_orders_order_date_idx" ON "advcake_orders"("order_date");

-- CreateIndex
CREATE INDEX "advcake_orders_payment_status_idx" ON "advcake_orders"("payment_status");

-- CreateIndex
CREATE INDEX "advcake_orders_paid_idx" ON "advcake_orders"("paid");

-- CreateIndex
CREATE INDEX "advcake_orders_offer_idx" ON "advcake_orders"("offer");

-- CreateIndex
CREATE INDEX "advcake_order_items_order_ref_idx" ON "advcake_order_items"("order_ref");

-- CreateIndex
CREATE INDEX "advcake_order_items_pid_idx" ON "advcake_order_items"("pid");

-- AddForeignKey
ALTER TABLE "advcake_order_items" ADD CONSTRAINT "advcake_order_items_order_ref_fkey" FOREIGN KEY ("order_ref") REFERENCES "advcake_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

