import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Heart, MessageCircle, Share2, Gift, Play, Pause, Volume2, VolumeX } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import Navigation from '@/components/Navigation';
import TipModal from '@/components/TipModal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const VideoCard = ({ video, onTip }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef(null);
  const observerRef = useRef(null);

  useEffect(() => {
    const handleView = async () => {
      try {
        const token = localStorage.getItem('token');
        await axios.post(
          `${API}/videos/${video.id}/view`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } catch (error) {
        console.error('View tracking error:', error);
      }
    };

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            videoRef.current?.play();
            setIsPlaying(true);
            handleView();
          } else {
            videoRef.current?.pause();
            setIsPlaying(false);
          }
        });
      },
      { threshold: 0.7 }
    );

    if (videoRef.current) {
      observerRef.current.observe(videoRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [video.id]);

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  return (
    <div 
      className="snap-item relative w-full h-screen flex items-center justify-center bg-black"
      data-testid="video-card"
    >
      <div className="relative w-full max-w-[500px] h-full">
        <video
          ref={videoRef}
          src={video.cloudinary_url}
          className="w-full h-full object-cover"
          loop
          muted={isMuted}
          playsInline
          data-testid="video-player"
        />

        <div className="absolute bottom-0 left-0 right-0 video-gradient-mask p-6">
          <div className="flex items-center gap-3 mb-3">
            <img
              src={video.user_avatar || 'https://images.unsplash.com/photo-1758486190195-dd677b21e00f?w=100&h=100&fit=crop'}
              alt={video.username}
              className="w-12 h-12 rounded-full border-2 border-[#10B981]"
            />
            <div>
              <p className="font-semibold text-white">{video.username}</p>
              <p className="text-xs text-[#A0A0A5]">{video.view_count.toLocaleString()} views</p>
            </div>
          </div>
          
          <h3 className="text-lg font-semibold mb-2">{video.title}</h3>
          {video.description && (
            <p className="text-sm text-[#A0A0A5] line-clamp-2">{video.description}</p>
          )}
        </div>

        <div className="absolute right-4 bottom-32 flex flex-col gap-6">
          <button
            className="p-3 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white hover:bg-black/60 transition-colors"
            data-testid="like-btn"
          >
            <Heart className="w-6 h-6" />
          </button>
          
          <button
            className="p-3 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white hover:bg-black/60 transition-colors"
            data-testid="comment-btn"
          >
            <MessageCircle className="w-6 h-6" />
          </button>
          
          <button
            className="p-3 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white hover:bg-black/60 transition-colors"
            data-testid="share-btn"
          >
            <Share2 className="w-6 h-6" />
          </button>
          
          <button
            onClick={() => onTip(video)}
            className="p-3 rounded-full bg-[#10B981] text-black hover:bg-[#059669] transition-colors"
            data-testid="tip-btn"
          >
            <Gift className="w-6 h-6" />
          </button>
        </div>

        <div className="absolute top-4 right-4 flex gap-2">
          <button
            onClick={togglePlayPause}
            className="p-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white"
            data-testid="play-pause-btn"
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>
          
          <button
            onClick={toggleMute}
            className="p-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white"
            data-testid="mute-btn"
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
};

const Feed = ({ user, onLogout }) => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [showTipModal, setShowTipModal] = useState(false);

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    try {
      const response = await axios.get(`${API}/videos/feed`);
      setVideos(response.data);
    } catch (error) {
      toast.error('Failed to load videos');
    } finally {
      setLoading(false);
    }
  };

  const handleTip = (video) => {
    setSelectedVideo(video);
    setShowTipModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading feed...</div>
      </div>
    );
  }

  return (
    <div className="relative h-screen overflow-hidden" data-testid="feed-page">
      <div className="snap-container h-screen overflow-y-scroll">
        {videos.map((video) => (
          <VideoCard key={video.id} video={video} onTip={handleTip} />
        ))}
      </div>

      <Navigation user={user} onLogout={onLogout} />
      
      {showTipModal && selectedVideo && (
        <TipModal
          video={selectedVideo}
          onClose={() => setShowTipModal(false)}
        />
      )}
    </div>
  );
};

export default Feed;