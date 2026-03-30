import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const TipSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('checking');
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (sessionId) {
      pollPaymentStatus(sessionId);
    } else {
      navigate('/feed');
    }
  }, [searchParams, navigate]);

  const pollPaymentStatus = async (sessionId, currentAttempt = 0) => {
    if (currentAttempt >= 5) {
      setStatus('timeout');
      toast.error('Payment verification timed out. Please check your payment history.');
      return;
    }

    try {
      const response = await axios.get(`${API}/tips/status/${sessionId}`);
      
      if (response.data.payment_status === 'paid') {
        setStatus('success');
        toast.success('Tip sent successfully!');
      } else if (response.data.status === 'expired') {
        setStatus('failed');
        toast.error('Payment session expired');
      } else {
        setAttempts(currentAttempt + 1);
        setTimeout(() => pollPaymentStatus(sessionId, currentAttempt + 1), 2000);
      }
    } catch (error) {
      console.error('Status check error:', error);
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A]" data-testid="tip-success-page">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-morphism rounded-3xl p-12 text-center max-w-md"
      >
        {status === 'checking' && (
          <>
            <div className="animate-spin w-16 h-16 border-4 border-[#10B981] border-t-transparent rounded-full mx-auto mb-6" />
            <h2 className="text-2xl font-bold mb-2">Verifying Payment</h2>
            <p className="text-[#A0A0A5]">Please wait while we confirm your tip...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 className="w-16 h-16 text-[#10B981] mx-auto mb-6" />
            <h2 className="text-2xl font-bold mb-2">Tip Sent!</h2>
            <p className="text-[#A0A0A5] mb-8">Your tip has been sent to the creator successfully.</p>
            <button
              onClick={() => navigate('/feed')}
              className="btn-primary w-full"
              data-testid="back-to-feed-btn"
            >
              Back to Feed
            </button>
          </>
        )}

        {(status === 'failed' || status === 'timeout' || status === 'error') && (
          <>
            <div className="w-16 h-16 rounded-full bg-[#F43F5E] flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">!</span>
            </div>
            <h2 className="text-2xl font-bold mb-2">Payment Issue</h2>
            <p className="text-[#A0A0A5] mb-8">There was an issue with your payment. Please try again.</p>
            <button
              onClick={() => navigate('/feed')}
              className="btn-primary w-full"
            >
              Back to Feed
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default TipSuccess;