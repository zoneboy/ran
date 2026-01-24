
import React, { useState, useEffect } from 'react';
import { User, MembershipStatus, Announcement, Payment, BankDetails, Collection } from '../types';
import { api } from '../services/api';
import { uploadToCloudinary } from '../services/cloudinary';
import { CreditCard, Download, User as UserIcon, Bell, AlertTriangle, Users, Camera, X, Check, Loader2, Clock, UploadCloud, MessageCircle, BarChart2, Plus, FileText, Trash2 } from 'lucide-react';

interface UserDashboardProps {
  user: User;
  navigate: (page: string) => void;
  onUpdateUser?: (user: User) => void;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const YEARS = [new Date().getFullYear(), new Date().getFullYear() - 1];

const LOG_MATERIALS = [
  'PET Plastics',
  'Other Plastics',
  'Paper/Cartons',
  'UBC',
  'Metals',
  'Glass',
  'E-waste',
  'Nylon',
  'Organic',
  'PVC',
  'Organics'
];

const UserDashboard: React.FC<UserDashboardProps> = ({ user, navigate, onUpdateUser }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [displayUser, setDisplayUser] = useState<User>(user);
  const [formData, setFormData] = useState<User>(user);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDesc, setPaymentDesc] = useState('');
  const [receiptFileUrl, setReceiptFileUrl] = useState<string>('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  
  const [isUploadingProfile, setIsUploadingProfile] = useState(false);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);

  // Collections State
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [collectionForm, setCollectionForm] = useState({
      month: MONTHS[new Date().getMonth()],
      year: new Date().getFullYear().toString(),
      material: '',
      weight: '',
      images: [] as string[]
  });
  const [isUploadingCollection, setIsUploadingCollection] = useState(false);

  // Expiry Logic
  const today = new Date();
  const expiryDate = new Date(displayUser.expiryDate);
  const diffTime = expiryDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  const isExpiringSoon = diffDays > 0 && diffDays <= 30;
  const isExpired = diffDays <= 0;

