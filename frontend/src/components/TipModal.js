import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Gift } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const TipModal = ({ video, onClose }) => {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const presetAmounts = [1, 5, 10, 25, 50];

  const handleTip = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const origin = window.location.origin;
      
      const response = await axios.post(
        `${API}/tips/initiate`,
        {
          video_id: video.id,
          amount: parseFloat(amount)
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Origin: origin
          }
        }
      );

      window.location.href = response.data.checkout_url;
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to initiate tip');
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" data-testid="tip-modal">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        />
        
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative glass-morphism rounded-t-3xl sm:rounded-3xl p-8 w-full max-w-md z-10"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors"
            data-testid="close-modal-btn"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-full bg-[#10B981]">
              <Gift className="w-6 h-6 text-black" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Send a Tip</h2>
              <p className="text-sm text-[#A0A0A5]">Support {video.username}</p>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-3">Select Amount (USD)</label>
            <div className="grid grid-cols-5 gap-2 mb-4">
              {presetAmounts.map((preset) => (
                <button
                  key={preset}
                  onClick={() => setAmount(preset.toString())}
                  className={`p-3 rounded-xl border-2 transition-colors ${
                    amount === preset.toString()
                      ? 'border-[#10B981] bg-[#10B981]/10 text-[#10B981]'
                      : 'border-white/10 bg-[#141414] hover:border-white/20'
                  }`}
                  data-testid={`preset-${preset}`}
                >
                  ${preset}
                </button>
              ))}
            </div>
            
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#A0A0A5]">$</span>
              <input
                data-testid="custom-amount-input"
                type="number"
                min="1"
                step="0.01"
                className="input-field w-full pl-8"
                placeholder="Custom amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>

          <div className="p-4 bg-white/5 rounded-xl mb-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-[#A0A0A5]">Tip Amount</span>
              <span className="font-semibold">${amount || '0.00'}</span>
            </div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-[#A0A0A5]">Platform Fee (5%)</span>
              <span className="font-semibold">${amount ? (parseFloat(amount) * 0.05).toFixed(2) : '0.00'}</span>
            </div>
            <div className="border-t border-white/10 pt-2 mt-2 flex justify-between">
              <span className="font-semibold">Total</span>
              <span className="font-bold text-[#10B981]">${amount || '0.00'}</span>
            </div>
          </div>

          <button
            data-testid="send-tip-btn"
            onClick={handleTip}
            disabled={loading || !amount}
            className="btn-primary w-full py-4"
          >
            {loading ? 'Processing...' : 'Send Tip'}
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default TipModal;