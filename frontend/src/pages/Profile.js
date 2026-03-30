import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useParams } from 'react-router-dom';
import { MapPin, Calendar, Check, Video } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import Navigation from '@/components/Navigation';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Profile = ({ currentUser, onLogout }) => {
  const { username } = useParams();
  const [profile, setProfile] = useState(null);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
    fetchUserVideos();
  }, [username]);

  const fetchProfile = async () => {
    try {
      const response = await axios.get(`${API}/users/${username}`);
      setProfile(response.data);
    } catch (error) {
      toast.error('User not found');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserVideos = async () => {
    try {
      const response = await axios.get(`${API}/videos/user/${username}`);
      setVideos(response.data);
    } catch (error) {
      console.error('Failed to load videos');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading profile...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">User not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] pb-24" data-testid="profile-page">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-morphism rounded-3xl p-8 mb-8"
        >
          <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
            <img
              src={profile.avatar || 'https://images.unsplash.com/photo-1758486190195-dd677b21e00f?w=200&h=200&fit=crop'}
              alt={profile.username}
              className="w-32 h-32 rounded-full border-4 border-[#10B981] object-cover"
            />
            
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <h1 className="text-3xl font-bold">{profile.username}</h1>
                {profile.verification_status && (
                  <div className="p-2 rounded-full bg-[#10B981]" data-testid="verified-badge">
                    <Check className="w-4 h-4 text-black" />
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-2 text-sm text-[#A0A0A5] mb-3">
                <span className="px-3 py-1 rounded-full bg-white/10 capitalize">
                  {profile.account_type}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  Joined {new Date(profile.created_at).toLocaleDateString()}
                </span>
              </div>
              
              {profile.bio && (
                <p className="text-[#A0A0A5] mb-4">{profile.bio}</p>
              )}
              
              <div className="flex gap-6">
                <div>
                  <p className="text-2xl font-bold">{profile.video_count || 0}</p>
                  <p className="text-xs text-[#A0A0A5]">Videos</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{(profile.total_views || 0).toLocaleString()}</p>
                  <p className="text-xs text-[#A0A0A5]">Total Views</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <div>
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Video className="w-6 h-6 text-[#10B981]" />
            Videos
          </h2>
          
          {videos.length === 0 ? (
            <div className="text-center py-12 text-[#A0A0A5]">
              No videos yet
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {videos.map((video) => (
                <motion.div
                  key={video.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.05 }}
                  className="relative aspect-[9/16] rounded-xl overflow-hidden cursor-pointer group"
                  data-testid="profile-video-item"
                >
                  <video
                    src={video.cloudinary_url}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <p className="font-semibold text-sm mb-1">{video.title}</p>
                      <p className="text-xs text-[#A0A0A5]">{video.view_count.toLocaleString()} views</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {currentUser && <Navigation user={currentUser} onLogout={onLogout} />}
    </div>
  );
};

export default Profile;