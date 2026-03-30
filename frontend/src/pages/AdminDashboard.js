import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, Users, Video, Flag, CheckCircle, XCircle, Eye, TrendingUp, DollarSign } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import Navigation from '@/components/Navigation';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AdminDashboard = ({ user, onLogout }) => {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [flags, setFlags] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [timeseriesData, setTimeseriesData] = useState([]);
  const [engagementData, setEngagementData] = useState(null);

  useEffect(() => {
    if (user?.email !== 'admin@example.com') {
      toast.error('Admin access required');
      return;
    }
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [statsRes, usersRes, flagsRes, timeseriesRes, engagementRes] = await Promise.all([
        axios.get(`${API}/admin/stats`, { headers }),
        axios.get(`${API}/admin/users?limit=20`, { headers }),
        axios.get(`${API}/moderation/queue`, { headers }),
        axios.get(`${API}/admin/analytics/timeseries?days=30`, { headers }),
        axios.get(`${API}/admin/analytics/engagement`, { headers })
      ]);

      setStats(statsRes.data);
      setUsers(usersRes.data);
      setFlags(flagsRes.data);
      setTimeseriesData(timeseriesRes.data);
      setEngagementData(engagementRes.data);
    } catch (error) {
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyUser = async (userId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/admin/users/${userId}/verify`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('User verified');
      fetchDashboardData();
    } catch (error) {
      toast.error('Failed to verify user');
    }
  };

  const handleResolveFlag = async (flagId, action) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/admin/flags/${flagId}/resolve`,
        { action },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Flag ${action === 'remove' ? 'resolved and video removed' : 'resolved'}`);
      fetchDashboardData();
    } catch (error) {
      toast.error('Failed to resolve flag');
    }
  };

  if (user?.email !== 'admin@example.com') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 mx-auto mb-4 text-[#F43F5E]" />
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-[#A0A0A5]">Admin privileges required</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading admin dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] pb-24" data-testid="admin-dashboard">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-3 mb-8">
            <Shield className="w-10 h-10 text-[#F43F5E]" />
            <div>
              <h1 className="text-4xl font-black">Admin Dashboard</h1>
              <p className="text-[#A0A0A5]">Platform management & moderation</p>
            </div>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
            <div className="metric-card rounded-xl p-6">
              <Users className="w-6 h-6 text-[#10B981] mb-2" />
              <p className="text-2xl font-black">{stats?.total_users || 0}</p>
              <p className="text-xs text-[#A0A0A5]">Total Users</p>
            </div>
            <div className="metric-card rounded-xl p-6">
              <Video className="w-6 h-6 text-[#10B981] mb-2" />
              <p className="text-2xl font-black">{stats?.total_videos || 0}</p>
              <p className="text-xs text-[#A0A0A5]">Total Videos</p>
            </div>
            <div className="metric-card rounded-xl p-6">
              <Flag className="w-6 h-6 text-[#F43F5E] mb-2" />
              <p className="text-2xl font-black">{stats?.pending_flags || 0}</p>
              <p className="text-xs text-[#A0A0A5]">Pending Flags</p>
            </div>
            <div className="metric-card rounded-xl p-6">
              <CheckCircle className="w-6 h-6 text-[#10B981] mb-2" />
              <p className="text-2xl font-black">{stats?.total_transactions || 0}</p>
              <p className="text-xs text-[#A0A0A5]">Transactions</p>
            </div>
            <div className="metric-card rounded-xl p-6">
              <Eye className="w-6 h-6 text-[#10B981] mb-2" />
              <p className="text-2xl font-black">{stats?.active_fundraisers || 0}</p>
              <p className="text-xs text-[#A0A0A5]">Fundraisers</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mb-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-6 py-3 rounded-xl font-semibold transition-colors ${
                activeTab === 'overview'
                  ? 'bg-[#10B981] text-black'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
              data-testid="tab-overview"
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`px-6 py-3 rounded-xl font-semibold transition-colors ${
                activeTab === 'users'
                  ? 'bg-[#10B981] text-black'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
              data-testid="tab-users"
            >
              Users ({users.length})
            </button>
            <button
              onClick={() => setActiveTab('moderation')}
              className={`px-6 py-3 rounded-xl font-semibold transition-colors ${
                activeTab === 'moderation'
                  ? 'bg-[#10B981] text-black'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
              data-testid="tab-moderation"
            >
              Moderation ({flags.length})
            </button>
          </div>

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="neumorphism-dark rounded-2xl p-8">
              <h2 className="text-2xl font-bold mb-6">User Management</h2>
              <div className="space-y-4">
                {users.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between p-4 bg-[#0A0A0A] rounded-xl hover:bg-[#1C1C1E] transition-colors"
                    data-testid="user-item"
                  >
                    <div className="flex items-center gap-4">
                      <img
                        src={u.avatar || 'https://images.unsplash.com/photo-1758486190195-dd677b21e00f?w=100&h=100&fit=crop'}
                        alt={u.username}
                        className="w-12 h-12 rounded-full"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{u.username}</p>
                          {u.verification_status && (
                            <CheckCircle className="w-4 h-4 text-[#10B981]" />
                          )}
                        </div>
                        <p className="text-sm text-[#A0A0A5]">{u.email} • {u.account_type}</p>
                      </div>
                    </div>
                    {!u.verification_status && (
                      <button
                        onClick={() => handleVerifyUser(u.id)}
                        className="btn-primary px-4 py-2 text-sm"
                        data-testid={`verify-user-${u.id}`}
                      >
                        Verify
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Moderation Tab */}
          {activeTab === 'moderation' && (
            <div className="neumorphism-dark rounded-2xl p-8">
              <h2 className="text-2xl font-bold mb-6">Content Moderation</h2>
              {flags.length === 0 ? (
                <div className="text-center py-12 text-[#A0A0A5]">
                  <CheckCircle className="w-16 h-16 mx-auto mb-4 text-[#10B981]" />
                  <p>No pending flags. All clear!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {flags.map((flag) => (
                    <div
                      key={flag.id}
                      className="p-6 bg-[#0A0A0A] rounded-xl border border-[#F43F5E]/20"
                      data-testid="flag-item"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <p className="font-semibold text-[#F43F5E] mb-1">Flagged Content</p>
                          <p className="text-sm text-[#A0A0A5]">Video ID: {flag.video_id}</p>
                          <p className="text-sm text-[#A0A0A5]">Reason: {flag.reason}</p>
                        </div>
                        <p className="text-xs text-[#A0A0A5]">
                          {new Date(flag.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleResolveFlag(flag.id, 'remove')}
                          className="px-4 py-2 rounded-full bg-[#F43F5E] text-white font-semibold hover:bg-[#E11D48] transition-colors"
                          data-testid={`remove-flag-${flag.id}`}
                        >
                          Remove Video
                        </button>
                        <button
                          onClick={() => handleResolveFlag(flag.id, 'dismiss')}
                          className="px-4 py-2 rounded-full bg-white/10 text-white font-semibold hover:bg-white/20 transition-colors"
                        >
                          Dismiss Flag
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* User Growth Chart */}
              <div className="neumorphism-dark rounded-2xl p-8">
                <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                  <TrendingUp className="w-6 h-6 text-[#10B981]" />
                  User Growth (Last 30 Days)
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={timeseriesData}>
                    <defs>
                      <linearGradient id="userGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="date" stroke="#A0A0A5" tick={{ fontSize: 12 }} />
                    <YAxis stroke="#A0A0A5" tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        background: '#141414',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        color: '#fff'
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="total_users"
                      stroke="#10B981"
                      strokeWidth={3}
                      fill="url(#userGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Revenue & Videos Chart */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="neumorphism-dark rounded-2xl p-8">
                  <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                    <DollarSign className="w-6 h-6 text-[#10B981]" />
                    Revenue Trends
                  </h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={timeseriesData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="date" stroke="#A0A0A5" tick={{ fontSize: 10 }} />
                      <YAxis stroke="#A0A0A5" tick={{ fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{
                          background: '#141414',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '8px',
                          color: '#fff'
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        stroke="#10B981"
                        strokeWidth={3}
                        dot={{ fill: '#10B981', r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="neumorphism-dark rounded-2xl p-8">
                  <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                    <Video className="w-6 h-6 text-[#10B981]" />
                    Video Uploads
                  </h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={timeseriesData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="date" stroke="#A0A0A5" tick={{ fontSize: 10 }} />
                      <YAxis stroke="#A0A0A5" tick={{ fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{
                          background: '#141414',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '8px',
                          color: '#fff'
                        }}
                      />
                      <Bar dataKey="videos_uploaded" fill="#10B981" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Engagement Metrics */}
              {engagementData && (
                <div className="neumorphism-dark rounded-2xl p-8">
                  <h3 className="text-xl font-semibold mb-6">Engagement Metrics</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="text-center">
                      <p className="text-3xl font-black text-[#10B981]">
                        {engagementData.average_views_per_video.toFixed(0)}
                      </p>
                      <p className="text-sm text-[#A0A0A5] mt-1">Avg Views/Video</p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-black text-[#10B981]">
                        {engagementData.comments_per_video.toFixed(1)}
                      </p>
                      <p className="text-sm text-[#A0A0A5] mt-1">Comments/Video</p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-black text-[#10B981]">
                        {engagementData.total_comments.toLocaleString()}
                      </p>
                      <p className="text-sm text-[#A0A0A5] mt-1">Total Comments</p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-black text-[#10B981]">
                        {engagementData.total_platform_views.toLocaleString()}
                      </p>
                      <p className="text-sm text-[#A0A0A5] mt-1">Platform Views</p>
                    </div>
                  </div>

                  {/* Top Creators */}
                  <div className="mt-8">
                    <h4 className="font-semibold mb-4">Top Creators</h4>
                    <div className="space-y-3">
                      {engagementData.top_creators.map((creator, index) => (
                        <div
                          key={creator.username}
                          className="flex items-center justify-between p-3 bg-[#0A0A0A] rounded-xl"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-2xl font-black text-[#10B981]">#{index + 1}</span>
                            <div>
                              <p className="font-semibold">{creator.username}</p>
                              <p className="text-xs text-[#A0A0A5]">
                                {creator.video_count} videos
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{creator.total_views.toLocaleString()}</p>
                            <p className="text-xs text-[#A0A0A5]">views</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>

      <Navigation user={user} onLogout={onLogout} />
    </div>
  );
};

export default AdminDashboard;