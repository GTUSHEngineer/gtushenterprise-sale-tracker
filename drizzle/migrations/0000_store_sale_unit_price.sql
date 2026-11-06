ALTER TABLE public.sales
  ADD COLUMN unit_price numeric;

CREATE OR REPLACE FUNCTION public.process_sale()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  NEW.unit_price := COALESCE(NEW.unit_price, v_price);

  IF NEW.type = 'normal' THEN
    NEW.total_amount := NEW.units_sold * NEW.unit_price;
  ELSE
    NEW.total_amount := 0;
  END IF;

  RETURN NEW;
END;
$function$;