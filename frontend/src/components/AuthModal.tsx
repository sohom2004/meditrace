import React, { useState } from 'react';
import { ShieldCheck, Phone, User, KeyRound, Sparkles, ArrowRight, Stethoscope, Heart, Lock, AlertCircle } from 'lucide-react';
import { api, setAuthToken } from '../api';

interface AuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onSuccess: (user: any) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [phone, setPhone] = useState('+919876543210');
  const [fullName, setFullName] = useState('');
  const [otp, setOtp] = useState('123456');
  const [otpSent, setOtpSent] = useState(false);
  const [role, setRole] = useState<'patient' | 'practitioner'>('patient');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRequestOtp = async () => {
    if (!phone || phone.length < 10) {
      setError('Please enter a valid phone number (e.g., +919876543210)');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await api.requestOTP(phone);
      setOtpSent(true);
      setOtp('123456');
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.verifyOTP(phone, otp);
      setAuthToken(res.access_token);
      onSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!fullName.trim()) {
      setError('Please enter your full name');
      return;
    }
    if (!phone || phone.length < 10) {
      setError('Please enter a valid phone number');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await api.register(phone, fullName.trim(), role);
      setAuthToken(res.access_token);
      onSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (targetPhone: string) => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.verifyOTP(targetPhone, '123456');
      setAuthToken(res.access_token);
      onSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Quick login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="glass-modal w-full max-w-md rounded-3xl p-6 sm:p-8 relative border border-slate-700/60 shadow-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-500 to-teal-400 text-white shadow-lg shadow-sky-500/25 mb-3">
            <Heart className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            {mode === 'login' ? 'Welcome to MediTrace' : 'Create New Account'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {mode === 'login'
              ? 'Longitudinal Clinical Memory • Up to 3 Member Profiles'
              : 'Join with a single family plan supporting 3 isolated member profiles'}
          </p>
        </div>

        {/* Mode Selector */}
        <div className="flex p-1 mb-6 rounded-2xl bg-slate-900/80 border border-slate-800">
          <button
            onClick={() => { setMode('login'); setError(null); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${
              mode === 'login' ? 'bg-sky-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setMode('register'); setError(null); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${
              mode === 'register' ? 'bg-sky-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Create Account
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Mode */}
        {mode === 'login' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Mobile Number</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+919876543210"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
                />
              </div>
            </div>

            {otpSent && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex justify-between">
                  <span>Enter OTP</span>
                  <span className="text-[11px] text-sky-400 font-mono">Hint: 123456</span>
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="123456"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors tracking-widest"
                  />
                </div>
              </div>
            )}

            {!otpSent ? (
              <button
                onClick={handleRequestOtp}
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-teal-500 hover:from-sky-400 hover:to-teal-400 text-white font-semibold text-sm shadow-lg shadow-sky-500/25 transition-all flex items-center justify-center gap-2"
              >
                {loading ? 'Sending OTP...' : 'Send OTP'}
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleVerifyOtp}
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-teal-500 hover:from-sky-400 hover:to-teal-400 text-white font-semibold text-sm shadow-lg shadow-sky-500/25 transition-all flex items-center justify-center gap-2"
              >
                {loading ? 'Verifying...' : 'Verify & Continue'}
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {/* Quick Demo Logins */}
            <div className="pt-4 border-t border-slate-800">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5 text-center">
                Instant Demo Access
              </p>
              <div className="space-y-2">
                <button
                  onClick={() => handleQuickLogin('+919876543210')}
                  disabled={loading}
                  className="w-full p-2.5 rounded-xl bg-slate-900/70 hover:bg-slate-800/80 border border-slate-800 hover:border-sky-500/40 text-left transition-all flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-xs">
                      AS
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white">Aarav Sharma</div>
                      <div className="text-[11px] text-slate-400">Patient Manager • 3 Family Profiles</div>
                    </div>
                  </div>
                  <span className="text-[11px] text-sky-400 font-semibold px-2 py-0.5 rounded bg-sky-950/60 border border-sky-800/40">
                    Sign In
                  </span>
                </button>

                <button
                  onClick={() => handleQuickLogin('+919876543211')}
                  disabled={loading}
                  className="w-full p-2.5 rounded-xl bg-slate-900/70 hover:bg-slate-800/80 border border-slate-800 hover:border-teal-500/40 text-left transition-all flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold text-xs">
                      AM
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white">Dr. Ananya Mukherjee</div>
                      <div className="text-[11px] text-slate-400">Cardiologist • WBMC/2014/19823</div>
                    </div>
                  </div>
                  <span className="text-[11px] text-teal-400 font-semibold px-2 py-0.5 rounded bg-teal-950/60 border border-teal-800/40">
                    Sign In
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Register Mode */}
        {mode === 'register' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Vikram Malhotra"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Mobile Number</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+919988776655"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Account Type</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRole('patient')}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    role === 'patient'
                      ? 'bg-sky-600/30 border-sky-500 text-sky-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  Family Patient
                </button>
                <button
                  type="button"
                  onClick={() => setRole('practitioner')}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    role === 'practitioner'
                      ? 'bg-teal-600/30 border-teal-500 text-teal-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <Stethoscope className="w-3.5 h-3.5" />
                  Practitioner
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">
                {role === 'patient'
                  ? 'Includes family plan provisioning with up to 3 isolated member profiles.'
                  : 'Includes Medical Council registration and doctor workspace access.'}
              </p>
            </div>

            <button
              onClick={handleRegister}
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-teal-500 hover:from-sky-400 hover:to-teal-400 text-white font-semibold text-sm shadow-lg shadow-sky-500/25 transition-all flex items-center justify-center gap-2 mt-2"
            >
              {loading ? 'Creating...' : 'Create Account & Continue'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
