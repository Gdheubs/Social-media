import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Heart } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const FundraiserModal = ({ fundraiser, onClose, onSuccess, isContribute = false }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    goal_amount: ''
  });
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreateFundraiser = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/fundraisers/create`,
        {
          title: formData.title,
          description: formData.description,
          goal_amount: parseFloat(formData.goal_amount)
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Fundraiser created successfully!');
      onSuccess();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create fundraiser');
    } finally {
      setLoading(false);
    }
  };

  const handleContribute = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const origin = window.location.origin;
      
      const response = await axios.post(
        `${API}/fundraisers/${fundraiser.id}/contribute`,
        { amount: parseFloat(amount) },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Origin: origin
          },
          params: { amount: parseFloat(amount) }
        }
      );

      window.location.href = response.data.checkout_url;
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to initiate contribution');
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" data-testid="fundraiser-modal">
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
          className="relative glass-morphism rounded-t-3xl sm:rounded-3xl p-8 w-full max-w-md z-10"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors"
            data-testid="close-fundraiser-modal-btn"
          >
            <X className="w-6 h-6" />
          </button>

          {!isContribute ? (
            <form onSubmit={handleCreateFundraiser}>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-full bg-[#10B981]">
                  <Heart className="w-6 h-6 text-black" />
                </div>
                <h2 className="text-2xl font-bold">Create Fundraiser</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Title</label>
                  <input
                    data-testid="fundraiser-title-input"
                    type="text"
                    className="input-field w-full"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <textarea
                    data-testid="fundraiser-description-input"
                    className="input-field w-full min-h-[100px]"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Goal Amount (USD)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#A0A0A5]">$</span>
                    <input
                      data-testid="fundraiser-goal-input"
                      type="number"
                      min="1"
                      step="0.01"
                      className="input-field w-full pl-8"
                      value={formData.goal_amount}
                      onChange={(e) => setFormData({ ...formData, goal_amount: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>

              <button
                data-testid="create-fundraiser-submit-btn"
                type="submit"
                disabled={loading}
                className="btn-primary w-full mt-6 py-4"
              >
                {loading ? 'Creating...' : 'Create Fundraiser'}
              </button>
            </form>
          ) : (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-full bg-[#10B981]">
                  <Heart className="w-6 h-6 text-black" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Contribute</h2>
                  <p className="text-sm text-[#A0A0A5]">{fundraiser.title}</p>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Contribution Amount (USD)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#A0A0A5]">$</span>
                  <input
                    data-testid="contribution-amount-input"
                    type="number"
                    min="1"
                    step="0.01"
                    className="input-field w-full pl-8"
                    placeholder="Enter amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
              </div>

              <button
                data-testid="contribute-btn"
                onClick={handleContribute}
                disabled={loading || !amount}
                className="btn-primary w-full py-4"
              >
                {loading ? 'Processing...' : 'Contribute Now'}
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default FundraiserModal;