-- Migration: Change RAY columns from BIGINT to NUMERIC(30,0)
-- This is needed because RAY values (1e27) exceed BIGINT range

ALTER TABLE aave_events 
    ALTER COLUMN supply_apy_ray TYPE NUMERIC(30,0),
    ALTER COLUMN borrow_apy_ray TYPE NUMERIC(30,0),
    ALTER COLUMN stable_borrow_rate_ray TYPE NUMERIC(30,0),
    ALTER COLUMN variable_borrow_rate_ray TYPE NUMERIC(30,0);

