import React, { useState, useEffect } from 'react';
import { User, MembershipStatus, Announcement, Payment, BankDetails, Collection, MaterialPrice, ProcessedMaterial, StockpileEntry, Expense, EXPENSE_CATEGORIES } from '../types';
import { api } from '../services/api';
import { uploadToCloudinary } from '../services/cloudinary';
import { renderAnnouncementHtml } from '../utils/sanitizeHtml';
import { CreditCard, Download, User as UserIcon, Bell, AlertTriangle, Users, Camera, X, Check, Loader2, Clock, UploadCloud, MessageCircle, BarChart2, Plus, FileText, Trash2, Leaf, Factory, Archive, AlertCircle, Calculator, TrendingUp, TrendingDown, Wallet, Receipt, PieChart, ArrowDownCircle, ArrowUpCircle, Pencil } from 'lucide-react';

interface UserDashboardProps {
  user: User;
  navigate: (page: string, params?: any) => void;
  onUpdateUser?: (user: User) => void;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const YEARS = [new Date().getFullYear(), new Date().getFullYear() - 1];

const LOG_MATERIALS = [
  'PET Plastics',
  'HDPE',
  'PVC',
  'PP',
  'PS',
  'Other Plastics',
  'Paper/Cartons',
  'UBC',
  'Aluminium',
  'Copper',
  'Metals',
  'Glass',
  'E-waste',
  'Nylon'
];

const UserDashboard: React.FC<UserDashboardProps> = ({ user, navigate, onUpdateUser }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [displayUser, setDisplayUser] = useState<User>(user);
  const [formData, setFormData] = useState<User>(user);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [processed, setProcessed] = useState<ProcessedMaterial[]>([]);
  const [stockpile, setStockpile] = useState<StockpileEntry[]>([]);
  const [prices, setPrices] = useState<MaterialPrice[]>([]);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDesc, setPaymentDesc] = useState('');
  const [receiptFileUrl, setReceiptFileUrl] = useState<string>('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const [isUploadingProfile, setIsUploadingProfile] = useState(false);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);

  // Collections
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null);
  const [collectionForm, setCollectionForm] = useState({
      month: MONTHS[new Date().getMonth()],
      year: new Date().getFullYear().toString(),
      material: '',
      weight: '',
      totalCost: '',
      supplier: '',
      images: [] as string[]
  });

  // Processed Materials
  const [showProcessedModal, setShowProcessedModal] = useState(false);
  const [editingProcessedId, setEditingProcessedId] = useState<string | null>(null);
  const [processedForm, setProcessedForm] = useState({
      month: MONTHS[new Date().getMonth()],
      year: new Date().getFullYear().toString(),
      material: '',
      weight: '',
      pricePerKg: '',
      buyer: '',
      weighbridgeImages: [] as string[]
  });
  const [isUploadingWeighbridge, setIsUploadingWeighbridge] = useState(false);
  const [isSavingProcessed, setIsSavingProcessed] = useState(false);

  // Active section toggle for logs (Collection / Processed)
  const [activeLogTab, setActiveLogTab] = useState<'collection' | 'processed' | 'stockpile'>('collection');

  // Top-level dashboard section
  const [activeSection, setActiveSection] = useState<'overview' | 'financials'>('overview');

