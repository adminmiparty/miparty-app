-- One-time Stripe payments per organized event (publish gate).

CREATE TABLE IF NOT EXISTS event_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_checkout_session_id text UNIQUE,
  stripe_payment_intent_id text,
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'eur',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

CREATE INDEX IF NOT EXISTS event_payments_event_id_idx ON event_payments(event_id);
CREATE INDEX IF NOT EXISTS event_payments_user_id_idx ON event_payments(user_id);
CREATE INDEX IF NOT EXISTS event_payments_stripe_session_idx ON event_payments(stripe_checkout_session_id);

COMMENT ON TABLE event_payments IS 'Stripe Checkout records for publishing organizer events.';
