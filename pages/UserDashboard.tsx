import React, { useState, useEffect } from 'react';
import { User, MembershipStatus, Announcement, Payment } from '../types';
import { api } from '../services/api';
import { CreditCard, Download, User as UserIcon, Bell, AlertTriangle, Users, Camera, X, Check, Loader2, Clock, UploadCloud, MessageCircle } from 'lucide-react';

interface UserDashboardProps {
  user: User;
  navigate?: (page: string) => void;
  onUpdateUser?: (user: User) => void;
}

const UserDashboard: React.FC<UserDashboardProps> = ({ user, navigate, onUpdateUser }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [displayUser, setDisplayUser] = useState<User>(user);
  const [formData, setFormData] = useState<User>(user);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDesc, setPaymentDesc] = useState('');
  const [receiptFile, setReceiptFile] = useState<string>('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  useEffect(() => {
    // 1. Set initial data from props
    setDisplayUser(user);
    setFormData(user);
    
    // 2. Refresh full user data (in case session storage stripped docs/images)
    const loadFullUser = async () => {
        try {
            const fullDetails = await api.getUser(user.id);
            if (fullDetails) {
                setDisplayUser(fullDetails);
                setFormData(fullDetails);
            }
        } catch (e) {
            console.error("Failed to refresh user details", e);
        }
    };

    // 3. Fetch announcements
    const loadAnnouncements = async () => {
      try {
        const data = await api.getAnnouncements();
        setAnnouncements(data);
      } catch (error) {
        console.error("Failed to load announcements");
      }
    };

    // 4. Fetch Payments
    const loadPayments = async () => {
        try {
            const data = await api.getPayments(user.id);
            setPayments(data);
        } catch (error) {
            console.error("Failed to load payments");
        }
    };

    loadFullUser();
    loadAnnouncements();
    loadPayments();
  }, [user]);

  // Expiry Calculation
  const getDaysUntilExpiry = () => {
    if (!displayUser.expiryDate) return null;
    const today = new Date();
    const expiry = new Date(displayUser.expiryDate);
    const diffTime = expiry.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const daysUntilExpiry = getDaysUntilExpiry();
  const isExpired = displayUser.status === MembershipStatus.EXPIRED || (daysUntilExpiry !== null && daysUntilExpiry < 0);
  const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 30;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          // Create canvas for resizing
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 400; // Constrain width to 400px
          const scaleSize = MAX_WIDTH / img.width;
          
          // If image is smaller than max width, keep original size, else resize
          if (scaleSize < 1) {
              canvas.width = MAX_WIDTH;
              canvas.height = img.height * scaleSize;
          } else {
              canvas.width = img.width;
              canvas.height = img.height;
          }
          
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          // Get compressed base64 string
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.5);
          setFormData(prev => ({ ...prev, profileImage: compressedDataUrl }));
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (onUpdateUser) {
      onUpdateUser(formData);
    }
    setIsEditing(false);
  };

  const handleReceiptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
       if (file.size > 2 * 1024 * 1024) { // 2MB Limit
        alert("Receipt file is too large. Max 2MB.");
        return;
      }

      if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              const MAX_WIDTH = 800; 
              const scaleSize = MAX_WIDTH / img.width;
              
              if (scaleSize < 1) {
                  canvas.width = MAX_WIDTH;
                  canvas.height = img.height * scaleSize;
              } else {
                  canvas.width = img.width;
                  canvas.height = img.height;
              }
              const ctx = canvas.getContext('2d');
              ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
              // Compressed receipt
              setReceiptFile(canvas.toDataURL('image/jpeg', 0.5));
            };
            img.src = event.target?.result as string;
          };
          reader.readAsDataURL(file);
      } else {
          const reader = new FileReader();
          reader.onload = (event) => {
             setReceiptFile(event.target?.result as string);
          };
          reader.readAsDataURL(file);
      }
    }
  };

  const handleMakePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!receiptFile) {
        alert("Please upload the payment receipt.");
        return;
    }

    setIsProcessingPayment(true);
    try {
        await api.createPayment({
            userId: user.id,
            amount: Number(paymentAmount),
            description: paymentDesc || 'Membership Renewal',
            status: 'Pending', // User initiated payments are Pending
            receipt: receiptFile
        });
        
        // Refresh payments list
        const updatedPayments = await api.getPayments(user.id);
        setPayments(updatedPayments);
        
        setShowPaymentModal(false);
        setPaymentAmount('');
        setPaymentDesc('');
        setReceiptFile('');
        alert("Payment Submitted! Your receipt has been sent to the admin for confirmation.");
    } catch (e) {
        alert("Payment Upload Failed. File might be too large.");
    } finally {
        setIsProcessingPayment(false);
    }
  };

  const openRenewalModal = () => {
      setPaymentDesc(`Membership Renewal - ${new Date().getFullYear()}`);
      setShowPaymentModal(true);
  };

  if (user.status === MembershipStatus.SUSPENDED) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-xl max-w-lg w-full text-center">
          <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Account Suspended</h1>
          <p className="text-gray-600 mb-6">Your membership has been suspended. Please contact the administrator to resolve any outstanding issues or payments.</p>
          <div className="border-t pt-4 text-left">
             <h3 className="font-bold mb-2">My Profile</h3>
             <p>Name: {user.firstName} {user.lastName}</p>
             <p>Member ID: {user.id}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8 relative">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ... (Rest of component matches existing structure) ... */}
        {/* Alerts Section */}
        {isExpired && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="flex items-start justify-between">
                    <div className="flex">
                        <AlertTriangle className="h-6 w-6 text-red-600 mr-3 mt-0.5" />
                        <div>
                            <h3 className="text-lg font-bold text-red-800">Membership Expired</h3>
                            <p className="text-red-700 mt-1">
                                Your membership expired on <span className="font-semibold">{displayUser.expiryDate}</span>. 
                                Please renew immediately to regain full access to member benefits and the directory.
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={openRenewalModal}
                        className="bg-red-600 text-white px-4 py-2 rounded-md font-bold hover:bg-red-700 whitespace-nowrap shadow-sm ml-4"
                    >
                        Renew Now
                    </button>
                </div>
            </div>
        )}

        {isExpiringSoon && !isExpired && (
            <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-md shadow-sm">
                <div className="flex items-start justify-between">
                    <div className="flex">
                        <Clock className="h-6 w-6 text-amber-600 mr-3 mt-0.5" />
                        <div>
                            <h3 className="text-lg font-bold text-amber-800">Membership Expiring Soon</h3>
                            <p className="text-amber-700 mt-1">
                                Your membership is valid until <span className="font-semibold">{displayUser.expiryDate}</span>. 
                                You have {daysUntilExpiry} days remaining. Avoid interruption by renewing early.
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={openRenewalModal}
                        className="bg-amber-500 text-white px-4 py-2 rounded-md font-bold hover:bg-amber-600 whitespace-nowrap shadow-sm ml-4"
                    >
                        Renew Membership
                    </button>
                </div>
            </div>
        )}

        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="relative h-16 w-16">
              <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center overflow-hidden">
                {displayUser.profileImage ? (
                  <img src={displayUser.profileImage} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <UserIcon className="h-8 w-8 text-green-600" />
                )}
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Welcome, {displayUser.firstName}</h1>
              <p className="text-gray-500">{displayUser.businessName}</p>
            </div>
          </div>
          <div className="mt-4 md:mt-0 flex space-x-3">
             <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
               displayUser.status === 'Active' ? 'bg-green-100 text-green-800' : 
               displayUser.status === 'Expired' ? 'bg-red-100 text-red-800' :
               'bg-yellow-100 text-yellow-800'
             }`}>
               Status: {displayUser.status}
             </span>
             <span className="px-4 py-2 bg-gray-100 text-gray-800 rounded-full text-sm font-semibold">
               ID: {displayUser.id.toUpperCase()}
             </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Content Column */}
          <div className="lg:col-span-2 space-y-6">
             
             {/* Quick Actions (Including Directory) */}
             <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
               {navigate && (
                 <button 
                  onClick={() => navigate('member-directory')}
                  className="bg-white p-4 rounded-lg shadow-sm flex flex-col items-center justify-center hover:bg-green-50 transition-colors border border-transparent hover:border-green-200 group"
                 >
                   <div className="p-3 bg-green-100 text-green-600 rounded-full mb-2 group-hover:bg-white group-hover:scale-110 transition-transform">
                     <Users className="h-6 w-6" />
                   </div>
                   <span className="font-semibold text-gray-800">Member Directory</span>
                 </button>
               )}
               <button 
                  onClick={() => setIsEditing(true)}
                  className="bg-white p-4 rounded-lg shadow-sm flex flex-col items-center justify-center hover:bg-green-50 transition-colors border border-transparent hover:border-green-200 group cursor-pointer"
               >
                  <div className="p-3 bg-blue-100 text-blue-600 rounded-full mb-2 group-hover:bg-white group-hover:scale-110 transition-transform">
                     <UserIcon className="h-6 w-6" />
                  </div>
                  <span className="font-semibold text-gray-800">Update Profile</span>
               </button>
               
               <a 
                  href="https://wa.me/2348122975338?text=I%20need%20help%20on"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white p-4 rounded-lg shadow-sm flex flex-col items-center justify-center hover:bg-green-50 transition-colors border border-transparent hover:border-green-200 group cursor-pointer"
               >
                  <div className="p-3 bg-amber-100 text-amber-600 rounded-full mb-2 group-hover:bg-white group-hover:scale-110 transition-transform">
                     <MessageCircle className="h-6 w-6" />
                  </div>
                  <span className="font-semibold text-gray-800">Contact Support</span>
               </a>
             </div>

             {/* ID Card & Certificate */}
             <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                  <Download className="h-5 w-5 mr-2 text-amber-500" /> Downloads
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Membership ID Card */}
                  {displayUser.documents?.membershipIdCard ? (
                    <a 
                      href={displayUser.documents.membershipIdCard} 
                      download={`${displayUser.businessName}_ID_Card`}
                      className="border-2 border-dashed border-green-300 bg-green-50 rounded-lg p-6 text-center hover:bg-green-100 transition-colors cursor-pointer group"
                    >
                       <p className="font-medium text-green-800">Membership ID Card</p>
                       <p className="text-xs text-green-600 mt-1 flex items-center justify-center">
                         <Download className="h-3 w-3 mr-1" /> Click to Download
                       </p>
                    </a>
                  ) : (
                    <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center bg-gray-50 opacity-70">
                       <p className="font-medium text-gray-500">Membership ID Card</p>
                       <p className="text-xs text-gray-400 mt-1">Not Available Yet</p>
                    </div>
                  )}

                  {/* Membership Certificate */}
                  {displayUser.documents?.membershipCertificate ? (
                    <a 
                      href={displayUser.documents.membershipCertificate} 
                      download={`${displayUser.businessName}_Certificate`}
                      className="border-2 border-dashed border-green-300 bg-green-50 rounded-lg p-6 text-center hover:bg-green-100 transition-colors cursor-pointer group"
                    >
                       <p className="font-medium text-green-800">Membership Certificate</p>
                       <p className="text-xs text-green-600 mt-1 flex items-center justify-center">
                         <Download className="h-3 w-3 mr-1" /> Click to Download
                       </p>
                    </a>
                  ) : (
                     <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center bg-gray-50 opacity-70">
                       <p className="font-medium text-gray-500">Membership Certificate</p>
                       <p className="text-xs text-gray-400 mt-1">Not Available Yet</p>
                    </div>
                  )}
                </div>
             </div>

             {/* Payment History */}
             <div className="bg-white rounded-lg shadow-sm p-6">
               <div className="flex justify-between items-center mb-4">
                 <h2 className="text-lg font-bold text-gray-900 flex items-center">
                   <CreditCard className="h-5 w-5 mr-2 text-amber-500" /> Payment History
                 </h2>
                 <button 
                    onClick={() => setShowPaymentModal(true)}
                    className="text-sm bg-green-50 text-green-600 hover:bg-green-100 px-3 py-1.5 rounded-md font-medium transition-colors"
                 >
                    Make Payment
                 </button>
               </div>
               <div className="overflow-x-auto">
                 <table className="min-w-full divide-y divide-gray-200">
                   <thead>
                     <tr>
                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Receipt</th>
                     </tr>
                   </thead>
                   <tbody className="bg-white divide-y divide-gray-200">
                     {payments.length > 0 ? payments.map(payment => (
                       <tr key={payment.id}>
                         <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{payment.date}</td>
                         <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{payment.description}</td>
                         <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{payment.currency} {payment.amount.toLocaleString()}</td>
                         <td className="px-6 py-4 whitespace-nowrap">
                           <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                             ${payment.status === 'Successful' ? 'bg-green-100 text-green-800' : 
                               payment.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                             {payment.status}
                           </span>
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap text-sm">
                           {payment.receipt ? (
                              <a href={payment.receipt} download={`receipt_${payment.reference}`} className="text-blue-600 hover:text-blue-800 hover:underline flex items-center">
                                <Download className="h-3 w-3 mr-1" /> Download
                              </a>
                           ) : (
                              <span className="text-gray-400 text-xs">N/A</span>
                           )}
                         </td>
                       </tr>
                     )) : (
                        <tr>
                            <td colSpan={5} className="text-center text-gray-500 py-6">No payment history found.</td>
                        </tr>
                     )}
                   </tbody>
                 </table>
               </div>
             </div>
          </div>

          {/* Sidebar Column */}
          <div className="space-y-6">
            
            {/* Profile Summary */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Membership Details</h2>
              <div className="space-y-3 text-sm">
                 <div className="flex justify-between border-b pb-2">
                   <span className="text-gray-500">Category</span>
                   <span className="font-medium">{displayUser.category}</span>
                 </div>
                 <div className="flex justify-between border-b pb-2">
                   <span className="text-gray-500">Joined</span>
                   <span className="font-medium">{displayUser.dateJoined}</span>
                 </div>
                 <div className="flex justify-between border-b pb-2">
                   <span className="text-gray-500">Expires</span>
                   <span className={`font-medium ${isExpired ? 'text-red-600' : isExpiringSoon ? 'text-amber-600' : ''}`}>
                       {displayUser.expiryDate}
                   </span>
                 </div>
                 <div className="pt-2">
                   <button 
                      onClick={() => setIsEditing(true)}
                      className="w-full bg-green-600 text-white py-2 rounded-md text-sm font-medium hover:bg-green-700 transition-colors"
                   >
                     Update Profile
                   </button>
                 </div>
              </div>
            </div>

            {/* Announcements */}
            <div className="bg-white rounded-lg shadow-sm p-6">
               <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                 <Bell className="h-5 w-5 mr-2 text-amber-500" /> Announcements
               </h2>
               <div className="space-y-4">
                 {announcements.length === 0 ? (
                   <p className="text-sm text-gray-500 text-center">No new announcements.</p>
                 ) : (
                   announcements.map(ann => (
                     <div key={ann.id} className={`p-3 rounded-lg border ${ann.isImportant ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
                       <div className="flex justify-between items-start mb-1">
                         <h3 className="font-semibold text-sm text-gray-900">{ann.title}</h3>
                         <span className="text-xs text-gray-400">{ann.date}</span>
                       </div>
                       <p className="text-xs text-gray-600">{ann.content}</p>
                     </div>
                   ))
                 )}
               </div>
            </div>

          </div>
        </div>

        {/* Edit Profile Modal */}
        {isEditing && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-gray-900">Edit Profile</h3>
                  <button onClick={() => setIsEditing(false)} className="text-gray-400 hover:text-gray-600"><X className="h-6 w-6" /></button>
                </div>
                
                <form onSubmit={handleSaveProfile} className="space-y-6">
                  {/* Profile Image Upload */}
                  <div className="flex flex-col items-center">
                    <div className="relative group cursor-pointer">
                      <div className="h-24 w-24 rounded-full overflow-hidden border-4 border-gray-100 shadow-md">
                        {formData.profileImage ? (
                          <img src={formData.profileImage} alt="Profile" className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full bg-green-100 flex items-center justify-center">
                             <UserIcon className="h-10 w-10 text-green-600" />
                          </div>
                        )}
                      </div>
                      <label className="absolute bottom-0 right-0 bg-green-600 text-white p-2 rounded-full shadow-lg hover:bg-green-700 transition-colors cursor-pointer">
                        <Camera className="h-4 w-4" />
                        <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                      </label>
                    </div>
                    <p className="mt-2 text-sm text-gray-500">Tap icon to change photo (Max 400px width)</p>
                  </div>

                  <div className="space-y-4">
                     <div>
                       <label className="block text-sm font-medium text-gray-700">Phone Number</label>
                       <input 
                         type="tel" 
                         value={formData.phone} 
                         onChange={(e) => setFormData({...formData, phone: e.target.value})}
                         className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-green-500 focus:border-green-500"
                       />
                     </div>
                     <div>
                       <label className="block text-sm font-medium text-gray-700">Business Address</label>
                       <input 
                         type="text" 
                         value={formData.businessAddress} 
                         onChange={(e) => setFormData({...formData, businessAddress: e.target.value})}
                         className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-green-500 focus:border-green-500"
                       />
                     </div>
                     <div>
                       <label className="block text-sm font-medium text-gray-700">Monthly Volume</label>
                       <input 
                         type="text" 
                         value={formData.monthlyVolume} 
                         onChange={(e) => setFormData({...formData, monthlyVolume: e.target.value})}
                         className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-green-500 focus:border-green-500"
                       />
                     </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <button 
                      type="button" 
                      onClick={() => setIsEditing(false)} 
                      className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 shadow-sm font-medium"
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Payment Modal */}
        {showPaymentModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md animate-in fade-in zoom-in duration-200">
               <div className="p-6">
                 <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center">
                        <CreditCard className="h-5 w-5 mr-2 text-green-600" /> Renew / Make Payment
                    </h3>
                    <button onClick={() => setShowPaymentModal(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
                 </div>

                 {/* Bank Details */}
                 <div className="bg-green-50 p-4 rounded-md mb-6 border border-green-200">
                    <p className="font-bold text-green-800 text-sm mb-2 uppercase tracking-wide">Bank Details for Transfer:</p>
                    <div className="space-y-1 text-sm text-green-900">
                        <p className="flex justify-between"><span>Bank:</span> <span className="font-semibold">Access Bank PLC</span></p>
                        <p className="flex justify-between"><span>Account Number:</span> <span className="font-mono font-bold text-lg">0785293332</span></p>
                        <p className="flex justify-between"><span>Account Name:</span> <span className="font-semibold text-right">Recyclers Association of Nigeria</span></p>
                    </div>
                 </div>
                 
                 <form onSubmit={handleMakePayment} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Amount (NGN)</label>
                        <input 
                          type="number" 
                          required
                          min="0"
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                          placeholder="0.00"
                          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-green-500 focus:border-green-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <input 
                          type="text" 
                          required
                          value={paymentDesc}
                          onChange={(e) => setPaymentDesc(e.target.value)}
                          placeholder="e.g. Annual Dues 2024"
                          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-green-500 focus:border-green-500"
                        />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Upload Receipt</label>
                      <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md bg-gray-50 hover:bg-gray-100 transition-colors">
                        <div className="space-y-1 text-center">
                          <UploadCloud className="mx-auto h-12 w-12 text-gray-400" />
                          <div className="flex text-sm text-gray-600">
                            <label className="relative cursor-pointer bg-white rounded-md font-medium text-green-600 hover:text-green-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-green-500">
                              <span>Upload a file</span>
                              <input type="file" accept="image/*,.pdf" className="sr-only" onChange={handleReceiptChange} required />
                            </label>
                            <p className="pl-1">or drag and drop</p>
                          </div>
                          <p className="text-xs text-gray-500">PNG, JPG, PDF up to 2MB</p>
                          {receiptFile && <p className="text-xs text-green-600 font-bold mt-2">File Selected!</p>}
                        </div>
                      </div>
                    </div>
                    
                    <div className="pt-4">
                        <button 
                           type="submit" 
                           disabled={isProcessingPayment}
                           className="w-full bg-green-600 text-white py-2 rounded-md font-bold hover:bg-green-700 flex justify-center items-center shadow-lg"
                        >
                           {isProcessingPayment ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Submit Payment'}
                        </button>
                    </div>
                 </form>
               </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default UserDashboard;