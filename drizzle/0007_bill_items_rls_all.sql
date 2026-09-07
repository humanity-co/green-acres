-- Migration 0007: Allow tenant inserts and mutations on bill_items matching tenant's bill society_id

DROP POLICY IF EXISTS bill_items_tenant_select ON bill_items;
DROP POLICY IF EXISTS bill_items_tenant_all ON bill_items;

CREATE POLICY bill_items_tenant_all ON bill_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM bills WHERE bills.id = bill_items.bill_id
      AND bills.society_id = nullif(current_setting('app.society_id', true), '')::uuid
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM bills WHERE bills.id = bill_items.bill_id
      AND bills.society_id = nullif(current_setting('app.society_id', true), '')::uuid
    )
  );
