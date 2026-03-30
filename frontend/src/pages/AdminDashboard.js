import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, Users, Video, Flag, CheckCircle, XCircle, Eye } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import Navigation from '@/components/Navigation';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AdminDashboard = ({ user, onLogout }) => {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [flags, setFlags] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

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

      const [statsRes, usersRes, flagsRes] = await Promise.all([
        axios.get(`${API}/admin/stats`, { headers }),
        axios.get(`${API}/admin/users?limit=20`, { headers }),
        axios.get(`${API}/moderation/queue`, { headers })
      ]);

      setStats(statsRes.data);
      setUsers(usersRes.data);
      setFlags(flagsRes.data);
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="neumorphism-dark rounded-2xl p-8">
                <h3 className="text-xl font-semibold mb-4">Recent Activity</h3>
                <p className="text-[#A0A0A5]">Platform activity overview coming soon</p>
              </div>
              <div className="neumorphism-dark rounded-2xl p-8">
                <h3 className="text-xl font-semibold mb-4">System Health</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[#A0A0A5]">API Status</span>
                    <span className="px-3 py-1 rounded-full bg-[#10B981]/20 text-[#10B981] text-sm">Operational</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#A0A0A5]">Database</span>
                    <span className="px-3 py-1 rounded-full bg-[#10B981]/20 text-[#10B981] text-sm">Connected</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#A0A0A5]">Payments</span>
                    <span className="px-3 py-1 rounded-full bg-[#10B981]/20 text-[#10B981] text-sm">Active</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      <Navigation user={user} onLogout={onLogout} />
    </div>
  );
};

export default AdminDashboard;