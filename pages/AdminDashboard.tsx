import React, { useState, useEffect } from 'react';
import { User, MembershipStatus, MembershipCategory, UserRole, Announcement, Payment } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Check, X, FileText, Search, Clock, Mail, Download, Filter, Bell, AlertCircle, Calendar, Loader2, Plus, Trash2, Megaphone, Edit, Save, Upload, FileCheck, CreditCard, Shield, ExternalLink, RefreshCw, User as UserIcon, Image as ImageIcon, File } from 'lucide-react';
import { api } from '../services/api';

interface AdminDashboardProps {
  // In a real app, this would fetch data
}

// ... (getRegion function remains unchanged) ...
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
  // ... (State and useEffects remain unchanged) ...
  const [users, setUsers] = useState<User[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [pendingPayments, setPendingPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [reminderSent, setReminderSent] = useState(false);
  
  // Modal States
  const [showExportModal, setShowExportModal] = useState(false);
  const [showAnnounceModal, setShowAnnounceModal] = useState(false);
  const [showPendingPaymentModal, setShowPendingPaymentModal] = useState(false);

  // Export Config
  const [exportConfig, setExportConfig] = useState({
    state: '',
    region: '',
    category: '',
    machinery: '',
    format: 'Excel'
  });

  // Announcement Config
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: '',
    content: '',
    isImportant: false,
    date: new Date().toISOString().split('T')[0]
  });

  // Edit Modals
  const [idEditModal, setIdEditModal] = useState<{ isOpen: boolean; userId: string; currentId: string; newId: string; name: string } | null>(null);
  const [expiryEditModal, setExpiryEditModal] = useState<{ isOpen: boolean; userId: string; currentExpiry: string; name: string } | null>(null);
  const [statusEditModal, setStatusEditModal] = useState<{ isOpen: boolean; userId: string; currentStatus: MembershipStatus; name: string } | null>(null);
  const [docModal, setDocModal] = useState<{ 
    isOpen: boolean; 
    userId: string; 
    name: string;
    // User Uploads
    profileImage?: string;
    cac?: string;
    logo?: string;
    evidence?: string;
    // Issued Docs
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
      const [usersData, announcementsData, allPayments] = await Promise.all([
        api.getUsers(),
        api.getAnnouncements(),
        api.getAllPayments()
      ]);
      setUsers(usersData);
      setAnnouncements(announcementsData);
      setPendingPayments(allPayments.filter(p => p.status === 'Pending'));
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
    e.preventDefault();
    e.stopPropagation();

    if (window.confirm('Are you sure you want to delete this announcement?')) {
      const previousAnnouncements = [...announcements];
      setAnnouncements(prev => prev.filter(ann => ann.id !== id));

      try {
        await api.deleteAnnouncement(id);
        await refreshData();
      } catch (e) {
        console.error("Delete failed", e);
        alert("Failed to delete announcement.");
        setAnnouncements(previousAnnouncements);
      }
    }
  };

  const handleGlobalApprovePayment = async (e: React.MouseEvent, paymentId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if(!window.confirm("Confirm approval of this payment?")) return;
    
    try {
        await api.updatePaymentStatus(paymentId, 'Successful');
        // Optimistic update
        setPendingPayments(prev => prev.filter(p => p.id !== paymentId));
        // Refresh full data
        const allPayments = await api.getAllPayments();
        setPendingPayments(allPayments.filter(p => p.status === 'Pending'));
        alert("Payment approved successfully.");
    } catch(e) {
        console.error(e);
        alert("Failed to approve payment.");
    }
  };

  const handleGlobalRejectPayment = async (e: React.MouseEvent, paymentId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if(!window.confirm("Are you sure you want to reject (delete) this payment record?")) return;
    
    try {
        await api.deletePayment(paymentId);
         // Optimistic update
        setPendingPayments(prev => prev.filter(p => p.id !== paymentId));
        // Refresh full data
        const allPayments = await api.getAllPayments();
        setPendingPayments(allPayments.filter(p => p.status === 'Pending'));
        alert("Payment rejected and removed.");
    } catch(e) {
        console.error(e);
        alert("Failed to reject payment.");
    }
  };

  const getUserName = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user ? `${user.businessName} (${user.firstName})` : 'Unknown User';
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
    
    const existingUser = users.find(u => u.id === idEditModal.newId && u.id !== idEditModal.currentId);
    if (existingUser) {
        alert(`User ID '${idEditModal.newId}' is already assigned to ${existingUser.businessName}.`);
        return;
    }

    try {
        await api.updateUserId(idEditModal.currentId, idEditModal.newId);
        setIdEditModal(null);
        await refreshData();
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
      // Load user uploads
      profileImage: user.profileImage,
      cac: user.documents?.cac,
      logo: user.documents?.logo,
      evidence: user.documents?.evidence,
      // Load issued docs
      idCard: user.documents?.membershipIdCard,
      certificate: user.documents?.membershipCertificate
    });
    setDocFiles({}); 
  };

  const handleDocFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'idCard' | 'certificate') => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("File is too large. Max 5MB allowed.");
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
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
                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.5); // 0.5 for safe storage
                setDocFiles(prev => ({ ...prev, [type]: compressedBase64 }));
            };
            img.src = event.target?.result as string;
        } else {
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

  const handleOpenPaymentModal = async (user: User) => {
    setPaymentModal({
      isOpen: true,
      userId: user.id,
      name: user.businessName
    });
    setShowAddPaymentForm(false);
    
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
      if (file.size > 2 * 1024 * 1024) { 
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
              setPaymentForm(prev => ({ ...prev, receipt: canvas.toDataURL('image/jpeg', 0.5) }));
            };
            img.src = event.target?.result as string;
          };
          reader.readAsDataURL(file);
      } else {
          const reader = new FileReader();
          reader.onload = (event) => {
             setPaymentForm(prev => ({ ...prev, receipt: event.target?.result as string }));
          };
          reader.readAsDataURL(file);
      }
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

    if(!window.confirm("Are you sure you want to delete this payment record? This cannot be undone.")) {
        return;
    }

    const previousPayments = [...userPayments];
    setUserPayments(prev => prev.filter(p => p.id !== paymentId));

    try {
        await api.deletePayment(paymentId);
        if (paymentModal) {
            const updated = await api.getPayments(paymentModal.userId);
            setUserPayments(updated);
        }
    } catch(e) {
        console.error("Delete Error", e);
        alert("Failed to delete payment.");
        setUserPayments(previousPayments);
    }
  };

  // ... (Filtering and Rendering logic unchanged) ...
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

  const today = new Date();
  const expiringUsers = users.filter(u => {
    if (u.role === UserRole.ADMIN || u.status === MembershipStatus.SUSPENDED) return false;
    if (!u.expiryDate) return false;
    const expiry = new Date(u.expiryDate);
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 30;
  });

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
        const headers = [
            'ID', 'Business Name', 'Category', 'Status', 'Expiry Date',
            'First Name', 'Last Name', 'Gender', 'Email', 'Phone', 'DOB',
            'Address', 'City', 'State', 'Region', 'Other States',
            'Commencement Date', 'Monthly Volume (Tons)', 'Employees',
            'Materials', 'Machinery',
            'Interests', 'Related Association'
        ];
        
        const csvContent = [
            headers.join(','),
            ...exportData.map(u => {
                 const safeUser = u as any; 
                 return [
                    `"${safeUser.id}"`,
                    `"${safeUser.businessName}"`,
                    `"${safeUser.category}"`,
                    `"${safeUser.status}"`,
                    `"${safeUser.expiryDate}"`,
                    `"${safeUser.firstName}"`,
                    `"${safeUser.lastName}"`,
                    `"${safeUser.gender || ''}"`,
                    `"${safeUser.email}"`,
                    `"${safeUser.phone}"`,
                    `"${safeUser.dob || ''}"`,
                    `"${safeUser.businessAddress}"`,
                    `"${safeUser.businessCity || ''}"`,
                    `"${safeUser.businessState}"`,
                    `"${getRegion(safeUser.businessState)}"`,
                    `"${safeUser.statesOfOperation || ''}"`,
                    `"${safeUser.businessCommencement || ''}"`,
                    `"${safeUser.monthlyVolume}"`,
                    `"${safeUser.employees}"`,
                    `"${(safeUser.materialTypes || []).join(' | ')}"`,
                    `"${(safeUser.machineryDeployed || []).join(' | ')}"`,
                    `"${(safeUser.areasOfInterest || []).join(' | ')}"`,
                    `"${safeUser.relatedAssociation === 'Yes' ? safeUser.relatedAssociationName : 'No'}"`
                ].join(',');
            })
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `ran_members_full_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } else {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
                <html>
                <head>
                    <title>RAN Member Profiles</title>
                    <style>
                        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; background: #f9f9f9; }
                        .member-card { background: white; border: 1px solid #ddd; margin-bottom: 40px; padding: 30px; border-radius: 8px; page-break-inside: avoid; }
                        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #16a34a; padding-bottom: 15px; margin-bottom: 20px; }
                        .header h1 { margin: 0; color: #166534; font-size: 24px; }
                        .header .meta { text-align: right; font-size: 12px; color: #666; }
                        .profile-header { display: flex; gap: 20px; margin-bottom: 20px; align-items: start; }
                        .profile-img { width: 120px; height: 120px; object-fit: cover; border-radius: 50%; border: 4px solid #f0fdf4; box-shadow: 0 2px 4px rgba(0,0,0,0.1); background: #eee; }
                        .logo-img { width: 100px; height: 100px; object-fit: contain; margin-left: auto; border: 1px solid #eee; padding: 5px; }
                        .section-title { font-weight: bold; color: #15803d; border-bottom: 1px solid #eee; margin-top: 20px; margin-bottom: 10px; padding-bottom: 5px; font-size: 14px; text-transform: uppercase; }
                        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px; }
                        .field { margin-bottom: 5px; }
                        .label { font-weight: bold; color: #555; display: block; font-size: 11px; }
                        .value { color: #000; }
                        .status-active { color: green; font-weight: bold; }
                        .status-expired { color: red; font-weight: bold; }
                        .doc-badge { display: inline-block; background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-right: 5px; border: 1px solid #bae6fd; }
                    </style>
                </head>
                <body>
                    <div style="text-align:center; margin-bottom: 40px;">
                        <h1 style="color:#166534;">Recyclers Association of Nigeria</h1>
                        <p>Membership Database Export - Generated: ${new Date().toLocaleDateString()}</p>
                    </div>

                    ${exportData.map(u => {
                        const safeUser = u as any;
                        return `
                        <div class="member-card">
                            <div class="header">
                                <div>
                                    <h1>${safeUser.businessName}</h1>
                                    <div style="font-size:14px; color:#555;">${safeUser.category}</div>
                                </div>
                                <div class="meta">
                                    ID: <strong>${safeUser.id}</strong><br/>
                                    Status: <span class="${safeUser.status === 'Active' ? 'status-active' : 'status-expired'}">${safeUser.status}</span><br/>
                                    Expires: ${safeUser.expiryDate}
                                </div>
                            </div>

                            <div class="profile-header">
                                ${safeUser.profileImage ? `<img src="${safeUser.profileImage}" class="profile-img" />` : '<div class="profile-img" style="display:flex;align-items:center;justify-content:center;color:#999;">No Photo</div>'}
                                <div style="flex:1; padding-left: 10px;">
                                    <div class="grid">
                                        <div class="field"><span class="label">Contact Name</span><span class="value">${safeUser.firstName} ${safeUser.lastName}</span></div>
                                        <div class="field"><span class="label">Gender</span><span class="value">${safeUser.gender || 'N/A'}</span></div>
                                        <div class="field"><span class="label">Email</span><span class="value">${safeUser.email}</span></div>
                                        <div class="field"><span class="label">Phone</span><span class="value">${safeUser.phone}</span></div>
                                        <div class="field"><span class="label">Date of Birth</span><span class="value">${safeUser.dob || 'N/A'}</span></div>
                                    </div>
                                </div>
                                ${safeUser.documents?.logo ? `<img src="${safeUser.documents.logo}" class="logo-img" />` : ''}
                            </div>

                            <div class="section-title">Business Information</div>
                            <div class="grid">
                                <div class="field"><span class="label">Address</span><span class="value">${safeUser.businessAddress}, ${safeUser.businessCity || ''}</span></div>
                                <div class="field"><span class="label">State / Region</span><span class="value">${safeUser.businessState} (${getRegion(safeUser.businessState)})</span></div>
                                <div class="field"><span class="label">Date Commenced</span><span class="value">${safeUser.businessCommencement || 'N/A'}</span></div>
                                <div class="field"><span class="label">Other States</span><span class="value">${safeUser.statesOfOperation || 'None'}</span></div>
                            </div>

                            <div class="section-title">Operational Data</div>
                            <div class="grid">
                                <div class="field"><span class="label">Materials</span><span class="value">${(safeUser.materialTypes || []).join(', ')}</span></div>
                                <div class="field"><span class="label">Machinery</span><span class="value">${(safeUser.machineryDeployed || []).join(', ')}</span></div>
                                <div class="field"><span class="label">Monthly Volume</span><span class="value">${safeUser.monthlyVolume} Tons</span></div>
                                <div class="field"><span class="label">Employees</span><span class="value">${safeUser.employees}</span></div>
                            </div>
                            
                            <div class="section-title">Other Details</div>
                            <div class="grid">
                                <div class="field"><span class="label">Areas of Interest</span><span class="value">${(safeUser.areasOfInterest || []).join(', ')}</span></div>
                                <div class="field"><span class="label">Related Association</span><span class="value">${safeUser.relatedAssociation === 'Yes' ? safeUser.relatedAssociationName : 'No'}</span></div>
                                <div class="field">
                                    <span class="label">Uploaded Documents</span>
                                    <div style="margin-top:2px;">
                                        ${safeUser.documents?.cac ? '<span class="doc-badge">CAC Cert</span>' : ''}
                                        ${safeUser.documents?.evidence ? '<span class="doc-badge">Evidence</span>' : ''}
                                        ${safeUser.documents?.membershipIdCard ? '<span class="doc-badge">ID Card</span>' : ''}
                                        ${safeUser.documents?.membershipCertificate ? '<span class="doc-badge">RAN Cert</span>' : ''}
                                        ${(!safeUser.documents?.cac && !safeUser.documents?.evidence) ? '<span style="color:#999;font-style:italic;">None</span>' : ''}
                                    </div>
                                </div>
                            </div>
                        </div>
                        `
                    }).join('')}

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
          
          <div className="mt-4 md:mt-0 flex flex-wrap items-center gap-3">
             <div className="relative cursor-pointer bg-white p-2 rounded-full shadow-sm hover:shadow-md transition-shadow" title="Expiring Members">
                <Bell className="h-6 w-6 text-gray-600" />
                {expiringUsers.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                    {expiringUsers.length}
                  </span>
                )}
             </div>

             <button 
                onClick={() => setShowPendingPaymentModal(true)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md font-medium text-sm shadow-sm transition-all ${
                   pendingPayments.length > 0 
                   ? 'bg-red-600 text-white hover:bg-red-700 animate-pulse' 
                   : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                }`}
             >
                <CreditCard className="h-4 w-4" />
                <span>Payment Requests</span>
                {pendingPayments.length > 0 && (
                   <span className="bg-white text-red-600 px-1.5 py-0.5 rounded-full text-xs font-bold">{pendingPayments.length}</span>
                )}
             </button>

             <button 
               onClick={() => setShowAnnounceModal(true)}
               className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center shadow-sm"
             >
                <Megaphone className="h-4 w-4 mr-2" /> Make Announcement
             </button>
          </div>
        </div>

        {/* ... (Rest of dashboard components) ... */}
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

      {/* Pending Payments Modal */}
      {showPendingPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full p-6 animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
             <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 flex items-center">
                    <CreditCard className="mr-2 h-5 w-5 text-red-600" /> Pending Payment Requests
                  </h2>
                  <p className="text-sm text-gray-500">Review receipts and approve membership payments.</p>
                </div>
                <button onClick={() => setShowPendingPaymentModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-6 w-6" />
                </button>
             </div>

             <div className="flex-1 overflow-y-auto mb-6 border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                   <thead className="bg-gray-50 sticky top-0">
                      <tr>
                         <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                         <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Member</th>
                         <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                         <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                         <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Receipt</th>
                         <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                   </thead>
                   <tbody className="bg-white divide-y divide-gray-200">
                      {pendingPayments.length > 0 ? pendingPayments.map(p => (
                         <tr key={p.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-600">{p.date}</td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{getUserName(p.userId)}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{p.description}</td>
                            <td className="px-4 py-3 text-sm font-bold text-green-700">{p.amount.toLocaleString()}</td>
                            <td className="px-4 py-3 text-sm">
                               {p.receipt ? (
                                  <a 
                                    href={p.receipt} 
                                    download={`receipt_${p.reference}`} 
                                    className="text-blue-600 hover:underline flex items-center text-xs"
                                  >
                                    <Download className="h-3 w-3 mr-1" /> View/Download
                                  </a>
                               ) : (
                                  <span className="text-red-400 text-xs italic">No receipt</span>
                               )}
                            </td>
                            <td className="px-4 py-3 text-sm space-x-2">
                               <button 
                                 onClick={(e) => handleGlobalApprovePayment(e, p.id)}
                                 className="bg-green-100 text-green-700 hover:bg-green-200 px-2 py-1 rounded text-xs font-semibold border border-green-200"
                               >
                                  Approve
                               </button>
                               <button 
                                 onClick={(e) => handleGlobalRejectPayment(e, p.id)}
                                 className="bg-red-50 text-red-600 hover:bg-red-100 px-2 py-1 rounded text-xs font-semibold border border-red-200"
                               >
                                  Reject
                               </button>
                            </td>
                         </tr>
                      )) : (
                         <tr><td colSpan={6} className="text-center py-8 text-gray-500">No pending payment requests.</td></tr>
                      )}
                   </tbody>
                </table>
             </div>
             
             <div className="flex justify-end">
                <button onClick={() => setShowPendingPaymentModal(false)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded hover:bg-gray-200">Close</button>
             </div>
           </div>
        </div>
      )}

      {/* Export Modal, Announcement Modal, Edit Modals ... (Rest remains unchanged) */}
      {/* ... */}
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
                    PDF (Print Detailed)
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
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 animate-in fade-in zoom-in duration-200 overflow-y-auto max-h-[90vh]">
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
                
                {/* User Submissions Section */}
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <h3 className="font-bold text-blue-800 mb-3 text-sm uppercase flex items-center">
                        <UserIcon className="h-4 w-4 mr-1"/> Registration Submissions
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        {/* Profile Image */}
                        <div className="bg-white p-3 rounded border border-blue-100 flex flex-col items-center">
                            <span className="text-xs font-semibold text-gray-500 mb-2">Profile Image</span>
                            {docModal.profileImage ? (
                                <>
                                    <img src={docModal.profileImage} alt="Profile" className="h-20 w-20 object-cover rounded-full mb-2 border border-gray-200"/>
                                    <a href={docModal.profileImage} download="Profile_Image" className="text-xs text-blue-600 hover:underline flex items-center"><Download className="h-3 w-3 mr-1"/> Download</a>
                                </>
                            ) : <span className="text-xs text-gray-400 italic py-4">Not Uploaded</span>}
                        </div>

                        {/* Business Logo */}
                        <div className="bg-white p-3 rounded border border-blue-100 flex flex-col items-center">
                            <span className="text-xs font-semibold text-gray-500 mb-2">Business Logo</span>
                            {docModal.logo ? (
                                <>
                                    <img src={docModal.logo} alt="Logo" className="h-20 w-20 object-contain mb-2"/>
                                    <a href={docModal.logo} download="Business_Logo" className="text-xs text-blue-600 hover:underline flex items-center"><Download className="h-3 w-3 mr-1"/> Download</a>
                                </>
                            ) : <span className="text-xs text-gray-400 italic py-4">Not Uploaded</span>}
                        </div>

                        {/* CAC Cert */}
                        <div className="bg-white p-3 rounded border border-blue-100 flex flex-col items-center justify-center text-center">
                            <span className="text-xs font-semibold text-gray-500 mb-2">CAC Certificate</span>
                            {docModal.cac ? (
                                <a href={docModal.cac} download="CAC_Certificate" className="flex flex-col items-center text-blue-600 hover:text-blue-800">
                                    <FileText className="h-8 w-8 mb-1"/>
                                    <span className="text-xs hover:underline">Download File</span>
                                </a>
                            ) : <span className="text-xs text-gray-400 italic py-4">Not Uploaded</span>}
                        </div>

                        {/* Evidence */}
                        <div className="bg-white p-3 rounded border border-blue-100 flex flex-col items-center justify-center text-center">
                            <span className="text-xs font-semibold text-gray-500 mb-2">Business Evidence</span>
                            {docModal.evidence ? (
                                <a href={docModal.evidence} download="Business_Evidence" className="flex flex-col items-center text-blue-600 hover:text-blue-800">
                                    <ImageIcon className="h-8 w-8 mb-1"/>
                                    <span className="text-xs hover:underline">Download File</span>
                                </a>
                            ) : <span className="text-xs text-gray-400 italic py-4">Not Uploaded</span>}
                        </div>
                    </div>
                </div>

                <div className="border-t border-gray-200 my-4"></div>

                <h3 className="font-bold text-gray-800 mb-1 text-sm uppercase">Issue Documents</h3>

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