
-- PRODUCTS
CREATE TABLE public.products (
  code TEXT PRIMARY KEY,
  product_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  units_per_quantity NUMERIC NOT NULL CHECK (units_per_quantity > 0),
  total_units NUMERIC GENERATED ALWAYS AS (quantity * units_per_quantity) STORED,
  total_purchase_cost NUMERIC NOT NULL CHECK (total_purchase_cost >= 0),
  selling_price_per_unit NUMERIC NOT NULL CHECK (selling_price_per_unit >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enforce uppercase + format via trigger (cannot use immutable check on regex easily -- but regex is immutable, ok)
ALTER TABLE public.products ADD CONSTRAINT products_code_format CHECK (code ~ '^[A-Z0-9]{4,}$');

-- SALES
CREATE TYPE public.sale_type AS ENUM ('normal','donated','spoilt');

CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL REFERENCES public.products(code) ON DELETE RESTRICT,
  units_sold NUMERIC NOT NULL CHECK (units_sold > 0),
  type public.sale_type NOT NULL DEFAULT 'normal',
  total_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX sales_code_idx ON public.sales(code);
CREATE INDEX sales_created_at_idx ON public.sales(created_at);

-- SETTINGS (single row)
CREATE TABLE public.settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  low_stock_threshold NUMERIC NOT NULL DEFAULT 10,
  email TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.settings (id, low_stock_threshold, email) VALUES (1, 10, NULL);

-- Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Single-user app: any authenticated user has full access
CREATE POLICY "auth all products" ON public.products FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth all sales" ON public.sales FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth all settings" ON public.settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Stock validation + auto total_amount on sales insert
CREATE OR REPLACE FUNCTION public.process_sale()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_units NUMERIC;
  v_sold NUMERIC;
  v_remaining NUMERIC;
  v_price NUMERIC;
BEGIN
  SELECT total_units, selling_price_per_unit
    INTO v_total_units, v_price
  FROM public.products WHERE code = NEW.code;

  IF v_total_units IS NULL THEN
    RAISE EXCEPTION 'Unknown product code: %', NEW.code;
  END IF;

  SELECT COALESCE(SUM(units_sold),0) INTO v_sold
  FROM public.sales WHERE code = NEW.code;

  v_remaining := v_total_units - v_sold;

  IF v_remaining <= 0 THEN
    RAISE EXCEPTION 'Out of stock for %', NEW.code;
  END IF;

  IF NEW.units_sold > v_remaining THEN
    RAISE EXCEPTION 'Only % units remaining for %', v_remaining, NEW.code;
  END IF;

  IF NEW.type = 'normal' THEN
    NEW.total_amount := NEW.units_sold * v_price;
  ELSE
    NEW.total_amount := 0;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_process_sale
BEFORE INSERT ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.process_sale();
