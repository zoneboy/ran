import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import Navbar from './components/Navbar';
import Register from './pages/Register';
import Login from './pages/Login';
import UserDashboard from './pages/UserDashboard';
import AdminDashboard from './pages/AdminDashboard';
import MemberDirectory from './pages/MemberDirectory';
import Messages from './pages/Messages';
import Pricelist from './pages/Pricelist';
import Benefits from './pages/Benefits';
import Listings from './pages/Listings';
import { User } from './types';
import { api } from './services/api';

const pageToPath = (page: string, params?: any): string => {
  switch (page) {
    case 'login': return '/login';
    case 'register': return '/register';
    case 'benefits': return '/benefits';
    case 'dashboard': return '/dashboard';
    case 'admin-dashboard': return '/admin';
    case 'member-directory': return '/directory';
    case 'messages':
      if (params?.targetUserId) return `/messages?to=${encodeURIComponent(params.targetUserId)}`;
      return '/messages';
    case 'pricelist': return '/pricelist';
    case 'listings': return '/listings';
    default: return '/login';
  }
};

const pathToPage = (pathname: string): string => {
  if (pathname.startsWith('/login')) return 'login';
  if (pathname.startsWith('/register')) return 'register';
  if (pathname.startsWith('/benefits')) return 'benefits';
  if (pathname.startsWith('/dashboard')) return 'dashboard';
  if (pathname.startsWith('/admin')) return 'admin-dashboard';
  if (pathname.startsWith('/directory')) return 'member-directory';
  if (pathname.startsWith('/messages')) return 'messages';
  if (pathname.startsWith('/pricelist')) return 'pricelist';
  if (pathname.startsWith('/listings')) return 'listings';
  return 'login';
};

interface AppShellProps {
  user: User | null;
  setUser: (u: User | null) => void;
  handleLogin: (u: User) => void;
  handleLogout: () => Promise<void>;
  handleUpdateUser: (u: User) => Promise<void>;
}

