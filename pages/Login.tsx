
import React, { useState } from 'react';
import { User } from '../types';
import { api } from '../services/api';
import { AlertCircle, KeyRound, ArrowLeft, Mail, CheckCircle, Loader2, Eye, EyeOff } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
  navigate: (page: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin, navigate }) => {
  const [view, setView] = useState<'login' | 'reset'>('login');
  const [resetStep, setResetStep] = useState(1); // 1: Request, 2: Confirm
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Login State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Reset State
  const [resetEmail, setResetEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await api.login(email, password);
      onLogin(user);
    } catch (error: any) {
      alert(error.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.resetPassword(resetEmail);
      setResetStep(2);
      alert('If an account exists, a code has been sent to your email.');
    } catch (error: any) {
      alert(error.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.confirmPasswordReset(resetEmail, resetToken, newPassword);
      alert('Password reset successful. Please login.');
      setView('login');
      setResetStep(1);
    } catch (error: any) {
      alert(error.message || 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          {view === 'login' ? 'Sign in to your account' : 'Reset Password'}
        </h2>
        {view === 'login' && (
           <p className="mt-2 text-center text-sm text-gray-600">
            Or{' '}
            <button onClick={() => navigate('register')} className="font-medium text-green-600 hover:text-green-500">
              become a member
            </button>
          </p>
        )}
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          
          {view === 'login' ? (
            <form className="space-y-6" onSubmit={handleLogin}>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email address
                </label>
                <div className="mt-1 relative">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                  />
                  <Mail className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <div className="mt-1 relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                  />
                   <button 
                      type="button" 
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                    Remember me
                  </label>
                </div>

                <div className="text-sm">
                  <button type="button" onClick={() => setView('reset')} className="font-medium text-green-600 hover:text-green-500">
                    Forgot your password?
                  </button>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="animate-spin h-5 w-5" /> : 'Sign in'}
                </button>
              </div>
            </form>
          ) : (
            <div>
               {resetStep === 1 ? (
                 <form className="space-y-6" onSubmit={handleRequestReset}>
                    <div className="bg-yellow-50 p-3 rounded-md flex items-start">
                        <AlertCircle className="h-5 w-5 text-yellow-500 mr-2 mt-0.5" />
                        <p className="text-sm text-yellow-700">Enter your email address and we'll send you a code to reset your password.</p>
                    </div>
                    <div>
                        <label htmlFor="reset-email" className="block text-sm font-medium text-gray-700">
                        Email address
                        </label>
                        <div className="mt-1">
                        <input
                            id="reset-email"
                            type="email"
                            required
                            value={resetEmail}
                            onChange={(e) => setResetEmail(e.target.value)}
                            className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                        />
                        </div>
                    </div>
                    <div>
                        <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                        >
                        {loading ? <Loader2 className="animate-spin h-5 w-5" /> : 'Send Reset Code'}
                        </button>
                    </div>
                 </form>
               ) : (
                 <form className="space-y-6" onSubmit={handleConfirmReset}>
                    <div className="bg-green-50 p-3 rounded-md flex items-start">
                        <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5" />
                        <p className="text-sm text-green-700">Code sent! Please check your inbox (and spam folder).</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Verification Code</label>
                        <input
                            type="text"
                            required
                            placeholder="123456"
                            value={resetToken}
                            onChange={(e) => setResetToken(e.target.value)}
                            className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">New Password</label>
                        <input
                            type="password"
                            required
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                        />
                    </div>
                    <div>
                        <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                        >
                        {loading ? <Loader2 className="animate-spin h-5 w-5" /> : 'Reset Password'}
                        </button>
                    </div>
                 </form>
               )}
               <div className="mt-6">
                 <button
                    type="button"
                    onClick={() => { setView('login'); setResetStep(1); }}
                    className="w-full flex justify-center items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back to Login
                  </button>
               </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Login;
