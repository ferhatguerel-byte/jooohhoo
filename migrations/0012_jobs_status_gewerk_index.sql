-- Migration 0012: Matching-Lifecycle – provider-zentrierte Kandidaten-Vorfilterung.
--
-- fetchProviderAndCandidateJobs() (src/lib/matching/provider-candidate-jobs.ts, Gegenstück zu
-- fetchJobAndCandidateProviders()) filtert offene Jobs nach status und gewerk in einer
-- WHERE-Bedingung – dieser zusammengesetzte Index deckt genau dieses Zugriffsmuster ab, analog zu
-- idx_users_role_subscription_status aus Migration 0001 für die job-zentrierte Query.

CREATE INDEX IF NOT EXISTS idx_jobs_status_gewerk ON jobs(status, gewerk);

INSERT INTO schema_migrations (filename) VALUES ('0012_jobs_status_gewerk_index.sql')
ON CONFLICT (filename) DO NOTHING;
