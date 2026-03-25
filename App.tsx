import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Register from './pages/Register';
import Login from './pages/Login';
import UserDashboard from './pages/UserDashboard';
import AdminDashboard from './pages/AdminDashboard';
import MemberDirectory from './pages/MemberDirectory';
import Messages from './pages/Messages';
import Pricelist from './pages/Pricelist';
import Benefits from './pages/Benefits';
import { User } from './types';
import { api } from './services/api';

function App() {
  const [currentPage, setCurrentPage] = useState('login');
  const [pageParams, setPageParams] = useState<any>(null); // State to hold parameters passed during navigation
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

// Initialize Session
  useEffect(() => {
    const initSession = async () => {
      let restoredUser = null;
      try {
        const storedUser = await api.getCurrentUser(); // Gets from Memory
        
        if (storedUser) {
           // Validate against backend to ensure ID exists in Live DB
           try {
             const validUser = await api.getUser(storedUser.id);
             if (validUser) {
               setUser(validUser);
               restoredUser = validUser;
             } else {
               // User exists in memory but not in DB
               await api.logout();
               setUser(null);
             }
           } catch (e) {
             console.warn("Backend validation failed (offline?), using stored session.");
             setUser(storedUser);
             restoredUser = storedUser;
           }
        }
      } catch (error) {
        console.error('Session restore failed', error);
      } finally {
        setIsLoading(false);
        
        // Handle routing AFTER the session is checked
        const params = new URLSearchParams(window.location.search);
        const page = params.get('page');
        
        if (page) {
            setCurrentPage(page);
        } else if (restoredUser) {
            // Auto-route to the correct dashboard if they are already logged in
            setCurrentPage(restoredUser.role === 'ADMIN' ? 'admin-dashboard' : 'dashboard');
        }
      }
    };
    
    initSession();
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
    navigate('login');
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

  // Expiry Check Helper - Robust 1-Day Expiration
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

 const renderPage = () => {
    const expired = isExpired();

    switch (currentPage) {
      case 'benefits':
        return <Benefits navigate={navigate} user={user} />;
      case 'register':
        return <Register navigate={navigate} />;
      case 'login':
        return <Login onLogin={handleLogin} navigate={navigate} />;
      case 'dashboard':
        return user ? <UserDashboard user={user} navigate={navigate} onUpdateUser={handleUpdateUser} /> : <Login onLogin={handleLogin} navigate={navigate} />;
      case 'admin-dashboard':
        return user && user.role === 'ADMIN' ? <AdminDashboard /> : <Login onLogin={handleLogin} navigate={navigate} />;
      case 'member-directory':
        if (user && expired) return <UserDashboard user={user} navigate={navigate} onUpdateUser={handleUpdateUser} />;
        return user ? <MemberDirectory navigate={navigate} currentUser={user} /> : <Login onLogin={handleLogin} navigate={navigate} />;
      case 'messages':
        if (user && expired) return <UserDashboard user={user} navigate={navigate} onUpdateUser={handleUpdateUser} />;
        return user ? <Messages currentUser={user} navigate={navigate} targetUserId={pageParams?.targetUserId} /> : <Login onLogin={handleLogin} navigate={navigate} />;
      case 'pricelist':
        if (user && expired) return <UserDashboard user={user} navigate={navigate} onUpdateUser={handleUpdateUser} />;
        return user ? <Pricelist navigate={navigate} /> : <Login onLogin={handleLogin} navigate={navigate} />;
      default:
        return <Login onLogin={handleLogin} navigate={navigate} />; // Fallback to login
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
                <li><button onClick={() => navigate('login')} className="hover:text-white">Portal Login</button></li>
                {!user && <li><button onClick={() => navigate('register')} className="hover:text-white">Join Us</button></li>}
                <li><button className="hover:text-white">Contact Support</button></li>
                <li><button className="hover:text-white">Privacy Policy</button></li>
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
}

export default App;