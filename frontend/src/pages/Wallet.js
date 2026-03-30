import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, CreditCard, History, TrendingUp } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import Navigation from '@/components/Navigation';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Wallet = ({ user, onLogout }) => {
  const [walletData, setWalletData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWalletData();
  }, []);

  const fetchWalletData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API}/users/me`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setWalletData(response.data);
    } catch (error) {
      toast.error('Failed to load wallet data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading wallet...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] pb-24" data-testid="wallet-page">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-4xl font-black mb-2">Wallet</h1>
          <p className="text-[#A0A0A5] mb-8">Manage your earnings and payouts</p>

          <div className="glass-morphism rounded-3xl p-8 mb-8" data-testid="balance-card">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-full bg-[#10B981]">
                <DollarSign className="w-8 h-8 text-black" />
              </div>
              <div>
                <p className="text-sm text-[#A0A0A5]">Available Balance</p>
                <p className="text-5xl font-black">${(walletData?.wallet_balance || 0).toFixed(2)}</p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <button
                data-testid="withdraw-btn"
                className="btn-primary flex-1 py-4"
                onClick={() => toast.info('Payout feature coming soon!')}
              >
                <CreditCard className="w-5 h-5 inline mr-2" />
                Withdraw
              </button>
              <button
                data-testid="history-btn"
                className="btn-secondary flex-1 py-4"
              >
                <History className="w-5 h-5 inline mr-2" />
                History
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="neumorphism-dark rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <TrendingUp className="w-6 h-6 text-[#10B981]" />
                <h3 className="text-lg font-semibold">Earnings Breakdown</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[#A0A0A5]">View Earnings</span>
                  <span className="font-semibold">$0.00</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#A0A0A5]">Tips Received</span>
                  <span className="font-semibold">$0.00</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#A0A0A5]">Fundraising</span>
                  <span className="font-semibold">$0.00</span>
                </div>
              </div>
            </div>

            <div className="neumorphism-dark rounded-2xl p-6">
              <h3 className="text-lg font-semibold mb-4">Payout Information</h3>
              <p className="text-sm text-[#A0A0A5] mb-4">
                Earnings are calculated at $0.50 per 1,000 validated views. 
                Minimum payout threshold is $50.00.
              </p>
              <div className="p-3 bg-[#10B981]/10 border border-[#10B981]/20 rounded-lg">
                <p className="text-xs text-[#10B981] font-medium">
                  5% platform fee applies to all transactions
                </p>
              </div>
            </div>
          </div>

          <div className="neumorphism-dark rounded-2xl p-8">
            <h2 className="text-xl font-semibold mb-6">Recent Transactions</h2>
            <div className="text-center py-12 text-[#A0A0A5]">
              No transactions yet
            </div>
          </div>
        </motion.div>
      </div>

      <Navigation user={user} onLogout={onLogout} />
    </div>
  );
};

export default Wallet;