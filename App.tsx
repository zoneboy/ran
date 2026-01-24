
import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Register from './pages/Register';
import Login from './pages/Login';
import UserDashboard from './pages/UserDashboard';
import AdminDashboard from './pages/AdminDashboard';
import MemberDirectory from './pages/MemberDirectory';
import Messages from './pages/Messages';
import { User } from './types';
import { api } from './services/api';

function App() {
  const [currentPage, setCurrentPage] = useState('home');
  const [pageParams, setPageParams] = useState<any>(null); // State to hold parameters passed during navigation
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize Session
  useEffect(() => {
    const initSession = async () => {
      try {
        const storedUser = await api.getCurrentUser(); // Gets from Memory
        
        if (storedUser) {
           // Validate against backend to ensure ID exists in Live DB
           try {
             const validUser = await api.getUser(storedUser.id);
             if (validUser) {
               setUser(validUser);
             } else {
               // User exists in memory but not in DB
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

    // Check for Magic Link params in URL
    const params = new URLSearchParams(window.location.search);
    const page = params.get('page');
    if (page === 'reset-password') {
        const token = params.get('token');
        const email = params.get('email');
        if (token && email) {
            setPageParams({ token, email });
            setCurrentPage('login');
            // Clean URL to avoid leaking token or re-triggering logic
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }
  }, []);

  const navigate = (page: string, params?: any) => {
    setPageParams(params);
    setCurrentPage(page);
    window.scrollTo(0, 0);
  };

  const handleLogin = (userData: User) => {
    setUser(userData);
    if (userData.role === 'ADMIN') {
      navigate('admin-dashboard');
    } else {
      navigate('dashboard');
    }
  };

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    navigate('home');
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

  // Expiry Check Helper
  const isExpired = () => {
      if (!user) return false;
      if (user.status === 'Expired') return true;
      if (user.role === 'ADMIN') return false;
      const today = new Date();
      const expiryDate = new Date(user.expiryDate);
      const diffTime = expiryDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 0;
  };

  const renderPage = () => {
    const expired = isExpired();

    switch (currentPage) {
      case 'home':
        return <Home navigate={navigate} user={user} />;
      case 'register':
        return <Register navigate={navigate} />;
      case 'login':
        return <Login onLogin={handleLogin} navigate={navigate} initialParams={pageParams} />;
      case 'dashboard':
        return user ? <UserDashboard user={user} navigate={navigate} onUpdateUser={handleUpdateUser} /> : <Login onLogin={handleLogin} navigate={navigate} initialParams={pageParams} />;
      case 'admin-dashboard':
        return user && user.role === 'ADMIN' ? <AdminDashboard /> : <Home navigate={navigate} user={user} />;
      case 'member-directory':
        // Restrict directory if expired
        if (user && expired) return <UserDashboard user={user} navigate={navigate} onUpdateUser={handleUpdateUser} />;
        return user ? <MemberDirectory navigate={navigate} currentUser={user} /> : <Login onLogin={handleLogin} navigate={navigate} initialParams={pageParams} />;
      case 'messages':
        // Restrict messages if expired
        if (user && expired) return <UserDashboard user={user} navigate={navigate} onUpdateUser={handleUpdateUser} />;
        return user ? <Messages currentUser={user} navigate={navigate} targetUserId={pageParams?.targetUserId} /> : <Login onLogin={handleLogin} navigate={navigate} initialParams={pageParams} />;
      default:
        return <Home navigate={navigate} user={user} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      <Navbar user={user} onLogout={handleLogout} navigate={navigate} currentPage={currentPage} />
      <main>
        {renderPage()}
      </main>
      
      {/* Footer */}
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
                <li><button onClick={() => navigate('home')} className="hover:text-white">Home</button></li>
                {!user && <li><button onClick={() => navigate('register')} className="hover:text-white">Join Us</button></li>}
                <li><button className="hover:text-white">Contact Support</button></li>
                <li><button className="hover:text-white">Privacy Policy</button></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Contact</h4>
              <ul className="space-y-2 text-sm">
                <li>Lagos, Nigeria</li>
                <li>info@ran.org.ng</li>
                <li>+234 800 123 4567</li>
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
}

export default App;
