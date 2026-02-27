-- Criar enum para roles de usuário
CREATE TYPE public.app_role AS ENUM ('admin', 'medico');

-- Criar tabela de perfis de usuário
CREATE TABLE public.profiles (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  full_name TEXT,
  email TEXT NOT NULL
);

-- Criar tabela de roles de usuário (separada por segurança)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Habilitar RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Criar função security definer para verificar role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Políticas RLS para profiles
CREATE POLICY "Usuários podem ver seu próprio perfil"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Usuários podem atualizar seu próprio perfil"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Admins podem ver todos os perfis"
ON public.profiles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Políticas RLS para user_roles
CREATE POLICY "Usuários podem ver suas próprias roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins podem ver todas as roles"
ON public.user_roles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem gerenciar roles"
ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Função para criar perfil automaticamente quando usuário se registra
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
    NEW.email
  );
  
  -- Atribuir role de médico por padrão
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'medico');
  
  RETURN NEW;
END;
$$;

-- Trigger para criar perfil automaticamente
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger para atualizar updated_at em profiles
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();