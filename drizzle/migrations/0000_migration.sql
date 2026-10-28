
-- ===== Core reference records =====
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  phone text, email text, address text, notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (length(trim(code)) > 0),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  contract_value bigint NOT NULL CHECK (contract_value >= 0),
  start_date date NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('planned','active','on_hold','completed','cancelled')),
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.projects(client_id);

CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  type text NOT NULL CHECK (type IN ('cash','mtn_momo','orange_money','bank')),
  opening_balance bigint NOT NULL DEFAULT 0,
  opening_date date NOT NULL DEFAULT current_date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('income','expense')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  role text, phone text, email text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.payees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  kind text NOT NULL DEFAULT 'supplier' CHECK (kind IN ('supplier','contractor','other')),
  phone text, email text, address text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ===== Money core =====
CREATE TABLE public.ref_counters (year int PRIMARY KEY, last_value int NOT NULL DEFAULT 0);

CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  txn_date date NOT NULL,
  type text NOT NULL CHECK (type IN ('receipt','receipt_reversal')),
  description text,
  client_id uuid REFERENCES public.clients(id) ON DELETE RESTRICT,
  project_id uuid REFERENCES public.projects(id) ON DELETE RESTRICT,
  account_id uuid REFERENCES public.accounts(id) ON DELETE RESTRICT,
  category_id uuid REFERENCES public.categories(id) ON DELETE RESTRICT,
  payment_method text,
  amount bigint NOT NULL CHECK (amount > 0),
  direction text NOT NULL CHECK (direction IN ('in','out')),
  status text NOT NULL DEFAULT 'posted' CHECK (status IN ('posted')),
  reversal_of uuid REFERENCES public.transactions(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.transactions(txn_date);
CREATE INDEX ON public.transactions(project_id);

CREATE TABLE public.receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_no text NOT NULL UNIQUE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
  receipt_date date NOT NULL,
  amount bigint NOT NULL CHECK (amount > 0),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  payment_method text NOT NULL CHECK (payment_method IN ('cash','mtn_momo','orange_money','bank_transfer')),
  reference text NOT NULL CHECK (length(trim(reference)) > 0),
  notes text,
  status text NOT NULL DEFAULT 'posted' CHECK (status IN ('posted','reversed')),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE RESTRICT,
  reversal_transaction_id uuid REFERENCES public.transactions(id) ON DELETE RESTRICT,
  reversal_reason text,
  replaces_receipt_id uuid REFERENCES public.receipts(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.receipts(project_id);

CREATE TABLE public.account_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  movement_date date NOT NULL,
  direction text NOT NULL CHECK (direction IN ('in','out')),
  amount bigint NOT NULL CHECK (amount > 0),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE RESTRICT,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.account_movements(account_id, movement_date);

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ===== Grants: server-only access until sign-in exists =====
GRANT ALL ON public.clients, public.projects, public.accounts, public.categories, public.staff, public.payees,
  public.ref_counters, public.transactions, public.receipts, public.account_movements, public.audit_logs TO service_role;

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ref_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ===== updated_at =====
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['clients','projects','accounts','categories','staff','payees','receipts'] LOOP
    EXECUTE format('CREATE TRIGGER trg_touch BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at()', t);
  END LOOP; END $$;

-- ===== Immutability =====
CREATE OR REPLACE FUNCTION public.block_change() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'Posted financial records cannot be changed or deleted; use a reversal.'; END $$;
CREATE TRIGGER trg_immutable BEFORE UPDATE OR DELETE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.block_change();
CREATE TRIGGER trg_immutable BEFORE UPDATE OR DELETE ON public.account_movements FOR EACH ROW EXECUTE FUNCTION public.block_change();
CREATE TRIGGER trg_immutable BEFORE UPDATE OR DELETE ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.block_change();

CREATE OR REPLACE FUNCTION public.guard_receipt() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Receipts cannot be deleted; reverse them instead.'; END IF;
  IF OLD.status = 'reversed' THEN RAISE EXCEPTION 'This receipt is already reversed.'; END IF;
  IF NEW.status <> 'reversed' OR NEW.amount <> OLD.amount OR NEW.account_id <> OLD.account_id
     OR NEW.project_id <> OLD.project_id OR NEW.client_id <> OLD.client_id OR NEW.receipt_date <> OLD.receipt_date
     OR NEW.receipt_no <> OLD.receipt_no THEN
    RAISE EXCEPTION 'Posted receipts can only be reversed.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard BEFORE UPDATE OR DELETE ON public.receipts FOR EACH ROW EXECUTE FUNCTION public.guard_receipt();

-- ===== References =====
CREATE OR REPLACE FUNCTION public.next_reference(_date date) RETURNS text LANGUAGE plpgsql SET search_path = public AS $$
DECLARE y int := extract(year FROM _date)::int; n int;
BEGIN
  INSERT INTO public.ref_counters(year, last_value) VALUES (y, 1)
  ON CONFLICT (year) DO UPDATE SET last_value = public.ref_counters.last_value + 1
  RETURNING last_value INTO n;
  RETURN 'FA/FIN/TID' || lpad((y % 100)::text, 2, '0') || '-' || lpad(n::text, 4, '0');
END $$;

-- ===== Posting functions (atomic) =====
CREATE OR REPLACE FUNCTION public.post_receipt(
  _client_id uuid, _project_id uuid, _date date, _amount bigint, _account_id uuid,
  _method text, _reference text, _notes text, _idempotency_key text, _replaces uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SET search_path = public AS $$
DECLARE existing uuid; ref text; txn uuid; rid uuid; pclient uuid;
BEGIN
  SELECT id INTO existing FROM public.receipts WHERE idempotency_key = _idempotency_key;
  IF existing IS NOT NULL THEN RETURN existing; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Amount must be greater than zero.'; END IF;
  IF coalesce(trim(_reference),'') = '' THEN RAISE EXCEPTION 'Payment reference is required.'; END IF;
  SELECT client_id INTO pclient FROM public.projects WHERE id = _project_id;
  IF pclient IS NULL THEN RAISE EXCEPTION 'Project not found.'; END IF;
  IF pclient <> _client_id THEN RAISE EXCEPTION 'This project belongs to a different client.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE id = _account_id AND is_active) THEN
    RAISE EXCEPTION 'Receiving account not found or inactive.'; END IF;

  ref := public.next_reference(_date);
  INSERT INTO public.transactions(reference, txn_date, type, description, client_id, project_id, account_id, payment_method, amount, direction)
  VALUES (ref, _date, 'receipt', 'Client receipt ' || _reference, _client_id, _project_id, _account_id, _method, _amount, 'in')
  RETURNING id INTO txn;
  INSERT INTO public.account_movements(account_id, movement_date, direction, amount, transaction_id, description)
  VALUES (_account_id, _date, 'in', _amount, txn, 'Receipt ' || ref);
  INSERT INTO public.receipts(receipt_no, client_id, project_id, receipt_date, amount, account_id, payment_method, reference, notes, transaction_id, idempotency_key, replaces_receipt_id)
  VALUES (ref, _client_id, _project_id, _date, _amount, _account_id, _method, _reference, _notes, txn, _idempotency_key, _replaces)
  RETURNING id INTO rid;
  INSERT INTO public.audit_logs(entity, entity_id, action, details)
  VALUES ('receipt', rid, 'posted', jsonb_build_object('reference', ref, 'amount', _amount, 'replaces', _replaces));
  RETURN rid;
END $$;

CREATE OR REPLACE FUNCTION public.reverse_receipt(_receipt_id uuid, _reason text) RETURNS uuid LANGUAGE plpgsql SET search_path = public AS $$
DECLARE r public.receipts; ref text; txn uuid;
BEGIN
  IF coalesce(trim(_reason),'') = '' THEN RAISE EXCEPTION 'A reason is required to reverse a receipt.'; END IF;
  SELECT * INTO r FROM public.receipts WHERE id = _receipt_id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Receipt not found.'; END IF;
  IF r.status = 'reversed' THEN RAISE EXCEPTION 'This receipt is already reversed.'; END IF;
  ref := public.next_reference(current_date);
  INSERT INTO public.transactions(reference, txn_date, type, description, client_id, project_id, account_id, payment_method, amount, direction, reversal_of)
  VALUES (ref, current_date, 'receipt_reversal', 'Reversal of ' || r.receipt_no || ': ' || _reason, r.client_id, r.project_id, r.account_id, r.payment_method, r.amount, 'out', r.transaction_id)
  RETURNING id INTO txn;
  INSERT INTO public.account_movements(account_id, movement_date, direction, amount, transaction_id, description)
  VALUES (r.account_id, current_date, 'out', r.amount, txn, 'Reversal ' || r.receipt_no);
  UPDATE public.receipts SET status = 'reversed', reversal_transaction_id = txn, reversal_reason = _reason WHERE id = r.id;
  INSERT INTO public.audit_logs(entity, entity_id, action, details)
  VALUES ('receipt', r.id, 'reversed', jsonb_build_object('reason', _reason, 'reversal_reference', ref));
  RETURN txn;
END $$;

REVOKE ALL ON FUNCTION public.post_receipt(uuid,uuid,date,bigint,uuid,text,text,text,text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reverse_receipt(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.next_reference(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.post_receipt(uuid,uuid,date,bigint,uuid,text,text,text,text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.reverse_receipt(uuid,text) TO service_role;

-- ===== Calculated views =====
CREATE VIEW public.account_balances WITH (security_invoker = on) AS
SELECT a.id, a.name, a.type, a.opening_balance, a.opening_date, a.is_active,
  coalesce(sum(m.amount) FILTER (WHERE m.direction='in'),0)::bigint AS total_in,
  coalesce(sum(m.amount) FILTER (WHERE m.direction='out'),0)::bigint AS total_out,
  (a.opening_balance + coalesce(sum(m.amount) FILTER (WHERE m.direction='in'),0)
     - coalesce(sum(m.amount) FILTER (WHERE m.direction='out'),0))::bigint AS balance
FROM public.accounts a LEFT JOIN public.account_movements m ON m.account_id = a.id
GROUP BY a.id;

CREATE VIEW public.project_financials WITH (security_invoker = on) AS
SELECT p.id, p.code, p.name, p.client_id, c.name AS client_name, p.contract_value, p.status,
  coalesce((SELECT sum(amount) FROM public.receipts r WHERE r.project_id = p.id AND r.status='posted'),0)::bigint AS received,
  (p.contract_value - coalesce((SELECT sum(amount) FROM public.receipts r WHERE r.project_id = p.id AND r.status='posted'),0))::bigint AS outstanding
FROM public.projects p JOIN public.clients c ON c.id = p.client_id;

GRANT SELECT ON public.account_balances, public.project_financials TO service_role;

-- ===== Seed =====
INSERT INTO public.accounts(name, type, opening_balance) VALUES
 ('Cash','cash',0),('MTN MoMo','mtn_momo',0),('Orange Money','orange_money',0);
INSERT INTO public.categories(name, kind) VALUES
 ('Materials','expense'),('Workmanship','expense'),('Transport','expense'),('Utilities','expense'),
 ('Rent','expense'),('Equipment','expense'),('Communications','expense'),('Staff payments','expense'),
 ('Commissions','expense'),('Other expenses','expense'),('Project revenue','income');
