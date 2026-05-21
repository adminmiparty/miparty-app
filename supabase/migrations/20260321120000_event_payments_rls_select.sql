-- Allow organizers to read their own payment rows (post-checkout safety on dashboard).

ALTER TABLE event_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_payments_select_own ON event_payments;
CREATE POLICY event_payments_select_own ON event_payments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
