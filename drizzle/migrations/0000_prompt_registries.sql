CREATE TABLE public.prompt_registries (
  user_id uuid PRIMARY KEY,
  registry jsonb NOT NULL DEFAULT '{"assets":[],"audit":[]}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prompt_registries TO authenticated;
GRANT ALL ON public.prompt_registries TO service_role;
ALTER TABLE public.prompt_registries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own registry select" ON public.prompt_registries FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own registry insert" ON public.prompt_registries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own registry update" ON public.prompt_registries FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own registry delete" ON public.prompt_registries FOR DELETE TO authenticated USING (auth.uid() = user_id);