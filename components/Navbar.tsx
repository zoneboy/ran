import React, { useState, useEffect } from 'react';
import { Menu, X, Recycle, User, LogOut, Users, MessageSquare, Coins, Package } from 'lucide-react';
import { User as UserType } from '../types';
import { api } from '../services/api';

interface NavbarProps {
  user: UserType | null;
  onLogout: () => void;
  navigate: (page: string) => void;
  currentPage: string;
}

const Navbar: React.FC<NavbarProps> = ({ user, onLogout, navigate, currentPage }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const isExpired = React.useMemo(() => {
    if (!user) return false;
    if (user.status === 'Expired') return true;
    if (user.role === 'ADMIN') return false;

    const today = new Date();
    const expiryDate = new Date(user.expiryDate);
    const diffTime = expiryDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 0;
  }, [user]);

  useEffect(() => {
    if (user && !isExpired) {
      const checkUnread = async () => {
        try {
          const count = await api.getUnreadCount(user.id);
          setUnreadCount(count);
        } catch (e) {
        }
      };
      checkUnread();
      const interval = setInterval(checkUnread, 15000);
      return () => clearInterval(interval);
    } else {
      setUnreadCount(0);
    }
  }, [user, isExpired, currentPage]);

  const navLinks = [
    { name: 'Benefits', value: 'benefits' },
  ];

  const handleNav = (page: string) => {
    navigate(page);
    setIsOpen(false);
  };

  return (
    <nav className="bg-green-700 text-white shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div
            className="flex items-center cursor-pointer"
            onClick={() => handleNav(user ? (user.role === 'ADMIN' ? 'admin-dashboard' : 'dashboard') : 'login')}
          >
            <img src="/ran-logo.png" alt="RAN Logo" className="h-10 mr-2" />
          </div>

          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              {navLinks.map((link) => (
                <button
                  key={link.value}
                  onClick={() => handleNav(link.value)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    currentPage === link.value ? 'bg-green-800 text-white' : 'hover:bg-green-600'
                  }`}
                >
                  {link.name}
                </button>
              ))}

              {user && !isExpired && (
                <>
                  <button
                    onClick={() => handleNav('member-directory')}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center ${
                      currentPage === 'member-directory' ? 'bg-green-800 text-white' : 'hover:bg-green-600'
                    }`}
                  >
                    <Users className="h-4 w-4 mr-1" /> Directory
                  </button>
                  <button
                    onClick={() => handleNav('pricelist')}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center ${
                      currentPage === 'pricelist' ? 'bg-green-800 text-white' : 'hover:bg-green-600'
                    }`}
                  >
                    <Coins className="h-4 w-4 mr-1" /> Pricelist
                  </button>
                </>
              )}

              {user && (
                <button
                  onClick={() => handleNav('listings')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center ${
                    currentPage === 'listings' ? 'bg-green-800 text-white' : 'hover:bg-green-600'
                  }`}
                >
                  <Package className="h-4 w-4 mr-1" /> Listings
                </button>
              )}

              {user && !isExpired && (
                <button
                  onClick={() => handleNav('messages')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center relative ${
                    currentPage === 'messages' ? 'bg-green-800 text-white' : 'hover:bg-green-600'
                  }`}
                >
                  <MessageSquare className="h-4 w-4 mr-1" />
                  Messages
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 leading-none shadow-sm animate-pulse">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>
              )}

              {!user && (
                <>
                  <button onClick={() => handleNav('login')} className="hover:bg-green-600 px-3 py-2 rounded-md text-sm font-medium">Login</button>
                  <button onClick={() => handleNav('register')} className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">Register</button>
                </>
              )}

              {user && (
                <div className="flex items-center ml-4 space-x-4">
                  <button
                    onClick={() => handleNav(user.role === 'ADMIN' ? 'admin-dashboard' : 'dashboard')}
                    className="flex items-center space-x-2 hover:bg-green-600 px-3 py-2 rounded-md transition-colors"
                  >
                    <User className="h-4 w-4" />
                    <span>Dashboard</span>
                  </button>
                  <button
                    onClick={onLogout}
                    className="flex items-center space-x-1 text-red-200 hover:text-red-100 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="text-sm">Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="-mr-2 flex md:hidden items-center gap-2">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="bg-green-800 inline-flex items-center justify-center p-2 rounded-md text-gray-200 hover:text-white hover:bg-green-600 focus:outline-none relative"
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              {!isOpen && unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 rounded-full h-3 w-3 border-2 border-green-700 animate-pulse" />
              )}
            </button>
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="md:hidden bg-green-700 pb-3">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {navLinks.map((link) => (
              <button
                key={link.value}
                onClick={() => handleNav(link.value)}
                className="block w-full text-left px-3 py-2 rounded-md text-base font-medium hover:bg-green-600"
              >
                {link.name}
              </button>
            ))}
            {user && !isExpired && (
              <>
                <button
                  onClick={() => handleNav('member-directory')}
                  className="block w-full text-left px-3 py-2 rounded-md text-base font-medium hover:bg-green-600"
                >
                  Member Directory
                </button>
                <button
                  onClick={() => handleNav('pricelist')}
                  className="block w-full text-left px-3 py-2 rounded-md text-base font-medium hover:bg-green-600"
                >
                  Pricelist
                </button>
              </>
            )}

            {user && (
              <button
                onClick={() => handleNav('listings')}
                className="block w-full text-left px-3 py-2 rounded-md text-base font-medium hover:bg-green-600"
              >
                Listings
              </button>
            )}

            {user && !isExpired && (
              <button
                onClick={() => handleNav('messages')}
                className="block w-full text-left px-3 py-2 rounded-md text-base font-medium hover:bg-green-600 flex items-center justify-between"
              >
                <span className="flex items-center">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Messages
                </span>
                {unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse shadow-sm">
                    {unreadCount > 99 ? '99+' : unreadCount} new
                  </span>
                )}
              </button>
            )}
            {!user && (
              <>
                <button onClick={() => handleNav('login')} className="block w-full text-left px-3 py-2 rounded-md text-base font-medium hover:bg-green-600">Login</button>
                <button onClick={() => handleNav('register')} className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-amber-400 hover:text-amber-300">Register</button>
              </>
            )}
            {user && (
              <>
                <button onClick={() => handleNav(user.role === 'ADMIN' ? 'admin-dashboard' : 'dashboard')} className="block w-full text-left px-3 py-2 rounded-md text-base font-medium hover:bg-green-600">Dashboard</button>
                <button onClick={onLogout} className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-red-300 hover:text-red-200">Logout</button>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;