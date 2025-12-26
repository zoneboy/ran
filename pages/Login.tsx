import React, { useState } from 'react';
import { User } from '../types';
import { api } from '../services/api';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
  navigate: (page: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin, navigate }) => {
  const [view, setView] = useState<'login' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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

  // Reset Password Handler
  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      await api.resetPassword(email);
      setSuccessMsg(`If an account exists for ${email}, a reset link has been sent.`);
    } catch (err) {
      setError('Failed to process reset request.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearData = () => {
    if (window.confirm('Are you sure? This will wipe all registered users and reset the database to its default state.')) {
        localStorage.clear();
        window.location.reload();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-lg">
        
        {view === 'login' ? (
          <>
            <div>
              <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Sign in to your account</h2>
              <p className="mt-2 text-center text-sm text-gray-600">
                Or <button onClick={() => navigate('register')} className="font-medium text-green-600 hover:text-green-500">register for a new membership</button>
              </p>
            </div>
            <form className="mt-8 space-y-6" onSubmit={handleLoginSubmit}>
              <div className="rounded-md shadow-sm -space-y-px">
                <div>
                  <label htmlFor="email-address" className="sr-only">Registered Email Address</label>
                  <input
                    id="email-address"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-green-500 focus:border-green-500 focus:z-10 sm:text-sm"
                    placeholder="Enter your registered email"
                  />
                </div>
                <div>
                  <label htmlFor="password" className="sr-only">Password</label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-green-500 focus:border-green-500 focus:z-10 sm:text-sm"
                    placeholder="Password"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end">
                <button 
                  type="button" 
                  onClick={() => setView('reset')}
                  className="text-sm font-medium text-green-600 hover:text-green-500"
                >
                  Forgot your password?
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
                      <div className="mt-2 text-sm text-red-700">
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
                  className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${isLoading ? 'bg-green-400' : 'bg-green-700 hover:bg-green-800'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors`}
                >
                  {isLoading ? 'Signing in...' : 'Sign in'}
                </button>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-md text-xs text-blue-700">
                 <p className="font-bold">Demo Credentials:</p>
                 <p>Admin: admin@ran.org.ng / password123</p>
                 <p>Member: chinedu@ecolife.com / password123</p>
              </div>

              <div className="text-center pt-4 border-t border-gray-100">
                 <button 
                   type="button"
                   onClick={handleClearData}
                   className="text-xs text-gray-400 hover:text-red-500 flex items-center justify-center w-full transition-colors"
                 >
                   <RefreshCw className="h-3 w-3 mr-1" /> Reset System Data (Clear Cache)
                 </button>
              </div>
            </form>
          </>
        ) : (
          <>
             <div>
              <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Reset Password</h2>
              <p className="mt-2 text-center text-sm text-gray-600">
                Enter your email address and we'll send you a link to reset your password.
              </p>
            </div>
            <form className="mt-8 space-y-6" onSubmit={handleResetSubmit}>
              <div>
                <label htmlFor="reset-email" className="sr-only">Email address</label>
                <input
                  id="reset-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                  placeholder="Enter your registered email"
                />
              </div>

              {successMsg && <div className="text-green-600 text-sm text-center font-medium bg-green-50 p-2 rounded">{successMsg}</div>}
              {error && <div className="text-red-500 text-sm text-center">{error}</div>}

              <div className="flex flex-col space-y-3">
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${isLoading ? 'bg-green-400' : 'bg-green-700 hover:bg-green-800'}`}
                >
                  {isLoading ? 'Sending...' : 'Send Reset Link'}
                </button>
                <button
                  type="button"
                  onClick={() => setView('login')}
                  className="w-full flex justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  Back to Login
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default Login;