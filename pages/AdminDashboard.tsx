import React, { useState, useEffect } from 'react';
import { User, MembershipStatus, MembershipCategory, UserRole, Announcement, Payment } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Check, X, FileText, Search, Clock, Mail, Download, Filter, Bell, AlertCircle, Calendar, Loader2, Plus, Trash2, Megaphone, Edit, Save, Upload, FileCheck, CreditCard, Shield, ExternalLink } from 'lucide-react';
import { api } from '../services/api';

interface AdminDashboardProps {
  // In a real app, this would fetch data
}

const getRegion = (state: string) => {
  if (!state) return 'Other';
  const mapping: { [key: string]: string } = {
    'Lagos': 'South West', 'Ogun': 'South West', 'Oyo': 'South West', 'Osun': 'South West', 'Ondo': 'South West', 'Ekiti': 'South West',
    'Rivers': 'South South', 'Delta': 'South South', 'Edo': 'South South', 'Akwa Ibom': 'South South', 'Cross River': 'South South', 'Bayelsa': 'South South',
    'Abuja': 'North Central', 'FCT': 'North Central', 'Plateau': 'North Central', 'Benue': 'North Central', 'Kwara': 'North Central', 'Kogi': 'North Central', 'Nasarawa': 'North Central', 'Niger': 'North Central',
    'Kano': 'North West', 'Kaduna': 'North West', 'Katsina': 'North West', 'Kebbi': 'North West', 'Sokoto': 'North West', 'Zamfara': 'North West', 'Jigawa': 'North West',
    'Borno': 'North East', 'Adamawa': 'North East', 'Bauchi': 'North East', 'Gombe': 'North East', 'Taraba': 'North East', 'Yobe': 'North East',
    'Enugu': 'South East', 'Abia': 'South East', 'Anambra': 'South East', 'Ebonyi': 'South East', 'Imo': 'South East'
  };
  return mapping[state] || 'Other';
};

