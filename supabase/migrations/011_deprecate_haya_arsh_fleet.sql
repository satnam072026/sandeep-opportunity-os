-- Sandeep Opportunity OS — Migration 011: Decommission Obsolete Haya Arsh Fleet Configuration
-- Enforces strict 3-agent fleet: Bago Muse, Haya Satnam, Kattu AI.
-- Removes historical placeholder 'haya_arsh' from active fleet configuration.

DELETE FROM public.opportunity_agent_attribution WHERE agent_id = 'haya_arsh';
DELETE FROM public.opportunity_sources WHERE agent_id = 'haya_arsh';
DELETE FROM public.data_sources WHERE agent_id = 'haya_arsh';
DELETE FROM public.agents WHERE id = 'haya_arsh';
