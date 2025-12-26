import React, { useState, useEffect } from 'react';
import { Search, MapPin, Briefcase, Tag, ArrowLeft, Users, Layers, Factory, Loader2, Phone, Mail, BarChart, Settings, ShieldAlert, User as UserIcon } from 'lucide-react';
import { BusinessCategory, User, UserRole } from '../types';
import { api } from '../services/api';

interface MemberDirectoryProps {
  navigate: (page: string) => void;
  currentUser: User;
}

const MemberDirectory: React.FC<MemberDirectoryProps> = ({ navigate, currentUser }) => {
  const [members, setMembers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [selectedMember, setSelectedMember] = useState<User | null>(null);

  const isAdmin = currentUser.role === UserRole.ADMIN;

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const data = await api.getUsers();
        setMembers(data);
      } catch (error) {
        console.error('Failed to fetch members', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchMembers();
  }, []);

  // Filter Logic
  const filteredMembers = members.filter(user => {
    // Exclude Admin from list, and only show Active members to general members
    if (user.role === 'ADMIN') return false;
    
    // Admins can see everyone, Members only see Active
    if (!isAdmin && user.status !== 'Active') return false;

    const safeBusiness = (user.businessName || '').toLowerCase();
    const safeMaterials = user.materialTypes || [];
    const searchLower = searchTerm.toLowerCase();

    const matchesSearch = 
      safeBusiness.includes(searchLower) ||
      safeMaterials.some(m => (m || '').toLowerCase().includes(searchLower));

    const matchesCategory = selectedCategory ? user.category === selectedCategory || Object.values(BusinessCategory).some(c => c === selectedCategory) : true;
    
    const matchesState = selectedState ? user.businessState === selectedState : true;

    return matchesSearch && matchesCategory && matchesState;
  });

  const uniqueStates = Array.from(new Set(members.filter(u => u.role !== 'ADMIN').map(u => u.businessState || 'Unknown')));

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-10 w-10 text-green-600 animate-spin" /></div>;
  }

  // Detailed View Component
  if (selectedMember) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <button 
            onClick={() => setSelectedMember(null)}
            className="flex items-center text-green-700 hover:text-green-800 font-medium mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Directory
          </button>

          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            {/* Header */}
            <div className="bg-green-700 p-8 text-white">
              <div className="flex flex-col md:flex-row items-start justify-between">
                <div className="flex items-center">
                  <div className="h-24 w-24 bg-white rounded-full flex items-center justify-center text-green-700 overflow-hidden border-4 border-green-600 shrink-0">
                    {selectedMember.profileImage ? (
                      <img src={selectedMember.profileImage} alt={selectedMember.businessName} className="h-full w-full object-cover" />
                    ) : (
                      <Factory className="h-10 w-10" />
                    )}
                  </div>
                  <div className="ml-6">
                    <h1 className="text-3xl font-bold">{selectedMember.businessName}</h1>
                    <p className="text-green-100 mt-1 flex items-center">
                      <Briefcase className="h-4 w-4 mr-2" /> {selectedMember.category}
                    </p>
                    <p className="text-green-100 mt-1 flex items-center">
                      <MapPin className="h-4 w-4 mr-2" /> {selectedMember.businessAddress}, {selectedMember.businessState}
                    </p>
                  </div>
                </div>
                <div className="mt-4 md:mt-0 flex flex-col items-end gap-2">
                  <span className="px-4 py-2 bg-green-600 rounded-full text-sm font-semibold border border-green-500">
                    Since {new Date(selectedMember.dateJoined).getFullYear()}
                  </span>
                  {isAdmin && (
                    <span className={`px-4 py-1 rounded-full text-xs font-bold border ${
                        selectedMember.status === 'Active' ? 'bg-white text-green-700 border-white' : 'bg-red-100 text-red-700 border-red-200'
                    }`}>
                        {selectedMember.status}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Basic Info */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 border-b pb-2 mb-4">Member Information</h3>
                <div className="space-y-4">
                  <div className="flex items-start">
                    <Users className="h-5 w-5 text-gray-400 mr-3 mt-1" />
                    <div>
                      <p className="text-sm font-medium text-gray-500">Member Name</p>
                      <p className="text-gray-900">{selectedMember.firstName} {selectedMember.lastName}</p>
                    </div>
                  </div>
                  
                  {/* Contact details restricted to Admins */}
                  {isAdmin ? (
                    <>
                        <div className="flex items-start">
                            <UserIcon className="h-5 w-5 text-gray-400 mr-3 mt-1" />
                            <div>
                            <p className="text-sm font-medium text-gray-500">Gender</p>
                            <p className="text-gray-900">{selectedMember.gender || 'N/A'}</p>
                            </div>
                        </div>
                        <div className="flex items-start">
                            <Phone className="h-5 w-5 text-gray-400 mr-3 mt-1" />
                            <div>
                            <p className="text-sm font-medium text-gray-500">Phone</p>
                            <p className="text-gray-900">{selectedMember.phone}</p>
                            </div>
                        </div>
                        <div className="flex items-start">
                            <Mail className="h-5 w-5 text-gray-400 mr-3 mt-1" />
                            <div>
                            <p className="text-sm font-medium text-gray-500">Email</p>
                            <p className="text-gray-900">{selectedMember.email}</p>
                            </div>
                        </div>
                    </>
                  ) : (
                    <div className="p-3 bg-gray-50 rounded border border-gray-100 text-xs text-gray-500 italic flex items-center">
                        <ShieldAlert className="h-4 w-4 mr-2" />
                        Contact details are private.
                    </div>
                  )}
                </div>
              </div>

              {/* Operational Info */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 border-b pb-2 mb-4">Recycling Activities</h3>
                <div className="space-y-4">
                  <div className="flex items-start">
                    <Layers className="h-5 w-5 text-gray-400 mr-3 mt-1" />
                    <div>
                      <p className="text-sm font-medium text-gray-500">Materials Collected / Processed</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                         {(selectedMember.materialTypes || []).length > 0 ? (
                           selectedMember.materialTypes.map(m => (
                             <span key={m} className="bg-green-50 text-green-700 text-sm px-3 py-1 rounded-full border border-green-100">{m}</span>
                           ))
                         ) : (
                           <span className="text-gray-500 text-sm">No materials listed</span>
                         )}
                      </div>
                    </div>
                  </div>

                  {/* Operational metrics restricted to Admins */}
                  {isAdmin ? (
                    <>
                         <div className="flex items-start">
                            <BarChart className="h-5 w-5 text-gray-400 mr-3 mt-1" />
                            <div>
                            <p className="text-sm font-medium text-gray-500">Monthly Volume</p>
                            <p className="text-gray-900">{selectedMember.monthlyVolume} Tons</p>
                            </div>
                        </div>
                        <div className="flex items-start">
                            <Users className="h-5 w-5 text-gray-400 mr-3 mt-1" />
                            <div>
                            <p className="text-sm font-medium text-gray-500">Employees</p>
                            <p className="text-gray-900">{selectedMember.employees}</p>
                            </div>
                        </div>
                         <div className="flex items-start">
                            <Settings className="h-5 w-5 text-gray-400 mr-3 mt-1" />
                            <div>
                            <p className="text-sm font-medium text-gray-500">Machinery</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                                {(selectedMember.machineryDeployed || []).map(m => (
                                    <span key={m} className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-700">{m}</span>
                                ))}
                            </div>
                            </div>
                        </div>
                    </>
                  ) : (
                     <div className="p-3 bg-gray-50 rounded border border-gray-100 text-xs text-gray-500 italic">
                        Detailed operational metrics are restricted.
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
          <div>
             <h1 className="text-3xl font-bold text-gray-900">Member Directory</h1>
             <p className="text-gray-600 mt-2">
                {isAdmin 
                    ? "Full access directory view (Admin Mode)." 
                    : "Connect with other recyclers in the association."}
             </p>
          </div>
          <button onClick={() => navigate(isAdmin ? 'admin-dashboard' : 'dashboard')} className="mt-4 md:mt-0 text-green-600 hover:text-green-700 font-medium">
            &larr; Back to Dashboard
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white p-6 rounded-lg shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search business, materials..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
            />
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          </div>
          
          <div className="relative">
             <select 
               value={selectedState} 
               onChange={(e) => setSelectedState(e.target.value)}
               className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500 appearance-none"
             >
               <option value="">All States</option>
               {uniqueStates.map(state => (
                 <option key={state} value={state}>{state}</option>
               ))}
             </select>
             <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          </div>

          <div className="relative">
             <select 
               value={selectedCategory} 
               onChange={(e) => setSelectedCategory(e.target.value)}
               className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500 appearance-none"
             >
               <option value="">All Membership Types</option>
               <option value="Corporate Member">Corporate Member</option>
               <option value="Associate Member">Associate Member</option>
               <option value="Professional Member">Professional Member</option>
             </select>
             <Briefcase className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          </div>
        </div>

        {/* Results Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMembers.length > 0 ? (
            filteredMembers.map(member => (
              <div key={member.id} className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden border border-gray-100 flex flex-col">
                <div className="p-6 flex-1 cursor-pointer" onClick={() => setSelectedMember(member)}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900 mb-1">{member.businessName}</h3>
                      <p className="text-sm text-green-600 font-medium mb-1">{member.category}</p>
                      <p className="text-sm text-gray-500 mb-3">{member.firstName} {member.lastName}</p>
                    </div>
                    {member.profileImage && (
                      <img src={member.profileImage} alt={member.businessName} className="h-14 w-14 rounded-full object-cover ml-3 bg-gray-100 border border-gray-200" />
                    )}
                  </div>
                  
                  <div className="space-y-2 text-sm text-gray-600 mt-2">
                    <div className="flex items-center">
                      <MapPin className="h-4 w-4 mr-2 text-gray-400" />
                      {member.businessAddress}, {member.businessState}
                    </div>
                    {(member.materialTypes || []).length > 0 && (
                      <div className="flex items-start">
                        <Tag className="h-4 w-4 mr-2 text-gray-400 mt-1" />
                        <div className="flex flex-wrap gap-1">
                          {member.materialTypes.slice(0, 3).map(mat => (
                            <span key={mat} className="bg-gray-100 px-2 py-0.5 rounded text-xs">
                              {mat}
                            </span>
                          ))}
                          {member.materialTypes.length > 3 && <span className="text-xs text-gray-400">+{member.materialTypes.length - 3}</span>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="bg-gray-50 px-6 py-3 border-t border-gray-100 flex justify-center items-center">
                  <button 
                    onClick={() => setSelectedMember(member)}
                    className="text-sm text-green-700 font-medium hover:underline focus:outline-none"
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full text-center py-12">
              <p className="text-gray-500 text-lg">No members found matching your criteria.</p>
              <button 
                onClick={() => {setSearchTerm(''); setSelectedCategory(''); setSelectedState('');}}
                className="mt-4 text-green-600 font-medium hover:text-green-700"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MemberDirectory;