const AdminDashboard: React.FC<AdminDashboardProps> = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [reminderSent, setReminderSent] = useState(false);
  
  // Export Modal State
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportConfig, setExportConfig] = useState({
    state: '',
    region: '',
    category: '',
    machinery: '',
    format: 'Excel'
  });

  // Announcement Modal State
  const [showAnnounceModal, setShowAnnounceModal] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: '',
    content: '',
    isImportant: false,
    date: new Date().toISOString().split('T')[0]
  });

  // ID Assignment Modal State
  const [idEditModal, setIdEditModal] = useState<{ isOpen: boolean; userId: string; currentId: string; newId: string; name: string } | null>(null);

  // Expiry Date Edit Modal State
  const [expiryEditModal, setExpiryEditModal] = useState<{ isOpen: boolean; userId: string; currentExpiry: string; name: string } | null>(null);

  // Status Edit Modal State
  const [statusEditModal, setStatusEditModal] = useState<{ isOpen: boolean; userId: string; currentStatus: MembershipStatus; name: string } | null>(null);

  // Document Upload Modal State
  const [docModal, setDocModal] = useState<{ 
    isOpen: boolean; 
    userId: string; 
    name: string; 
    idCard?: string; 
    certificate?: string 
  } | null>(null);
  const [docFiles, setDocFiles] = useState<{ idCard?: string; certificate?: string }>({});

  // Payment Recording Modal State
  const [paymentModal, setPaymentModal] = useState<{
    isOpen: boolean;
    userId: string;
    name: string;
  } | null>(null);
  const [userPayments, setUserPayments] = useState<Payment[]>([]);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    status: 'Successful' as 'Successful' | 'Pending' | 'Failed',
    receipt: ''
  });
  const [showAddPaymentForm, setShowAddPaymentForm] = useState(false);

  const refreshData = async () => {
    try {
      const [usersData, announcementsData] = await Promise.all([
        api.getUsers(),
        api.getAnnouncements()
      ]);
      setUsers(usersData);
      setAnnouncements(announcementsData);
    } catch (error) {
      console.error('Failed to load data', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  // Derived Analytics Data
  const statusData = [
    { name: 'Active', value: users.filter(u => u.status === MembershipStatus.ACTIVE).length },
    { name: 'Pending', value: users.filter(u => u.status === MembershipStatus.PENDING).length },
    { name: 'Suspended', value: users.filter(u => u.status === MembershipStatus.SUSPENDED).length },
    { name: 'Expired', value: users.filter(u => u.status === MembershipStatus.EXPIRED).length },
  ];

  const categoryData = [
    { name: 'Corporate', value: users.filter(u => (u.category || '').toString().includes('Corporate')).length },
    { name: 'Patron', value: users.filter(u => (u.category || '').toString().includes('Patron')).length },
    { name: 'Associate', value: users.filter(u => (u.category || '').toString().includes('Associate')).length },
    { name: 'Other', value: users.filter(u => !(u.category || '').toString().includes('Corporate') && !(u.category || '').toString().includes('Patron') && !(u.category || '').toString().includes('Associate')).length },
  ];

  const COLORS = ['#16a34a', '#eab308', '#dc2626', '#4b5563'];

  const uniqueStates = Array.from(new Set(users.filter(u => u.role !== UserRole.ADMIN).map(u => u.businessState || 'Unknown'))) as string[];
  const uniqueRegions = Array.from(new Set(uniqueStates.map(s => getRegion(s))));
  const uniqueMachinery = Array.from(new Set(users.flatMap(u => u.machineryDeployed || []).filter((m): m is string => !!m)));

  const handleStatusChange = async (userId: string, newStatus: MembershipStatus) => {
    // Optimistic update
    const previousUsers = [...users];
    setUsers(users.map(u => u.id === userId ? { ...u, status: newStatus } : u));
    
    try {
      const userToUpdate = users.find(u => u.id === userId);
      if (userToUpdate) {
        await api.updateUser({ ...userToUpdate, status: newStatus });
      }
    } catch (error) {
       // Revert on fail
       setUsers(previousUsers);
       alert('Failed to update status');
    }
  };

  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createAnnouncement(newAnnouncement);
      setShowAnnounceModal(false);
      setNewAnnouncement({ title: '', content: '', isImportant: false, date: new Date().toISOString().split('T')[0] });
      await refreshData();
      alert('Announcement posted successfully!');
    } catch (err) {
      alert('Failed to post announcement');
    }
  };

  const handleDeleteAnnouncement = async (e: React.MouseEvent, id: string) => {
    // Stop event propagation to prevent any parent handlers from firing
    e.preventDefault();
    e.stopPropagation();

    if (window.confirm('Are you sure you want to delete this announcement?')) {
      // Optimistic Update
      const previousAnnouncements = [...announcements];
      setAnnouncements(prev => prev.filter(ann => ann.id !== id));

      try {
        await api.deleteAnnouncement(id);
        await refreshData(); // Force sync
      } catch (e) {
        console.error("Delete failed", e);
        alert("Failed to delete announcement.");
        setAnnouncements(previousAnnouncements);
      }
    }
  };

  const handleOpenIdModal = (user: User) => {
    setIdEditModal({
        isOpen: true,
        userId: user.id,
        currentId: user.id,
        newId: user.id,
        name: user.businessName
    });
  };

  const handleSaveId = async () => {
    if (!idEditModal) return;
    if (!idEditModal.newId.trim()) {
        alert("ID cannot be empty");
        return;
    }
    
    // UI check for existing ID before calling API to give instant feedback if possible
    const existingUser = users.find(u => u.id === idEditModal.newId && u.id !== idEditModal.currentId);
    if (existingUser) {
        alert(`User ID '${idEditModal.newId}' is already assigned to ${existingUser.businessName}.`);
        return;
    }

    try {
        await api.updateUserId(idEditModal.currentId, idEditModal.newId);
        setIdEditModal(null);
        await refreshData(); // Await to ensure UI updates after modal closes
        alert(`Successfully updated ID to ${idEditModal.newId}`);
    } catch (e: any) {
        alert(e.message || "Failed to update ID");
    }
  };

  const handleOpenExpiryModal = (user: User) => {
    setExpiryEditModal({
        isOpen: true,
        userId: user.id,
        currentExpiry: user.expiryDate,
        name: user.businessName
    });
  };

  const handleSaveExpiry = async () => {
    if (!expiryEditModal) return;
    if (!expiryEditModal.currentExpiry) {
        alert("Expiry date cannot be empty");
        return;
    }

    try {
        const userToUpdate = users.find(u => u.id === expiryEditModal.userId);
        if (!userToUpdate) throw new Error("User not found");

        const updatedUser = { ...userToUpdate, expiryDate: expiryEditModal.currentExpiry };
        await api.updateUser(updatedUser);
        
        setExpiryEditModal(null);
        await refreshData();
        alert(`Successfully updated expiry date for ${expiryEditModal.name}`);
    } catch (e: any) {
        alert(e.message || "Failed to update expiry date");
    }
  };

  const handleOpenStatusModal = (user: User) => {
    setStatusEditModal({
        isOpen: true,
        userId: user.id,
        currentStatus: user.status,
        name: user.businessName
    });
  };

  const handleSaveStatus = async () => {
    if (!statusEditModal) return;
    try {
        await handleStatusChange(statusEditModal.userId, statusEditModal.currentStatus);
        setStatusEditModal(null);
    } catch (e) {
        console.error("Failed to save status", e);
    }
  };

  const handleOpenDocModal = (user: User) => {
    setDocModal({
      isOpen: true,
      userId: user.id,
      name: user.businessName,
      idCard: user.documents?.membershipIdCard,
      certificate: user.documents?.membershipCertificate
    });
    setDocFiles({}); // Reset pending files
  };

  const handleDocFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'idCard' | 'certificate') => {
    const file = e.target.files?.[0];
    if (file) {
      // Check size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        alert("File is too large. Max 5MB allowed.");
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        // If it's an image, compress it to save storage space
        if (file.type.startsWith('image/')) {
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
                // Compress to JPEG at 0.7 quality
                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
                setDocFiles(prev => ({ ...prev, [type]: compressedBase64 }));
            };
            img.src = event.target?.result as string;
        } else {
            // Use original base64 for non-images (e.g. PDF)
            const base64 = event.target?.result as string;
            setDocFiles(prev => ({ ...prev, [type]: base64 }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveDocs = async () => {
    if (!docModal) return;
    
    try {
      const userToUpdate = users.find(u => u.id === docModal.userId);
      if (!userToUpdate) throw new Error("User not found");

      // Merge existing documents with new uploads
      const updatedDocuments = {
        ...userToUpdate.documents,
        ...(docFiles.idCard && { membershipIdCard: docFiles.idCard }),
        ...(docFiles.certificate && { membershipCertificate: docFiles.certificate }),
      };

      const updatedUser = { ...userToUpdate, documents: updatedDocuments };
      await api.updateUser(updatedUser);

      setDocModal(null);
      setDocFiles({});
      await refreshData();
      alert("Documents updated successfully");
    } catch (e: any) {
      alert(e.message || "Failed to save documents. Files might be too large.");
    }
  };

  // Payment Handlers
  const handleOpenPaymentModal = async (user: User) => {
    setPaymentModal({
      isOpen: true,
      userId: user.id,
      name: user.businessName
    });
    setShowAddPaymentForm(false);
    
    // Fetch payments
    try {
        const data = await api.getPayments(user.id);
        setUserPayments(data);
    } catch (e) {
        console.error("Failed to fetch payments");
        setUserPayments([]);
    }

    setPaymentForm({
        amount: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        status: 'Successful',
        receipt: ''
    });
  };

  const handlePaymentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB Limit
        alert("Receipt file is too large. Max 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
         setPaymentForm(prev => ({ ...prev, receipt: event.target?.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModal) return;

    try {
        await api.createPayment({
            userId: paymentModal.userId,
            amount: Number(paymentForm.amount),
            description: paymentForm.description,
            date: paymentForm.date,
            status: paymentForm.status,
            receipt: paymentForm.receipt
        });
        // Refresh local list
        const updated = await api.getPayments(paymentModal.userId);
        setUserPayments(updated);
        
        setShowAddPaymentForm(false);
        alert("Payment recorded successfully.");
    } catch (e: any) {
        alert(e.message || "Failed to record payment.");
    }
  };

  const handleApprovePayment = async (e: React.MouseEvent, paymentId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if(!paymentModal) return;
    try {
        await api.updatePaymentStatus(paymentId, 'Successful');
        // Refresh local list
        const updated = await api.getPayments(paymentModal.userId);
        setUserPayments(updated);
        alert("Payment approved!");
    } catch(e) {
        alert("Failed to approve payment.");
    }
  };

  const handleDeletePayment = async (e: React.MouseEvent, paymentId: string) => {
    e.preventDefault();
    e.stopPropagation();

    // Do NOT rely on modal state for verification logic to avoid state closure issues
    // Just confirm and delete
    if(!window.confirm("Are you sure you want to delete this payment record? This cannot be undone.")) {
        return;
    }

    // Optimistic Update
    const previousPayments = [...userPayments];
    setUserPayments(prev => prev.filter(p => p.id !== paymentId));

    try {
        await api.deletePayment(paymentId);
        
        // Ensure UI matches backend/storage
        if (paymentModal) {
            const updated = await api.getPayments(paymentModal.userId);
            setUserPayments(updated);
        }
    } catch(e) {
        console.error("Delete Error", e);
        alert("Failed to delete payment.");
        // Revert UI on error
        setUserPayments(previousPayments);
    }
  };

  // Improved Search Logic with safe access
  const filteredUsers = users.filter(u => {
    if (u.role === UserRole.ADMIN) return false;
    const searchTerm = filter.toLowerCase();
    const safeFirstName = (u.firstName || '').toLowerCase();
    const safeLastName = (u.lastName || '').toLowerCase();
    const safeBusiness = (u.businessName || '').toLowerCase();
    const safeCategory = (u.category || '').toString().toLowerCase();
    const safeState = (u.businessState || '').toLowerCase();
    const safeRegion = getRegion(u.businessState).toLowerCase();
    const safeMaterials = u.materialTypes || [];
    const safeId = (u.id || '').toLowerCase();

    return (
      safeFirstName.includes(searchTerm) || 
      safeLastName.includes(searchTerm) || 
      safeBusiness.includes(searchTerm) ||
      safeCategory.includes(searchTerm) ||
      safeState.includes(searchTerm) ||
      safeRegion.includes(searchTerm) ||
      safeMaterials.some(m => (m || '').toLowerCase().includes(searchTerm)) ||
      safeId.includes(searchTerm)
    );
  });

  // Expiration Logic (Check within 30 days)
  const today = new Date();
  const expiringUsers = users.filter(u => {
    if (u.role === UserRole.ADMIN || u.status === MembershipStatus.SUSPENDED) return false;
    if (!u.expiryDate) return false;
    const expiry = new Date(u.expiryDate);
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 30;
  });

  const triggerReminders = () => {
    setReminderSent(true);
    setTimeout(() => setReminderSent(false), 5000);
    alert(`System Message: Automated check initiated. ${expiringUsers.length} notifications queued for delivery via Email/SMS.`);
  };

  const handleExport = () => {
    const exportData = users.filter(u => {
      if(u.role === UserRole.ADMIN) return false;
      const matchState = exportConfig.state ? u.businessState === exportConfig.state : true;
      const matchRegion = exportConfig.region ? getRegion(u.businessState) === exportConfig.region : true;
      const matchCat = exportConfig.category ? u.category === exportConfig.category : true;
      const matchMach = exportConfig.machinery ? (u.machineryDeployed || []).includes(exportConfig.machinery) : true;
      return matchState && matchRegion && matchCat && matchMach;
    });

    if (exportConfig.format === 'Excel') {
        // Generate CSV
        const headers = ['Business Name', 'Member ID', 'Contact Name', 'Email', 'Phone', 'Category', 'State', 'Region', 'Status', 'Expiry Date', 'Volume (Tons)', 'Employees'];
        const csvContent = [
            headers.join(','),
            ...exportData.map(u => [
                `"${u.businessName}"`,
                `"${u.id}"`,
                `"${u.firstName} ${u.lastName}"`,
                u.email,
                `"${u.phone}"`,
                u.category,
                u.businessState,
                getRegion(u.businessState),
                u.status,
                u.expiryDate,
                u.monthlyVolume,
                u.employees
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `ran_members_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } else {
        // PDF (Print View)
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
                <html>
                <head>
                    <title>RAN Membership Report</title>
                    <style>
                        body { font-family: sans-serif; padding: 20px; }
                        h1 { color: #166534; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #f3f4f6; font-weight: bold; }
                        tr:nth-child(even) { background-color: #f9fafb; }
                    </style>
                </head>
                <body>
                    <h1>Recyclers Association of Nigeria - Membership Report</h1>
                    <p>Generated on: ${new Date().toLocaleDateString()}</p>
                    <p>Total Records: ${exportData.length}</p>
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Business Name</th>
                                <th>Contact</th>
                                <th>Email</th>
                                <th>Category</th>
                                <th>State</th>
                                <th>Expiry Date</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${exportData.map(u => `
                                <tr>
                                    <td>${u.id}</td>
                                    <td>${u.businessName}</td>
                                    <td>${u.firstName} ${u.lastName}</td>
                                    <td>${u.email}</td>
                                    <td>${u.category}</td>
                                    <td>${u.businessState}</td>
                                    <td>${u.expiryDate}</td>
                                    <td>${u.status}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <script>window.print();</script>
                </body>
                </html>
            `);
            printWindow.document.close();
        }
    }
    setShowExportModal(false);
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-10 w-10 text-green-600 animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8 relative">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header with Notification Count */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          
          <div className="mt-4 md:mt-0 flex items-center space-x-4">
             <div className="relative cursor-pointer bg-white p-2 rounded-full shadow-sm hover:shadow-md transition-shadow">
                <Bell className="h-6 w-6 text-gray-600" />
                {expiringUsers.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                    {expiringUsers.length}
                  </span>
                )}
             </div>
             <button 
               onClick={() => setShowAnnounceModal(true)}
               className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center shadow-sm"
             >
                <Megaphone className="h-4 w-4 mr-2" /> Make Announcement
             </button>
             <div className="text-sm text-gray-500 text-right hidden sm:block">
                <p>System Status: <span className="text-green-600 font-semibold">Online</span></p>
                <p className="text-xs">Last Check: {new Date().toLocaleTimeString()}</p>
             </div>
          </div>
        </div>

        {/* Analytics Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-lg font-bold text-gray-700 mb-4">Membership Status</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 text-sm mt-2">
              {statusData.map((entry, index) => (
                <div key={index} className="flex items-center">
                  <span className="w-3 h-3 rounded-full mr-1" style={{ backgroundColor: COLORS[index] }}></span>
                  {entry.name}: {entry.value}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-lg font-bold text-gray-700 mb-4">Member Categories</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData}>
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#15803d" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Announcements Section */}
        <div className="bg-white rounded-lg shadow-sm p-6">
           <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
             <Megaphone className="h-5 w-5 mr-2 text-green-600" /> Active Announcements
           </h2>
           <div className="space-y-3">
              {announcements.length === 0 ? (
                <p className="text-gray-500 text-sm">No active announcements.</p>
              ) : (
                announcements.map(ann => (
                  <div key={ann.id} className="flex justify-between items-start p-3 bg-gray-50 rounded border border-gray-100">
                    <div>
                      <h4 className="font-semibold text-gray-800 flex items-center">
                        {ann.title}
                        {ann.isImportant && <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded-full">Important</span>}
                      </h4>
                      <p className="text-sm text-gray-600 mt-1">{ann.content}</p>
                      <p className="text-xs text-gray-400 mt-1">Posted: {ann.date}</p>
                    </div>
                    <button 
                      type="button"
                      onClick={(e) => handleDeleteAnnouncement(e, ann.id)}
                      className="text-gray-400 hover:text-red-500 p-2 rounded hover:bg-gray-100 transition-colors"
                      title="Delete Announcement"
                    >
                      <Trash2 className="h-5 w-5 pointer-events-none" />
                    </button>
                  </div>
                ))
              )}
           </div>
        </div>

        {/* User Management Section */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
            <h2 className="text-xl font-bold text-gray-900">Member Management</h2>
            <div className="relative w-full md:w-96">
              <input
                type="text"
                placeholder="Search name, ID, business..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-md focus:ring-green-500 focus:border-green-500"
              />
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            </div>
            <button 
              onClick={() => setShowExportModal(true)}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center shrink-0 transition-colors"
            >
              <FileText className="h-4 w-4 mr-2" /> Export Data
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Business / Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Member ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Region</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className={user.status === MembershipStatus.EXPIRED ? 'bg-red-50' : ''}>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{user.businessName}</div>
                        <div className="text-sm text-gray-500">{user.firstName} {user.lastName}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 group relative">
                        <div className="flex items-center space-x-2">
                           <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">{user.id}</span>
                           <button onClick={() => handleOpenIdModal(user)} className="text-gray-400 hover:text-green-600" title="Edit ID">
                             <Edit className="h-4 w-4" />
                           </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.category}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className="block font-medium">{getRegion(user.businessState || '')}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center space-x-2">
                            <span className={user.status === MembershipStatus.EXPIRED ? 'text-red-600 font-bold' : ''}>{user.expiryDate}</span>
                            <button onClick={() => handleOpenExpiryModal(user)} className="text-gray-400 hover:text-green-600" title="Edit Expiry Date">
                                <Edit className="h-4 w-4" />
                            </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                              ${user.status === 'Active' ? 'bg-green-100 text-green-800' : 
                                user.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' : 
                                user.status === 'Expired' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                              {user.status}
                            </span>
                             <button onClick={() => handleOpenStatusModal(user)} className="text-gray-400 hover:text-blue-600" title="Change Status">
                                <Edit className="h-4 w-4" />
                             </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2 flex items-center">
                        <button
                          onClick={() => handleOpenDocModal(user)}
                          className="text-gray-500 hover:text-green-600 bg-gray-50 p-1.5 rounded"
                          title="Manage Documents (ID/Cert)"
                        >
                          <FileCheck className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleOpenPaymentModal(user)}
                          className="text-amber-500 hover:text-amber-600 bg-amber-50 p-1.5 rounded"
                          title="Manage Payments"
                        >
                          <CreditCard className="h-5 w-5" />
                        </button>
                        {user.status === MembershipStatus.PENDING && (
                          <button 
                            onClick={() => handleStatusChange(user.id, MembershipStatus.ACTIVE)}
                            className="text-green-600 hover:text-green-900 bg-green-50 p-1 rounded" title="Approve">
                            <Check className="h-5 w-5" />
                          </button>
                        )}
                        {user.status !== MembershipStatus.SUSPENDED && (
                          <button 
                            onClick={() => handleStatusChange(user.id, MembershipStatus.SUSPENDED)}
                            className="text-red-600 hover:text-red-900 bg-red-50 p-1 rounded" title="Suspend">
                            <X className="h-5 w-5" />
                          </button>
                        )}
                         {user.status === MembershipStatus.SUSPENDED && (
                          <button 
                            onClick={() => handleStatusChange(user.id, MembershipStatus.ACTIVE)}
                            className="text-blue-600 hover:text-blue-900 bg-blue-50 p-1 rounded" title="Reactivate">
                            <Check className="h-5 w-5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-gray-500">No members found matching your search.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900 flex items-center">
                <Download className="mr-2 h-5 w-5 text-green-600" /> Export Data
              </h2>
              <button onClick={() => setShowExportModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Region</label>
                <select 
                  className="w-full border rounded-md px-3 py-2"
                  value={exportConfig.region}
                  onChange={(e) => setExportConfig({...exportConfig, region: e.target.value})}
                >
                  <option value="">All Regions</option>
                  {uniqueRegions.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Filter by State</label>
                <select 
                  className="w-full border rounded-md px-3 py-2"
                  value={exportConfig.state}
                  onChange={(e) => setExportConfig({...exportConfig, state: e.target.value})}
                >
                  <option value="">All States</option>
                  {uniqueStates.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Membership Type</label>
                <select 
                  className="w-full border rounded-md px-3 py-2"
                  value={exportConfig.category}
                  onChange={(e) => setExportConfig({...exportConfig, category: e.target.value})}
                >
                  <option value="">All Categories</option>
                  {Object.values(MembershipCategory).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Machinery Deployed</label>
                <select 
                  className="w-full border rounded-md px-3 py-2"
                  value={exportConfig.machinery}
                  onChange={(e) => setExportConfig({...exportConfig, machinery: e.target.value})}
                >
                   <option value="">All Machinery</option>
                   {uniqueMachinery.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              <div className="pt-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Export Format</label>
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input 
                      type="radio" 
                      name="format" 
                      value="Excel" 
                      checked={exportConfig.format === 'Excel'}
                      onChange={() => setExportConfig({...exportConfig, format: 'Excel'})}
                      className="mr-2 text-green-600 focus:ring-green-500"
                    />
                    Excel (.csv)
                  </label>
                  <label className="flex items-center">
                    <input 
                      type="radio" 
                      name="format" 
                      value="PDF" 
                      checked={exportConfig.format === 'PDF'}
                      onChange={() => setExportConfig({...exportConfig, format: 'PDF'})}
                      className="mr-2 text-green-600 focus:ring-green-500"
                    />
                    PDF (Print)
                  </label>
                </div>
              </div>

              <div className="pt-4 flex justify-end space-x-3">
                <button 
                  onClick={() => setShowExportModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleExport}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center"
                >
                  <Download className="h-4 w-4 mr-2" /> Download Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Make Announcement Modal */}
      {showAnnounceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900 flex items-center">
                <Megaphone className="mr-2 h-5 w-5 text-amber-500" /> New Announcement
              </h2>
              <button onClick={() => setShowAnnounceModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <form onSubmit={handlePostAnnouncement} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input 
                  type="text" 
                  required
                  value={newAnnouncement.title}
                  onChange={(e) => setNewAnnouncement({...newAnnouncement, title: e.target.value})}
                  className="w-full border rounded-md px-3 py-2 focus:ring-amber-500 focus:border-amber-500"
                  placeholder="e.g. AGM 2024 Rescheduled"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                <textarea 
                  required
                  value={newAnnouncement.content}
                  onChange={(e) => setNewAnnouncement({...newAnnouncement, content: e.target.value})}
                  rows={4}
                  className="w-full border rounded-md px-3 py-2 focus:ring-amber-500 focus:border-amber-500"
                  placeholder="Enter details..."
                />
              </div>

              <div className="flex items-center">
                <input 
                  type="checkbox" 
                  id="isImportant"
                  checked={newAnnouncement.isImportant}
                  onChange={(e) => setNewAnnouncement({...newAnnouncement, isImportant: e.target.checked})}
                  className="h-4 w-4 text-amber-600 focus:ring-amber-500 border-gray-300 rounded"
                />
                <label htmlFor="isImportant" className="ml-2 block text-sm text-gray-900">
                  Mark as Important / Urgent
                </label>
              </div>

              <div className="pt-4 flex justify-end space-x-3">
                <button 
                  type="button"
                  onClick={() => setShowAnnounceModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-amber-500 text-white rounded-md hover:bg-amber-600 flex items-center"
                >
                   Post Announcement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit ID Modal */}
      {idEditModal && idEditModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Assign Member ID</h3>
            <p className="text-sm text-gray-500 mb-4">
                Updating ID for <span className="font-semibold">{idEditModal.name}</span>.
            </p>
            
            <div className="space-y-3">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">New ID</label>
                    <input 
                        type="text" 
                        value={idEditModal.newId}
                        onChange={(e) => setIdEditModal({...idEditModal, newId: e.target.value})}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-green-500 focus:border-green-500"
                    />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                    <button 
                        onClick={() => setIdEditModal(null)}
                        className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSaveId}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm flex items-center"
                    >
                        <Save className="h-4 w-4 mr-2" /> Save ID
                    </button>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Expiry Modal */}
      {expiryEditModal && expiryEditModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center mb-4 text-amber-600">
                <Calendar className="h-5 w-5 mr-2" />
                <h3 className="text-lg font-bold text-gray-900">Edit Expiry Date</h3>
            </div>
            
            <p className="text-sm text-gray-500 mb-4">
                Update membership expiry date for <span className="font-semibold">{expiryEditModal.name}</span>.
            </p>
            
            <div className="space-y-3">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">New Expiry Date</label>
                    <input 
                        type="date" 
                        value={expiryEditModal.currentExpiry}
                        onChange={(e) => setExpiryEditModal({...expiryEditModal, currentExpiry: e.target.value})}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-green-500 focus:border-green-500"
                    />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                    <button 
                        onClick={() => setExpiryEditModal(null)}
                        className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSaveExpiry}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm flex items-center"
                    >
                        <Save className="h-4 w-4 mr-2" /> Save Changes
                    </button>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Status Modal */}
      {statusEditModal && statusEditModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center mb-4 text-blue-600">
                <Shield className="h-5 w-5 mr-2" />
                <h3 className="text-lg font-bold text-gray-900">Edit Membership Status</h3>
            </div>
            
            <p className="text-sm text-gray-500 mb-4">
                Manually change status for <span className="font-semibold">{statusEditModal.name}</span>.
            </p>
            
            <div className="space-y-3">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select 
                        value={statusEditModal.currentStatus}
                        onChange={(e) => setStatusEditModal({...statusEditModal, currentStatus: e.target.value as MembershipStatus})}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-green-500 focus:border-green-500"
                    >
                        {Object.values(MembershipStatus).map((status) => (
                            <option key={status} value={status}>{status}</option>
                        ))}
                    </select>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                    <button 
                        onClick={() => setStatusEditModal(null)}
                        className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSaveStatus}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm flex items-center"
                    >
                        <Save className="h-4 w-4 mr-2" /> Save Status
                    </button>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* Document Upload Modal */}
      {docModal && docModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 animate-in fade-in zoom-in duration-200">
             <div className="flex justify-between items-center mb-6">
               <div>
                  <h2 className="text-xl font-bold text-gray-900 flex items-center">
                    <FileCheck className="mr-2 h-5 w-5 text-green-600" /> Member Documents
                  </h2>
                  <p className="text-sm text-gray-500">Manage ID Card & Certificate for {docModal.name}</p>
               </div>
               <button onClick={() => setDocModal(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-6 w-6" />
               </button>
             </div>

             <div className="space-y-6">
                {/* ID Card Section */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                   <div className="flex justify-between items-start mb-3">
                      <label className="block text-sm font-bold text-gray-800">Membership ID Card</label>
                      {docModal.idCard && (
                         <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Uploaded</span>
                      )}
                   </div>
                   <div className="flex items-center space-x-3">
                      <div className="flex-1">
                         <input 
                           type="file" 
                           onChange={(e) => handleDocFileChange(e, 'idCard')}
                           className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-600 file:text-white hover:file:bg-green-700"
                         />
                      </div>
                      {docModal.idCard && (
                        <a href={docModal.idCard} download="ID_Card" className="text-blue-600 hover:text-blue-800 text-xs underline shrink-0">
                           View Current
                        </a>
                      )}
                   </div>
                   {docFiles.idCard && <p className="text-xs text-amber-600 mt-2">New file selected (unsaved)</p>}
                </div>

                {/* Certificate Section */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                   <div className="flex justify-between items-start mb-3">
                      <label className="block text-sm font-bold text-gray-800">Membership Certificate</label>
                      {docModal.certificate && (
                         <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Uploaded</span>
                      )}
                   </div>
                   <div className="flex items-center space-x-3">
                      <div className="flex-1">
                         <input 
                           type="file" 
                           onChange={(e) => handleDocFileChange(e, 'certificate')}
                           className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-600 file:text-white hover:file:bg-green-700"
                         />
                      </div>
                      {docModal.certificate && (
                        <a href={docModal.certificate} download="Certificate" className="text-blue-600 hover:text-blue-800 text-xs underline shrink-0">
                           View Current
                        </a>
                      )}
                   </div>
                   {docFiles.certificate && <p className="text-xs text-amber-600 mt-2">New file selected (unsaved)</p>}
                </div>
             </div>

             <div className="pt-6 flex justify-end space-x-3 border-t border-gray-100 mt-4">
                <button 
                  onClick={() => setDocModal(null)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveDocs}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center"
                >
                  <Save className="h-4 w-4 mr-2" /> Save Documents
                </button>
             </div>
          </div>
        </div>
      )}

      {/* Payment Recording / Management Modal */}
      {paymentModal && paymentModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900 flex items-center">
                <CreditCard className="mr-2 h-5 w-5 text-amber-500" /> Manage Payments
              </h2>
              <button onClick={() => setPaymentModal(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <p className="text-sm text-gray-500 mb-4">
                Payments for: <span className="font-semibold">{paymentModal.name}</span>
            </p>

            {/* Payment List */}
            <div className="flex-1 overflow-y-auto mb-6 border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                        <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {userPayments.length > 0 ? userPayments.map(p => (
                            <tr key={p.id}>
                                <td className="px-3 py-2 text-sm text-gray-500">{p.date}</td>
                                <td className="px-3 py-2 text-sm font-medium">{p.amount.toLocaleString()}</td>
                                <td className="px-3 py-2">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                    ${p.status === 'Successful' ? 'bg-green-100 text-green-800' : 
                                        p.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                                    {p.status}
                                    </span>
                                </td>
                                <td className="px-3 py-2 text-sm space-x-2 flex items-center">
                                    {p.receipt && (
                                        <a href={p.receipt} download={`receipt_${p.reference}`} title="Download Receipt" className="text-blue-600 hover:text-blue-800 inline-block">
                                            <Download className="h-4 w-4" />
                                        </a>
                                    )}
                                    {p.status === 'Pending' && (
                                        <button 
                                            onClick={(e) => handleApprovePayment(e, p.id)}
                                            className="text-green-600 hover:text-green-900 font-medium text-xs border border-green-200 px-2 py-0.5 rounded bg-green-50"
                                        >
                                            Approve
                                        </button>
                                    )}
                                    <button 
                                        type="button"
                                        onClick={(e) => handleDeletePayment(e, p.id)}
                                        className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-2 rounded ml-2 border border-red-200"
                                        title="Delete Payment"
                                    >
                                        <Trash2 className="h-4 w-4 pointer-events-none" />
                                    </button>
                                </td>
                            </tr>
                        )) : (
                            <tr><td colSpan={4} className="text-center py-4 text-sm text-gray-500">No records found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {!showAddPaymentForm ? (
                <button 
                    onClick={() => setShowAddPaymentForm(true)}
                    className="w-full py-2 border-2 border-dashed border-gray-300 rounded-md text-gray-600 hover:border-green-500 hover:text-green-600 font-medium flex justify-center items-center"
                >
                    <Plus className="h-4 w-4 mr-2" /> Record New Payment Manually
                </button>
            ) : (
                <form onSubmit={handleSavePayment} className="space-y-4 border-t pt-4 bg-gray-50 p-4 rounded-md animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex justify-between items-center">
                        <h4 className="text-sm font-bold text-gray-700">New Payment Entry</h4>
                        <button type="button" onClick={() => setShowAddPaymentForm(false)} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
                            <input 
                            type="date" 
                            required
                            value={paymentForm.date}
                            onChange={(e) => setPaymentForm({...paymentForm, date: e.target.value})}
                            className="w-full border rounded-md px-2 py-1.5 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Amount</label>
                            <input 
                            type="number" 
                            required
                            value={paymentForm.amount}
                            onChange={(e) => setPaymentForm({...paymentForm, amount: e.target.value})}
                            className="w-full border rounded-md px-2 py-1.5 text-sm"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                        <input 
                        type="text" 
                        required
                        placeholder="e.g. Annual Dues 2024"
                        value={paymentForm.description}
                        onChange={(e) => setPaymentForm({...paymentForm, description: e.target.value})}
                        className="w-full border rounded-md px-2 py-1.5 text-sm"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                            <select 
                            value={paymentForm.status}
                            onChange={(e) => setPaymentForm({...paymentForm, status: e.target.value as any})}
                            className="w-full border rounded-md px-2 py-1.5 text-sm"
                            >
                                <option value="Successful">Successful</option>
                                <option value="Pending">Pending</option>
                                <option value="Failed">Failed</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Receipt</label>
                            <input 
                            type="file" 
                            accept="image/*,application/pdf"
                            onChange={handlePaymentFileChange}
                            className="block w-full text-xs text-gray-500"
                            />
                        </div>
                    </div>

                    <div className="pt-2 flex justify-end">
                        <button 
                        type="submit"
                        className="px-4 py-2 bg-amber-500 text-white rounded-md hover:bg-amber-600 flex items-center text-sm"
                        >
                        Save Payment
                        </button>
                    </div>
                </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminDashboard;