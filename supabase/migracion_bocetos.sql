-- Bocetos (dibujos internos): nuevo tipo de foto 'boceto'
alter table public.fotos drop constraint if exists fotos_tipo_check;
alter table public.fotos add constraint fotos_tipo_check check (tipo in ('antes','despues','otra','boceto'));
