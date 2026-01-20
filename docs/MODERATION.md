# Moderation Guide

This document explains how moderation works in AtlasP2P, including admin roles, moderation tools, and best practices.

---

## Admin Roles

### Super Admin

**Defined by:** `ADMIN_EMAILS` environment variable

**Capabilities:**
- All moderator capabilities
- Promote users to moderator
- Demote moderators
- Delete user accounts
- Access system settings
- Cannot be banned or demoted

**Assignment:**
```bash
# In .env file
ADMIN_EMAILS=admin1@example.com,admin2@example.com
```

### Moderator

**Defined by:** `admin_users` database table

**Capabilities:**
- Review moderation queue
- Approve/reject verifications
- Approve/reject profile changes
- Ban/unban users
- View audit logs
- View user list

**Assignment:** Promoted by super admin via Admin Dashboard → Users → Promote

---

## Moderation Queue

### What Gets Queued

1. **Node Verifications** (if manual approval enabled)
   - Verification method used
   - Node details (IP, port, location)
   - User who submitted
   - Timestamp

2. **Profile Changes** (if moderation enabled)
   - Display name changes
   - Description changes
   - Avatar uploads
   - Social links
   - Tip configuration

3. **Avatars** (always moderated if uploads enabled)
   - Image file
   - Node it belongs to
   - Uploader info

### Queue Interface

Access: Admin Dashboard → Moderation

**Filters:**
- Status: `pending`, `approved`, `rejected`, `all`
- Type: `verification`, `profile`, `avatar`, `all`
- Pagination for large queues

**Each Item Shows:**
- Item type and ID
- User email who submitted
- Node information (IP:port, location)
- Current vs pending values (for profile changes)
- Submission timestamp

---

## Moderation Actions

### Approve

- Content goes live immediately
- User notified (if notifications enabled)
- Action logged to audit trail

**For Verifications:**
- Node marked as verified
- `verified_nodes` record created
- Node gets verification badge

**For Profiles:**
- Pending changes applied
- Old values replaced
- Tip config updated (if changed)

### Reject

- Content denied
- User notified with reason
- Action logged with notes

**For Verifications:**
- Verification status set to `failed`
- Node remains unverified
- User can try again

**For Profiles:**
- Pending changes cleared
- Current profile unchanged
- User can resubmit

### Flag

- Marked for further review
- Stays in queue
- Other admins can see flag
- Useful for uncertain cases

---

## User Management

### Viewing Users

Access: Admin Dashboard → Users

**User List Shows:**
- Email address
- Account creation date
- Last sign-in
- Admin status
- Ban status
- Verified nodes count

### Banning Users

**What Ban Does:**
- User added to `banned_users` table
- User cannot log in
- Existing sessions invalidated
- Verified nodes remain (but can't be managed)
- Can be unbanned later

**Ban Form:**
- Reason (required, shown in audit)
- Permanent flag

**Who Can Be Banned:**
- Regular users
- Moderators (by super admin only)
- NOT super admins

### Unbanning Users

- Removes from `banned_users` table
- User can log in again
- Previous data restored

### Deleting Users

**Permanent Action:**
- Supabase auth account deleted
- User data cascade deleted
- Verified nodes ownership removed
- Cannot be undone

**Who Can Delete:**
- Super admins only
- Cannot delete self
- Cannot delete other super admins

---

## Audit Logs

### What's Logged

Every admin action is recorded:
- Moderation approvals/rejections
- User bans/unbans
- User promotions/demotions
- Settings changes

### Log Entry Contains

```json
{
  "id": "uuid",
  "admin_id": "uuid",
  "admin_email": "admin@example.com",
  "action": "moderation_approve",
  "resource_type": "verification",
  "resource_id": "uuid",
  "details": {
    "verification": {
      "method": "http_file",
      "node_address": "192.168.1.1:33117",
      "submitted_by": "user@example.com"
    }
  },
  "ip_address": "203.0.113.1",
  "user_agent": "Mozilla/5.0...",
  "created_at": "2025-01-21T00:00:00Z"
}
```

### Viewing Logs

Access: Admin Dashboard → Audit Logs

**Filters:**
- Resource type (verification, profile, user, etc.)
- Shows last 100 entries

---

## Configuration Options

### Moderation Settings

In `project.config.yaml`:

```yaml
adminConfig:
  requireApproval: true          # Manual approval for verifications
  moderateProfiles: true         # Review profile changes
  moderateAvatars: true          # Review avatar uploads
  allowAvatarUpload: true        # Enable avatar uploads at all

  alerts:
    enabled: true                # Enable alert system
    requireEmailVerification: true
```

### Verification Methods

Control which verification methods require approval:

```yaml
verificationConfig:
  enabledMethods:
    - message_sign   # Cryptographic signature
    - http_file      # File on web server
    - dns_txt        # DNS TXT record
    - user_agent     # Custom user agent string
```

---

## Best Practices

### Reviewing Verifications

1. **Check node is real**
   - IP resolves to actual node
   - Port matches expected
   - Version is valid

2. **Check verification method**
   - Message sign: Verify signature is valid
   - HTTP file: Check file was placed correctly
   - DNS TXT: Verify record exists
   - User agent: Confirm custom string

3. **Look for abuse patterns**
   - Multiple verifications from same IP
   - Suspicious user agents
   - Mass verification attempts

### Reviewing Profiles

1. **Display names**
   - No impersonation
   - No offensive content
   - Reasonable length

2. **Descriptions**
   - No spam or advertising
   - No offensive content
   - No personal information of others

3. **Avatars**
   - Appropriate content
   - No copyrighted material (unless owner)
   - No offensive imagery

4. **Social links**
   - Links actually work
   - Links are relevant
   - No malicious URLs

### Handling Ban Appeals

1. Review the ban reason in audit logs
2. Check user's history
3. Consider context
4. Document decision
5. Unban if warranted

---

## Security Considerations

### Protecting Admin Access

- Use strong, unique passwords
- Enable 2FA if available
- Don't share credentials
- Log out after admin sessions

### Avoiding Mistakes

- Double-check before rejecting
- Add clear rejection reasons
- Don't ban without cause
- Review audit logs periodically

### Preventing Abuse

- Monitor for unusual patterns
- Rotate ADMIN_EMAILS if compromised
- Review moderator actions
- Keep audit logs

---

## API Endpoints

For automation or custom admin tools:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/check` | GET | Check admin status |
| `/api/admin/moderation` | GET | List queue items |
| `/api/admin/moderation` | POST | Review item |
| `/api/admin/users` | GET | List users |
| `/api/admin/users` | POST | Promote/demote/ban |
| `/api/admin/users` | DELETE | Delete user |
| `/api/admin/audit` | GET | Get audit logs |
| `/api/admin/settings` | GET | Get settings |

See [API Reference](api/API_REFERENCE.md) for full documentation.

---

**Last Updated:** 2026-01-21
