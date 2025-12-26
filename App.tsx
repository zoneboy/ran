import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Register from './pages/Register';
import Login from './pages/Login';
import UserDashboard from './pages/UserDashboard';
import AdminDashboard from './pages/AdminDashboard';
import MemberDirectory from './pages/MemberDirectory';
import { User } from './types';
import { api } from './services/api';

function App() {
  const [currentPage, setCurrentPage] = useState('home');
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize Session
  useEffect(() => {
    const initSession = async () => {
      try {
        const currentUser = await api.getCurrentUser();
        setUser(currentUser);
      } catch (error) {
        console.error('Session restore failed', error);
      } finally {
        setIsLoading(false);
      }
    };
    initSession();
  }, []);

  const navigate = (page: string) => {
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

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <Home navigate={navigate} />;
      case 'register':
        return <Register navigate={navigate} />;
      case 'login':
        return <Login onLogin={handleLogin} navigate={navigate} />;
      case 'dashboard':
        return user ? <UserDashboard user={user} navigate={navigate} onUpdateUser={handleUpdateUser} /> : <Login onLogin={handleLogin} navigate={navigate} />;
      case 'admin-dashboard':
        return user && user.role === 'ADMIN' ? <AdminDashboard /> : <Home navigate={navigate} />;
      case 'member-directory':
        return user ? <MemberDirectory navigate={navigate} currentUser={user} /> : <Login onLogin={handleLogin} navigate={navigate} />;
      default:
        return <Home navigate={navigate} />;
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
                <li><button onClick={() => navigate('register')} className="hover:text-white">Join Us</button></li>
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