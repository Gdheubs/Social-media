import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Upload as UploadIcon, Video, Image as ImageIcon } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import Navigation from '@/components/Navigation';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Upload = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    aspectRatio: '9:16'
  });
  const [videoFile, setVideoFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type.startsWith('video/')) {
        setVideoFile(file);
        setPreviewUrl(URL.createObjectURL(file));
      } else {
        toast.error('Please select a valid video file');
      }
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    
    if (!videoFile) {
      toast.error('Please select a video file');
      return;
    }

    setUploading(true);

    try {
      const token = localStorage.getItem('token');
      
      // Step 1: Get Cloudinary signature
      const signatureResponse = await axios.get(
        `${API}/cloudinary/signature`,
        {
          params: { resource_type: 'video', folder: 'uploads' },
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      const { signature, timestamp, cloud_name, api_key, folder } = signatureResponse.data;

      // Step 2: Upload to Cloudinary
      const cloudinaryFormData = new FormData();
      cloudinaryFormData.append('file', videoFile);
      cloudinaryFormData.append('api_key', api_key);
      cloudinaryFormData.append('timestamp', timestamp);
      cloudinaryFormData.append('signature', signature);
      cloudinaryFormData.append('folder', folder);

      const cloudinaryResponse = await axios.post(
        `https://api.cloudinary.com/v1_1/${cloud_name}/video/upload`,
        cloudinaryFormData
      );

      // Step 3: Save video metadata to backend
      const videoData = {
        cloudinary_public_id: cloudinaryResponse.data.public_id,
        cloudinary_url: cloudinaryResponse.data.secure_url,
        aspect_ratio: formData.aspectRatio,
        title: formData.title,
        description: formData.description
      };

      await axios.post(
        `${API}/videos/upload`,
        videoData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Video uploaded successfully!');
      navigate('/feed');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] pb-24" data-testid="upload-page">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-morphism rounded-3xl p-8"
        >
          <div className="flex items-center gap-3 mb-8">
            <UploadIcon className="w-8 h-8 text-[#10B981]" />
            <h1 className="text-3xl font-bold">Upload Video</h1>
          </div>

          <form onSubmit={handleUpload} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-3">Video File</label>
              <div className="relative">
                <input
                  data-testid="video-file-input"
                  type="file"
                  accept="video/*"
                  onChange={handleFileChange}
                  className="hidden"
                  id="video-upload"
                />
                <label
                  htmlFor="video-upload"
                  className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-white/10 rounded-xl hover:border-[#10B981] transition-colors cursor-pointer bg-[#141414]"
                >
                  {previewUrl ? (
                    <video
                      src={previewUrl}
                      className="w-full h-full object-contain rounded-xl"
                      controls
                    />
                  ) : (
                    <div className="text-center">
                      <Video className="w-16 h-16 mx-auto mb-4 text-[#10B981]" />
                      <p className="text-lg font-medium">Click to upload video</p>
                      <p className="text-sm text-[#A0A0A5] mt-2">MP4, MOV, AVI up to 100MB</p>
                    </div>
                  )}
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Aspect Ratio</label>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, aspectRatio: '9:16' })}
                  className={`flex-1 p-4 rounded-xl border-2 transition-colors ${
                    formData.aspectRatio === '9:16'
                      ? 'border-[#10B981] bg-[#10B981]/10'
                      : 'border-white/10 bg-[#141414]'
                  }`}
                  data-testid="aspect-9-16-btn"
                >
                  <div className="w-12 h-20 mx-auto bg-white/20 rounded mb-2" />
                  <p className="text-sm font-medium">Vertical (9:16)</p>
                  <p className="text-xs text-[#A0A0A5]">Reels style</p>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, aspectRatio: '16:9' })}
                  className={`flex-1 p-4 rounded-xl border-2 transition-colors ${
                    formData.aspectRatio === '16:9'
                      ? 'border-[#10B981] bg-[#10B981]/10'
                      : 'border-white/10 bg-[#141414]'
                  }`}
                  data-testid="aspect-16-9-btn"
                >
                  <div className="w-20 h-12 mx-auto bg-white/20 rounded mb-2" />
                  <p className="text-sm font-medium">Horizontal (16:9)</p>
                  <p className="text-xs text-[#A0A0A5]">Standard</p>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Title</label>
              <input
                data-testid="video-title-input"
                type="text"
                className="input-field w-full"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Give your video a catchy title"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Description (Optional)</label>
              <textarea
                data-testid="video-description-input"
                className="input-field w-full min-h-[100px]"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe your video..."
              />
            </div>

            <button
              data-testid="upload-submit-btn"
              type="submit"
              className="btn-primary w-full py-4 text-lg"
              disabled={uploading || !videoFile}
            >
              {uploading ? 'Uploading...' : 'Upload Video'}
            </button>
          </form>
        </motion.div>
      </div>

      <Navigation user={user} onLogout={onLogout} />
    </div>
  );
};

export default Upload;