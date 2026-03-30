import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Heart, TrendingUp, Calendar } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import Navigation from '@/components/Navigation';
import FundraiserModal from '@/components/FundraiserModal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Fundraisers = ({ user, onLogout }) => {
  const [fundraisers, setFundraisers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedFundraiser, setSelectedFundraiser] = useState(null);
  const [showContributeModal, setShowContributeModal] = useState(false);

  useEffect(() => {
    fetchFundraisers();
  }, []);

  const fetchFundraisers = async () => {
    try {
      const response = await axios.get(`${API}/fundraisers`);
      setFundraisers(response.data);
    } catch (error) {
      toast.error('Failed to load fundraisers');
    } finally {
      setLoading(false);
    }
  };

  const handleContribute = (fundraiser) => {
    setSelectedFundraiser(fundraiser);
    setShowContributeModal(true);
  };

  const calculateProgress = (current, goal) => {
    return Math.min((current / goal) * 100, 100);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading fundraisers...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] pb-24" data-testid="fundraisers-page">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-4xl font-black mb-2">Fundraisers</h1>
              <p className="text-[#A0A0A5]">Support causes you care about</p>
            </div>
            
            {user?.account_type === 'business' && (
              <button
                data-testid="create-fundraiser-btn"
                onClick={() => setShowCreateModal(true)}
                className="btn-primary"
              >
                Create Fundraiser
              </button>
            )}
          </div>

          {fundraisers.length === 0 ? (
            <div className="glass-morphism rounded-3xl p-12 text-center">
              <Heart className="w-16 h-16 mx-auto mb-4 text-[#10B981]" />
              <h3 className="text-xl font-semibold mb-2">No active fundraisers</h3>
              <p className="text-[#A0A0A5]">Be the first to create a fundraiser</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {fundraisers.map((fundraiser) => {
                const progress = calculateProgress(fundraiser.current_amount, fundraiser.goal_amount);
                
                return (
                  <motion.div
                    key={fundraiser.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.02 }}
                    className="glass-morphism rounded-2xl p-6 cursor-pointer"
                    onClick={() => handleContribute(fundraiser)}
                    data-testid="fundraiser-card"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#10B981] to-[#059669] flex items-center justify-center">
                        <Heart className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold">{fundraiser.username}</p>
                        <p className="text-xs text-[#A0A0A5]">Business Account</p>
                      </div>
                    </div>

                    <h3 className="text-xl font-bold mb-2">{fundraiser.title}</h3>
                    <p className="text-sm text-[#A0A0A5] mb-4 line-clamp-2">{fundraiser.description}</p>

                    <div className="mb-4">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-[#10B981] font-semibold">
                          ${fundraiser.current_amount.toFixed(2)}
                        </span>
                        <span className="text-[#A0A0A5]">
                          ${fundraiser.goal_amount.toFixed(2)}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#10B981] to-[#059669] transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="text-xs text-[#A0A0A5] mt-2">
                        {progress.toFixed(0)}% funded
                      </p>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-[#A0A0A5]">
                      <Calendar className="w-4 h-4" />
                      Started {new Date(fundraiser.created_at).toLocaleDateString()}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>

      <Navigation user={user} onLogout={onLogout} />
      
      {showCreateModal && (
        <FundraiserModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchFundraisers();
          }}
        />
      )}
      
      {showContributeModal && selectedFundraiser && (
        <FundraiserModal
          fundraiser={selectedFundraiser}
          onClose={() => setShowContributeModal(false)}
          onSuccess={() => {
            setShowContributeModal(false);
            fetchFundraisers();
          }}
          isContribute
        />
      )}
    </div>
  );
};

export default Fundraisers;