import React from 'react';
import { ReceiptItem } from '../types';
import { User, Users, Edit2 } from 'lucide-react';

interface Props {
  item: ReceiptItem;
  currency: string;
  onEdit: (item: ReceiptItem) => void;
}

const ReceiptItemRow: React.FC<Props> = ({ item, currency, onEdit }) => {
  const isAssigned = item.assignedTo.length > 0;

  return (
    <div 
      onClick={() => onEdit(item)}
      className={`p-3 border-b border-gray-100 last:border-0 flex justify-between items-center hover:bg-indigo-50/30 active:bg-indigo-50 transition-colors cursor-pointer group ${isAssigned ? 'bg-green-50/50' : ''}`}
    >
      <div className="flex-1 min-w-0 pr-2">
        <div className="flex items-center gap-2">
            <span className="font-medium text-gray-800 truncate block">{item.name}</span>
            {item.quantity !== 1 && <span className="text-xs text-gray-400 font-mono">x{item.quantity}</span>}
        </div>
        <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-1">
          {isAssigned ? (
            item.assignedTo.map((person, idx) => (
              <span key={idx} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800">
                {person}
              </span>
            ))
          ) : (
            <span className="text-gray-400 italic text-[10px]">Sin asignar</span>
          )}
        </div>
      </div>
      <div className="text-right flex items-center gap-3">
        <div>
            <div className="font-semibold text-gray-900">{currency}{item.price.toFixed(2)}</div>
            <div className="flex justify-end mt-1">
                {isAssigned ? (
                    <div className="flex -space-x-1">
                        {item.assignedTo.length === 1 ? (
                            <User size={12} className="text-green-600" />
                        ) : (
                            <Users size={12} className="text-green-600" />
                        )}
                    </div>
                ) : (
                    <div className="w-3 h-3 rounded-full border border-gray-300"></div>
                )}
            </div>
        </div>
        <Edit2 className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
};

export default ReceiptItemRow;