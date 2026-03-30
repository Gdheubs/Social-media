import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Play, TrendingUp, DollarSign, Users } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Landing = ({ onAuth }) => {
  const [showAuth, setShowAuth] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
    account_type: 'personal'
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/register';
      const payload = isLogin 
        ? { email: formData.email, password: formData.password }
        : formData;

      const response = await axios.post(`${API}${endpoint}`, payload);
      toast.success(isLogin ? 'Welcome back!' : 'Account created successfully!');
      onAuth(response.data.token, response.data.user);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full relative overflow-hidden" style={{
      backgroundImage: `url('https://static.prod-images.emergentagent.com/jobs/e079eadd-5e20-4760-89c0-3b489820621d/images/c23fd5c33d2cd6ad99a772a889e60b46f775f4075c24f07bcf054271c7a58af2.png')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    }}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4">
        {!showAuth ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center max-w-4xl mx-auto"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="mb-8"
            >
              <Play className="w-20 h-20 mx-auto text-[#10B981] mb-6" />
            </motion.div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-6 tracking-tight leading-none">
              Create. Share. <span className="text-gradient">Earn.</span>
            </h1>
            
            <p className="text-lg sm:text-xl text-[#A0A0A5] mb-12 max-w-2xl mx-auto leading-relaxed">
              Join the next-gen hybrid social ecosystem where creators meet community. 
              Share your story, build your audience, and monetize your content.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
              <button
                data-testid="get-started-btn"
                onClick={() => setShowAuth(true)}
                className="btn-primary px-8 py-4 text-lg"
              >
                Get Started
              </button>
              <button
                onClick={() => { setShowAuth(true); setIsLogin(true); }}
                className="btn-secondary px-8 py-4 text-lg"
              >
                Sign In
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="glass-morphism rounded-2xl p-6"
              >
                <TrendingUp className="w-10 h-10 text-[#10B981] mb-4" />
                <h3 className="text-xl font-semibold mb-2">Grow Your Audience</h3>
                <p className="text-[#A0A0A5] text-sm">Reach millions with our hybrid feed algorithm</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="glass-morphism rounded-2xl p-6"
              >
                <DollarSign className="w-10 h-10 text-[#10B981] mb-4" />
                <h3 className="text-xl font-semibold mb-2">Monetize Content</h3>
                <p className="text-[#A0A0A5] text-sm">$0.50 per 1K views + tips & fundraising</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="glass-morphism rounded-2xl p-6"
              >
                <Users className="w-10 h-10 text-[#10B981] mb-4" />
                <h3 className="text-xl font-semibold mb-2">Community First</h3>
                <p className="text-[#A0A0A5] text-sm">Connect deeply with your true fans</p>
              </motion.div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-morphism rounded-3xl p-8 max-w-md w-full"
          >
            <h2 className="text-3xl font-bold mb-6 text-center">
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4" data-testid="auth-form">
              {!isLogin && (
                <div>
                  <label className="block text-sm font-medium mb-2">Username</label>
                  <input
                    data-testid="username-input"
                    type="text"
                    className="input-field w-full"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <input
                  data-testid="email-input"
                  type="email"
                  className="input-field w-full"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Password</label>
                <input
                  data-testid="password-input"
                  type="password"
                  className="input-field w-full"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
              </div>

              {!isLogin && (
                <div>
                  <label className="block text-sm font-medium mb-2">Account Type</label>
                  <select
                    data-testid="account-type-select"
                    className="input-field w-full"
                    value={formData.account_type}
                    onChange={(e) => setFormData({ ...formData, account_type: e.target.value })}
                  >
                    <option value="personal">Personal</option>
                    <option value="professional">Professional (Creator)</option>
                    <option value="business">Business</option>
                  </select>
                </div>
              )}

              <button
                data-testid="auth-submit-btn"
                type="submit"
                className="btn-primary w-full"
                disabled={loading}
              >
                {loading ? 'Loading...' : (isLogin ? 'Sign In' : 'Create Account')}
              </button>
            </form>

            <p className="text-center mt-6 text-sm text-[#A0A0A5]">
              {isLogin ? "Don't have an account?" : "Already have an account?"}
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-[#10B981] ml-2 hover:underline"
              >
                {isLogin ? 'Sign Up' : 'Sign In'}
              </button>
            </p>

            <button
              onClick={() => setShowAuth(false)}
              className="text-[#A0A0A5] text-sm mt-4 hover:text-white transition-colors w-full text-center"
            >
              ← Back to home
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Landing;