-- Roles enum + user_roles table
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin','employee');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read own roles" ON public.user_roles;
CREATE POLICY "read own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Convenience: allow admins to view all roles
DROP POLICY IF EXISTS "admins read all roles" ON public.user_roles;
CREATE POLICY "admins read all roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Track whether the first admin has been claimed (bootstrap)
CREATE TABLE IF NOT EXISTS public.auth_bootstrap (
  id int PRIMARY KEY DEFAULT 1,
  admin_claimed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (id = 1)
);
INSERT INTO public.auth_bootstrap (id, admin_claimed) VALUES (1, false)
  ON CONFLICT (id) DO NOTHING;

GRANT SELECT ON public.auth_bootstrap TO anon, authenticated;
GRANT ALL ON public.auth_bootstrap TO service_role;

ALTER TABLE public.auth_bootstrap ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone can read bootstrap" ON public.auth_bootstrap;
CREATE POLICY "anyone can read bootstrap" ON public.auth_bootstrap
  FOR SELECT TO anon, authenticated USING (true);
