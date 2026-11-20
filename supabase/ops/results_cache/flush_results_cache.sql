-- Drop every stored answer now (the table stays; the next view of each is built afresh). Use after
-- something the versions don't see changed the figures (a derived table rebuilt by hand, say). The
-- same without SQL: set RESULTS_CACHE_EPOCH in Render to a new value (also empties memory: a restart).
delete from public.results_cache;
