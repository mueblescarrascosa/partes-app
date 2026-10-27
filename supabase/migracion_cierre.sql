-- Fin de servicio: un parte que termina sin hacer el trabajo (el cliente lo rechaza, la compañía lo anula,
-- el cliente acepta una indemnización u otro motivo). Pasa a «realizado» con esta información y,
-- si se factura algo (la visita, horas, otro concepto), van solo esas líneas en lineas_realizadas.
-- cierre = { motivo: 'rechazado' | 'anulado' | 'indemnizado' | 'otro', motivo_txt, nota, facturar: bool,
--            fecha, estado_antes, lineas_antes }  (lo «_antes» sirve para reabrirlo tal como estaba)
alter table public.partes add column if not exists cierre jsonb;
comment on column public.partes.cierre is 'Fin de servicio sin hacer el trabajo: motivo, nota, si se factura algo y cómo estaba antes (para reabrir)';
