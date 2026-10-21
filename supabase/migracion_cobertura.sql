-- 2.10: modalidad, avisos de cobertura y límite de importe
alter table public.partes add column if not exists modalidad text;
alter table public.partes add column if not exists aviso_cobertura text;
alter table public.partes add column if not exists limite_importe numeric(10,2);
