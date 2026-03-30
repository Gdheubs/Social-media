import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const FundraiserSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (sessionId) {
      pollPaymentStatus(sessionId);
    } else {
      navigate('/fundraisers');
    }
  }, [searchParams, navigate]);

  const pollPaymentStatus = async (sessionId, attempt = 0) => {
    if (attempt >= 5) {
      setStatus('timeout');
      return;
    }

    try {
      const response = await axios.get(`${API}/fundraisers/status/${sessionId}`);
      
      if (response.data.payment_status === 'paid') {
        setStatus('success');
        toast.success('Contribution successful!');
      } else if (response.data.status === 'expired') {
        setStatus('failed');
      } else {
        setTimeout(() => pollPaymentStatus(sessionId, attempt + 1), 2000);
      }
    } catch (error) {
      console.error('Status check error:', error);
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A]" data-testid="fundraiser-success-page">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-morphism rounded-3xl p-12 text-center max-w-md"
      >
        {status === 'checking' && (
          <>
            <div className="animate-spin w-16 h-16 border-4 border-[#10B981] border-t-transparent rounded-full mx-auto mb-6" />
            <h2 className="text-2xl font-bold mb-2">Verifying Contribution</h2>
            <p className="text-[#A0A0A5]">Please wait...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 className="w-16 h-16 text-[#10B981] mx-auto mb-6" />
            <h2 className="text-2xl font-bold mb-2">Thank You!</h2>
            <p className="text-[#A0A0A5] mb-8">Your contribution has been received successfully.</p>
            <button
              onClick={() => navigate('/fundraisers')}
              className="btn-primary w-full"
              data-testid="back-to-fundraisers-btn"
            >
              View Fundraisers
            </button>
          </>
        )}

        {(status === 'failed' || status === 'timeout' || status === 'error') && (
          <>
            <div className="w-16 h-16 rounded-full bg-[#F43F5E] flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">!</span>
            </div>
            <h2 className="text-2xl font-bold mb-2">Payment Issue</h2>
            <p className="text-[#A0A0A5] mb-8">There was an issue with your contribution.</p>
            <button
              onClick={() => navigate('/fundraisers')}
              className="btn-primary w-full"
            >
              Back to Fundraisers
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default FundraiserSuccess;