-- Add http_file verification method
-- This allows node operators to verify ownership by serving a challenge file via HTTP

-- Drop the old constraint
ALTER TABLE verifications DROP CONSTRAINT IF EXISTS verifications_method_check;

-- Add new constraint with http_file method
ALTER TABLE verifications ADD CONSTRAINT verifications_method_check
  CHECK (method IN ('message_sign', 'user_agent', 'port_challenge', 'dns_txt', 'http_file'));

-- Comment for documentation
COMMENT ON COLUMN verifications.method IS 'Verification method: message_sign (wallet signature), user_agent (custom UA), port_challenge (port connectivity), dns_txt (DNS TXT record + IP resolution), http_file (HTTP file challenge)';