  useEffect(() => {
    const fetchData = async () => {
        try {
            // Load payments regardless of expiry status so they can see history/make new ones
            const payData = await api.getPayments(user.id);
            setPayments(payData);
            const bankData = await api.getBankDetails();
            setBankDetails(bankData);

            if (!isExpired) {
                // Only load other data if not expired
                const [annData, colData] = await Promise.all([
                    api.getAnnouncements(),
                    api.getCollections(user.id)
                ]);
                setAnnouncements(annData);
                setCollections(colData);
            }
        } catch (e) {
            console.error("Failed to fetch dashboard data", e);
        }
    };
    fetchData();
  }, [user.id, isExpired]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleProfileImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingProfile(true);
    try {
        const url = await uploadToCloudinary(file);
        setFormData(prev => ({ ...prev, profileImage: url }));
        // Auto save profile image
        const updated = { ...displayUser, profileImage: url };
        await api.updateUser(updated);
        setDisplayUser(updated);
        if (onUpdateUser) onUpdateUser(updated);
    } catch (e) {
        alert("Failed to upload image");
    } finally {
        setIsUploadingProfile(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
        const updated = await api.updateUser(formData);
        setDisplayUser(updated);
        if (onUpdateUser) onUpdateUser(updated);
        setIsEditing(false);
        alert("Profile updated successfully");
    } catch (e) {
        alert("Failed to update profile");
    }
  };

  const handleCancelEdit = () => {
      setFormData(displayUser);
      setIsEditing(false);
  };

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setIsUploadingReceipt(true);
      try {
          const url = await uploadToCloudinary(file);
          setReceiptFileUrl(url);
      } catch(e) {
          alert("Upload failed");
      } finally {
          setIsUploadingReceipt(false);
      }
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!receiptFileUrl) {
          alert("Please upload a receipt/proof of payment");
          return;
      }
      setIsProcessingPayment(true);
      try {
          await api.createPayment({
              userId: user.id,
              amount: Number(paymentAmount),
              description: paymentDesc,
              date: new Date().toISOString().split('T')[0],
              status: 'Pending',
              receipt: receiptFileUrl
          });
          const updatedPayments = await api.getPayments(user.id);
          setPayments(updatedPayments);
          setShowPaymentModal(false);
          setPaymentAmount('');
          setPaymentDesc('');
          setReceiptFileUrl('');
          alert("Payment submitted for approval");
      } catch (e) {
          alert("Failed to submit payment");
      } finally {
          setIsProcessingPayment(false);
      }
  };

  const handleCollectionSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsProcessingPayment(true); // Reuse loading state
      try {
          await api.createCollection({
              userId: user.id,
              ...collectionForm,
              weight: Number(collectionForm.weight)
          });
          const updated = await api.getCollections(user.id);
          setCollections(updated);
          setShowCollectionModal(false);
          setCollectionForm({
             month: MONTHS[new Date().getMonth()],
             year: new Date().getFullYear().toString(),
             material: '',
             weight: '',
             images: []
          });
          alert("Collection logged successfully");
      } catch (e) {
          alert("Failed to log collection");
      } finally {
          setIsProcessingPayment(false);
      }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">My Dashboard</h1>
                <p className="text-gray-600">Welcome back, {displayUser.firstName}</p>
            </div>
            <div className="mt-4 md:mt-0 flex gap-3">
                 <div className={`px-4 py-2 rounded-full text-sm font-bold flex items-center ${
                     displayUser.status === 'Active' ? 'bg-green-100 text-green-800' :
                     displayUser.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                     'bg-red-100 text-red-800'
                 }`}>
                     {displayUser.status === 'Active' ? <Check className="h-4 w-4 mr-2" /> : <AlertTriangle className="h-4 w-4 mr-2" />}
                     Status: {displayUser.status}
                 </div>
                 {!isExpired && (
                    <button onClick={() => navigate('messages')} className="flex items-center bg-white border border-gray-300 px-4 py-2 rounded-md hover:bg-gray-50">
                        <MessageCircle className="h-4 w-4 mr-2 text-gray-600" /> Messages
                    </button>
                 )}
            </div>
        </div>

        {/* Renewal/Expired Notice */}
        {(isExpiringSoon || isExpired) && (
            <div className={`rounded-lg p-4 border-l-4 shadow-sm animate-in fade-in slide-in-from-top-2 ${isExpired ? 'bg-red-50 border-red-500' : 'bg-amber-50 border-amber-500'}`}>
                <div className="flex items-start">
                    <div className="flex-shrink-0">
                        <AlertTriangle className={`h-5 w-5 ${isExpired ? 'text-red-500' : 'text-amber-500'}`} aria-hidden="true" />
                    </div>
                    <div className="ml-3 flex-1 md:flex md:justify-between md:items-center">
                        <div>
                            <h3 className={`text-sm font-bold ${isExpired ? 'text-red-800' : 'text-amber-800'}`}>
                                {isExpired ? 'Membership Expired' : 'Membership Renewal Due'}
                            </h3>
                            <div className={`mt-1 text-sm ${isExpired ? 'text-red-700' : 'text-amber-700'}`}>
                                <p>
                                    {isExpired 
                                        ? `Your membership expired on ${displayUser.expiryDate}. Please renew immediately to retain full access.` 
                                        : `Your membership expires in ${diffDays} days (${displayUser.expiryDate}). Please renew to avoid interruption.`}
                                </p>
                            </div>
                        </div>
                        <div className="mt-4 md:mt-0 md:ml-6">
                            <button
                                onClick={() => setShowPaymentModal(true)}
                                className={`text-sm font-bold px-4 py-2 rounded-md shadow-sm transition-colors ${
                                    isExpired 
                                    ? 'bg-red-600 text-white hover:bg-red-700' 
                                    : 'bg-amber-500 text-white hover:bg-amber-600'
                                }`}
                            >
                                Renew Now
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {isExpired ? (
            /* Restricted View for Expired Members */
            <div className="max-w-3xl mx-auto">
                <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="font-bold text-gray-900 flex items-center">
                            <CreditCard className="h-5 w-5 mr-2 text-gray-600" /> Payments History & Renewal
                        </h2>
                        <button onClick={() => setShowPaymentModal(true)} className="text-xs text-green-600 hover:text-green-700 font-bold uppercase">
                            New Payment
                        </button>
                    </div>
                    
                    <div className="space-y-4">
                        {payments.length > 0 ? payments.map(pay => (
                            <div key={pay.id} className="flex justify-between items-center border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                                <div>
                                    <p className="text-sm font-medium text-gray-800">{pay.description}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <p className="text-xs text-gray-500">{pay.date}</p>
                                        {pay.receipt && (
                                            <a 
                                                href={pay.receipt}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-green-600 hover:underline flex items-center"
                                            >
                                                <Download className="h-3 w-3 mr-1" /> Receipt
                                            </a>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold text-gray-900">₦{pay.amount.toLocaleString()}</p>
                                    <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                                        pay.status === 'Successful' ? 'bg-green-100 text-green-700' : 
                                        pay.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                                    }`}>
                                        {pay.status}
                                    </span>
                                </div>
                            </div>
                        )) : (
                            <p className="text-sm text-gray-500 text-center py-4">No payment history.</p>
                        )}
                    </div>
                </div>
            </div>
        ) : (
            /* Active View */
            <>
                {/* Announcements */}
                {announcements.length > 0 && (
                    <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-amber-500">
                        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                            <Bell className="h-5 w-5 mr-2 text-amber-500" /> Announcements & News
                        </h2>
                        <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
                            {announcements.map(ann => (
                                <div key={ann.id} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                                    <div className="flex justify-between items-start">
                                        <h3 className="font-semibold text-gray-800 sticky top-0 bg-white z-10">{ann.title}</h3>
                                        {ann.isImportant && <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full shrink-0 ml-2">Important</span>}
                                    </div>
                                    <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">{ann.content}</p>
                                    <p className="text-xs text-gray-400 mt-1">{ann.date}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* Left Column - Profile */}
                    <div className="lg:col-span-2 space-y-8">
                        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                            <div className="bg-green-700 px-6 py-4 flex justify-between items-center">
                                <h2 className="text-white font-bold flex items-center">
                                    <UserIcon className="h-5 w-5 mr-2" /> Member Profile
                                </h2>
                                {!isEditing && (
                                    <button onClick={() => setIsEditing(true)} className="text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-500 transition-colors">
                                        Edit Profile
                                    </button>
                                )}
                            </div>
                            
                            <div className="p-6">
                                <div className="flex flex-col md:flex-row gap-6">
                                    <div className="flex flex-col items-center space-y-3">
                                        <div className="h-32 w-32 rounded-full overflow-hidden border-4 border-green-50 relative bg-gray-100">
                                            {isUploadingProfile ? (
                                                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75">
                                                    <Loader2 className="h-8 w-8 animate-spin text-green-600" />
                                                </div>
                                            ) : (
                                                <img 
                                                    src={formData.profileImage || "https://via.placeholder.com/150"} 
                                                    alt="Profile" 
                                                    className="h-full w-full object-cover"
                                                />
                                            )}
                                        </div>
                                        {isEditing && (
                                            <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-md text-sm flex items-center transition-colors">
                                                <Camera className="h-4 w-4 mr-2" /> Change Photo
                                                <input type="file" className="hidden" accept="image/*" onChange={handleProfileImageChange} />
                                            </label>
                                        )}
                                    </div>

                                    <div className="flex-1 space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-500 uppercase">First Name</label>
                                                <input 
                                                    type="text" 
                                                    name="firstName" 
                                                    value={formData.firstName} 
                                                    onChange={handleInputChange} 
                                                    disabled={!isEditing}
                                                    className="w-full mt-1 p-2 border rounded bg-gray-50 disabled:bg-white disabled:border-none disabled:p-0 disabled:text-gray-900 disabled:font-medium"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-500 uppercase">Last Name</label>
                                                <input 
                                                    type="text" 
                                                    name="lastName" 
                                                    value={formData.lastName} 
                                                    onChange={handleInputChange} 
                                                    disabled={!isEditing}
                                                    className="w-full mt-1 p-2 border rounded bg-gray-50 disabled:bg-white disabled:border-none disabled:p-0 disabled:text-gray-900 disabled:font-medium"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-500 uppercase">Business Name</label>
                                                <input 
                                                    type="text" 
                                                    name="businessName" 
                                                    value={formData.businessName} 
                                                    onChange={handleInputChange} 
                                                    disabled={!isEditing}
                                                    className="w-full mt-1 p-2 border rounded bg-gray-50 disabled:bg-white disabled:border-none disabled:p-0 disabled:text-gray-900 disabled:font-medium"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-500 uppercase">Phone</label>
                                                <input 
                                                    type="text" 
                                                    name="phone" 
                                                    value={formData.phone} 
                                                    onChange={handleInputChange} 
                                                    disabled={!isEditing}
                                                    className="w-full mt-1 p-2 border rounded bg-gray-50 disabled:bg-white disabled:border-none disabled:p-0 disabled:text-gray-900 disabled:font-medium"
                                                />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="block text-xs font-semibold text-gray-500 uppercase">Address</label>
                                                <input 
                                                    type="text" 
                                                    name="businessAddress" 
                                                    value={formData.businessAddress} 
                                                    onChange={handleInputChange} 
                                                    disabled={!isEditing}
                                                    className="w-full mt-1 p-2 border rounded bg-gray-50 disabled:bg-white disabled:border-none disabled:p-0 disabled:text-gray-900 disabled:font-medium"
                                                />
                                            </div>
                                        </div>

                                        {isEditing && (
                                            <div className="flex justify-end gap-3 pt-4 border-t">
                                                <button onClick={handleCancelEdit} className="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
                                                <button onClick={handleSaveProfile} className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700">Save Changes</button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Collections Section */}
                        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b flex justify-between items-center">
                                <h2 className="text-lg font-bold text-gray-900 flex items-center">
                                    <BarChart2 className="h-5 w-5 mr-2 text-green-600" /> Collection Log
                                </h2>
                                <button onClick={() => setShowCollectionModal(true)} className="text-sm bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 flex items-center">
                                    <Plus className="h-4 w-4 mr-1" /> Log Activity
                                </button>
                            </div>
                            <div className="p-0 overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Material</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Weight (KG)</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date Logged</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {collections.length > 0 ? collections.map(col => (
                                            <tr key={col.id}>
                                                <td className="px-6 py-4 text-sm text-gray-900">{col.month} {col.year}</td>
                                                <td className="px-6 py-4 text-sm text-gray-600">{col.material}</td>
                                                <td className="px-6 py-4 text-sm font-bold text-gray-900">{col.weight}</td>
                                                <td className="px-6 py-4 text-sm text-gray-500">{new Date(col.createdAt).toLocaleDateString()}</td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">No collection data logged yet.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Payments & Status */}
                    <div className="space-y-8">
                        {/* Membership Card */}
                        <div className="bg-gradient-to-br from-green-800 to-green-600 rounded-xl shadow-lg p-6 text-white">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <p className="text-green-100 text-sm">Membership ID</p>
                                    <p className="text-2xl font-mono font-bold tracking-wider">{displayUser.id}</p>
                                </div>
                                <Users className="h-8 w-8 text-green-200 opacity-50" />
                            </div>
                            <div className="space-y-2 mb-6">
                                <div className="flex justify-between text-sm">
                                    <span className="text-green-100">Category</span>
                                    <span className="font-semibold">{displayUser.category}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-green-100">Expiry</span>
                                    <span className="font-semibold">{displayUser.expiryDate}</span>
                                </div>
                            </div>
                            
                            <div className="space-y-2">
                                {displayUser.documents?.membershipIdCard ? (
                                    <a 
                                        href={displayUser.documents.membershipIdCard} 
                                        download="ID_Card"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full bg-white bg-opacity-20 hover:bg-opacity-30 text-white py-2 rounded text-sm font-medium flex items-center justify-center transition-colors"
                                    >
                                        <CreditCard className="h-4 w-4 mr-2" /> Download ID Card
                                    </a>
                                ) : (
                                    <div className="w-full bg-black bg-opacity-20 text-white py-2 rounded text-sm text-center italic">
                                        ID Card Pending
                                    </div>
                                )}

                                {displayUser.documents?.membershipCertificate ? (
                                    <a 
                                    href={displayUser.documents.membershipCertificate} 
                                    download="Certificate"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full bg-white bg-opacity-20 hover:bg-opacity-30 text-white py-2 rounded text-sm font-medium flex items-center justify-center transition-colors"
                                    >
                                        <FileText className="h-4 w-4 mr-2" /> Download Certificate
                                    </a>
                                ) : (
                                    <div className="w-full bg-black bg-opacity-20 text-white py-2 rounded text-sm text-center italic">
                                        Certificate Pending
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Payments */}
                        <div className="bg-white rounded-lg shadow-sm p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="font-bold text-gray-900 flex items-center">
                                    <CreditCard className="h-5 w-5 mr-2 text-gray-600" /> Payments
                                </h2>
                                <button onClick={() => setShowPaymentModal(true)} className="text-xs text-green-600 hover:text-green-700 font-bold uppercase">
                                    New Payment
                                </button>
                            </div>
                            
                            <div className="space-y-4">
                                {payments.length > 0 ? payments.slice(0, 3).map(pay => (
                                    <div key={pay.id} className="flex justify-between items-center border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                                        <div>
                                            <p className="text-sm font-medium text-gray-800">{pay.description}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <p className="text-xs text-gray-500">{pay.date}</p>
                                                {pay.receipt && (
                                                    <a 
                                                        href={pay.receipt}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-xs text-green-600 hover:underline flex items-center"
                                                    >
                                                        <Download className="h-3 w-3 mr-1" /> Receipt
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-bold text-gray-900">₦{pay.amount.toLocaleString()}</p>
                                            <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                                                pay.status === 'Successful' ? 'bg-green-100 text-green-700' : 
                                                pay.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                                            }`}>
                                                {pay.status}
                                            </span>
                                        </div>
                                    </div>
                                )) : (
                                    <p className="text-sm text-gray-500 text-center py-4">No payment history.</p>
                                )}
                                {payments.length > 3 && (
                                    <button className="w-full text-center text-xs text-gray-500 hover:text-green-600 mt-2">View All Transactions</button>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            </>
        )}

      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-gray-900">Record Payment</h3>
                    <button onClick={() => setShowPaymentModal(false)}><X className="h-5 w-5 text-gray-500" /></button>
                </div>
                
                {bankDetails && (
                    <div className="bg-gray-50 p-4 rounded mb-4 text-sm text-gray-700 border border-gray-200">
                        <p className="font-bold mb-1">Bank Transfer Details:</p>
                        <p>Bank: {bankDetails.bankName}</p>
                        <p>Account: {bankDetails.accountNumber}</p>
                        <p>Name: {bankDetails.accountName}</p>
                    </div>
                )}

                <form onSubmit={handleSubmitPayment} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Amount (NGN)</label>
                        <input type="number" required value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} className="w-full border rounded px-3 py-2 mt-1" placeholder="0.00" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Description</label>
                        <input type="text" required value={paymentDesc} onChange={e => setPaymentDesc(e.target.value)} className="w-full border rounded px-3 py-2 mt-1" placeholder="e.g. Annual Dues 2024" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Upload Receipt</label>
                        <div className="border-2 border-dashed border-gray-300 rounded-md p-4 text-center">
                            {isUploadingReceipt ? (
                                <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                            ) : receiptFileUrl ? (
                                <div className="flex items-center justify-center text-green-600">
                                    <Check className="h-5 w-5 mr-2" /> Receipt Attached
                                </div>
                            ) : (
                                <input type="file" accept="image/*,.pdf" onChange={handleReceiptUpload} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100" />
                            )}
                        </div>
                    </div>
                    <button type="submit" disabled={isProcessingPayment} className="w-full bg-green-600 text-white py-2 rounded font-bold hover:bg-green-700 disabled:opacity-50">
                        {isProcessingPayment ? 'Submitting...' : 'Submit Payment'}
                    </button>
                </form>
            </div>
        </div>
      )}

      {/* Collection Modal */}
      {showCollectionModal && !isExpired && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-gray-900">Log Collection Activity</h3>
                      <button onClick={() => setShowCollectionModal(false)}><X className="h-5 w-5 text-gray-500" /></button>
                  </div>
                  <form onSubmit={handleCollectionSubmit} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-sm font-medium text-gray-700">Month</label>
                              <select className="w-full border rounded px-3 py-2 mt-1" value={collectionForm.month} onChange={e => setCollectionForm({...collectionForm, month: e.target.value})}>
                                  {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                              </select>
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-gray-700">Year</label>
                              <select className="w-full border rounded px-3 py-2 mt-1" value={collectionForm.year} onChange={e => setCollectionForm({...collectionForm, year: e.target.value})}>
                                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                              </select>
                          </div>
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-gray-700">Material Type</label>
                          <select className="w-full border rounded px-3 py-2 mt-1" required value={collectionForm.material} onChange={e => setCollectionForm({...collectionForm, material: e.target.value})}>
                              <option value="">Select Material</option>
                              {LOG_MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
                              <option value="Other">Other</option>
                          </select>
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-gray-700">Weight (KG)</label>
                          <input type="number" step="0.01" required value={collectionForm.weight} onChange={e => setCollectionForm({...collectionForm, weight: e.target.value})} className="w-full border rounded px-3 py-2 mt-1" placeholder="0.00" />
                      </div>
                      <button type="submit" disabled={isProcessingPayment} className="w-full bg-green-600 text-white py-2 rounded font-bold hover:bg-green-700 disabled:opacity-50">
                          {isProcessingPayment ? 'Saving...' : 'Save Entry'}
                      </button>
                  </form>
              </div>
          </div>
      )}

    </div>
  );
};

export default UserDashboard;
