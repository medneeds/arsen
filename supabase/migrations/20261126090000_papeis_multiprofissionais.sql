-- Capitulo multiprofissional (staging): papeis de nutricao e fisioterapia.
-- ALTER TYPE ... ADD VALUE nao pode ser usado na mesma transacao em que o valor
-- e criado; aplicar este arquivo sozinho.
--
-- Reversao: PostgreSQL nao remove valor de enum. Para reverter, recriar o tipo
-- sem os valores (so possivel se nenhuma linha usar 'nutricionista' ou
-- 'fisioterapeuta').

alter type public.papel_profissional add value if not exists 'nutricionista';
alter type public.papel_profissional add value if not exists 'fisioterapeuta';
