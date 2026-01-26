
import React, { useState, useEffect } from 'react';
import { MaterialPrice } from '../types';
import { api } from '../services/api';
import { ArrowLeft, Loader2, Coins, Tag, RefreshCw } from 'lucide-react';

interface PricelistProps {
  navigate: (page: string) => void;
}

const Pricelist: React.FC<PricelistProps> = ({ navigate }) => {
  const [prices, setPrices] = useState<MaterialPrice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrices = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getPrices();
      setPrices(data);
    } catch (err: any) {
      setError(err.message || "Failed to load prices. You may not have access.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPrices();
  }, []);

  const getMaterialIcon = (name: string) => {
    // You could map specific icons here based on name if desired
    return <Tag className="h-6 w-6 text-green-600" />;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <Coins className="h-8 w-8 mr-3 text-amber-500" /> 
              Current Material Pricelist
            </h1>
            <p className="text-gray-600 mt-2">Latest market rates for recyclable materials.</p>
          </div>
          <div className="flex gap-3">
             <button 
                onClick={fetchPrices}
                className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-md font-medium flex items-center"
             >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
             </button>
             <button 
                onClick={() => navigate('dashboard')}
                className="text-green-600 hover:text-green-700 font-medium px-4 py-2"
             >
                &larr; Back to Dashboard
             </button>
          </div>
        </div>

        {error ? (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded shadow-sm">
            <p className="text-red-700 font-bold">Access Denied / Error</p>
            <p className="text-red-600">{error}</p>
          </div>
        ) : isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-10 w-10 text-green-600 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {prices.map(item => (
              <div key={item.id} className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-100 overflow-hidden">
                <div className="p-6">
                   <div className="flex items-center justify-between mb-4">
                      <div className="bg-green-50 p-3 rounded-full">
                        {getMaterialIcon(item.materialName)}
                      </div>
                      <span className="text-xs font-mono text-gray-400">NGN</span>
                   </div>
                   <h3 className="text-lg font-bold text-gray-800 mb-2 min-h-[3.5rem] flex items-center">
                     {item.materialName}
                   </h3>
                   <div className="text-3xl font-extrabold text-green-700 mb-1">
                     {item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                   </div>
                   <p className="text-xs text-gray-500 mt-4 pt-4 border-t border-gray-100">
                     Last Updated: {item.lastUpdated}
                   </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Pricelist;
