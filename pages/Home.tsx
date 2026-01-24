import React from 'react';
import { ArrowRight, Leaf, ShieldCheck, Users, TrendingUp, LayoutDashboard } from 'lucide-react';
import { User } from '../types';

interface HomeProps {
  navigate: (page: string) => void;
  user: User | null;
}

const Home: React.FC<HomeProps> = ({ navigate, user }) => {
  const handleDashboardClick = () => {
    if (user?.role === 'ADMIN') {
      navigate('admin-dashboard');
    } else {
      navigate('dashboard');
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <div className="relative bg-green-900 text-white overflow-hidden">
        <div className="absolute inset-0">
          <img 
            src="https://picsum.photos/1920/1080?grayscale&blur=2" 
            alt="Recycling Background" 
            className="w-full h-full object-cover opacity-20"
          />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6">
            Recyclers Association <br />
            <span className="text-amber-400">of Nigeria</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mb-10">
            Uniting the recycling ecosystem for a sustainable future. We advocate for policies, build capacity, and foster growth for recyclers across Nigeria.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4">
            {user ? (
              <button 
                onClick={handleDashboardClick}
                className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-lg flex items-center justify-center transition-transform hover:scale-105 border border-green-500"
              >
                <LayoutDashboard className="mr-2 h-5 w-5" /> Go to Dashboard
              </button>
            ) : (
              <>
                <button 
                  onClick={() => navigate('register')}
                  className="px-8 py-4 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg shadow-lg flex items-center justify-center transition-transform hover:scale-105"
                >
                  Join the Association <ArrowRight className="ml-2 h-5 w-5" />
                </button>
                <button 
                  onClick={() => navigate('login')}
                  className="px-8 py-4 bg-transparent border-2 border-white hover:bg-white hover:text-green-900 text-white font-bold rounded-lg shadow-lg transition-colors"
                >
                  Member Login
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mission & Stats */}
      <div className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">Our Mission</h2>
            <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
              To create an enabling environment for the recycling industry in Nigeria through advocacy, standardization, and capacity building.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 bg-green-50 rounded-xl text-center hover:shadow-md transition-shadow">
              <div className="inline-flex items-center justify-center p-3 bg-green-100 rounded-full mb-4">
                <Leaf className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Environmental Impact</h3>
              <p className="text-gray-600">Promoting sustainable waste management practices to protect our environment.</p>
            </div>
            <div className="p-6 bg-green-50 rounded-xl text-center hover:shadow-md transition-shadow">
              <div className="inline-flex items-center justify-center p-3 bg-green-100 rounded-full mb-4">
                <Users className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Community Growth</h3>
              <p className="text-gray-600">Building a strong network of collectors, aggregators, and processors.</p>
            </div>
            <div className="p-6 bg-green-50 rounded-xl text-center hover:shadow-md transition-shadow">
              <div className="inline-flex items-center justify-center p-3 bg-green-100 rounded-full mb-4">
                <ShieldCheck className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Policy Advocacy</h3>
              <p className="text-gray-600">Representing the interests of recyclers at state and federal levels.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Latest News */}
      <div className="bg-slate-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">Industry News & Updates</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                <img src={`https://picsum.photos/400/200?random=${i}`} alt="News" className="w-full h-48 object-cover" />
                <div className="p-6">
                  <span className="text-sm text-green-600 font-semibold">Update</span>
                  <h3 className="mt-2 text-xl font-semibold text-gray-900">National Recycling Policy Review</h3>
                  <p className="mt-2 text-gray-600 line-clamp-3">
                    The association is actively participating in the review of the new national policy framework for solid waste management...
                  </p>
                  <button className="mt-4 text-green-700 font-medium hover:text-green-800">Read more →</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;