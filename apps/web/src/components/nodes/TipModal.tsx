'use client';

import { useState, useEffect } from 'react';
import { X, Copy, Check, Coins, QrCode } from 'lucide-react';
import { getThemeConfig, getChainConfig } from '@/config';

interface TipConfig {
  wallet_address: string;
  accepted_coins: string[];
  minimum_tip: number | null;
  thank_you_message: string | null;
}

interface TipModalProps {
  nodeId: string;
  nodeName?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function TipModal({ nodeId, nodeName, isOpen, onClose }: TipModalProps) {
  const theme = getThemeConfig();
  const chain = getChainConfig();
  const [tipConfig, setTipConfig] = useState<TipConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedCoin, setSelectedCoin] = useState<string>(chain.ticker);

  useEffect(() => {
    if (isOpen) {
      fetchTipConfig();
    }
  }, [isOpen, nodeId]);

  const fetchTipConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/nodes/${nodeId}/tip-config`);

      if (!response.ok) {
        throw new Error('Failed to fetch tip configuration');
      }

      const data = await response.json();
      setTipConfig(data);
      setSelectedCoin(data.accepted_coins[0] || chain.ticker);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tip configuration');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (tipConfig?.wallet_address) {
      navigator.clipboard.writeText(tipConfig.wallet_address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const generateQRCode = () => {
    if (!tipConfig?.wallet_address) return '';
    // Using QR code API service - you can replace with a library if preferred
    const baseUrl = 'https://api.qrserver.com/v1/create-qr-code/';
    const params = new URLSearchParams({
      size: '256x256',
      data: tipConfig.wallet_address,
      bgcolor: 'ffffff',
      color: '000000',
    });
    return `${baseUrl}?${params.toString()}`;
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-6 py-4 border-b border-border"
          style={{
            background: `linear-gradient(135deg, ${theme.primaryColor}15 0%, transparent 100%)`,
          }}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Coins className="h-6 w-6" style={{ color: theme.primaryColor }} />
              <div>
                <h2 className="text-xl font-bold">Send a Tip</h2>
                {nodeName && (
                  <p className="text-sm text-muted-foreground">to {nodeName}</p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-muted border-t-primary"></div>
            </div>
          ) : error ? (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-center">
              <p className="text-destructive">{error}</p>
            </div>
          ) : tipConfig ? (
            <div className="space-y-6">
              {/* Thank You Message */}
              {tipConfig.thank_you_message && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm italic text-muted-foreground">
                    "{tipConfig.thank_you_message}"
                  </p>
                </div>
              )}

              {/* Coin Selection */}
              {tipConfig.accepted_coins.length > 1 && (
                <div>
                  <label className="block text-sm font-medium mb-3">
                    Select Cryptocurrency
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {tipConfig.accepted_coins.map((coin) => (
                      <button
                        key={coin}
                        onClick={() => setSelectedCoin(coin)}
                        className={`px-4 py-2 rounded-lg border transition-colors ${
                          selectedCoin === coin
                            ? 'bg-primary text-white border-primary'
                            : 'bg-background border-border hover:border-primary/50'
                        }`}
                      >
                        {coin}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* QR Code */}
              <div className="flex justify-center">
                <div className="bg-white p-4 rounded-lg border-2 border-border">
                  <img
                    src={generateQRCode()}
                    alt="Wallet QR Code"
                    className="w-64 h-64"
                  />
                </div>
              </div>

              {/* Wallet Address */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Wallet Address
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={tipConfig.wallet_address}
                    readOnly
                    className="flex-1 p-3 bg-muted border border-border rounded-lg font-mono text-sm select-all"
                  />
                  <button
                    onClick={copyToClipboard}
                    className="p-3 bg-background hover:bg-muted border border-border rounded-lg transition-colors"
                    title={copied ? 'Copied!' : 'Copy address'}
                  >
                    {copied ? (
                      <Check className="h-5 w-5 text-success" />
                    ) : (
                      <Copy className="h-5 w-5" />
                    )}
                  </button>
                </div>
                {copied && (
                  <p className="text-xs text-success mt-2">
                    Address copied to clipboard!
                  </p>
                )}
              </div>

              {/* Minimum Tip */}
              {tipConfig.minimum_tip && (
                <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg">
                  <p className="text-sm text-warning-foreground">
                    Minimum tip: {tipConfig.minimum_tip} {selectedCoin}
                  </p>
                </div>
              )}

              {/* Instructions */}
              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <p className="text-sm font-medium">How to send a tip:</p>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Scan the QR code with your wallet app</li>
                  <li>Or copy the wallet address above</li>
                  <li>Send your tip using {selectedCoin}</li>
                  <li>The node operator will receive your contribution</li>
                </ol>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-muted/30">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-background hover:bg-muted border border-border rounded-lg text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
