-- SOLO STAGING (`moxtracker-research-staging`): toglie le tabelle Research per
-- riapplicare la migrazione R3 compattata e rimisurare G5C-03 sullo stesso D1.
-- Contengono soltanto dati sintetici delle misure. Mai su un altro database:
--   npx wrangler d1 execute moxtracker-research-staging --remote \
--     --config wrangler.research-staging.toml --file strumenti/research-staging/reset-schema-staging.sql
-- Ordine: figlie prima dei genitori, per le chiavi esterne.
DROP TABLE IF EXISTS research_event;
DROP TABLE IF EXISTS research_deck_card;
DROP TABLE IF EXISTS research_sideboard_delta;
DROP TABLE IF EXISTS research_game_contribution;
DROP TABLE IF EXISTS research_contribution_variante;
DROP TABLE IF EXISTS research_snapshot_storia;
DROP TABLE IF EXISTS research_revisione_server;
DROP TABLE IF EXISTS research_contribution;
DROP TABLE IF EXISTS research_consent_generation;
DROP TABLE IF EXISTS research_consent_tombstone;
DROP TABLE IF EXISTS research_deleted_contribution;
DROP TABLE IF EXISTS research_lineage;
DROP TABLE IF EXISTS research_guardia;
