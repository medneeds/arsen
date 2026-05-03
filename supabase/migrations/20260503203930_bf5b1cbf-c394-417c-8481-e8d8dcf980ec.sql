UPDATE public.profiles
SET access_profiles = ARRAY['desenvolvedor','gestor','nir','farmacia','ccih','administrativo','imagem','laboratorio','multi','classificacao_risco','medico']::text[]
WHERE id = '111eb1df-317e-4fa7-a0d2-7d4ddd87c354';