import React, { useState } from 'react';
import { Menu, X, Recycle, User, LogOut, Users } from 'lucide-react';
import { User as UserType } from '../types';

interface NavbarProps {
  user: UserType | null;
  onLogout: () => void;
  navigate: (page: string) => void;
  currentPage: string;
}

const Navbar: React.FC<NavbarProps> = ({ user, onLogout, navigate, currentPage }) => {
  const [isOpen, setIsOpen] = useState(false);

  const navLinks = [
    { name: 'Home', value: 'home' },
    { name: 'Benefits', value: 'benefits' }, // Placeholder link
    { name: 'News', value: 'news' }, // Placeholder link
  ];

  const handleNav = (page: string) => {
    navigate(page);
    setIsOpen(false);
  };

  return (
    <nav className="bg-green-700 text-white shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center cursor-pointer" onClick={() => handleNav('home')}>
            <Recycle className="h-8 w-8 text-amber-400 mr-2" />
            <span className="font-bold text-xl tracking-tight">RAN Portal</span>
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

              {/* Authenticated Links */}
              {user && (
                 <button
                    onClick={() => handleNav('member-directory')}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center ${
                      currentPage === 'member-directory' ? 'bg-green-800 text-white' : 'hover:bg-green-600'
                    }`}
                  >
                    <Users className="h-4 w-4 mr-1" /> Directory
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
          
          <div className="-mr-2 flex md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="bg-green-800 inline-flex items-center justify-center p-2 rounded-md text-gray-200 hover:text-white hover:bg-green-600 focus:outline-none"
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
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
             {user && (
                <button 
                  onClick={() => handleNav('member-directory')} 
                  className="block w-full text-left px-3 py-2 rounded-md text-base font-medium hover:bg-green-600"
                >
                  Member Directory
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