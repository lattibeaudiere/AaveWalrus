-- Placeholder SEAL migrations
-- Create a table to store SEAL-related metadata for walrus blobs
CREATE TABLE IF NOT EXISTS seal_metadata (
    id SERIAL PRIMARY KEY,
    event_id UUID REFERENCES aave_events(id) ON DELETE CASCADE,
    walrus_blob_id TEXT,
    policy JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add any indexes needed for queries
CREATE INDEX IF NOT EXISTS idx_seal_metadata_event_id ON seal_metadata(event_id);
