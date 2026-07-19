-- v60: expiry_run_logs — persists both scheduled and manual expiry run results
--      so run history survives backend restarts.
--      Idempotent: protected by the IF NOT EXISTS guard.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'expiry_run_logs')
BEGIN
    CREATE TABLE expiry_run_logs (
        id                   BIGINT IDENTITY(1,1) PRIMARY KEY,
        trigger_type         NVARCHAR(20)  NOT NULL,         -- SCHEDULED | MANUAL
        customer_id          BIGINT        NULL,             -- non-null for MANUAL runs only
        status               NVARCHAR(20)  NOT NULL,         -- RUNNING | SUCCESS | PARTIAL_FAILURE | FAILURE
        started_at           DATETIME2(6)  NOT NULL,
        finished_at          DATETIME2(6)  NULL,
        customers_processed  INT           NOT NULL DEFAULT 0,
        customers_succeeded  INT           NOT NULL DEFAULT 0,
        customers_failed     INT           NOT NULL DEFAULT 0,
        lots_expired         INT           NOT NULL DEFAULT 0,
        points_expired       INT           NOT NULL DEFAULT 0,
        error_summary        NVARCHAR(500) NULL,
        created_at           DATETIME2(6)  NOT NULL DEFAULT SYSDATETIME()
    );

    -- Index for quick "latest SCHEDULED run" lookup
    CREATE INDEX IX_erl_trigger_started ON expiry_run_logs (trigger_type, started_at DESC);
END
