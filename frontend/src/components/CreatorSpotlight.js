import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Eye, DollarSign, Video } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CreatorSpotlight = () => {
  const navigate = useNavigate();
  const [spotlight, setSpotlight] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSpotlight();
  }, []);

  const fetchSpotlight = async () => {
    try {
      const response = await axios.get(`${API}/creators/spotlight?limit=10`);
      setSpotlight(response.data);
    } catch (error) {
      console.error('Failed to load spotlight');
    } finally {
      setLoading(false);
    }
  };

  if (loading || spotlight.length === 0) {
    return null;
  }

  return (
    <div className="w-full py-6 px-4 bg-gradient-to-r from-[#141414] to-[#0A0A0A] border-b border-white/5" data-testid="creator-spotlight">
      <div className="max-w-[500px] mx-auto">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-[#10B981]" />
          <h2 className="text-lg font-bold">Creator Spotlight</h2>
          <span className="text-xs text-[#A0A0A5]">Top creators this week</span>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
          {spotlight.map((creator, index) => (
            <motion.div
              key={creator.user_id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => navigate(`/profile/${creator.username}`)}
              className="flex-shrink-0 w-[200px] glass-morphism rounded-2xl p-4 cursor-pointer hover:scale-105 transition-transform"
              data-testid="spotlight-creator"
            >
              <div className="relative mb-3">
                {index === 0 && (
                  <div className="absolute -top-2 -right-2 z-10 p-2 rounded-full bg-[#10B981]">
                    <TrendingUp className="w-4 h-4 text-black" />
                  </div>
                )}
                <img
                  src={creator.user_avatar || 'https://images.unsplash.com/photo-1758486190195-dd677b21e00f?w=200&h=200&fit=crop'}
                  alt={creator.username}
                  className="w-16 h-16 rounded-full mx-auto border-2 border-[#10B981]"
                />
              </div>
              
              <p className="font-semibold text-center mb-2 truncate">{creator.username}</p>
              
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between text-[#A0A0A5]">
                  <span className="flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    {creator.total_views.toLocaleString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    {creator.total_tips.toFixed(0)}
                  </span>
                </div>
                <div className="flex items-center justify-center gap-1 text-[#10B981]">
                  <Video className="w-3 h-3" />
                  {creator.video_count} videos
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

export default CreatorSpotlight;