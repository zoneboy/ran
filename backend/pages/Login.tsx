import React, { useState } from 'react';
import { User } from '../types';
import { api } from '../services/api';
import { AlertCircle, KeyRound, ArrowLeft, Mail } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
  navigate: (page: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin, navigate }) => {
  const [view, setView] = useState<'login' | 'reset'>('login');
  
  // Login State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Reset Flow State
  const [resetStep, setResetStep] = useState<1 | 2>(1); // 1: Request Email, 2: Verify & Reset
  const [resetEmail, setResetEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // General State
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Helper: Password Validation
  const validatePassword = (pass: string) => {
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return regex.test(pass);
  };

  // Login Handler
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const user = await api.login(email, password);
      onLogin(user);
    } catch (err: any) {
      // Display the specific error message from the API (e.g. "Account pending")
      setError(err.message || 'Invalid email or password.');
    } finally {
      setIsLoading(false);
    }
  };

  // Reset Step 1: Request Code
  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      await api.resetPassword(resetEmail);
      setResetStep(2);
      setSuccessMsg(`A reset code has been sent to ${resetEmail}. Check your inbox (or alert).`);
    } catch (err) {
      setError('Failed to process reset request.');
    } finally {
      setIsLoading(false);
    }
  };

  // Reset Step 2: Confirm Reset
  const handleResetConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccessMsg('');

    if (newPassword !== confirmNewPassword) {
        setError("Passwords do not match.");
        setIsLoading(false);
        return;
    }

    if (!validatePassword(newPassword)) {
        setError("Password must be 8+ chars, include uppercase, lowercase, number, and special char.");
        setIsLoading(false);
        return;
    }

    try {
        await api.confirmPasswordReset(resetEmail, otpCode, newPassword);
        alert("Password reset successful! You can now login.");
        setView('login');
        setResetStep(1);
        setResetEmail('');
        setOtpCode('');
        setNewPassword('');
    } catch (err: any) {
        setError(err.message || "Failed to reset password. Check your code.");
    } finally {
        setIsLoading(false);
    }
  };

  const handleSwitchToReset = () => {
      setView('reset');
      setResetStep(1);
      setError('');
      setSuccessMsg('');
  };

  const handleBackToLogin = () => {
      setView('login');
      setError('');
      setSuccessMsg('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="max-w-md w-full bg-white p-10 rounded-xl shadow-lg border border-gray-100">
        
        {view === 'login' ? (
          <>
            <div>
              <div className="flex justify-center mb-4">
                 <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                    <KeyRound className="h-6 w-6 text-green-700" />
                 </div>
              </div>
              <h2 className="mt-2 text-center text-3xl font-extrabold text-gray-900">Welcome Back</h2>
              <p className="mt-2 text-center text-sm text-gray-600">
                Sign in to your RAN portal account
              </p>
            </div>
            
            <form className="mt-8 space-y-6" onSubmit={handleLoginSubmit}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="email-address" className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                  <input
                    id="email-address"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                    placeholder="name@example.com"
                  />
                </div>
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <button type="button" onClick={() => navigate('register')} className="font-medium text-sm text-green-600 hover:text-green-500">
                    Create account
                </button>
                <button 
                  type="button" 
                  onClick={handleSwitchToReset}
                  className="text-sm font-medium text-green-600 hover:text-green-500"
                >
                  Forgot password?
                </button>
              </div>

              {error && (
                <div className="rounded-md bg-red-50 p-4 border border-red-100">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <AlertCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">Login Failed</h3>
                      <div className="mt-1 text-sm text-red-700">
                        <p>{error}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${isLoading ? 'bg-green-400' : 'bg-green-700 hover:bg-green-800'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors shadow-sm`}
                >
                  {isLoading ? 'Signing in...' : 'Sign in'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
             {/* RESET PASSWORD FLOW */}
             <div>
              <button onClick={handleBackToLogin} className="flex items-center text-sm text-gray-500 hover:text-gray-700 mb-6">
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back to Login
              </button>
              <h2 className="text-center text-3xl font-extrabold text-gray-900">Reset Password</h2>
              <p className="mt-2 text-center text-sm text-gray-600">
                {resetStep === 1 ? "Enter your email to receive a reset code." : "Enter the code sent to your email."}
              </p>
            </div>

            {error && <div className="mt-4 rounded-md bg-red-50 p-3 border border-red-100 text-red-600 text-sm text-center">{error}</div>}
            {successMsg && <div className="mt-4 rounded-md bg-green-50 p-3 border border-green-100 text-green-700 text-sm text-center font-medium">{successMsg}</div>}

            {resetStep === 1 ? (
                <form className="mt-8 space-y-6" onSubmit={handleResetRequest}>
                    <div>
                        <label htmlFor="reset-email" className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
                        <div className="relative rounded-md shadow-sm">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Mail className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                id="reset-email"
                                type="email"
                                required
                                value={resetEmail}
                                onChange={(e) => setResetEmail(e.target.value)}
                                className="focus:ring-green-500 focus:border-green-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2 border"
                                placeholder="Enter your registered email"
                            />
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className={`w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${isLoading ? 'bg-green-400' : 'bg-green-700 hover:bg-green-800'}`}
                    >
                        {isLoading ? 'Sending...' : 'Send Reset Code'}
                    </button>
                </form>
            ) : (
                <form className="mt-8 space-y-6" onSubmit={handleResetConfirm}>
                    <div className="space-y-4">
                        <div className="bg-amber-50 p-3 rounded text-amber-800 text-xs text-center border border-amber-100 mb-4">
                            Check your email (or the browser alert) for the 6-digit code.
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Reset Code (OTP)</label>
                            <input
                                type="text"
                                required
                                value={otpCode}
                                onChange={(e) => setOtpCode(e.target.value)}
                                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm text-center tracking-widest font-mono text-lg"
                                placeholder="123456"
                                maxLength={6}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                            <input
                                type="password"
                                required
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm"
                                placeholder="New Password"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                            <input
                                type="password"
                                required
                                value={confirmNewPassword}
                                onChange={(e) => setConfirmNewPassword(e.target.value)}
                                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm"
                                placeholder="Confirm New Password"
                            />
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className={`w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${isLoading ? 'bg-green-400' : 'bg-green-700 hover:bg-green-800'}`}
                    >
                        {isLoading ? 'Resetting...' : 'Reset Password'}
                    </button>
                    <button
                        type="button"
                        onClick={() => setResetStep(1)}
                        className="w-full text-center text-sm text-gray-500 hover:text-gray-700"
                    >
                        Resend Code
                    </button>
                </form>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Login;