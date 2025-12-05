import React, { useMemo, useState, useRef, useEffect } from 'react';
import { ReceiptData, PersonSummary } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Download, Share2, Calculator } from 'lucide-react';
import html2canvas from 'html2canvas';

interface Props {
  data: ReceiptData;
  onUpdateTip: (newTip: number) => void;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#EF4444', '#3B82F6'];

const SummaryPanel: React.FC<Props> = ({ data, onUpdateTip }) => {
  const [tipMode, setTipMode] = useState<'receipt' | 'percent' | 'fixed'>('receipt');
  const [tipValue, setTipValue] = useState<number>(10);
  const [isChartVisible, setIsChartVisible] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Hook to check visibility for Recharts safety
  useEffect(() => {
    const checkVisibility = () => {
        if (panelRef.current) {
            // Check if the element has width/height, implying it's visible in the layout
            const { offsetWidth, offsetHeight } = panelRef.current;
            setIsChartVisible(offsetWidth > 0 && offsetHeight > 0);
        }
    };
    
    // Check initially and on resize
    checkVisibility();
    window.addEventListener('resize', checkVisibility);
    // Simple interval to check if tab changed visibility
    const interval = setInterval(checkVisibility, 500);

    return () => {
        window.removeEventListener('resize', checkVisibility);
        clearInterval(interval);
    };
  }, []);

  const summaryData = useMemo(() => {
    const peopleMap = new Map<string, PersonSummary>();
    let unassignedTotal = 0;

    peopleMap.set('Unassigned', {
      name: 'Unassigned',
      items: [],
      subtotal: 0,
      taxShare: 0,
      tipShare: 0,
      total: 0
    });

    data.items.forEach(item => {
      if (item.assignedTo.length === 0) {
        const p = peopleMap.get('Unassigned')!;
        p.items.push({ name: item.name, cost: item.price, quantity: item.quantity });
        p.subtotal += item.price;
        unassignedTotal += item.price;
      } else {
        const splitPrice = item.price / item.assignedTo.length;
        const splitQty = item.quantity / item.assignedTo.length;
        
        item.assignedTo.forEach(personName => {
          if (!peopleMap.has(personName)) {
            peopleMap.set(personName, {
              name: personName,
              items: [],
              subtotal: 0,
              taxShare: 0,
              tipShare: 0,
              total: 0
            });
          }
          const p = peopleMap.get(personName)!;
          const existingItem = p.items.find(i => i.name === item.name);
          if (existingItem) {
              existingItem.cost += splitPrice;
              existingItem.quantity += splitQty;
          } else {
              p.items.push({ name: item.name, cost: splitPrice, quantity: splitQty });
          }
          p.subtotal += splitPrice;
        });
      }
    });

    const validSubtotal = data.subtotal || 1; 
    
    Array.from(peopleMap.values()).forEach(person => {
       const ratio = person.subtotal / validSubtotal;
       person.taxShare = data.tax * ratio;
       person.tipShare = data.tip * ratio;
       person.total = person.subtotal + person.taxShare + person.tipShare;
    });

    const result = Array.from(peopleMap.values());
    const unassigned = result.find(p => p.name === 'Unassigned');
    const others = result.filter(p => p.name !== 'Unassigned').sort((a, b) => b.total - a.total);
    
    if (unassigned && unassigned.subtotal > 0.01) {
        return [unassigned, ...others];
    }
    return others;
  }, [data]);

  const chartData = summaryData.map(p => ({
    name: p.name,
    value: p.total
  })).filter(p => p.value > 0);

  const allAssigned = summaryData.every(p => p.name !== 'Unassigned');

  const handleTipChange = (mode: 'receipt' | 'percent' | 'fixed', value?: number) => {
      setTipMode(mode);
      if (value !== undefined) setTipValue(value);
      
      let newTipAmount = data.tip;

      if (mode === 'fixed' && value !== undefined) {
          newTipAmount = value;
      } else if (mode === 'percent' && value !== undefined) {
          newTipAmount = data.subtotal * (value / 100);
      }
      
      if (mode !== 'receipt') {
        onUpdateTip(newTipAmount);
      }
  };

  const downloadImage = async () => {
      if (panelRef.current) {
          try {
              const canvas = await html2canvas(panelRef.current, {
                  backgroundColor: '#ffffff',
                  scale: 2
              });
              const link = document.createElement('a');
              link.download = 'bill-split-summary.png';
              link.href = canvas.toDataURL();
              link.click();
          } catch (e) {
              console.error("Error generating image", e);
          }
      }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 h-full flex flex-col relative" ref={panelRef}>
      <div className="p-3 md:p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 shrink-0">
        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <span>💰</span> Live Split
        </h3>
        {allAssigned && (
             <button onClick={downloadImage} className="text-indigo-600 hover:text-indigo-800 p-1.5 hover:bg-indigo-50 rounded-lg transition-colors" title="Descargar imagen">
                 <Download size={18} />
             </button>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-3">
        {summaryData.length === 0 ? (
            <div className="text-center text-gray-400 py-10">
                <p>Asigna artículos para ver el resumen</p>
            </div>
        ) : (
            summaryData.map((person) => (
                <div key={person.name} className={`rounded-lg p-3 ${person.name === 'Unassigned' ? 'bg-red-50 border border-red-100' : 'bg-gray-50 border border-gray-100'}`}>
                    <div className="flex justify-between items-center mb-1">
                        <span className={`font-semibold ${person.name === 'Unassigned' ? 'text-red-600' : 'text-gray-800'}`}>{person.name}</span>
                        <span className="font-bold text-gray-900">{data.currency}{person.total.toFixed(2)}</span>
                    </div>
                    <div className="text-xs text-gray-500 flex justify-between">
                        <span>Items: {data.currency}{person.subtotal.toFixed(2)}</span>
                        <span>Tax/Tip: {data.currency}{(person.taxShare + person.tipShare).toFixed(2)}</span>
                    </div>
                    {person.items.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-200/50">
                             <ul className="text-[10px] text-gray-500 space-y-0.5">
                                {person.items.map((i, idx) => (
                                    <li key={idx} className="flex justify-between">
                                        <span>
                                            {i.quantity > 0.99 ? <span className="font-semibold text-gray-700">{Number(i.quantity.toFixed(1))}x </span> : ''}
                                            {i.name}
                                        </span>
                                        <span>{data.currency}{i.cost.toFixed(2)}</span>
                                    </li>
                                ))}
                             </ul>
                        </div>
                    )}
                </div>
            ))
        )}
      </div>

      <div className="h-40 w-full min-h-[160px] shrink-0 border-t border-gray-100 pt-2 bg-white relative">
        <div className="absolute inset-0 w-full h-full" style={{minHeight: '160px'}}>
            {/* Only render Chart if visible to prevent Recharts width(-1) crash */}
            {isChartVisible && (
                <ResponsiveContainer width="99%" height="100%">
                    <PieChart>
                        <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={30}
                            outerRadius={50}
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip 
                            formatter={(value: number) => `${data.currency}${value.toFixed(2)}`}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                    </PieChart>
                </ResponsiveContainer>
            )}
        </div>
      </div>
      
      {/* Tip Control Section */}
      <div className="p-3 bg-gray-50 border-t border-gray-200 text-sm shrink-0">
        <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-gray-700 flex items-center gap-1"><Calculator size={14}/> Propina</span>
            <span className="font-mono text-gray-900">{data.currency}{data.tip.toFixed(2)}</span>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={() => handleTipChange('percent', 10)}
                className={`flex-1 py-1 px-2 rounded text-xs border ${tipMode === 'percent' && tipValue === 10 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200'}`}
            >
                10%
            </button>
            <button 
                onClick={() => handleTipChange('percent', 15)}
                className={`flex-1 py-1 px-2 rounded text-xs border ${tipMode === 'percent' && tipValue === 15 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200'}`}
            >
                15%
            </button>
            <div className="flex-1 relative">
                <input 
                    type="number" 
                    placeholder="Custom"
                    className="w-full py-1 px-2 rounded text-xs border border-gray-200 focus:border-indigo-500 outline-none text-center"
                    onChange={(e) => handleTipChange('fixed', parseFloat(e.target.value) || 0)}
                />
            </div>
        </div>
      </div>

      <div className="p-4 bg-gray-900 text-white flex justify-between items-center rounded-b-xl shrink-0">
        <span className="text-sm font-medium">Total Final</span>
        <span className="text-xl font-bold">{data.currency}{data.total.toFixed(2)}</span>
      </div>
    </div>
  );
};

export default SummaryPanel;