-- Complete tenant policies for relationship tables. These tables do not carry
-- society_id directly, so ownership is inherited from their parent record.

CREATE POLICY poll_votes_tenant_insert ON poll_votes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM polls WHERE polls.id = poll_votes.poll_id
      AND polls.society_id = nullif(current_setting('app.society_id', true), '')::uuid
    )
  );
CREATE POLICY poll_votes_tenant_update ON poll_votes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM polls WHERE polls.id = poll_votes.poll_id
      AND polls.society_id = nullif(current_setting('app.society_id', true), '')::uuid
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM polls WHERE polls.id = poll_votes.poll_id
      AND polls.society_id = nullif(current_setting('app.society_id', true), '')::uuid
    )
  );
CREATE POLICY poll_votes_tenant_delete ON poll_votes
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM polls WHERE polls.id = poll_votes.poll_id
      AND polls.society_id = nullif(current_setting('app.society_id', true), '')::uuid
    )
  );

CREATE POLICY ticket_comments_tenant_insert ON ticket_comments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM helpdesk_tickets WHERE helpdesk_tickets.id = ticket_comments.ticket_id
      AND helpdesk_tickets.society_id = nullif(current_setting('app.society_id', true), '')::uuid
    )
  );
CREATE POLICY ticket_comments_tenant_update ON ticket_comments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM helpdesk_tickets WHERE helpdesk_tickets.id = ticket_comments.ticket_id
      AND helpdesk_tickets.society_id = nullif(current_setting('app.society_id', true), '')::uuid
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM helpdesk_tickets WHERE helpdesk_tickets.id = ticket_comments.ticket_id
      AND helpdesk_tickets.society_id = nullif(current_setting('app.society_id', true), '')::uuid
    )
  );
CREATE POLICY ticket_comments_tenant_delete ON ticket_comments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM helpdesk_tickets WHERE helpdesk_tickets.id = ticket_comments.ticket_id
      AND helpdesk_tickets.society_id = nullif(current_setting('app.society_id', true), '')::uuid
    )
  );

CREATE POLICY poll_options_tenant_insert ON poll_options
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM polls WHERE polls.id = poll_options.poll_id
      AND polls.society_id = nullif(current_setting('app.society_id', true), '')::uuid
    )
  );
CREATE POLICY poll_options_tenant_update ON poll_options
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM polls WHERE polls.id = poll_options.poll_id
      AND polls.society_id = nullif(current_setting('app.society_id', true), '')::uuid
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM polls WHERE polls.id = poll_options.poll_id
      AND polls.society_id = nullif(current_setting('app.society_id', true), '')::uuid
    )
  );
CREATE POLICY poll_options_tenant_delete ON poll_options
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM polls WHERE polls.id = poll_options.poll_id
      AND polls.society_id = nullif(current_setting('app.society_id', true), '')::uuid
    )
  );

CREATE POLICY bill_items_tenant_insert ON bill_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM bills WHERE bills.id = bill_items.bill_id
      AND bills.society_id = nullif(current_setting('app.society_id', true), '')::uuid
    )
  );
CREATE POLICY bill_items_tenant_update ON bill_items
  FOR UPDATE USING (
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
CREATE POLICY bill_items_tenant_delete ON bill_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM bills WHERE bills.id = bill_items.bill_id
      AND bills.society_id = nullif(current_setting('app.society_id', true), '')::uuid
    )
  );