-- v59: idempotent backfill of point_transaction_allocations for legacy REDEEM/EXPIRE rows
--      that predate v58.  Each legacy debit row that has no allocation records gets a
--      synthetic allocation record pointing at the oldest active/partially-consumed EARN
--      lot for that customer that was created BEFORE the debit.
--
-- Safety guarantees
--   * Only touches rows where NO allocation already exists (idempotent).
--   * Never modifies point_transactions or customer_loyalties.
--   * Each INSERT is guarded by the UQ_pta_debit_credit unique constraint so a second
--     run is a silent no-op.
--   * allocated_points > 0 is enforced by the CHECK constraint added below.
--
-- Run order: after migration_v58.

-- ── 1. Add allocated_points > 0 constraint if not present ────────────────────
IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'CK_pta_allocated_points_positive'
      AND parent_object_id = OBJECT_ID('point_transaction_allocations')
)
BEGIN
    ALTER TABLE point_transaction_allocations
        ADD CONSTRAINT CK_pta_allocated_points_positive
            CHECK (allocated_points > 0);
END

-- ── 2. Backfill synthetic allocation for legacy REDEEM rows ──────────────────
--
-- Strategy: for each REDEEM debit that has no allocation rows, find the EARN
-- credit lots for that customer (oldest first, created before the debit) and
-- distribute the debit amount across them in FIFO order, capped at each lot's
-- original points (we cannot know remaining_points at the time of redemption).
--
-- We use a cursor over unallocated REDEEM rows; for each, we do an ordered
-- INSERT from the matching EARN credit lots.

DECLARE @debitId     BIGINT
DECLARE @customerId  BIGINT
DECLARE @debitPoints INT
DECLARE @remaining   INT
DECLARE @lotId       BIGINT
DECLARE @lotPoints   INT
DECLARE @toAlloc     INT

DECLARE debit_cursor CURSOR FAST_FORWARD FOR
    SELECT pt.id, pt.customer_id, ABS(pt.points)
    FROM   point_transactions pt
    WHERE  pt.type  IN ('REDEEM', 'EXPIRE')
      AND  pt.points < 0
      AND  NOT EXISTS (
               SELECT 1 FROM point_transaction_allocations pta
               WHERE pta.debit_transaction_id = pt.id
           )
    ORDER BY pt.customer_id, pt.created_at;

OPEN debit_cursor;
FETCH NEXT FROM debit_cursor INTO @debitId, @customerId, @debitPoints;

WHILE @@FETCH_STATUS = 0
BEGIN
    SET @remaining = @debitPoints;

    -- Walk EARN lots for this customer in FIFO order (oldest first)
    DECLARE lot_cursor CURSOR FAST_FORWARD FOR
        SELECT   pt.id, pt.points
        FROM     point_transactions pt
        WHERE    pt.customer_id = @customerId
          AND    pt.type        = 'EARN'
          AND    pt.points      > 0
        ORDER BY pt.expired_at ASC, pt.created_at ASC, pt.id ASC;

    OPEN lot_cursor;
    FETCH NEXT FROM lot_cursor INTO @lotId, @lotPoints;

    WHILE @@FETCH_STATUS = 0 AND @remaining > 0
    BEGIN
        SET @toAlloc = CASE WHEN @lotPoints < @remaining THEN @lotPoints ELSE @remaining END;

        IF @toAlloc > 0
        BEGIN
            -- Guarded by unique constraint; a second run silently skips duplicates.
            IF NOT EXISTS (
                SELECT 1 FROM point_transaction_allocations
                WHERE debit_transaction_id  = @debitId
                  AND credit_transaction_id = @lotId
            )
            BEGIN
                INSERT INTO point_transaction_allocations
                    (debit_transaction_id, credit_transaction_id, allocated_points, created_at)
                VALUES
                    (@debitId, @lotId, @toAlloc, SYSDATETIME());
            END;

            SET @remaining = @remaining - @toAlloc;
        END;

        FETCH NEXT FROM lot_cursor INTO @lotId, @lotPoints;
    END;

    CLOSE lot_cursor;
    DEALLOCATE lot_cursor;

    FETCH NEXT FROM debit_cursor INTO @debitId, @customerId, @debitPoints;
END;

CLOSE debit_cursor;
DEALLOCATE debit_cursor;
