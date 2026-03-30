import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, TrendingUp, Eye, Gift, ArrowUpRight } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import Navigation from '@/components/Navigation';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Analytics = ({ user, onLogout }) => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API}/analytics/dashboard`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAnalytics(response.data);
    } catch (error) {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading analytics...</div>
      </div>
    );
  }

  const mockChartData = [
    { name: 'Mon', views: 120 },
    { name: 'Tue', views: 280 },
    { name: 'Wed', views: 450 },
    { name: 'Thu', views: 380 },
    { name: 'Fri', views: 520 },
    { name: 'Sat', views: 680 },
    { name: 'Sun', views: 890 }
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0A] pb-24" data-testid="analytics-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-4xl font-black mb-2">Analytics Dashboard</h1>
          <p className="text-[#A0A0A5] mb-8">Track your performance and earnings</p>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-12">
            <div className="metric-card rounded-xl p-6" data-testid="total-videos-card">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs uppercase tracking-[0.2em] font-semibold text-[#A0A0A5]">Total Videos</p>
                <TrendingUp className="w-4 h-4 text-[#10B981]" />
              </div>
              <p className="text-3xl font-black mb-1">{analytics?.total_videos || 0}</p>
              <p className="text-xs text-[#A0A0A5]">Published content</p>
            </div>

            <div className="metric-card rounded-xl p-6" data-testid="total-views-card">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs uppercase tracking-[0.2em] font-semibold text-[#A0A0A5]">Total Views</p>
                <Eye className="w-4 h-4 text-[#10B981]" />
              </div>
              <p className="text-3xl font-black mb-1">{(analytics?.total_views || 0).toLocaleString()}</p>
              <p className="text-xs text-[#10B981] flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3" />
                +24% this week
              </p>
            </div>

            <div className="metric-card rounded-xl p-6" data-testid="total-tips-card">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs uppercase tracking-[0.2em] font-semibold text-[#A0A0A5]">Tips Received</p>
                <Gift className="w-4 h-4 text-[#10B981]" />
              </div>
              <p className="text-3xl font-black mb-1">${(analytics?.total_tips || 0).toFixed(2)}</p>
              <p className="text-xs text-[#A0A0A5]">From supporters</p>
            </div>

            <div className="metric-card rounded-xl p-6" data-testid="wallet-balance-card">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs uppercase tracking-[0.2em] font-semibold text-[#A0A0A5]">Wallet Balance</p>
                <DollarSign className="w-4 h-4 text-[#10B981]" />
              </div>
              <p className="text-3xl font-black mb-1">${(analytics?.wallet_balance || 0).toFixed(2)}</p>
              <p className="text-xs text-[#A0A0A5]">Available to withdraw</p>
            </div>
          </div>

          <div className="neumorphism-dark rounded-2xl p-8 mb-8">
            <h2 className="text-xl font-semibold mb-6">Views This Week</h2>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={mockChartData}>
                <defs>
                  <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="#A0A0A5" />
                <YAxis stroke="#A0A0A5" />
                <Tooltip
                  contentStyle={{
                    background: '#141414',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px'
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="views"
                  stroke="#10B981"
                  strokeWidth={3}
                  fill="url(#viewsGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="neumorphism-dark rounded-2xl p-8">
            <h2 className="text-xl font-semibold mb-6">Recent Videos</h2>
            <div className="space-y-4">
              {analytics?.videos?.map((video) => (
                <div
                  key={video.id}
                  className="flex items-center gap-4 p-4 bg-[#0A0A0A] rounded-xl hover:bg-[#1C1C1E] transition-colors"
                  data-testid="recent-video-item"
                >
                  <img
                    src={video.cloudinary_url}
                    alt={video.title}
                    className="w-24 h-16 object-cover rounded-lg"
                  />
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">{video.title}</h3>
                    <p className="text-sm text-[#A0A0A5]">
                      {video.view_count.toLocaleString()} views • ${video.tips_received.toFixed(2)} tips
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      <Navigation user={user} onLogout={onLogout} />
    </div>
  );
};

export default Analytics;