-- Purge simulated news cache entries
DELETE FROM api_cache WHERE cache_key LIKE 'serp_news_%';
