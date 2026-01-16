-- ===========================================
-- FIX: Add DELETE policy for verifications
-- ===========================================
-- Users should be able to delete their own pending verifications
-- without requiring admin client bypass
--
-- BEFORE: Users could not delete their own verifications, requiring
--         admin client usage in DELETE /api/verify endpoint
--
-- AFTER: Users can delete their own verifications when in
--        'pending' or 'pending_approval' status
-- ===========================================

CREATE POLICY "Users can delete own pending verifications"
  ON verifications
  FOR DELETE
  USING (
    auth.uid() = user_id
    AND status IN ('pending', 'pending_approval')
  );

-- ===========================================
-- VERIFICATION:
--
-- Test that users can now delete their own verifications:
-- 1. Create a verification as a user
-- 2. Try to delete it using regular client (not admin)
-- 3. Should succeed if status is pending/pending_approval
-- 4. Should fail if status is verified/failed/expired
-- ===========================================
