-- Fix nodes_status_check constraint to include 'reachable' status
-- The crawler uses 'reachable' for nodes that respond to TCP but not P2P handshake

ALTER TABLE nodes DROP CONSTRAINT IF EXISTS nodes_status_check;
ALTER TABLE nodes ADD CONSTRAINT nodes_status_check
  CHECK (status = ANY (ARRAY['pending', 'up', 'down', 'reachable']));
