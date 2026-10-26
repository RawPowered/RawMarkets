-- Catalog baseline marker (rows seeded via applyCatalogBaseline in embeddedCatalog.ts)
INSERT OR IGNORE INTO engine_meta (key, value) VALUES ('catalog_baseline_version', '0');