const AppShell: React.FC<AppShellProps> = ({ user, setUser, handleLogin, handleLogout, handleUpdateUser }) => {
  const routerNavigate = useNavigate();
  const location = useLocation();

  const navigate = (page: string, params?: any) => {
    const path = pageToPath(page, params);
    routerNavigate(path);
    window.scrollTo(0, 0);
  };

  const currentPage = pathToPage(location.pathname);

  const isExpired = () => {
    if (!user) return false;
    if (user.status === 'Expired') return true;
    if (user.role === 'ADMIN') return false;
    if (!user.expiryDate) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(user.expiryDate);
    expiry.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - expiry.getTime();
    const daysPastExpiry = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return daysPastExpiry >= 1;
  };

  const expired = isExpired();

  const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    if (!user) return <Navigate to="/login" replace />;
    return <>{children}</>;
  };

  const RequireAdmin: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    if (!user) return <Navigate to="/login" replace />;
    if (user.role !== 'ADMIN') return <Navigate to="/dashboard" replace />;
    return <>{children}</>;
  };

  const BlockExpired: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    if (!user) return <Navigate to="/login" replace />;
    if (expired) return <UserDashboard user={user} navigate={navigate} onUpdateUser={handleUpdateUser} />;
    return <>{children}</>;
  };

  const MessagesRoute: React.FC = () => {
    const [searchParams] = useSearchParams();
    const targetUserId = searchParams.get('to');
    if (!user) return <Navigate to="/login" replace />;
    if (expired) return <UserDashboard user={user} navigate={navigate} onUpdateUser={handleUpdateUser} />;
    return <Messages currentUser={user} navigate={navigate} targetUserId={targetUserId} />;
  };

  const RootRedirect: React.FC = () => {
    if (!user) return <Navigate to="/login" replace />;
    return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/dashboard'} replace />;
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      <Navbar user={user} onLogout={handleLogout} navigate={navigate} currentPage={currentPage} />
      <main>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<Login onLogin={handleLogin} navigate={navigate} />} />
          <Route path="/register" element={<Register navigate={navigate} />} />
          <Route path="/benefits" element={<Benefits navigate={navigate} user={user} />} />
          <Route path="/dashboard" element={
            <RequireAuth>
              {user && <UserDashboard user={user} navigate={navigate} onUpdateUser={handleUpdateUser} />}
            </RequireAuth>
          } />
          <Route path="/admin" element={
            <RequireAdmin>
              <AdminDashboard />
            </RequireAdmin>
          } />
          <Route path="/directory" element={
            <BlockExpired>
              {user && <MemberDirectory navigate={navigate} currentUser={user} />}
            </BlockExpired>
          } />
          <Route path="/messages" element={<MessagesRoute />} />
          <Route path="/pricelist" element={
            <BlockExpired>
              <Pricelist navigate={navigate} />
            </BlockExpired>
          } />
          <Route path="/listings" element={
            <RequireAuth>
              {user && <Listings navigate={navigate} currentUser={user} />}
            </RequireAuth>
          } />
          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </main>

      <footer className="bg-gray-800 text-gray-300 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-2">
              <h3 className="text-white text-lg font-bold mb-4">Recyclers Association of Nigeria</h3>
              <p className="text-sm max-w-md">
                Connecting recyclers, advocating for policies, and building a sustainable future for waste management in Nigeria.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="https://recyclersassociation.org" className="hover:text-white transition-colors">Home</a>
                </li>
                <li>
                  <button onClick={() => navigate(user ? (user.role === 'ADMIN' ? 'admin-dashboard' : 'dashboard') : 'login')} className="hover:text-white transition-colors">
                    {user ? 'My Dashboard' : 'Portal Login'}
                  </button>
                </li>
                {!user && (
                  <li>
                    <button onClick={() => navigate('register')} className="hover:text-white transition-colors">Join Us</button>
                  </li>
                )}
                <li>
                  <a href="mailto:membership@recyclersassociation.org?subject=RAN%20Portal%20Support%20Request" className="hover:text-white transition-colors">Contact Support</a>
                </li>
                <li>
                  <button className="hover:text-white transition-colors">Privacy Policy</button>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Contact</h4>
              <ul className="space-y-2 text-sm">
                <li>Abuja, Nigeria</li>
                <li>membership@recyclersassociation.org</li>
                <li>+234 907 981 9777</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-700 mt-8 pt-8 text-center text-sm">
            &copy; {new Date().getFullYear()} Recyclers Association of Nigeria. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initSession = async () => {
      try {
        const storedUser = await api.getCurrentUser();

        if (storedUser) {
          try {
            const validUser = await api.getUser(storedUser.id);
            if (validUser) {
              setUser(validUser);
            } else {
              await api.logout();
              setUser(null);
            }
          } catch (e) {
            console.warn("Backend validation failed (offline?), using stored session.");
            setUser(storedUser);
          }
        }
      } catch (error) {
        console.error('Session restore failed', error);
      } finally {
        setIsLoading(false);
      }
    };

    initSession();
  }, []);

  const handleLogin = (userData: User) => {
    setUser(userData);
    const target = userData.role === 'ADMIN' ? '/admin' : '/dashboard';
    window.history.pushState({}, '', target);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    window.history.pushState({}, '', '/login');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const handleUpdateUser = async (updatedUser: User) => {
    try {
      const result = await api.updateUser(updatedUser);
      setUser(result);
    } catch (error) {
      console.error('Update failed', error);
      alert('Failed to update profile');
    }
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-green-700">Loading RAN Portal...</div>;
  }

  return (
    <BrowserRouter>
      <AppShell
        user={user}
        setUser={setUser}
        handleLogin={handleLogin}
        handleLogout={handleLogout}
        handleUpdateUser={handleUpdateUser}
      />
    </BrowserRouter>
  );
}

export default App;