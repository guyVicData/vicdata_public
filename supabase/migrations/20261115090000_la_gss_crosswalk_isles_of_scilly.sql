-- GIAS refresh, 16 Oct 2026: GIAS now spells the LA "Isles of Scilly" (it was "Isles Of Scilly");
-- the DfE code (420) and GSS code (E06000053) are unchanged. region_nation_la_rollup joins
-- la_gss_crosswalk.la_name = schools.la_name exactly, and uses la_name as the LA's display name,
-- so the row is renamed rather than given a second spelling (a second row would put Scilly on
-- the rollup twice). Keyed on dfe_code, so it is safe to run twice. Apply straight after
-- sync-schools.js has brought the new spelling into schools.
update public.la_gss_crosswalk
set la_name = 'Isles of Scilly'
where dfe_code = '420' and la_name <> 'Isles of Scilly';
