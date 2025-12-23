'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Save, Loader2, Upload, X, Coins, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { getThemeConfig, getFeatureFlags, getChainConfig } from '@/config';
import { useToast } from '@/components/ui/Toast';

// Force dynamic rendering to bypass Next.js 16 pre-rendering bug
export const dynamic = 'force-dynamic';

interface ProfileData {
  displayName: string;
  description: string;
  avatarUrl: string;
  website: string;
  twitter: string;
  github: string;
  discord: string;
  telegram: string;
  isPublic: boolean;
}

interface PendingChanges {
  display_name?: string;
  description?: string;
  avatar_url?: string;
  website?: string;
  twitter?: string;
  github?: string;
  discord?: string;
  telegram?: string;
  is_public?: boolean;
}

interface TipConfigData {
  walletAddress: string;
  acceptedCoins: string[];
  minimumTip: number | null;
  thankYouMessage: string;
  isActive: boolean;
}

export default function EditProfilePage() {
  const router = useRouter();
  const params = useParams();
  const nodeId = params.id as string;
  const theme = getThemeConfig();
  const features = getFeatureFlags();
  const { toast } = useToast();

  // Get accepted coins from config (with fallback using current chain's ticker)
  const chainTicker = getChainConfig().ticker;
  const acceptedCoins = features.tipping?.acceptedCoins || [chainTicker, 'BTC', 'LTC', 'DOGE', 'ETH'];

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [pendingSubmittedAt, setPendingSubmittedAt] = useState<string | null>(null);

  const [profile, setProfile] = useState<ProfileData>({
    displayName: '',
    description: '',
    avatarUrl: '',
    website: '',
    twitter: '',
    github: '',
    discord: '',
    telegram: '',
    isPublic: true
  });

  const [tipConfig, setTipConfig] = useState<TipConfigData>({
    walletAddress: '',
    acceptedCoins: [],  // User selects which coins they accept
    minimumTip: null,
    thankYouMessage: '',
    isActive: false
  });

  useEffect(() => {
    fetchProfile();
    fetchTipConfig();
  }, [nodeId]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/profiles/${nodeId}`);

      if (!response.ok) {
        if (response.status === 404) {
          // No profile yet, use empty state
          return;
        }
        throw new Error('Failed to fetch profile');
      }

      const data = await response.json();

      // Check for pending changes
      if (data.pending_changes && data.has_pending_changes) {
        setHasPendingChanges(true);
        setPendingSubmittedAt(data.pending_submitted_at);
        // Show pending values in the form (so user sees what they submitted)
        const pending = data.pending_changes as PendingChanges;
        setProfile({
          displayName: pending.display_name || data.display_name || '',
          description: pending.description || data.description || '',
          avatarUrl: pending.avatar_url || data.avatar_url || '',
          website: pending.website || data.website || '',
          twitter: pending.twitter || data.twitter || '',
          github: pending.github || data.github || '',
          discord: pending.discord || data.discord || '',
          telegram: pending.telegram || data.telegram || '',
          isPublic: pending.is_public ?? data.is_public ?? true
        });
      } else {
        // API returns snake_case from database
        setProfile({
          displayName: data.display_name || '',
          description: data.description || '',
          avatarUrl: data.avatar_url || '',
          website: data.website || '',
          twitter: data.twitter || '',
          github: data.github || '',
          discord: data.discord || '',
          telegram: data.telegram || '',
          isPublic: data.is_public ?? true
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const fetchTipConfig = async () => {
    try {
      const response = await fetch(`/api/nodes/${nodeId}/tip-config`);

      if (!response.ok) {
        if (response.status === 404) {
          // No tip config yet, use empty state
          return;
        }
        throw new Error('Failed to fetch tip configuration');
      }

      const data = await response.json();
      setTipConfig({
        walletAddress: data.wallet_address || '',
        acceptedCoins: data.accepted_coins || ['BTC'],
        minimumTip: data.minimum_tip || null,
        thankYouMessage: data.thank_you_message || '',
        isActive: data.is_active ?? false
      });
    } catch (err) {
      // Silent fail - tip config is optional
      console.error('Failed to load tip config:', err);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      // Save profile and tip config together (both go through moderation)
      const profileResponse = await fetch(`/api/profiles/${nodeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...profile,
          // Include tip config in the same request for moderation
          tipConfig: tipConfig.isActive || tipConfig.walletAddress.trim() ? tipConfig : undefined
        }),
      });

      const profileData = await profileResponse.json();

      if (!profileResponse.ok) {
        throw new Error(profileData.error || 'Failed to save profile');
      }

      setSuccess(true);
      // Check if profile changes require approval
      if (profileData.pending) {
        setSuccessMessage(profileData.message || 'Your changes have been submitted for admin review.');
        setHasPendingChanges(true);
        setPendingSubmittedAt(new Date().toISOString());
        // Show toast for immediate feedback
        toast.success('Submitted for Review', 'An admin will review your changes shortly.');
        // Don't redirect immediately, let user see the message
        setTimeout(() => {
          router.push('/manage/nodes');
        }, 3000);
      } else {
        setSuccessMessage('Profile saved successfully! Redirecting...');
        toast.success('Profile Saved', 'Your changes have been applied.');
        setTimeout(() => {
          router.push('/manage/nodes');
        }, 1500);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save profile';
      setError(errorMessage);
      toast.error('Save Failed', errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be smaller than 2MB');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/profiles/${nodeId}/avatar`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to upload avatar');
      }

      const data = await response.json();
      setProfile(prev => ({ ...prev, avatarUrl: data.url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload avatar');
    } finally {
      setUploading(false);
    }
  };

  const removeAvatar = () => {
    setProfile(prev => ({ ...prev, avatarUrl: '' }));
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-12 w-12 animate-spin" style={{ color: theme.primaryColor }} />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.push('/my-nodes')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to My Nodes
        </button>
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Edit Node Profile
        </h1>
        <p className="text-muted-foreground">
          Customize how your node appears to others
        </p>
      </div>

      {/* Pending Changes Banner */}
      {hasPendingChanges && !success && (
        <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-amber-600 dark:text-amber-400">
                Changes Pending Approval
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Your profile changes are waiting for admin review.
                {pendingSubmittedAt && (
                  <> Submitted {new Date(pendingSubmittedAt).toLocaleDateString()} at {new Date(pendingSubmittedAt).toLocaleTimeString()}.</>
                )}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                You can update your submission below. The new changes will replace the pending ones.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="mb-6 p-4 bg-success/10 border border-success/20 rounded-lg">
          <p className="text-success">{successMessage || 'Profile saved successfully!'}</p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
            <p className="text-destructive">{error}</p>
          </div>
        </div>
      )}

      {/* Profile Form */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-6">
        {/* Avatar Upload */}
        <div>
          <label className="block text-sm font-medium mb-3">Avatar</label>
          <div className="flex items-center gap-4">
            {profile.avatarUrl ? (
              <div className="relative">
                <img
                  src={profile.avatarUrl}
                  alt="Avatar"
                  className="h-24 w-24 rounded-full object-cover border-2 border-border"
                />
                <button
                  onClick={removeAvatar}
                  className="absolute -top-2 -right-2 p-1 bg-destructive text-white rounded-full hover:bg-destructive/90"
                  title="Remove avatar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="h-24 w-24 rounded-full bg-muted border-2 border-dashed border-border flex items-center justify-center">
                <Upload className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            <div>
              <input
                type="file"
                id="avatar-upload"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
                disabled={uploading}
              />
              <label
                htmlFor="avatar-upload"
                className="inline-flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg cursor-pointer transition-colors"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Upload Image
                  </>
                )}
              </label>
              <p className="text-xs text-muted-foreground mt-2">
                Max 2MB, 256x256px recommended
              </p>
            </div>
          </div>
        </div>

        {/* Display Name */}
        <div>
          <label htmlFor="displayName" className="block text-sm font-medium mb-2">
            Display Name
          </label>
          <input
            id="displayName"
            type="text"
            value={profile.displayName}
            onChange={(e) => setProfile(prev => ({ ...prev, displayName: e.target.value }))}
            placeholder="My Awesome Node"
            className="w-full p-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            maxLength={50}
          />
          <p className="text-xs text-muted-foreground mt-1">
            {profile.displayName.length}/50 characters
          </p>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium mb-2">
            Description
          </label>
          <textarea
            id="description"
            value={profile.description}
            onChange={(e) => setProfile(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Tell others about your node..."
            className="w-full p-3 bg-background border border-border rounded-lg resize-none h-32 focus:outline-none focus:ring-2 focus:ring-primary/50"
            maxLength={500}
          />
          <p className="text-xs text-muted-foreground mt-1">
            {profile.description.length}/500 characters
          </p>
        </div>

        {/* Website */}
        <div>
          <label htmlFor="website" className="block text-sm font-medium mb-2">
            Website
          </label>
          <input
            id="website"
            type="url"
            value={profile.website}
            onChange={(e) => setProfile(prev => ({ ...prev, website: e.target.value }))}
            placeholder="https://example.com"
            className="w-full p-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {/* Social Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="twitter" className="block text-sm font-medium mb-2">
              Twitter/X
            </label>
            <input
              id="twitter"
              type="text"
              value={profile.twitter}
              onChange={(e) => setProfile(prev => ({ ...prev, twitter: e.target.value }))}
              placeholder="@username"
              className="w-full p-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div>
            <label htmlFor="github" className="block text-sm font-medium mb-2">
              GitHub
            </label>
            <input
              id="github"
              type="text"
              value={profile.github}
              onChange={(e) => setProfile(prev => ({ ...prev, github: e.target.value }))}
              placeholder="username"
              className="w-full p-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div>
            <label htmlFor="discord" className="block text-sm font-medium mb-2">
              Discord
            </label>
            <input
              id="discord"
              type="text"
              value={profile.discord}
              onChange={(e) => setProfile(prev => ({ ...prev, discord: e.target.value }))}
              placeholder="username#1234"
              className="w-full p-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div>
            <label htmlFor="telegram" className="block text-sm font-medium mb-2">
              Telegram
            </label>
            <input
              id="telegram"
              type="text"
              value={profile.telegram}
              onChange={(e) => setProfile(prev => ({ ...prev, telegram: e.target.value }))}
              placeholder="@username"
              className="w-full p-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>

        {/* Public Toggle */}
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div>
            <p className="font-medium">Public Profile</p>
            <p className="text-sm text-muted-foreground">
              Make your profile visible to everyone on the network map
            </p>
          </div>
          <button
            onClick={() => setProfile(prev => ({ ...prev, isPublic: !prev.isPublic }))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              profile.isPublic ? 'bg-primary' : 'bg-muted-foreground/30'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                profile.isPublic ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Tipping Configuration */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-6 mt-6">
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <Coins className="h-6 w-6" style={{ color: theme.primaryColor }} />
          <div>
            <h2 className="text-xl font-bold">Tipping Configuration</h2>
            <p className="text-sm text-muted-foreground">
              Allow others to tip your node for its contribution to the network
            </p>
          </div>
        </div>

        {/* Enable Tipping Toggle */}
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div>
            <p className="font-medium">Enable Tipping</p>
            <p className="text-sm text-muted-foreground">
              Display a tip button on your node profile
            </p>
          </div>
          <button
            onClick={() => setTipConfig(prev => ({ ...prev, isActive: !prev.isActive }))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              tipConfig.isActive ? 'bg-primary' : 'bg-muted-foreground/30'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                tipConfig.isActive ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Wallet Address */}
        <div>
          <label htmlFor="walletAddress" className="block text-sm font-medium mb-2">
            Wallet Address <span className="text-destructive">*</span>
          </label>
          <input
            id="walletAddress"
            type="text"
            value={tipConfig.walletAddress}
            onChange={(e) => setTipConfig(prev => ({ ...prev, walletAddress: e.target.value }))}
            placeholder="Enter your wallet address"
            className="w-full p-3 bg-background border border-border rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            disabled={!tipConfig.isActive}
          />
          <p className="text-xs text-muted-foreground mt-1">
            This address will be displayed when someone tips your node
          </p>
        </div>

        {/* Accepted Coins */}
        <div>
          <label className="block text-sm font-medium mb-3">
            Accepted Cryptocurrencies
          </label>
          <div className="flex flex-wrap gap-3">
            {acceptedCoins.map((coin) => (
              <button
                key={coin}
                onClick={() => {
                  setTipConfig(prev => {
                    const coins = prev.acceptedCoins.includes(coin)
                      ? prev.acceptedCoins.filter(c => c !== coin)
                      : [...prev.acceptedCoins, coin];
                    return { ...prev, acceptedCoins: coins };
                  });
                }}
                disabled={!tipConfig.isActive}
                className={`px-4 py-2 rounded-lg border transition-colors ${
                  tipConfig.acceptedCoins.includes(coin)
                    ? 'bg-primary text-white border-primary'
                    : 'bg-background border-border hover:border-primary/50'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {coin}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Select which cryptocurrencies you accept for tips
          </p>
        </div>

        {/* Minimum Tip Amount */}
        <div>
          <label htmlFor="minimumTip" className="block text-sm font-medium mb-2">
            Minimum Tip Amount (Optional)
          </label>
          <input
            id="minimumTip"
            type="number"
            step="0.01"
            min="0"
            value={tipConfig.minimumTip || ''}
            onChange={(e) => setTipConfig(prev => ({
              ...prev,
              minimumTip: e.target.value ? parseFloat(e.target.value) : null
            }))}
            placeholder="No minimum"
            className="w-full p-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            disabled={!tipConfig.isActive}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Leave empty for no minimum tip requirement
          </p>
        </div>

        {/* Thank You Message */}
        <div>
          <label htmlFor="thankYouMessage" className="block text-sm font-medium mb-2">
            Thank You Message (Optional)
          </label>
          <textarea
            id="thankYouMessage"
            value={tipConfig.thankYouMessage}
            onChange={(e) => setTipConfig(prev => ({ ...prev, thankYouMessage: e.target.value }))}
            placeholder="Thank you for supporting my node!"
            className="w-full p-3 bg-background border border-border rounded-lg resize-none h-24 focus:outline-none focus:ring-2 focus:ring-primary/50"
            maxLength={200}
            disabled={!tipConfig.isActive}
          />
          <p className="text-xs text-muted-foreground mt-1">
            {tipConfig.thankYouMessage.length}/200 characters
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <button
            onClick={() => router.push('/my-nodes')}
            className="px-6 py-2 bg-muted hover:bg-muted/80 rounded-lg transition-colors"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !profile.displayName}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-2 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: theme.primaryColor }}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                {hasPendingChanges ? 'Update & Resubmit' : 'Submit for Review'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
