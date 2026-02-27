-- Tornar o campo email nullable na tabela profiles
ALTER TABLE public.profiles ALTER COLUMN email DROP NOT NULL;

-- Atualizar a função de criar perfil para lidar com username
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    CASE 
      WHEN NEW.email LIKE '%@sistema.local' THEN NULL
      ELSE NEW.email
    END
  );
  
  -- Atribuir role de médico por padrão
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'medico');
  
  RETURN NEW;
END;
$$;