  // Financials state
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [activeFinanceTab, setActiveFinanceTab] = useState<'pnl' | 'balance' | 'cashflow' | 'expenses'>('pnl');
  const [financeYear, setFinanceYear] = useState<string>('all');
  const [financeMonth, setFinanceMonth] = useState<string>('all');
  const [financeMaterial, setFinanceMaterial] = useState<string>('all');
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    month: MONTHS[new Date().getMonth()],
    year: new Date().getFullYear().toString(),
    category: EXPENSE_CATEGORIES[0] as string,
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    receipt: ''
  });
  const [isSavingExpense, setIsSavingExpense] = useState(false);
  const [isUploadingExpenseReceipt, setIsUploadingExpenseReceipt] = useState(false);
  const [openingCashBalance, setOpeningCashBalance] = useState<string>(
    user.openingCashBalance != null ? String(user.openingCashBalance) : '0'
  );
  const [isSavingOpeningCash, setIsSavingOpeningCash] = useState(false);

  // Unread messages
  const [unreadCount, setUnreadCount] = useState(0);

  // Pagination
  const [announcementPage, setAnnouncementPage] = useState(1);
  const ANNOUNCEMENTS_PER_PAGE = 3;
  const [paymentPage, setPaymentPage] = useState(1);
  const PAYMENTS_PER_PAGE = 10;
  const [showAllPayments, setShowAllPayments] = useState(false);

  // Expiry logic
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  const expiryDateObj = new Date(displayUser.expiryDate);
  expiryDateObj.setHours(0, 0, 0, 0);

  const diffTime = expiryDateObj.getTime() - todayDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const isExpired = diffDays <= -1 || displayUser.status === 'Expired';
  const isExpiringSoon = !isExpired && diffDays >= 0 && diffDays <= 30;

  useEffect(() => {
    if (isExpired) return;
    const checkUnread = async () => {
      try {
        const count = await api.getUnreadCount(user.id);
        setUnreadCount(count);
      } catch (e) { /* silent */ }
    };
    checkUnread();
    const interval = setInterval(checkUnread, 15000);
    return () => clearInterval(interval);
  }, [user.id, isExpired]);

  const refreshLogsAndStockpile = async () => {
    try {
      const [colData, procData, stockData, expData] = await Promise.all([
        api.getCollections(user.id),
        api.getProcessedMaterials(user.id),
        api.getStockpile(user.id),
        api.getExpenses(user.id)
      ]);
      setCollections(colData);
      setProcessed(procData);
      setStockpile(stockData);
      setExpenses(expData);
    } catch (e) {
      console.error('Refresh failed', e);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingData(true);
      try {
        const payData = await api.getPayments(user.id);
        setPayments(payData);
        const bankData = await api.getBankDetails();
        setBankDetails(bankData);

        if (!isExpired) {
          const [annData, pricesData] = await Promise.all([
            api.getAnnouncements(),
            api.getPrices()
          ]);
          setAnnouncements(annData);
          setPrices(pricesData);
          await refreshLogsAndStockpile();
        }
      } catch (e) {
        console.error("Failed to fetch dashboard data", e);
      } finally {
        setIsLoadingData(false);
      }
    };
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, isExpired]);

  // CO2e calculated from processed materials (real output, not just collection)
  const totalCo2e = processed.reduce((acc, entry) => {
    const rateInfo = prices.find(p => p.materialName === entry.material);
    const rate = rateInfo ? rateInfo.co2Rate : 0;
    return acc + (entry.weight * rate);
  }, 0);

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
      const updated = { ...displayUser, profileImage: url };
      await api.updateUser(updated);
      setDisplayUser(updated);
      if (onUpdateUser) onUpdateUser(updated);
    } catch (e) { alert("Failed to upload image"); }
    finally { setIsUploadingProfile(false); }
  };

  const handleSaveProfile = async () => {
    try {
      const updated = await api.updateUser(formData);
      setDisplayUser(updated);
      if (onUpdateUser) onUpdateUser(updated);
      setIsEditing(false);
      alert("Profile updated successfully");
    } catch (e) { alert("Failed to update profile"); }
  };

  const handleCancelEdit = () => {
    setFormData(displayUser);
    setIsEditing(false);
  };

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingReceipt(true);
    try { setReceiptFileUrl(await uploadToCloudinary(file)); }
    catch (e) { alert("Upload failed"); }
    finally { setIsUploadingReceipt(false); }
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiptFileUrl) return alert("Please upload a receipt/proof of payment");
    setIsProcessingPayment(true);
    try {
      await api.createPayment({ userId: user.id, amount: Number(paymentAmount), description: paymentDesc, date: new Date().toISOString().split('T')[0], status: 'Pending', receipt: receiptFileUrl });
      setPayments(await api.getPayments(user.id));
      setShowPaymentModal(false);
      setPaymentAmount(''); setPaymentDesc(''); setReceiptFileUrl('');
      alert("Payment submitted for approval");
    } catch (e) { alert("Failed to submit payment"); }
    finally { setIsProcessingPayment(false); }
  };

  const openCollectionModalForCreate = () => {
    setEditingCollectionId(null);
    setCollectionForm({ month: MONTHS[new Date().getMonth()], year: new Date().getFullYear().toString(), material: '', weight: '', totalCost: '', supplier: '', images: [] });
    setShowCollectionModal(true);
  };

  const openCollectionModalForEdit = (col: Collection) => {
    setEditingCollectionId(col.id);
    const total = (col.pricePerKg || 0) * col.weight;
    setCollectionForm({
      month: col.month,
      year: col.year,
      material: col.material,
      weight: String(col.weight),
      totalCost: total > 0 ? String(total) : '',
      supplier: col.supplier || '',
      images: col.images || []
    });
    setShowCollectionModal(true);
  };

  const handleCollectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessingPayment(true);
    try {
      const weight = Number(collectionForm.weight);
      const totalCost = collectionForm.totalCost ? Number(collectionForm.totalCost) : 0;
      const pricePerKg = weight > 0 && totalCost > 0 ? totalCost / weight : 0;
      const payload = {
        userId: user.id,
        month: collectionForm.month,
        year: collectionForm.year,
        material: collectionForm.material,
        weight,
        pricePerKg,
        supplier: collectionForm.supplier,
        images: collectionForm.images
      };
      if (editingCollectionId) {
        await api.updateCollection(editingCollectionId, payload);
      } else {
        await api.createCollection(payload);
      }
      await refreshLogsAndStockpile();
      setShowCollectionModal(false);
      setEditingCollectionId(null);
      setCollectionForm({ month: MONTHS[new Date().getMonth()], year: new Date().getFullYear().toString(), material: '', weight: '', totalCost: '', supplier: '', images: [] });
      alert(editingCollectionId ? 'Collection updated successfully' : 'Collection logged successfully');
    } catch (e: any) { alert(e.message || 'Failed to save collection'); }
    finally { setIsProcessingPayment(false); }
  };

  const handleDeleteCollection = async (col: Collection) => {
    if (!window.confirm(`Delete this ${col.material} collection (${col.weight.toLocaleString()} kg)?`)) return;
    try {
      await api.deleteCollection(col.id);
      await refreshLogsAndStockpile();
    } catch (e: any) { alert(e.message || 'Failed to delete collection'); }
  };

  const handleWeighbridgeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsUploadingWeighbridge(true);
    try {
      const urls: string[] = [];
      for (const file of files) {
        if (file.size > 5 * 1024 * 1024) {
          alert(`${file.name} is too large (max 5MB).`);
          continue;
        }
        const url = await uploadToCloudinary(file);
        urls.push(url);
      }
      setProcessedForm(prev => ({ ...prev, weighbridgeImages: [...prev.weighbridgeImages, ...urls] }));
    } catch (err) {
      alert('Failed to upload one or more weighbridge images.');
    } finally {
      setIsUploadingWeighbridge(false);
      e.target.value = '';
    }
  };

  const removeWeighbridgeImage = (index: number) => {
    setProcessedForm(prev => ({
      ...prev,
      weighbridgeImages: prev.weighbridgeImages.filter((_, i) => i !== index)
    }));
  };

  // Soft warning: check if processed weight exceeds stockpile for that material
  const checkProcessedAgainstStockpile = (material: string, weight: number): boolean => {
    const entry = stockpile.find(s => s.material === material);
    if (!entry) {
      // No prior collection of this material
      const confirmed = window.confirm(
        `You have no collection history for ${material}. ` +
        `Logging ${weight}kg processed without any collected baseline. ` +
        `Continue anyway?`
      );
      return confirmed;
    }
    if (weight > entry.inStock) {
      const confirmed = window.confirm(
        `Heads up: you're logging ${weight}kg processed but your current stockpile is only ${entry.inStock.toLocaleString()}kg of ${material} ` +
        `(${entry.collected.toLocaleString()}kg collected - ${entry.processed.toLocaleString()}kg already processed). ` +
        `This will leave your stockpile negative. Continue anyway?`
      );
      return confirmed;
    }
    return true;
  };

  const openProcessedModalForCreate = () => {
    setEditingProcessedId(null);
    setProcessedForm({
      month: MONTHS[new Date().getMonth()],
      year: new Date().getFullYear().toString(),
      material: '',
      weight: '',
      pricePerKg: '',
      buyer: '',
      weighbridgeImages: []
    });
    setShowProcessedModal(true);
  };

  const openProcessedModalForEdit = (p: ProcessedMaterial) => {
    setEditingProcessedId(p.id);
    setProcessedForm({
      month: p.month,
      year: p.year,
      material: p.material,
      weight: String(p.weight),
      pricePerKg: p.pricePerKg ? String(p.pricePerKg) : '',
      buyer: p.buyer || '',
      weighbridgeImages: p.weighbridgeImages || []
    });
    setShowProcessedModal(true);
  };

  const handleProcessedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (processedForm.weighbridgeImages.length === 0) {
      alert('At least one weighbridge ticket image is required.');
      return;
    }

    const weight = Number(processedForm.weight);
    if (!weight || weight <= 0) {
      alert('Please enter a valid weight.');
      return;
    }

    // Soft warning (skip on edit to avoid double-prompts when re-saving same row)
    if (!editingProcessedId) {
      const proceed = checkProcessedAgainstStockpile(processedForm.material, weight);
      if (!proceed) return;
    }

    setIsSavingProcessed(true);
    try {
      const payload = {
        userId: user.id,
        month: processedForm.month,
        year: processedForm.year,
        material: processedForm.material,
        weight,
        pricePerKg: processedForm.pricePerKg ? Number(processedForm.pricePerKg) : 0,
        buyer: processedForm.buyer,
        weighbridgeImages: processedForm.weighbridgeImages
      };
      if (editingProcessedId) {
        await api.updateProcessedMaterial(editingProcessedId, payload);
      } else {
        await api.createProcessedMaterial(payload);
      }
      await refreshLogsAndStockpile();
      setShowProcessedModal(false);
      setEditingProcessedId(null);
      setProcessedForm({
        month: MONTHS[new Date().getMonth()],
        year: new Date().getFullYear().toString(),
        material: '',
        weight: '',
        pricePerKg: '',
        buyer: '',
        weighbridgeImages: []
      });
      alert(editingProcessedId ? 'Processed entry updated successfully' : 'Processed material logged successfully');
    } catch (e: any) {
      alert(e.message || 'Failed to save processed material');
    } finally {
      setIsSavingProcessed(false);
    }
  };

  const handleDeleteProcessed = async (p: ProcessedMaterial) => {
    if (!window.confirm(`Delete this ${p.material} processed entry (${p.weight.toLocaleString()} kg)?`)) return;
    try {
      await api.deleteProcessedMaterial(p.id);
      await refreshLogsAndStockpile();
    } catch (e: any) { alert(e.message || 'Failed to delete processed entry'); }
  };

  const handleExpenseReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingExpenseReceipt(true);
    try {
      const url = await uploadToCloudinary(file);
      setExpenseForm(prev => ({ ...prev, receipt: url }));
    } catch (err) {
      alert('Failed to upload receipt.');
    } finally {
      setIsUploadingExpenseReceipt(false);
      e.target.value = '';
    }
  };

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(expenseForm.amount);
    if (!amt || amt <= 0) { alert('Please enter a valid amount.'); return; }
    if (!expenseForm.category) { alert('Please choose a category.'); return; }
    setIsSavingExpense(true);
    try {
      await api.createExpense({
        userId: user.id,
        month: expenseForm.month,
        year: expenseForm.year,
        category: expenseForm.category,
        amount: amt,
        description: expenseForm.description,
        date: expenseForm.date,
        receipt: expenseForm.receipt
      });
      const fresh = await api.getExpenses(user.id);
      setExpenses(fresh);
      setShowExpenseModal(false);
      setExpenseForm({
        month: MONTHS[new Date().getMonth()],
        year: new Date().getFullYear().toString(),
        category: EXPENSE_CATEGORIES[0],
        amount: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
        receipt: ''
      });
    } catch (err: any) {
      alert(err.message || 'Failed to save expense.');
    } finally {
      setIsSavingExpense(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!window.confirm('Delete this expense?')) return;
    try {
      await api.deleteExpense(id);
      setExpenses(prev => prev.filter(x => x.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete.');
    }
  };

  const handleOpeningCashChange = (val: string) => {
    setOpeningCashBalance(val);
  };

  const handleOpeningCashSave = async () => {
    const amt = Number(openingCashBalance);
    if (isNaN(amt) || amt < 0) { alert('Please enter a valid non-negative amount.'); return; }
    setIsSavingOpeningCash(true);
    try {
      await api.updateOpeningCash(amt);
      const updated = { ...displayUser, openingCashBalance: amt };
      setDisplayUser(updated);
      if (onUpdateUser) onUpdateUser(updated);
    } catch (err: any) {
      alert(err.message || 'Failed to save opening cash.');
    } finally {
      setIsSavingOpeningCash(false);
    }
  };

  // ============ FINANCIAL CALCULATIONS ============
  const periodMatches = (month: string, year: string): boolean => {
    if (financeYear !== 'all' && year !== financeYear) return false;
    if (financeMonth !== 'all' && month !== financeMonth) return false;
    return true;
  };

  const filteredProcessed = processed.filter(p =>
    periodMatches(p.month, p.year) &&
    (financeMaterial === 'all' || p.material === financeMaterial)
  );
  const filteredCollections = collections.filter(c =>
    periodMatches(c.month, c.year) &&
    (financeMaterial === 'all' || c.material === financeMaterial)
  );
  const filteredExpenses = expenses.filter(x => periodMatches(x.month, x.year));

  // Revenue per material from processed (price * weight)
  const revenueByMaterial: Record<string, { weight: number; revenue: number }> = {};
  filteredProcessed.forEach(p => {
    const rev = (p.pricePerKg || 0) * p.weight;
    if (!revenueByMaterial[p.material]) revenueByMaterial[p.material] = { weight: 0, revenue: 0 };
    revenueByMaterial[p.material].weight += p.weight;
    revenueByMaterial[p.material].revenue += rev;
  });
  const totalRevenue = Object.values(revenueByMaterial).reduce((s, r) => s + r.revenue, 0);

  // Cost of Raw Materials (COGS) per material from collections (cost * weight)
  const cogsByMaterial: Record<string, { weight: number; cost: number }> = {};
  filteredCollections.forEach(c => {
    const cost = (c.pricePerKg || 0) * c.weight;
    if (!cogsByMaterial[c.material]) cogsByMaterial[c.material] = { weight: 0, cost: 0 };
    cogsByMaterial[c.material].weight += c.weight;
    cogsByMaterial[c.material].cost += cost;
  });
  const totalCOGS = Object.values(cogsByMaterial).reduce((s, r) => s + r.cost, 0);

  // Operating Expenses by category
  const expensesByCategory: Record<string, number> = {};
  filteredExpenses.forEach(x => {
    expensesByCategory[x.category] = (expensesByCategory[x.category] || 0) + x.amount;
  });
  const totalExpenses = Object.values(expensesByCategory).reduce((s, x) => s + x, 0);

  const grossProfit = totalRevenue - totalCOGS;
  const operatingExpenses = totalExpenses;
  const netProfit = grossProfit - operatingExpenses;
  const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  // Balance sheet — inventory at lower-of-cost-or-market: prefer user's avg purchase cost,
  // then avg sale price, then admin market price.
  const inventoryValue = stockpile.reduce((sum, s) => {
    const userPurchases = collections.filter(c => c.material === s.material && (c.pricePerKg || 0) > 0);
    const avgCost = userPurchases.length > 0
      ? userPurchases.reduce((a, b) => a + (b.pricePerKg || 0), 0) / userPurchases.length
      : 0;
    const userSales = processed.filter(p => p.material === s.material && (p.pricePerKg || 0) > 0);
    const avgSale = userSales.length > 0
      ? userSales.reduce((a, b) => a + (b.pricePerKg || 0), 0) / userSales.length
      : 0;
    const market = prices.find(p => p.materialName === s.material)?.price || 0;
    const valuation = avgCost > 0 ? avgCost : (avgSale > 0 ? avgSale : market);
    return sum + Math.max(0, s.inStock) * valuation;
  }, 0);

  const openingCash = Number(openingCashBalance) || 0;
  // Cash-on-hand estimate: opening + all-time revenue - all-time raw material costs - all-time operating expenses
  const allTimeRevenue = processed.reduce((s, p) => s + ((p.pricePerKg || 0) * p.weight), 0);
  const allTimeCOGS = collections.reduce((s, c) => s + ((c.pricePerKg || 0) * c.weight), 0);
  const allTimeExpenses = expenses.reduce((s, x) => s + x.amount, 0);
  const cashOnHand = openingCash + allTimeRevenue - allTimeCOGS - allTimeExpenses;

  const totalAssets = cashOnHand + inventoryValue;
  // Liabilities — pending payments as accounts payable
  const pendingDues = payments.filter(p => p.status === 'Pending').reduce((s, p) => s + p.amount, 0);
  const totalLiabilities = pendingDues;
  const equity = totalAssets - totalLiabilities;

  // Cash flow rows
  const cashInflows = filteredProcessed
    .filter(p => (p.pricePerKg || 0) > 0)
    .map(p => ({
      id: p.id,
      date: p.createdAt,
      period: `${p.month} ${p.year}`,
      label: `Sale: ${p.material}${p.buyer ? ` (${p.buyer})` : ''}`,
      amount: (p.pricePerKg || 0) * p.weight
    }));
  const cashOutflowsCOGS = filteredCollections
    .filter(c => (c.pricePerKg || 0) > 0)
    .map(c => ({
      id: c.id,
      date: c.createdAt,
      period: `${c.month} ${c.year}`,
      label: `Raw materials: ${c.material}${c.supplier ? ` (${c.supplier})` : ''}`,
      amount: -((c.pricePerKg || 0) * c.weight)
    }));
  const cashOutflowsExp = filteredExpenses.map(x => ({
    id: x.id,
    date: x.date || x.createdAt,
    period: `${x.month} ${x.year}`,
    label: `${x.category}${x.description ? `: ${x.description}` : ''}`,
    amount: -x.amount
  }));
  const cashFlowRows = [...cashInflows, ...cashOutflowsCOGS, ...cashOutflowsExp]
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const netCashFlow = cashFlowRows.reduce((s, r) => s + r.amount, 0);

  // Filter option lists
  const availableYears = Array.from(new Set([
    ...processed.map(p => p.year),
    ...collections.map(c => c.year),
    ...expenses.map(e => e.year),
    new Date().getFullYear().toString()
  ])).filter(Boolean).sort().reverse();
  const availableMaterials = Array.from(new Set([
    ...processed.map(p => p.material),
    ...collections.map(c => c.material)
  ])).filter(Boolean).sort();

  const fmtNaira = (n: number) =>
    `${n < 0 ? '-' : ''}₦${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  const AnnouncementSkeleton = () => (
    <div className="space-y-4">{[1, 2].map(i => (<div key={i} className="animate-pulse flex flex-col space-y-2"><div className="h-4 bg-gray-200 rounded w-3/4"></div><div className="h-3 bg-gray-100 rounded w-full"></div><div className="h-3 bg-gray-100 rounded w-1/2"></div></div>))}</div>
  );

  const LogSkeleton = () => (
    <div className="space-y-4">{[1, 2, 3].map(i => (<div key={i} className="animate-pulse flex space-x-4 border-b pb-2"><div className="h-4 bg-gray-200 rounded w-1/4"></div><div className="h-4 bg-gray-200 rounded w-1/4"></div><div className="h-4 bg-gray-200 rounded w-1/4"></div></div>))}</div>
  );

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
            <div className={`px-4 py-2 rounded-full text-sm font-bold flex items-center ${displayUser.status === 'Active' ? 'bg-green-100 text-green-800' : displayUser.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
              {displayUser.status === 'Active' ? <Check className="h-4 w-4 mr-2" /> : <AlertTriangle className="h-4 w-4 mr-2" />}
              Status: {displayUser.status}
            </div>
            {!isExpired && (
              <button onClick={() => navigate('messages')} className="flex items-center bg-white border border-gray-300 px-4 py-2 rounded-md hover:bg-gray-50 relative">
                <MessageCircle className="h-4 w-4 mr-2 text-gray-600" /> Messages
                {unreadCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 leading-none shadow-sm animate-pulse">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Renewal/Expired Notice */}
        {(isExpiringSoon || isExpired) && (
          <div className={`rounded-lg p-4 border-l-4 shadow-sm ${isExpired ? 'bg-red-50 border-red-500' : 'bg-amber-50 border-amber-500'}`}>
            <div className="flex items-start">
              <AlertTriangle className={`h-5 w-5 ${isExpired ? 'text-red-500' : 'text-amber-500'} flex-shrink-0`} />
              <div className="ml-3 flex-1 md:flex md:justify-between md:items-center">
                <div>
                  <h3 className={`text-sm font-bold ${isExpired ? 'text-red-800' : 'text-amber-800'}`}>{isExpired ? 'Membership Expired' : 'Membership Renewal Due'}</h3>
                  <div className={`mt-1 text-sm ${isExpired ? 'text-red-700' : 'text-amber-700'}`}><p>{isExpired ? `Your membership expired on ${displayUser.expiryDate}. Please renew immediately to retain full access.` : `Your membership expires in ${diffDays} days (${displayUser.expiryDate}). Please renew to avoid interruption.`}</p></div>
                </div>
                <div className="mt-4 md:mt-0 md:ml-6">
                  <button onClick={() => setShowPaymentModal(true)} className={`text-sm font-bold px-4 py-2 rounded-md shadow-sm transition-colors ${isExpired ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-amber-500 text-white hover:bg-amber-600'}`}>Renew Now</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {isExpired ? (
          /* Restricted view for expired members */
          <div className="max-w-3xl mx-auto">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold text-gray-900 flex items-center"><CreditCard className="h-5 w-5 mr-2 text-gray-600" /> Payments History & Renewal</h2>
                <button onClick={() => setShowPaymentModal(true)} className="text-xs text-green-600 hover:text-green-700 font-bold uppercase">New Payment</button>
              </div>
              <div className="space-y-4">
                {isLoadingData ? (
                  <div className="animate-pulse space-y-4"><div className="h-10 bg-gray-100 rounded"></div><div className="h-10 bg-gray-100 rounded"></div></div>
                ) : payments.length > 0 ? payments
                  .slice((paymentPage - 1) * PAYMENTS_PER_PAGE, paymentPage * PAYMENTS_PER_PAGE)
                  .map(pay => (
                    <div key={pay.id} className="flex justify-between items-center border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                      <div><p className="text-sm font-medium text-gray-800">{pay.description}</p><div className="flex items-center gap-2 mt-1"><p className="text-xs text-gray-500">{pay.date}</p>{pay.receipt && (<a href={pay.receipt} target="_blank" rel="noopener noreferrer" className="text-xs text-green-600 hover:underline flex items-center"><Download className="h-3 w-3 mr-1" /> Receipt</a>)}</div></div>
                      <div className="text-right"><p className="text-sm font-bold text-gray-900">₦{pay.amount.toLocaleString()}</p><span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${pay.status === 'Successful' ? 'bg-green-100 text-green-700' : pay.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{pay.status}</span></div>
                    </div>
                  )) : (<p className="text-sm text-gray-500 text-center py-4">No payment history.</p>)}
              </div>
            </div>
          </div>
        ) : (
          /* Active view */
          <>
            {/* Section switcher */}
            <div className="inline-flex bg-white border border-gray-200 rounded-lg p-1 gap-1 shadow-sm">
              <button
                onClick={() => setActiveSection('overview')}
                className={`px-4 py-2 rounded text-sm font-medium transition-colors flex items-center ${activeSection === 'overview' ? 'bg-green-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >
                <BarChart2 className="h-4 w-4 mr-2" /> Overview
              </button>
              <button
                onClick={() => setActiveSection('financials')}
                className={`px-4 py-2 rounded text-sm font-medium transition-colors flex items-center ${activeSection === 'financials' ? 'bg-emerald-700 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >
                <Calculator className="h-4 w-4 mr-2" /> Financials
                <span className="ml-2 text-[10px] bg-amber-400 text-amber-900 px-1.5 py-0.5 rounded font-bold uppercase">New</span>
              </button>
            </div>

            {activeSection === 'financials' ? (
              <FinancialsSection
                year={financeYear} setYear={setFinanceYear}
                month={financeMonth} setMonth={setFinanceMonth}
                material={financeMaterial} setMaterial={setFinanceMaterial}
                availableYears={availableYears}
                availableMaterials={availableMaterials}
                activeFinanceTab={activeFinanceTab}
                setActiveFinanceTab={setActiveFinanceTab}
                totalRevenue={totalRevenue}
                revenueByMaterial={revenueByMaterial}
                cogsByMaterial={cogsByMaterial}
                totalCOGS={totalCOGS}
                grossProfit={grossProfit}
                expensesByCategory={expensesByCategory}
                totalExpenses={totalExpenses}
                netProfit={netProfit}
                netMargin={netMargin}
                cashOnHand={cashOnHand}
                inventoryValue={inventoryValue}
                totalAssets={totalAssets}
                totalLiabilities={totalLiabilities}
                pendingDues={pendingDues}
                equity={equity}
                openingCashBalance={openingCashBalance}
                onOpeningCashChange={handleOpeningCashChange}
                onOpeningCashSave={handleOpeningCashSave}
                isSavingOpeningCash={isSavingOpeningCash}
                savedOpeningCash={displayUser.openingCashBalance ?? 0}
                stockpile={stockpile}
                prices={prices}
                processed={processed}
                collections={collections}
                filteredExpenses={filteredExpenses}
                cashFlowRows={cashFlowRows}
                netCashFlow={netCashFlow}
                onAddExpense={() => setShowExpenseModal(true)}
                onDeleteExpense={handleDeleteExpense}
                fmtNaira={fmtNaira}
              />
            ) : (
              <>
            {/* Announcements */}
            {(announcements.length > 0 || isLoadingData) && (
              <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-amber-500">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center"><Bell className="h-5 w-5 mr-2 text-amber-500" /> Announcements & News</h2>
                <div className="space-y-4 pr-2">
                  {isLoadingData ? (<AnnouncementSkeleton />) : announcements.length > 0 ? (
                    announcements
                      .slice((announcementPage - 1) * ANNOUNCEMENTS_PER_PAGE, announcementPage * ANNOUNCEMENTS_PER_PAGE)
                      .map(ann => (
                        <div key={ann.id} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                          <div className="flex justify-between items-start"><h3 className="font-semibold text-gray-800">{ann.title}</h3>{ann.isImportant && <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full shrink-0 ml-2">Important</span>}</div>
                          <div className="text-sm text-gray-600 mt-1 ran-prose" dangerouslySetInnerHTML={{ __html: renderAnnouncementHtml(ann.content) }} />
                          <p className="text-xs text-gray-400 mt-1">{ann.date}</p>
                        </div>
                      ))
                  ) : (<p className="text-sm text-gray-400">No announcements.</p>)}
                </div>
                {announcements.length > ANNOUNCEMENTS_PER_PAGE && (
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-500">
                      Showing {((announcementPage - 1) * ANNOUNCEMENTS_PER_PAGE) + 1}–{Math.min(announcementPage * ANNOUNCEMENTS_PER_PAGE, announcements.length)} of {announcements.length}
                    </p>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => setAnnouncementPage(p => Math.max(1, p - 1))} disabled={announcementPage === 1} className="px-3 py-1 text-xs border rounded hover:bg-gray-50 disabled:opacity-40">Prev</button>
                      <span className="text-xs text-gray-500 px-2">Page {announcementPage} of {Math.ceil(announcements.length / ANNOUNCEMENTS_PER_PAGE)}</span>
                      <button type="button" onClick={() => setAnnouncementPage(p => Math.min(Math.ceil(announcements.length / ANNOUNCEMENTS_PER_PAGE), p + 1))} disabled={announcementPage >= Math.ceil(announcements.length / ANNOUNCEMENTS_PER_PAGE)} className="px-3 py-1 text-xs border rounded hover:bg-gray-50 disabled:opacity-40">Next</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

              {/* Left Column */}
              <div className="lg:col-span-2 space-y-8">

                {/* Profile */}
                <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                  <div className="bg-green-700 px-6 py-4 flex justify-between items-center">
                    <h2 className="text-white font-bold flex items-center"><UserIcon className="h-5 w-5 mr-2" /> Member Profile</h2>
                    {!isEditing && (<button onClick={() => setIsEditing(true)} className="text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-500 transition-colors">Edit Profile</button>)}
                  </div>

                  <div className="p-6">
                    <div className="flex flex-col md:flex-row gap-6">
                      <div className="flex flex-col items-center space-y-3">
                        <div className="h-32 w-32 rounded-full overflow-hidden border-4 border-green-50 relative bg-gray-100">
                          {isUploadingProfile ? (<div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75"><Loader2 className="h-8 w-8 animate-spin text-green-600" /></div>) : (<img src={formData.profileImage || "https://via.placeholder.com/150"} alt="Profile" className="h-full w-full object-cover" />)}
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
                          <div><label className="block text-xs font-semibold text-gray-500 uppercase">First Name</label><input type="text" name="firstName" value={formData.firstName} onChange={handleInputChange} disabled={!isEditing} className="w-full mt-1 p-2 border rounded bg-gray-50 disabled:bg-white disabled:border-none disabled:p-0 disabled:text-gray-900 disabled:font-medium" /></div>
                          <div><label className="block text-xs font-semibold text-gray-500 uppercase">Last Name</label><input type="text" name="lastName" value={formData.lastName} onChange={handleInputChange} disabled={!isEditing} className="w-full mt-1 p-2 border rounded bg-gray-50 disabled:bg-white disabled:border-none disabled:p-0 disabled:text-gray-900 disabled:font-medium" /></div>
                          <div><label className="block text-xs font-semibold text-gray-500 uppercase">Business Name</label><input type="text" name="businessName" value={formData.businessName} onChange={handleInputChange} disabled={!isEditing} className="w-full mt-1 p-2 border rounded bg-gray-50 disabled:bg-white disabled:border-none disabled:p-0 disabled:text-gray-900 disabled:font-medium" /></div>
                          <div><label className="block text-xs font-semibold text-gray-500 uppercase">Phone</label><input type="text" name="phone" value={formData.phone} onChange={handleInputChange} disabled={!isEditing} className="w-full mt-1 p-2 border rounded bg-gray-50 disabled:bg-white disabled:border-none disabled:p-0 disabled:text-gray-900 disabled:font-medium" /></div>
                          <div className="md:col-span-2"><label className="block text-xs font-semibold text-gray-500 uppercase">Address</label><input type="text" name="businessAddress" value={formData.businessAddress} onChange={handleInputChange} disabled={!isEditing} className="w-full mt-1 p-2 border rounded bg-gray-50 disabled:bg-white disabled:border-none disabled:p-0 disabled:text-gray-900 disabled:font-medium" /></div>
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

                {/* Logs Section with tabs */}
                <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center mb-3">
                      <BarChart2 className="h-5 w-5 mr-2 text-green-600" /> Material Logs
                    </h2>
                    <div className="inline-flex bg-gray-100 rounded-lg p-1 gap-1 flex-wrap">
                      <button
                        onClick={() => setActiveLogTab('collection')}
                        className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${activeLogTab === 'collection' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                      >
                        📥 Collection
                      </button>
                      <button
                        onClick={() => setActiveLogTab('processed')}
                        className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${activeLogTab === 'processed' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                      >
                        ⚙️ Processed
                      </button>
                      <button
                        onClick={() => setActiveLogTab('stockpile')}
                        className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${activeLogTab === 'stockpile' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                      >
                        📦 Stockpile
                      </button>
                    </div>
                  </div>

                  {/* Collection Log */}
                  {activeLogTab === 'collection' && (
                    <>
                      <div className="px-6 py-3 border-b flex justify-between items-center bg-gray-50">
                        <p className="text-sm text-gray-600">Log how much you've collected this period</p>
                        <button onClick={openCollectionModalForCreate} className="text-sm bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 flex items-center">
                          <Plus className="h-4 w-4 mr-1" /> Log Collection
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Material</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Weight (KG)</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Cost</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg ₦/kg</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date Logged</th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {isLoadingData ? (<tr><td colSpan={8} className="px-6 py-4"><LogSkeleton /></td></tr>) : collections.length > 0 ? collections.map(col => (
                              <tr key={col.id}>
                                <td className="px-6 py-4 text-sm text-gray-900">{col.month} {col.year}</td>
                                <td className="px-6 py-4 text-sm text-gray-600">{col.material}</td>
                                <td className="px-6 py-4 text-sm font-bold text-gray-900">{col.weight.toLocaleString()}</td>
                                <td className="px-6 py-4 text-sm font-semibold text-amber-700">
                                  {(col.pricePerKg || 0) > 0 ? `₦${((col.pricePerKg || 0) * col.weight).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500">{col.pricePerKg ? `₦${col.pricePerKg.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'}</td>
                                <td className="px-6 py-4 text-sm text-gray-600">{col.supplier || '—'}</td>
                                <td className="px-6 py-4 text-sm text-gray-500">{new Date(col.createdAt).toLocaleDateString()}</td>
                                <td className="px-6 py-4 text-sm text-right whitespace-nowrap">
                                  <button onClick={() => openCollectionModalForEdit(col)} className="text-gray-500 hover:text-green-600 mr-2" title="Edit">
                                    <Pencil className="h-4 w-4 inline" />
                                  </button>
                                  <button onClick={() => handleDeleteCollection(col)} className="text-gray-400 hover:text-red-600" title="Delete">
                                    <Trash2 className="h-4 w-4 inline" />
                                  </button>
                                </td>
                              </tr>
                            )) : (<tr><td colSpan={8} className="px-6 py-8 text-center text-gray-500">No collection data logged yet.</td></tr>)}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  {/* Processed Log */}
                  {activeLogTab === 'processed' && (
                    <>
                      <div className="px-6 py-3 border-b flex justify-between items-center bg-gray-50">
                        <p className="text-sm text-gray-600">Log how much you've processed or sold (with weighbridge proof)</p>
                        <button onClick={openProcessedModalForCreate} className="text-sm bg-teal-600 text-white px-3 py-1.5 rounded hover:bg-teal-700 flex items-center">
                          <Plus className="h-4 w-4 mr-1" /> Log Processed
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Material</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Weight (KG)</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price ₦/kg</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Buyer</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Weighbridge</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date Logged</th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {isLoadingData ? (<tr><td colSpan={9} className="px-6 py-4"><LogSkeleton /></td></tr>) : processed.length > 0 ? processed.map(p => (
                              <tr key={p.id}>
                                <td className="px-6 py-4 text-sm text-gray-900">{p.month} {p.year}</td>
                                <td className="px-6 py-4 text-sm text-gray-600">{p.material}</td>
                                <td className="px-6 py-4 text-sm font-bold text-gray-900">{p.weight.toLocaleString()}</td>
                                <td className="px-6 py-4 text-sm text-gray-600">{p.pricePerKg ? `₦${p.pricePerKg.toLocaleString()}` : '—'}</td>
                                <td className="px-6 py-4 text-sm font-semibold text-emerald-700">
                                  {(p.pricePerKg || 0) > 0 ? `₦${((p.pricePerKg || 0) * p.weight).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600">{p.buyer || '—'}</td>
                                <td className="px-6 py-4 text-sm">
                                  <div className="flex gap-1 flex-wrap">
                                    {p.weighbridgeImages.map((img, i) => (
                                      <a key={i} href={img} target="_blank" rel="noopener noreferrer" className="text-xs bg-teal-50 text-teal-700 px-2 py-0.5 rounded hover:bg-teal-100 border border-teal-200">
                                        #{i + 1}
                                      </a>
                                    ))}
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500">{new Date(p.createdAt).toLocaleDateString()}</td>
                                <td className="px-6 py-4 text-sm text-right whitespace-nowrap">
                                  <button onClick={() => openProcessedModalForEdit(p)} className="text-gray-500 hover:text-teal-600 mr-2" title="Edit">
                                    <Pencil className="h-4 w-4 inline" />
                                  </button>
                                  <button onClick={() => handleDeleteProcessed(p)} className="text-gray-400 hover:text-red-600" title="Delete">
                                    <Trash2 className="h-4 w-4 inline" />
                                  </button>
                                </td>
                              </tr>
                            )) : (<tr><td colSpan={9} className="px-6 py-8 text-center text-gray-500">No processed material logged yet.</td></tr>)}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  {/* Stockpile */}
                  {activeLogTab === 'stockpile' && (
                    <>
                      <div className="px-6 py-3 border-b bg-gray-50">
                        <p className="text-sm text-gray-600">Your current inventory: <strong>Collected − Processed = In Stock</strong></p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Material</th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Collected</th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Processed</th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">In Stock</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {isLoadingData ? (<tr><td colSpan={4} className="px-6 py-4"><LogSkeleton /></td></tr>) : stockpile.length > 0 ? stockpile.map(s => (
                              <tr key={s.material}>
                                <td className="px-6 py-4 text-sm font-medium text-gray-900">{s.material}</td>
                                <td className="px-6 py-4 text-sm text-right text-green-700">{s.collected.toLocaleString()} kg</td>
                                <td className="px-6 py-4 text-sm text-right text-teal-700">{s.processed.toLocaleString()} kg</td>
                                <td className={`px-6 py-4 text-sm text-right font-bold ${s.inStock < 0 ? 'text-red-600' : s.inStock === 0 ? 'text-gray-400' : 'text-gray-900'}`}>
                                  {s.inStock.toLocaleString()} kg
                                </td>
                              </tr>
                            )) : (<tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">No inventory data yet. Start by logging a collection.</td></tr>)}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-8">

                {/* CO2e Impact */}
                <div className="bg-gradient-to-br from-teal-500 to-emerald-700 rounded-xl shadow-lg p-6 text-white">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-teal-100 text-sm font-medium uppercase tracking-wider">Environmental Impact</p>
                      <p className="text-3xl font-extrabold tracking-tight mt-1">
                        {totalCo2e.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-lg font-medium">kg CO₂e</span>
                      </p>
                    </div>
                    <div className="bg-white bg-opacity-20 p-2 rounded-full">
                      <Leaf className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <p className="text-teal-100 text-xs mt-4">
                    Total carbon emissions prevented through your processed (not just collected) recycling output.
                  </p>
                </div>

                {/* Membership Card */}
                <div className="bg-gradient-to-br from-green-800 to-green-600 rounded-xl shadow-lg p-6 text-white">
                  <div className="flex justify-between items-start mb-4">
                    <div><p className="text-green-100 text-sm">Membership ID</p><p className="text-2xl font-mono font-bold tracking-wider">{displayUser.id}</p></div>
                    <Users className="h-8 w-8 text-green-200 opacity-50" />
                  </div>
                  <div className="space-y-2 mb-6">
                    <div className="flex justify-between text-sm"><span className="text-green-100">Category</span><span className="font-semibold">{displayUser.category}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-green-100">Expiry</span><span className="font-semibold">{displayUser.expiryDate}</span></div>
                  </div>
                  <div className="space-y-2">
                    {displayUser.documents?.membershipIdCard ? (<a href={displayUser.documents.membershipIdCard} download="ID_Card" target="_blank" rel="noopener noreferrer" className="w-full bg-white bg-opacity-20 hover:bg-opacity-30 text-white py-2 rounded text-sm font-medium flex items-center justify-center transition-colors"><CreditCard className="h-4 w-4 mr-2" /> Download ID Card</a>) : (<div className="w-full bg-black bg-opacity-20 text-white py-2 rounded text-sm text-center italic">ID Card Pending</div>)}
                    {displayUser.documents?.membershipCertificate ? (<a href={displayUser.documents.membershipCertificate} download="Certificate" target="_blank" rel="noopener noreferrer" className="w-full bg-white bg-opacity-20 hover:bg-opacity-30 text-white py-2 rounded text-sm font-medium flex items-center justify-center transition-colors"><FileText className="h-4 w-4 mr-2" /> Download Certificate</a>) : (<div className="w-full bg-black bg-opacity-20 text-white py-2 rounded text-sm text-center italic">Certificate Pending</div>)}
                  </div>
                </div>

                {/* Payments */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="font-bold text-gray-900 flex items-center"><CreditCard className="h-5 w-5 mr-2 text-gray-600" /> Payments</h2>
                    <button onClick={() => setShowPaymentModal(true)} className="text-xs text-green-600 hover:text-green-700 font-bold uppercase">New Payment</button>
                  </div>

                  <div className="space-y-4">
                    {isLoadingData ? (
                      <div className="space-y-3 animate-pulse"><div className="h-10 bg-gray-100 rounded"></div><div className="h-10 bg-gray-100 rounded"></div></div>
                    ) : payments.length > 0 ? (showAllPayments
                      ? payments.slice((paymentPage - 1) * PAYMENTS_PER_PAGE, paymentPage * PAYMENTS_PER_PAGE)
                      : payments.slice(0, 3)
                    ).map(pay => (
                      <div key={pay.id} className="flex justify-between items-center border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                        <div><p className="text-sm font-medium text-gray-800">{pay.description}</p><div className="flex items-center gap-2 mt-1"><p className="text-xs text-gray-500">{pay.date}</p>{pay.receipt && (<a href={pay.receipt} target="_blank" rel="noopener noreferrer" className="text-xs text-green-600 hover:underline flex items-center"><Download className="h-3 w-3 mr-1" /> Receipt</a>)}</div></div>
                        <div className="text-right"><p className="text-sm font-bold text-gray-900">₦{pay.amount.toLocaleString()}</p><span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${pay.status === 'Successful' ? 'bg-green-100 text-green-700' : pay.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{pay.status}</span></div>
                      </div>
                    )) : (<p className="text-sm text-gray-500 text-center py-4">No payment history.</p>)}

                    {!showAllPayments && payments.length > 3 && (
                      <button type="button" onClick={() => { setShowAllPayments(true); setPaymentPage(1); }} className="w-full text-center text-xs text-gray-500 hover:text-green-600 mt-2">
                        View All Transactions ({payments.length})
                      </button>
                    )}
                    {showAllPayments && payments.length > PAYMENTS_PER_PAGE && (
                      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                        <button type="button" onClick={() => setShowAllPayments(false)} className="text-xs text-gray-500 hover:text-green-600">Show Less</button>
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => setPaymentPage(p => Math.max(1, p - 1))} disabled={paymentPage === 1} className="px-2 py-1 text-xs border rounded hover:bg-gray-50 disabled:opacity-40">Prev</button>
                          <span className="text-xs text-gray-500 px-1">{paymentPage} / {Math.ceil(payments.length / PAYMENTS_PER_PAGE)}</span>
                          <button type="button" onClick={() => setPaymentPage(p => Math.min(Math.ceil(payments.length / PAYMENTS_PER_PAGE), p + 1))} disabled={paymentPage >= Math.ceil(payments.length / PAYMENTS_PER_PAGE)} className="px-2 py-1 text-xs border rounded hover:bg-gray-50 disabled:opacity-40">Next</button>
                        </div>
                      </div>
                    )}
                    {showAllPayments && payments.length <= PAYMENTS_PER_PAGE && payments.length > 3 && (
                      <button type="button" onClick={() => setShowAllPayments(false)} className="w-full text-center text-xs text-gray-500 hover:text-green-600 mt-2">Show Less</button>
                    )}
                  </div>
                </div>

              </div>
            </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold text-gray-900">Record Payment</h3><button onClick={() => setShowPaymentModal(false)}><X className="h-5 w-5 text-gray-500" /></button></div>
            {bankDetails && (<div className="bg-gray-50 p-4 rounded mb-4 text-sm text-gray-700 border border-gray-200"><p className="font-bold mb-1">Bank Transfer Details:</p><p>Bank: {bankDetails.bankName}</p><p>Account: {bankDetails.accountNumber}</p><p>Name: {bankDetails.accountName}</p></div>)}
            <form onSubmit={handleSubmitPayment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Amount (NGN)</label>
                <select required value={paymentAmount} onChange={e => { const val = e.target.value; setPaymentAmount(val); if (val === '80000') setPaymentDesc('Corporate Member Dues'); else if (val === '20000') setPaymentDesc('Associate Member Dues'); else if (val === '200000') setPaymentDesc('Patrons Dues'); else setPaymentDesc(''); }} className="w-full border rounded px-3 py-2 mt-1 bg-white">
                  <option value="">Select Membership Category</option>
                  <option value="80000">Corporate Member (₦80,000)</option>
                  <option value="20000">Associate Member (₦20,000)</option>
                  <option value="200000">Patrons (₦200,000)</option>
                </select>
              </div>
              <div><label className="block text-sm font-medium text-gray-700">Description</label><input type="text" required value={paymentDesc} onChange={e => setPaymentDesc(e.target.value)} className="w-full border rounded px-3 py-2 mt-1" placeholder="e.g. Annual Dues 2024" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Upload Receipt</label><div className="border-2 border-dashed border-gray-300 rounded-md p-4 text-center">{isUploadingReceipt ? (<Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />) : receiptFileUrl ? (<div className="flex items-center justify-center text-green-600"><Check className="h-5 w-5 mr-2" /> Receipt Attached</div>) : (<input type="file" accept="image/*,.pdf" onChange={handleReceiptUpload} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100" />)}</div></div>
              <button type="submit" disabled={isProcessingPayment} className="w-full bg-green-600 text-white py-2 rounded font-bold hover:bg-green-700 disabled:opacity-50">{isProcessingPayment ? 'Submitting...' : 'Submit Payment'}</button>
            </form>
          </div>
        </div>
      )}

      {/* Collection Modal */}
      {showCollectionModal && !isExpired && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold text-gray-900">{editingCollectionId ? 'Edit Collection' : 'Log Collection'}</h3><button onClick={() => { setShowCollectionModal(false); setEditingCollectionId(null); }}><X className="h-5 w-5 text-gray-500" /></button></div>
            <form onSubmit={handleCollectionSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700">Month</label><select className="w-full border rounded px-3 py-2 mt-1" value={collectionForm.month} onChange={e => setCollectionForm({ ...collectionForm, month: e.target.value })}>{MONTHS.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                <div><label className="block text-sm font-medium text-gray-700">Year</label><select className="w-full border rounded px-3 py-2 mt-1" value={collectionForm.year} onChange={e => setCollectionForm({ ...collectionForm, year: e.target.value })}>{YEARS.map(y => <option key={y} value={y}>{y}</option>)}</select></div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Material Type</label>
                <select className="w-full border rounded px-3 py-2 mt-1" required value={collectionForm.material} onChange={e => setCollectionForm({ ...collectionForm, material: e.target.value })}>
                  <option value="">Select Material</option>
                  {LOG_MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
                  <option value="Other">Other</option>
                </select>
              </div>
              <div><label className="block text-sm font-medium text-gray-700">Weight (KG)</label><input type="number" step="0.01" required value={collectionForm.weight} onChange={e => setCollectionForm({ ...collectionForm, weight: e.target.value })} className="w-full border rounded px-3 py-2 mt-1" placeholder="0.00" /></div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Total Cost (₦) <span className="text-xs text-gray-400 font-normal">(optional)</span></label>
                  <input type="number" step="0.01" min="0" value={collectionForm.totalCost} onChange={e => setCollectionForm({ ...collectionForm, totalCost: e.target.value })} className="w-full border rounded px-3 py-2 mt-1" placeholder="0.00" />
                  <p className="text-[11px] text-gray-500 mt-1">Total ₦ paid for this batch (multiple suppliers/rates OK)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Supplier <span className="text-xs text-gray-400 font-normal">(optional)</span></label>
                  <input type="text" value={collectionForm.supplier} onChange={e => setCollectionForm({ ...collectionForm, supplier: e.target.value })} className="w-full border rounded px-3 py-2 mt-1" placeholder="e.g. Lastmile collector name" />
                </div>
              </div>
              {collectionForm.weight && collectionForm.totalCost && Number(collectionForm.weight) > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded p-2 text-sm text-amber-800">
                  Effective rate: <strong>₦{(Number(collectionForm.totalCost) / Number(collectionForm.weight)).toLocaleString(undefined, { maximumFractionDigits: 2 })}/kg</strong>
                </div>
              )}

              <button type="submit" disabled={isProcessingPayment} className="w-full bg-green-600 text-white py-2 rounded font-bold hover:bg-green-700 disabled:opacity-50">{isProcessingPayment ? 'Saving...' : editingCollectionId ? 'Update Entry' : 'Save Entry'}</button>
            </form>
          </div>
        </div>
      )}

      {/* Processed Material Modal */}
      {showProcessedModal && !isExpired && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center">
                <Factory className="h-5 w-5 mr-2 text-teal-600" /> {editingProcessedId ? 'Edit Processed Entry' : 'Log Processed Material'}
              </h3>
              <button onClick={() => { setShowProcessedModal(false); setEditingProcessedId(null); }}><X className="h-5 w-5 text-gray-500" /></button>
            </div>

            <form onSubmit={handleProcessedSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Month</label>
                  <select className="w-full border rounded px-3 py-2 mt-1" value={processedForm.month} onChange={e => setProcessedForm({ ...processedForm, month: e.target.value })}>
                    {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Year</label>
                  <select className="w-full border rounded px-3 py-2 mt-1" value={processedForm.year} onChange={e => setProcessedForm({ ...processedForm, year: e.target.value })}>
                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Material Type</label>
                <select className="w-full border rounded px-3 py-2 mt-1" required value={processedForm.material} onChange={e => setProcessedForm({ ...processedForm, material: e.target.value })}>
                  <option value="">Select Material</option>
                  {LOG_MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Weight Processed (KG)</label>
                <input type="number" step="0.01" required value={processedForm.weight} onChange={e => setProcessedForm({ ...processedForm, weight: e.target.value })} className="w-full border rounded px-3 py-2 mt-1" placeholder="0.00" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Sale Price (₦/kg)</label>
                  <input type="number" step="0.01" min="0" value={processedForm.pricePerKg} onChange={e => setProcessedForm({ ...processedForm, pricePerKg: e.target.value })} className="w-full border rounded px-3 py-2 mt-1" placeholder="0.00" />
                  <p className="text-[11px] text-gray-500 mt-1">Leave 0 if not yet sold</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Buyer (optional)</label>
                  <input type="text" value={processedForm.buyer} onChange={e => setProcessedForm({ ...processedForm, buyer: e.target.value })} className="w-full border rounded px-3 py-2 mt-1" placeholder="e.g. ABC Recyclers" />
                </div>
              </div>
              {processedForm.weight && processedForm.pricePerKg && (
                <div className="bg-emerald-50 border border-emerald-200 rounded p-2 text-sm text-emerald-800">
                  Revenue from this entry: <strong>₦{(Number(processedForm.weight) * Number(processedForm.pricePerKg)).toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Weighbridge Tickets <span className="text-red-500">*</span>
                  <span className="text-xs text-gray-500 font-normal ml-2">(Required — at least one image)</span>
                </label>
                <div className="border-2 border-dashed border-teal-300 rounded-md p-4 text-center bg-teal-50">
                  {isUploadingWeighbridge ? (
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-teal-600" />
                  ) : (
                    <>
                      <label className="cursor-pointer inline-flex items-center bg-teal-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-teal-700">
                        <UploadCloud className="h-4 w-4 mr-2" />
                        Upload Weighbridge Ticket(s)
                        <input type="file" accept="image/*,.pdf" multiple onChange={handleWeighbridgeUpload} className="hidden" />
                      </label>
                      <p className="text-xs text-gray-500 mt-2">Photo, scan, or PDF. Multiple files allowed.</p>
                    </>
                  )}
                </div>

                {processedForm.weighbridgeImages.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {processedForm.weighbridgeImages.map((img, i) => (
                      <div key={i} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded border border-gray-200">
                        <a href={img} target="_blank" rel="noopener noreferrer" className="text-sm text-teal-700 hover:underline flex items-center">
                          <FileText className="h-4 w-4 mr-2" /> Weighbridge Ticket #{i + 1}
                        </a>
                        <button type="button" onClick={() => removeWeighbridgeImage(i)} className="text-red-500 hover:text-red-700">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-blue-50 border-l-4 border-blue-400 p-3 text-xs text-blue-800 flex items-start">
                <AlertCircle className="h-4 w-4 mr-2 mt-0.5 shrink-0" />
                <span>The system will flag if processed weight exceeds your current stockpile, but won't block you from saving.</span>
              </div>

              <button type="submit" disabled={isSavingProcessed || processedForm.weighbridgeImages.length === 0} className="w-full bg-teal-600 text-white py-2 rounded font-bold hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed">
                {isSavingProcessed ? 'Saving...' : editingProcessedId ? 'Update Processed Entry' : 'Save Processed Entry'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Expense Modal */}
      {showExpenseModal && !isExpired && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center">
                <Receipt className="h-5 w-5 mr-2 text-amber-600" /> Log Expense
              </h3>
              <button onClick={() => setShowExpenseModal(false)}><X className="h-5 w-5 text-gray-500" /></button>
            </div>

            <form onSubmit={handleExpenseSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Month</label>
                  <select className="w-full border rounded px-3 py-2 mt-1" value={expenseForm.month} onChange={e => setExpenseForm({ ...expenseForm, month: e.target.value })}>
                    {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Year</label>
                  <select className="w-full border rounded px-3 py-2 mt-1" value={expenseForm.year} onChange={e => setExpenseForm({ ...expenseForm, year: e.target.value })}>
                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Category</label>
                <select required className="w-full border rounded px-3 py-2 mt-1" value={expenseForm.category} onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })}>
                  {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Amount (₦)</label>
                <input type="number" step="0.01" min="0.01" required value={expenseForm.amount} onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })} className="w-full border rounded px-3 py-2 mt-1" placeholder="0.00" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Date</label>
                <input type="date" required value={expenseForm.date} onChange={e => setExpenseForm({ ...expenseForm, date: e.target.value })} className="w-full border rounded px-3 py-2 mt-1" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Description (optional)</label>
                <input type="text" value={expenseForm.description} onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })} className="w-full border rounded px-3 py-2 mt-1" placeholder="e.g. Diesel for truck — Lagos run" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Receipt (optional)</label>
                <div className="border-2 border-dashed border-gray-300 rounded-md p-3 text-center">
                  {isUploadingExpenseReceipt ? (
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-amber-600" />
                  ) : expenseForm.receipt ? (
                    <div className="flex items-center justify-between text-sm">
                      <a href={expenseForm.receipt} target="_blank" rel="noopener noreferrer" className="text-amber-700 hover:underline flex items-center">
                        <Check className="h-4 w-4 mr-1" /> Receipt attached
                      </a>
                      <button type="button" onClick={() => setExpenseForm({ ...expenseForm, receipt: '' })} className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ) : (
                    <input type="file" accept="image/*,.pdf" onChange={handleExpenseReceiptUpload} className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100" />
                  )}
                </div>
              </div>

              <button type="submit" disabled={isSavingExpense} className="w-full bg-amber-600 text-white py-2 rounded font-bold hover:bg-amber-700 disabled:opacity-50">
                {isSavingExpense ? 'Saving...' : 'Save Expense'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

interface FinancialsSectionProps {
  year: string; setYear: (s: string) => void;
  month: string; setMonth: (s: string) => void;
  material: string; setMaterial: (s: string) => void;
  availableYears: string[];
  availableMaterials: string[];
  activeFinanceTab: 'pnl' | 'balance' | 'cashflow' | 'expenses';
  setActiveFinanceTab: (t: 'pnl' | 'balance' | 'cashflow' | 'expenses') => void;
  totalRevenue: number;
  revenueByMaterial: Record<string, { weight: number; revenue: number }>;
  cogsByMaterial: Record<string, { weight: number; cost: number }>;
  totalCOGS: number;
  grossProfit: number;
  expensesByCategory: Record<string, number>;
  totalExpenses: number;
  netProfit: number;
  netMargin: number;
  cashOnHand: number;
  inventoryValue: number;
  totalAssets: number;
  totalLiabilities: number;
  pendingDues: number;
  equity: number;
  openingCashBalance: string;
  onOpeningCashChange: (v: string) => void;
  onOpeningCashSave: () => void;
  isSavingOpeningCash: boolean;
  savedOpeningCash: number;
  stockpile: StockpileEntry[];
  prices: MaterialPrice[];
  processed: ProcessedMaterial[];
  collections: Collection[];
  filteredExpenses: Expense[];
  cashFlowRows: { id: string; date: string; period: string; label: string; amount: number }[];
  netCashFlow: number;
  onAddExpense: () => void;
  onDeleteExpense: (id: string) => void;
  fmtNaira: (n: number) => string;
}

const FinancialsSection: React.FC<FinancialsSectionProps> = ({
  year, setYear, month, setMonth, material, setMaterial,
  availableYears, availableMaterials,
  activeFinanceTab, setActiveFinanceTab,
  totalRevenue, revenueByMaterial,
  cogsByMaterial, totalCOGS, grossProfit,
  expensesByCategory, totalExpenses,
  netProfit, netMargin, cashOnHand, inventoryValue,
  totalAssets, totalLiabilities, pendingDues, equity,
  openingCashBalance, onOpeningCashChange, onOpeningCashSave, isSavingOpeningCash, savedOpeningCash,
  stockpile, prices, processed, collections, filteredExpenses,
  cashFlowRows, netCashFlow,
  onAddExpense, onDeleteExpense, fmtNaira
}) => {
  const openingCashDirty = Number(openingCashBalance) !== savedOpeningCash;
  return (
    <div className="space-y-6">
      {/* Header + Filters */}
      <div className="bg-white rounded-lg shadow-sm p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center">
              <Calculator className="h-6 w-6 mr-2 text-emerald-700" /> Financial Statements
            </h2>
            <p className="text-sm text-gray-500">Track your profit, loss, assets and cash flow from your recycling business.</p>
          </div>
          <button onClick={onAddExpense} className="inline-flex items-center bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded text-sm font-medium">
            <Plus className="h-4 w-4 mr-1" /> Log Expense
          </button>
        </div>

        <div className="flex flex-wrap gap-3 items-end border-t border-gray-100 pt-4">
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-1">Year</label>
            <select value={year} onChange={e => setYear(e.target.value)} className="border rounded px-3 py-1.5 text-sm bg-white">
              <option value="all">All Years</option>
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-1">Month</label>
            <select value={month} onChange={e => setMonth(e.target.value)} className="border rounded px-3 py-1.5 text-sm bg-white">
              <option value="all">All Months</option>
              {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase mb-1">Material</label>
            <select value={material} onChange={e => setMaterial(e.target.value)} className="border rounded px-3 py-1.5 text-sm bg-white">
              <option value="all">All Materials</option>
              {availableMaterials.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          {(year !== 'all' || month !== 'all' || material !== 'all') && (
            <button onClick={() => { setYear('all'); setMonth('all'); setMaterial('all'); }} className="text-xs text-gray-500 hover:text-emerald-700 underline">
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 text-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-wider text-emerald-100">Revenue</span>
            <TrendingUp className="h-4 w-4 text-emerald-100" />
          </div>
          <p className="text-xl font-extrabold truncate">{fmtNaira(totalRevenue)}</p>
        </div>
        <div className="bg-gradient-to-br from-rose-500 to-rose-700 text-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-wider text-rose-100">Expenses</span>
            <TrendingDown className="h-4 w-4 text-rose-100" />
          </div>
          <p className="text-xl font-extrabold truncate">{fmtNaira(totalExpenses)}</p>
        </div>
        <div className={`bg-gradient-to-br ${netProfit >= 0 ? 'from-teal-500 to-teal-700' : 'from-orange-500 to-orange-700'} text-white rounded-lg p-4 shadow-sm`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-wider text-white/80">Net {netProfit >= 0 ? 'Profit' : 'Loss'}</span>
            <PieChart className="h-4 w-4 text-white/80" />
          </div>
          <p className="text-xl font-extrabold truncate">{fmtNaira(netProfit)}</p>
          <p className="text-[11px] text-white/80 mt-1">Margin: {netMargin.toFixed(1)}%</p>
        </div>
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 text-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-wider text-indigo-100">Inventory Value</span>
            <Archive className="h-4 w-4 text-indigo-100" />
          </div>
          <p className="text-xl font-extrabold truncate">{fmtNaira(inventoryValue)}</p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="border-b px-4 py-2 flex gap-1 overflow-x-auto">
          {[
            { id: 'pnl', label: 'Profit & Loss', icon: TrendingUp },
            { id: 'balance', label: 'Balance Sheet', icon: Wallet },
            { id: 'cashflow', label: 'Cash Flow', icon: ArrowDownCircle },
            { id: 'expenses', label: 'Expenses', icon: Receipt }
          ].map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setActiveFinanceTab(t.id as any)}
                className={`px-3 py-1.5 rounded text-sm font-medium flex items-center whitespace-nowrap transition-colors ${activeFinanceTab === t.id ? 'bg-emerald-700 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                <Icon className="h-4 w-4 mr-1.5" /> {t.label}
              </button>
            );
          })}
        </div>

        {/* P&L */}
        {activeFinanceTab === 'pnl' && (
          <div className="p-5">
            <h3 className="font-bold text-gray-900 mb-3">Profit & Loss Statement</h3>
            <table className="min-w-full text-sm">
              <tbody>
                <tr className="border-b border-gray-200"><td colSpan={2} className="py-2 font-bold text-emerald-700 uppercase text-xs">Revenue</td></tr>
                {Object.entries(revenueByMaterial).length === 0 ? (
                  <tr><td colSpan={2} className="py-2 text-gray-400 italic pl-4">No sales recorded for this period. Log processed materials with a sale price to populate this.</td></tr>
                ) : Object.entries(revenueByMaterial).map(([mat, info]) => (
                  <tr key={mat} className="border-b border-gray-50">
                    <td className="py-2 pl-4 text-gray-700">{mat} <span className="text-gray-400 text-xs">({info.weight.toLocaleString()} kg)</span></td>
                    <td className="py-2 text-right font-medium text-gray-900">{fmtNaira(info.revenue)}</td>
                  </tr>
                ))}
                <tr className="border-b-2 border-gray-300 bg-emerald-50">
                  <td className="py-2 pl-4 font-bold text-gray-900">Total Revenue</td>
                  <td className="py-2 text-right font-bold text-emerald-700">{fmtNaira(totalRevenue)}</td>
                </tr>

                <tr><td colSpan={2} className="pt-4"></td></tr>
                <tr className="border-b border-gray-200"><td colSpan={2} className="py-2 font-bold text-amber-700 uppercase text-xs">Cost of Raw Materials</td></tr>
                {Object.entries(cogsByMaterial).length === 0 ? (
                  <tr><td colSpan={2} className="py-2 text-gray-400 italic pl-4">No purchase costs recorded. Add a cost ₦/kg on your Collection entries to populate this.</td></tr>
                ) : Object.entries(cogsByMaterial).map(([mat, info]) => (
                  <tr key={mat} className="border-b border-gray-50">
                    <td className="py-2 pl-4 text-gray-700">{mat} <span className="text-gray-400 text-xs">({info.weight.toLocaleString()} kg)</span></td>
                    <td className="py-2 text-right font-medium text-gray-900">{fmtNaira(info.cost)}</td>
                  </tr>
                ))}
                <tr className="border-b-2 border-gray-300 bg-amber-50">
                  <td className="py-2 pl-4 font-bold text-gray-900">Total Cost of Raw Materials</td>
                  <td className="py-2 text-right font-bold text-amber-700">{fmtNaira(totalCOGS)}</td>
                </tr>

                <tr><td colSpan={2} className="pt-3"></td></tr>
                <tr className={`border-y-2 border-gray-300 ${grossProfit >= 0 ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                  <td className="py-2 pl-4 font-bold text-gray-900 uppercase text-xs">Gross Profit</td>
                  <td className={`py-2 text-right font-bold ${grossProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{fmtNaira(grossProfit)}</td>
                </tr>

                <tr><td colSpan={2} className="pt-4"></td></tr>
                <tr className="border-b border-gray-200"><td colSpan={2} className="py-2 font-bold text-rose-700 uppercase text-xs">Operating Expenses</td></tr>
                {Object.entries(expensesByCategory).length === 0 ? (
                  <tr><td colSpan={2} className="py-2 text-gray-400 italic pl-4">No expenses logged for this period.</td></tr>
                ) : Object.entries(expensesByCategory).map(([cat, amt]) => (
                  <tr key={cat} className="border-b border-gray-50">
                    <td className="py-2 pl-4 text-gray-700">{cat}</td>
                    <td className="py-2 text-right font-medium text-gray-900">{fmtNaira(amt)}</td>
                  </tr>
                ))}
                <tr className="border-b-2 border-gray-300 bg-rose-50">
                  <td className="py-2 pl-4 font-bold text-gray-900">Total Expenses</td>
                  <td className="py-2 text-right font-bold text-rose-700">{fmtNaira(totalExpenses)}</td>
                </tr>

                <tr><td colSpan={2} className="pt-4"></td></tr>
                <tr className={`border-t-2 border-gray-400 ${netProfit >= 0 ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                  <td className="py-3 pl-4 font-extrabold text-gray-900 uppercase">Net {netProfit >= 0 ? 'Profit' : 'Loss'}</td>
                  <td className={`py-3 text-right font-extrabold text-lg ${netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{fmtNaira(netProfit)}</td>
                </tr>
                <tr>
                  <td className="py-1 pl-4 text-xs text-gray-500">Profit margin</td>
                  <td className="py-1 text-right text-xs text-gray-500">{netMargin.toFixed(2)}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Balance Sheet */}
        {activeFinanceTab === 'balance' && (
          <div className="p-5">
            <h3 className="font-bold text-gray-900 mb-3">Balance Sheet <span className="text-xs font-normal text-gray-500">(as of today)</span></h3>

            <div className="bg-gray-50 border border-gray-200 rounded p-3 mb-4 flex flex-col sm:flex-row sm:items-center gap-2">
              <label className="text-xs font-semibold text-gray-600 uppercase">Opening cash balance:</label>
              <input type="number" step="0.01" min="0" value={openingCashBalance} onChange={e => onOpeningCashChange(e.target.value)} className="border rounded px-3 py-1 text-sm w-40" placeholder="0" />
              <button
                type="button"
                onClick={onOpeningCashSave}
                disabled={isSavingOpeningCash || !openingCashDirty}
                className="bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded hover:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSavingOpeningCash ? 'Saving…' : openingCashDirty ? 'Save' : 'Saved'}
              </button>
              <span className="text-[11px] text-gray-500">Capital you started with. Synced to your account.</span>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-bold text-emerald-700 uppercase text-xs mb-2 border-b pb-1">Assets</h4>
                <table className="min-w-full text-sm">
                  <tbody>
                    <tr className="border-b border-gray-50"><td className="py-2 text-gray-700">Cash on hand</td><td className="py-2 text-right font-medium">{fmtNaira(cashOnHand)}</td></tr>
                    <tr className="border-b border-gray-50"><td className="py-2 text-gray-700">Inventory (stockpile)</td><td className="py-2 text-right font-medium">{fmtNaira(inventoryValue)}</td></tr>
                    <tr className="border-t-2 border-gray-300 bg-emerald-50"><td className="py-2 font-bold">Total Assets</td><td className="py-2 text-right font-bold text-emerald-700">{fmtNaira(totalAssets)}</td></tr>
                  </tbody>
                </table>

                {stockpile.length > 0 && (
                  <details className="mt-3 text-xs">
                    <summary className="cursor-pointer text-gray-500 hover:text-gray-700">Inventory breakdown</summary>
                    <table className="min-w-full mt-2">
                      <thead className="bg-gray-100">
                        <tr><th className="text-left px-2 py-1">Material</th><th className="text-right px-2 py-1">Stock (kg)</th><th className="text-right px-2 py-1">@ ₦/kg</th><th className="text-right px-2 py-1">Value</th></tr>
                      </thead>
                      <tbody>
                        {stockpile.filter(s => s.inStock > 0).map(s => {
                          const userPurchases = collections.filter(c => c.material === s.material && (c.pricePerKg || 0) > 0);
                          const avgCost = userPurchases.length > 0
                            ? userPurchases.reduce((a, b) => a + (b.pricePerKg || 0), 0) / userPurchases.length
                            : 0;
                          const userSales = processed.filter(p => p.material === s.material && (p.pricePerKg || 0) > 0);
                          const avgSale = userSales.length > 0
                            ? userSales.reduce((a, b) => a + (b.pricePerKg || 0), 0) / userSales.length
                            : 0;
                          const market = prices.find(p => p.materialName === s.material)?.price || 0;
                          const valuation = avgCost > 0 ? avgCost : (avgSale > 0 ? avgSale : market);
                          return (
                            <tr key={s.material} className="border-b border-gray-50">
                              <td className="px-2 py-1">{s.material}</td>
                              <td className="px-2 py-1 text-right">{s.inStock.toLocaleString()}</td>
                              <td className="px-2 py-1 text-right">{fmtNaira(valuation)}</td>
                              <td className="px-2 py-1 text-right font-medium">{fmtNaira(s.inStock * valuation)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </details>
                )}
              </div>

              <div>
                <h4 className="font-bold text-rose-700 uppercase text-xs mb-2 border-b pb-1">Liabilities & Equity</h4>
                <table className="min-w-full text-sm">
                  <tbody>
                    <tr className="border-b border-gray-50"><td className="py-2 text-gray-700">Pending membership dues</td><td className="py-2 text-right font-medium">{fmtNaira(pendingDues)}</td></tr>
                    <tr className="border-t border-gray-200 bg-rose-50"><td className="py-2 font-bold">Total Liabilities</td><td className="py-2 text-right font-bold text-rose-700">{fmtNaira(totalLiabilities)}</td></tr>
                    <tr><td className="py-2"></td></tr>
                    <tr className="border-b border-gray-50"><td className="py-2 text-gray-700">Owner's Equity</td><td className="py-2 text-right font-medium">{fmtNaira(equity)}</td></tr>
                    <tr className="border-t-2 border-gray-300 bg-indigo-50"><td className="py-2 font-bold">Liabilities + Equity</td><td className="py-2 text-right font-bold text-indigo-700">{fmtNaira(totalLiabilities + equity)}</td></tr>
                  </tbody>
                </table>
                <p className="text-[11px] text-gray-500 mt-3 italic">Assets must equal Liabilities + Equity. If they don't, check that your opening cash and expense entries are accurate.</p>
              </div>
            </div>
          </div>
        )}

        {/* Cash Flow */}
        {activeFinanceTab === 'cashflow' && (
          <div className="p-5">
            <h3 className="font-bold text-gray-900 mb-3">Cash Flow Statement</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Period</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Description</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {cashFlowRows.length === 0 ? (
                    <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-400 italic">No cash movements in this period.</td></tr>
                  ) : cashFlowRows.map(r => (
                    <tr key={r.id} className="border-b border-gray-50">
                      <td className="px-3 py-2 text-gray-600">{new Date(r.date).toLocaleDateString()}</td>
                      <td className="px-3 py-2 text-gray-500 text-xs">{r.period}</td>
                      <td className="px-3 py-2 text-gray-700 flex items-center">
                        {r.amount > 0 ? <ArrowDownCircle className="h-3 w-3 mr-1 text-emerald-600" /> : <ArrowUpCircle className="h-3 w-3 mr-1 text-rose-600" />}
                        {r.label}
                      </td>
                      <td className={`px-3 py-2 text-right font-medium ${r.amount >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{fmtNaira(r.amount)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-gray-300 bg-gray-50">
                    <td colSpan={3} className="px-3 py-2 font-bold text-gray-900">Net Cash Flow</td>
                    <td className={`px-3 py-2 text-right font-bold text-lg ${netCashFlow >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{fmtNaira(netCashFlow)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-gray-500 mt-3 italic">Inflows: sales of processed materials. Outflows: raw material purchases (from Collection entries with a cost) and operating expenses. Membership dues are tracked separately and excluded from business cash flow.</p>
          </div>
        )}

        {/* Expenses list */}
        {activeFinanceTab === 'expenses' && (
          <div className="p-5">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-gray-900">Expenses</h3>
              <button onClick={onAddExpense} className="text-sm bg-amber-600 text-white px-3 py-1.5 rounded hover:bg-amber-700 flex items-center">
                <Plus className="h-4 w-4 mr-1" /> Add Expense
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Period</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Category</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Description</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Amount</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500 uppercase">Receipt</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.length === 0 ? (
                    <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-400 italic">No expenses recorded for this period.</td></tr>
                  ) : filteredExpenses.map(x => (
                    <tr key={x.id} className="border-b border-gray-50">
                      <td className="px-3 py-2 text-gray-600">{x.date ? new Date(x.date).toLocaleDateString() : '—'}</td>
                      <td className="px-3 py-2 text-gray-500 text-xs">{x.month} {x.year}</td>
                      <td className="px-3 py-2 text-gray-700 font-medium">{x.category}</td>
                      <td className="px-3 py-2 text-gray-600">{x.description || '—'}</td>
                      <td className="px-3 py-2 text-right font-semibold text-rose-700">{fmtNaira(x.amount)}</td>
                      <td className="px-3 py-2 text-center">
                        {x.receipt ? (
                          <a href={x.receipt} target="_blank" rel="noopener noreferrer" className="text-amber-700 hover:underline text-xs inline-flex items-center"><Download className="h-3 w-3 mr-1" /> View</a>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => onDeleteExpense(x.id)} className="text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserDashboard;