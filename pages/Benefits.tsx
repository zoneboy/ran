/* --- FILE: pages/Benefits.tsx --- */
import React from 'react';
import { Users, ShieldCheck, GraduationCap, Briefcase, Zap, ArrowRight } from 'lucide-react';
import { User } from '../types';

interface BenefitsProps {
  navigate: (page: string) => void;
  user: User | null;
}

const Benefits: React.FC<BenefitsProps> = ({ navigate, user }) => {
  const benefitsList = [
    {
      icon: <Users className="h-6 w-6 text-green-600" />,
      title: "Networking & Insights",
      description: "Access to industry insights, and networking opportunities."
    },
    {
      icon: <ShieldCheck className="h-6 w-6 text-green-600" />,
      title: "Advocacy & Representation",
      description: "Representation in policy discussions and advocacy for recyclers."
    },
    {
      icon: <GraduationCap className="h-6 w-6 text-green-600" />,
      title: "Capacity Building",
      description: "Access to training and capacity-building programs."
    },
    {
      icon: <Briefcase className="h-6 w-6 text-green-600" />,
      title: "Business Support",
      description: "Business development support and partnerships within the recycling value chain."
    },
    {
      icon: <Zap className="h-6 w-6 text-green-600" />,
      title: "Innovations & Funding",
      description: "Updates on best practices, innovations, industry trends and funding opportunities."
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-4">Membership Benefits</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Join the Recyclers Association of Nigeria and unlock a world of opportunities to grow your recycling business and make a lasting environmental impact.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="p-8 sm:p-12">
            <ul className="space-y-8">
              {benefitsList.map((benefit, index) => (
                <li key={index} className="flex items-start">
                  <div className="flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-md bg-green-100 border border-green-200">
                    {benefit.icon}
                  </div>
                  <div className="ml-6">
                    <h3 className="text-xl font-bold text-gray-900">{benefit.title}</h3>
                    <p className="mt-2 text-gray-600 leading-relaxed">{benefit.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          
          {/* Call to action for non-logged-in users */}
          {!user && (
            <div className="bg-green-700 px-8 py-10 text-center sm:px-12 flex flex-col items-center">
              <h3 className="text-2xl font-bold text-white mb-4">Ready to elevate your recycling business?</h3>
              <button 
                onClick={() => navigate('register')}
                className="inline-flex items-center px-8 py-4 border border-transparent text-lg font-bold rounded-md text-green-800 bg-amber-400 hover:bg-amber-500 shadow-lg transition-transform hover:scale-105"
              >
                Join the Association Now <ArrowRight className="ml-2 h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Benefits;