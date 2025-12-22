-- Add 'pending_approval' status to verifications
-- This allows verifications that passed automated checks to await admin approval

-- Drop existing constraint
ALTER TABLE verifications DROP CONSTRAINT IF EXISTS verifications_status_check;

-- Add new constraint with pending_approval status
ALTER TABLE verifications ADD CONSTRAINT verifications_status_check
    CHECK (status IN ('pending', 'verified', 'failed', 'expired', 'pending_approval'));

-- Comment for documentation
COMMENT ON COLUMN verifications.status IS 'Verification status: pending (awaiting user proof), pending_approval (passed checks, awaiting admin), verified (approved), failed (checks failed), expired (challenge expired)';
