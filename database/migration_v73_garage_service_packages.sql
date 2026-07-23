-- V73: garage_service_packages — many-to-many relationship between garages and service packages
-- A package can serve multiple garages; a garage can offer multiple packages.
-- Migration is idempotent: all CREATE statements are guarded by IF NOT EXISTS / IF OBJECT_ID.
-- Backfill pairs every currently-active package with every currently-active garage so that
-- no existing service disappears from the customer UI after this migration runs.

-- ── 1. Create the mapping table ──────────────────────────────────────────────────────────────
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'garage_service_packages'
)
BEGIN
    CREATE TABLE garage_service_packages (
        garage_id           BIGINT   NOT NULL,
        service_package_id  BIGINT   NOT NULL,
        is_active           BIT      NOT NULL CONSTRAINT DF_gsp_is_active DEFAULT 1,
        created_at          DATETIME2 CONSTRAINT DF_gsp_created_at DEFAULT GETDATE(),
        updated_at          DATETIME2 CONSTRAINT DF_gsp_updated_at DEFAULT GETDATE(),

        CONSTRAINT PK_garage_service_packages
            PRIMARY KEY (garage_id, service_package_id),

        CONSTRAINT FK_gsp_garage
            FOREIGN KEY (garage_id) REFERENCES garages (id),

        CONSTRAINT FK_gsp_package
            FOREIGN KEY (service_package_id) REFERENCES service_packages (id)
    );
END;

-- ── 2. Indexes for common query patterns ─────────────────────────────────────────────────────
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_gsp_garage_active' AND object_id = OBJECT_ID('garage_service_packages')
)
BEGIN
    CREATE INDEX IX_gsp_garage_active
        ON garage_service_packages (garage_id, is_active);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_gsp_package_active' AND object_id = OBJECT_ID('garage_service_packages')
)
BEGIN
    CREATE INDEX IX_gsp_package_active
        ON garage_service_packages (service_package_id, is_active);
END;

-- ── 3. Backfill: pair all active packages with all active garages ─────────────────────────────
-- Only inserts rows that do not already exist — safe to re-run at any time.
INSERT INTO garage_service_packages (garage_id, service_package_id, is_active)
SELECT g.id, sp.id, 1
FROM   garages          g
       CROSS JOIN service_packages sp
WHERE  g.is_active  = 1
  AND  sp.is_active = 1
  AND  NOT EXISTS (
           SELECT 1
           FROM   garage_service_packages gsp
           WHERE  gsp.garage_id          = g.id
             AND  gsp.service_package_id = sp.id
       );
