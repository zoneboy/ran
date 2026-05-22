import React, { useState, useEffect } from 'react';
import { User, Listing, ListingType, ListingStatus } from '../types';
import { api } from '../services/api';
import { Search, MapPin, Tag, Plus, X, Loader2, Package, MessageSquare, Edit, CheckCircle, Clock, AlertCircle, Trash2 } from 'lucide-react';

interface ListingsProps {
  navigate: (page: string, params?: any) => void;
  currentUser: User;
}

const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
  "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT - Abuja", "Gombe",
  "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos",
  "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto",
  "Taraba", "Yobe", "Zamfara"
];

const Listings: React.FC<ListingsProps> = ({ navigate, currentUser }) => {
  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'AVAILABLE' | 'WANTED' | 'MINE'>('AVAILABLE');
  const [searchTerm, setSearchTerm] = useState('');
  const [materialFilter, setMaterialFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');

  const [showPostModal, setShowPostModal] = useState(false);
  const [editingListing, setEditingListing] = useState<Listing | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({
    type: currentUser.businessCategory === 'Processor' || currentUser.businessCategory === 'Manufacturer' ? 'WANTED' : 'AVAILABLE',
    material: '',
    quantityKg: '',
    locationState: currentUser.businessState || '',
    locationCity: currentUser.businessCity || '',
    pricePerKg: '',
    isNegotiable: false,
    description: ''
  });

  const isExpired = currentUser.status === 'Expired';
  const isActive = currentUser.status === 'Active' || currentUser.role === 'ADMIN';

  const fetchListings = async () => {
    setIsLoading(true);
    try {
      const filters: any = {};
      if (activeTab === 'MINE') {
        filters.scope = 'mine';
      } else {
        filters.type = activeTab;
      }
      if (materialFilter) filters.material = materialFilter;
      if (stateFilter) filters.state = stateFilter;
      if (searchTerm) filters.search = searchTerm;

      const data = await api.getListings(filters);
      setListings(data);
    } catch (e) {
      console.error('Failed to load listings', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchListings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    const timer = setTimeout(() => fetchListings(), 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, materialFilter, stateFilter]);

  const handleOpenPostModal = (listing?: Listing) => {
    if (listing) {
      setEditingListing(listing);
      setForm({
        type: listing.type,
        material: listing.material,
        quantityKg: listing.quantityKg.toString(),
        locationState: listing.locationState,
        locationCity: listing.locationCity || '',
        pricePerKg: listing.pricePerKg !== null ? listing.pricePerKg.toString() : '',
        isNegotiable: listing.pricePerKg === null,
        description: listing.description || ''
      });
    } else {
      setEditingListing(null);
      setForm({
        type: currentUser.businessCategory === 'Processor' || currentUser.businessCategory === 'Manufacturer' ? 'WANTED' : 'AVAILABLE',
        material: '',
        quantityKg: '',
        locationState: currentUser.businessState || '',
        locationCity: currentUser.businessCity || '',
        pricePerKg: '',
        isNegotiable: false,
        description: ''
      });
    }
    setShowPostModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = {
        type: form.type,
        material: form.material.trim(),
        quantityKg: Number(form.quantityKg),
        locationState: form.locationState,
        locationCity: form.locationCity.trim(),
        pricePerKg: form.isNegotiable ? null : (form.pricePerKg ? Number(form.pricePerKg) : null),
        description: form.description.trim()
      };

      if (editingListing) {
        await api.updateListing(editingListing.id, payload);
        alert('Listing updated successfully');
      } else {
        await api.createListing(payload);
        alert('Listing posted successfully');
      }
      setShowPostModal(false);
      await fetchListings();
    } catch (err: any) {
      alert(err.message || 'Failed to save listing');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseListing = async (id: string) => {
    if (!window.confirm('Close this listing? This cannot be undone.')) return;
    try {
      await api.closeListing(id);
      await fetchListings();
    } catch (e: any) {
      alert(e.message || 'Failed to close listing');
    }
  };

  const handleDeleteListing = async (id: string) => {
    if (!window.confirm('Permanently delete this listing?')) return;
    try {
      await api.deleteListing(id);
      await fetchListings();
    } catch (e: any) {
      alert(e.message || 'Failed to delete listing');
    }
  };

  const handleContactPoster = (listing: Listing) => {
    navigate('messages', { targetUserId: listing.userId });
  };

  const getDaysLeft = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days;
  };

  const TypeBadge: React.FC<{ type: ListingType }> = ({ type }) => (
    <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
      type === 'WANTED' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'
    }`}>
      {type === 'WANTED' ? '🔍 WANTED' : '📦 AVAILABLE'}
    </span>
  );

  const StatusBadge: React.FC<{ status: ListingStatus }> = ({ status }) => {
    const styles: Record<ListingStatus, string> = {
      OPEN: 'bg-green-100 text-green-700',
      CLOSED: 'bg-gray-200 text-gray-600',
      EXPIRED: 'bg-red-100 text-red-700'
    };
    return <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${styles[status]}`}>{status}</span>;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <Package className="h-8 w-8 mr-3 text-green-600" />
              Trade Listings
            </h1>
            <p className="text-gray-600 mt-1">Connect with buyers and sellers across Nigeria.</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigate(currentUser.role === 'ADMIN' ? 'admin-dashboard' : 'dashboard')}
              className="text-green-600 hover:text-green-700 font-medium px-4 py-2"
            >
              &larr; Dashboard
            </button>
            {isActive && (
              <button
                onClick={() => handleOpenPostModal()}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 font-medium flex items-center shadow-sm"
              >
                <Plus className="h-4 w-4 mr-2" /> Post Listing
              </button>
            )}
          </div>
        </div>

        {isExpired && (
          <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-amber-500 mr-2" />
              <p className="text-sm text-amber-800">
                Your membership is expired. You can browse listings but cannot post or contact sellers. Renew to participate.
              </p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm p-2 inline-flex w-full md:w-auto">
          {(['AVAILABLE', 'WANTED', 'MINE'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 md:flex-initial px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {tab === 'AVAILABLE' && '📦 Available'}
              {tab === 'WANTED' && '🔍 Wanted'}
              {tab === 'MINE' && '👤 My Listings'}
            </button>
          ))}
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Search material, business, city..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500 text-sm"
            />
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          </div>
          <div className="relative">
            <input
              type="text"
              placeholder="Filter by material (e.g. PET, HDPE)..."
              value={materialFilter}
              onChange={(e) => setMaterialFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500 text-sm"
            />
            <Tag className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          </div>
          <div className="relative">
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500 text-sm appearance-none"
            >
              <option value="">All States</option>
              {NIGERIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-10 w-10 text-green-600 animate-spin" />
          </div>
        ) : listings.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">No listings found.</p>
            {isActive && activeTab !== 'MINE' && (
              <button
                onClick={() => handleOpenPostModal()}
                className="text-green-600 hover:text-green-700 font-bold"
              >
                Be the first to post
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {listings.map(listing => {
              const isOwner = listing.userId === currentUser.id;
              const daysLeft = getDaysLeft(listing.expiresAt);
              const isClosed = listing.status !== 'OPEN';

              return (
                <div
                  key={listing.id}
                  className={`bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow border ${
                    isClosed ? 'border-gray-200 opacity-70' : 'border-gray-100'
                  } overflow-hidden flex flex-col`}
                >
                  <div className="p-5 flex-1">
                    <div className="flex items-start justify-between mb-3">
                      <TypeBadge type={listing.type} />
                      <StatusBadge status={listing.status} />
                    </div>

                    <h3 className="text-lg font-bold text-gray-900 mb-1">{listing.material}</h3>
                    <p className="text-2xl font-extrabold text-green-700 mb-3">
                      {listing.quantityKg.toLocaleString()} <span className="text-sm font-medium text-gray-500">kg</span>
                    </p>

                    <div className="space-y-1.5 text-sm text-gray-600">
                      <div className="flex items-center">
                        <MapPin className="h-4 w-4 mr-2 text-gray-400" />
                        {listing.locationCity ? `${listing.locationCity}, ` : ''}{listing.locationState}
                      </div>
                      <div className="flex items-center">
                        <Tag className="h-4 w-4 mr-2 text-gray-400" />
                        {listing.pricePerKg !== null
                          ? `₦${listing.pricePerKg.toLocaleString()}/kg`
                          : <span className="italic text-amber-600">Negotiable</span>}
                      </div>
                      {!isClosed && (
                        <div className="flex items-center text-xs text-gray-500">
                          <Clock className="h-3 w-3 mr-2" />
                          {daysLeft > 0 ? `${daysLeft} days left` : 'Expiring today'}
                        </div>
                      )}
                    </div>

                    {listing.description && (
                      <p className="text-sm text-gray-600 mt-3 pt-3 border-t border-gray-100 line-clamp-3">
                        {listing.description}
                      </p>
                    )}

                    <div className="mt-4 pt-3 border-t border-gray-100">
                      <p className="text-xs text-gray-500">Posted by</p>
                      <p className="text-sm font-semibold text-gray-800">{listing.businessName}</p>
                    </div>
                  </div>

                  <div className="bg-gray-50 px-5 py-3 border-t border-gray-100 flex gap-2">
                    {isOwner ? (
                      <>
                        {listing.status === 'OPEN' && (
                          <>
                            <button
                              onClick={() => handleOpenPostModal(listing)}
                              className="flex-1 text-sm bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-50 font-medium flex items-center justify-center"
                            >
                              <Edit className="h-3 w-3 mr-1" /> Edit
                            </button>
                            <button
                              onClick={() => handleCloseListing(listing.id)}
                              className="flex-1 text-sm bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 font-medium flex items-center justify-center"
                            >
                              <CheckCircle className="h-3 w-3 mr-1" /> Close
                            </button>
                          </>
                        )}
                        {listing.status !== 'OPEN' && (
                          <span className="text-xs text-gray-500 italic w-full text-center py-1">
                            {listing.status === 'CLOSED' ? 'You closed this listing' : 'Listing expired'}
                          </span>
                        )}
                      </>
                    ) : isClosed ? (
                      <span className="text-xs text-gray-500 italic w-full text-center py-1">
                        No longer accepting interest
                      </span>
                    ) : (
                      <button
                        onClick={() => handleContactPoster(listing)}
                        disabled={!isActive}
                        className="w-full text-sm bg-amber-500 text-white px-3 py-1.5 rounded hover:bg-amber-600 font-medium flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <MessageSquare className="h-3 w-3 mr-1" />
                        {isActive ? 'Contact Poster' : 'Renew to Contact'}
                      </button>
                    )}
                    {currentUser.role === 'ADMIN' && !isOwner && (
                      <button
                        onClick={() => handleDeleteListing(listing.id)}
                        className="text-sm bg-red-50 text-red-600 px-2 py-1.5 rounded hover:bg-red-100"
                        title="Admin: Delete listing"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showPostModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                {editingListing ? 'Edit Listing' : 'Post New Listing'}
              </h2>
              <button onClick={() => setShowPostModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!editingListing && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Listing Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, type: 'AVAILABLE' })}
                      className={`p-3 rounded border-2 text-sm font-medium ${
                        form.type === 'AVAILABLE'
                          ? 'border-green-600 bg-green-50 text-green-700'
                          : 'border-gray-200 text-gray-600'
                      }`}
                    >
                      📦 I have material to sell
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, type: 'WANTED' })}
                      className={`p-3 rounded border-2 text-sm font-medium ${
                        form.type === 'WANTED'
                          ? 'border-amber-600 bg-amber-50 text-amber-700'
                          : 'border-gray-200 text-gray-600'
                      }`}
                    >
                      🔍 I want to buy material
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">Material *</label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={form.material}
                  onChange={(e) => setForm({ ...form, material: e.target.value })}
                  placeholder="e.g. PP, PET bottles, Baled HDPE"
                  className="mt-1 w-full border rounded-md px-3 py-2 text-sm focus:ring-green-500 focus:border-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Quantity (kg) *</label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  value={form.quantityKg}
                  onChange={(e) => setForm({ ...form, quantityKg: e.target.value })}
                  placeholder="2000"
                  className="mt-1 w-full border rounded-md px-3 py-2 text-sm focus:ring-green-500 focus:border-green-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">State *</label>
                  <select
                    required
                    value={form.locationState}
                    onChange={(e) => setForm({ ...form, locationState: e.target.value })}
                    className="mt-1 w-full border rounded-md px-3 py-2 text-sm focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="">Select state</option>
                    {NIGERIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">City</label>
                  <input
                    type="text"
                    maxLength={100}
                    value={form.locationCity}
                    onChange={(e) => setForm({ ...form, locationCity: e.target.value })}
                    placeholder="Ilorin"
                    className="mt-1 w-full border rounded-md px-3 py-2 text-sm focus:ring-green-500 focus:border-green-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Price per kg (NGN)</label>
                  <label className="flex items-center text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={form.isNegotiable}
                      onChange={(e) => setForm({ ...form, isNegotiable: e.target.checked, pricePerKg: e.target.checked ? '' : form.pricePerKg })}
                      className="mr-1"
                    />
                    Negotiable
                  </label>
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={form.isNegotiable}
                  value={form.pricePerKg}
                  onChange={(e) => setForm({ ...form, pricePerKg: e.target.value })}
                  placeholder="450"
                  className="w-full border rounded-md px-3 py-2 text-sm focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Description ({form.description.length}/500)
                </label>
                <textarea
                  maxLength={500}
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Additional details: condition, baling, delivery terms..."
                  className="mt-1 w-full border rounded-md px-3 py-2 text-sm focus:ring-green-500 focus:border-green-500"
                />
              </div>

              <div className="bg-blue-50 p-3 rounded text-xs text-blue-800 flex items-start">
                <AlertCircle className="h-4 w-4 mr-2 mt-0.5 shrink-0" />
                <span>Listings auto-expire after 30 days. You can close yours anytime. Other members will contact you via the portal's messaging.</span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowPostModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-bold flex items-center disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (editingListing ? 'Save Changes' : 'Post Listing')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Listings;