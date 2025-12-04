
import React, { useState, useRef, useEffect } from 'react';
import { Camera, Send, Receipt, Plus, Loader2, ImagePlus, X, Eye, Save, Image as ImageIcon, Video, Merge, Trash2, Files } from 'lucide-react';
import { ReceiptData, ChatMessage, ReceiptItem } from './types';
import * as GeminiService from './services/gemini';
import ReceiptItemRow from './components/ReceiptItemRow';
import SummaryPanel from './components/SummaryPanel';

// Default empty state
const INITIAL_DATA: ReceiptData = {
  items: [],
  subtotal: 0,
  tax: 0,
  tip: 0,
  total: 0,
  currency: '$'
};

interface EditModalState {
    isOpen: boolean;
    mode: 'edit' | 'add';
    item?: ReceiptItem;
}

interface MergeModalState {
    isOpen: boolean;
    newData: ReceiptData | null;
}

const App: React.FC = () => {
  const [receiptData, setReceiptData] = useState<ReceiptData>(INITIAL_DATA);
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: 'welcome',
    role: 'system',
    text: '¡Hola! Sube una foto del recibo para empezar.',
    timestamp: Date.now()
  }]);
  const [input, setInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isProcessingChat, setIsProcessingChat] = useState(false);
  const [activeTab, setActiveTab] = useState<'receipt' | 'summary'>('receipt');
  
  // Modals
  const [showImageModal, setShowImageModal] = useState(false);
  const [showWebcam, setShowWebcam] = useState(false);
  const [editModal, setEditModal] = useState<EditModalState>({ isOpen: false, mode: 'add' });
  const [mergeModal, setMergeModal] = useState<MergeModalState>({ isOpen: false, newData: null });
  const [editForm, setEditForm] = useState({ name: '', price: '', quantity: '1' });

  // Refs
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);   // For Gallery/File Picker
  const cameraInputRef = useRef<HTMLInputElement>(null); // For Direct Camera Access
  const videoRef = useRef<HTMLVideoElement>(null);       // For Desktop Webcam
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cleanup webcam on unmount
  useEffect(() => {
    return () => {
      stopWebcam();
    };
  }, []);

  const calculateTotal = (data: ReceiptData) => {
      // Recalculate Subtotal from items
      const newSubtotal = data.items.reduce((acc, item) => acc + item.price, 0);
      return {
          ...data,
          subtotal: newSubtotal,
          total: newSubtotal + data.tax + data.tip
      };
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value to allow selecting the same file again
    e.target.value = '';

    processImageFile(file);
  };

  const processImageFile = (file: File | Blob) => {
    setIsAnalyzing(true);
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'system', text: 'Analizando recibo... Esto puede tardar un momento.', timestamp: Date.now() }]);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        if (typeof reader.result === 'string') {
            const base64String = reader.result.split(',')[1];
            setReceiptImage(reader.result); // Store for viewing later
            
            try {
                const newData = await GeminiService.analyzeReceiptImage(base64String);
                
                // Add ScanID to new items to track batches
                const scanId = `scan-${Date.now()}`;
                newData.items = newData.items.map(i => ({ ...i, scanId }));

                // Check if we should merge or replace
                if (receiptData.items.length > 0) {
                    setMergeModal({ isOpen: true, newData });
                    setMessages(prev => [...prev, { 
                        id: Date.now().toString(), 
                        role: 'system', 
                        text: `He encontrado ${newData.items.length} artículos nuevos. ¿Quieres añadirlos a la cuenta actual?`, 
                        timestamp: Date.now() 
                    }]);
                } else {
                    applyNewReceiptData(newData);
                }
            } catch (err) {
                setMessages(prev => [...prev, { id: Date.now().toString(), role: 'system', text: 'No pude leer el recibo. Por favor intenta con una foto más clara.', timestamp: Date.now() }]);
            } finally {
                setIsAnalyzing(false);
            }
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error(error);
      setIsAnalyzing(false);
    }
  };

  const applyNewReceiptData = (data: ReceiptData) => {
      setReceiptData(data);
      setMessages(prev => [...prev, { 
          id: Date.now().toString(), 
          role: 'model', 
          text: `¡Recibo listo! He encontrado ${data.items.length} artículos. El total es ${data.currency}${data.total}. Ahora dime quién pidió qué.`, 
          timestamp: Date.now() 
      }]);
  };

  const handleMergeOption = (option: 'merge' | 'replace') => {
      if (!mergeModal.newData) return;

      if (option === 'replace') {
          applyNewReceiptData(mergeModal.newData);
      } else {
          // Merge Logic
          setReceiptData(prev => {
              const mergedItems = [...prev.items, ...(mergeModal.newData!.items)];
              const mergedSubtotal = prev.subtotal + mergeModal.newData!.subtotal;
              const mergedTax = prev.tax + mergeModal.newData!.tax;
              const mergedTip = prev.tip + mergeModal.newData!.tip;
              
              return {
                  items: mergedItems,
                  subtotal: mergedSubtotal,
                  tax: mergedTax,
                  tip: mergedTip,
                  total: mergedSubtotal + mergedTax + mergedTip,
                  currency: prev.currency // Keep original currency or assume same
              };
          });
          setMessages(prev => [...prev, { 
              id: Date.now().toString(), 
              role: 'model', 
              text: `He añadido ${mergeModal.newData.items.length} artículos a la cuenta existente.`, 
              timestamp: Date.now() 
          }]);
      }
      setMergeModal({ isOpen: false, newData: null });
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isProcessingChat || receiptData.items.length === 0) return;

    const userText = input;
    setInput('');
    setIsProcessingChat(true);

    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', text: userText, timestamp: Date.now() }]);

    try {
      const result = await GeminiService.processSplitCommand(receiptData.items, userText);
      
      setReceiptData(prev => {
        const newItems = prev.items.map(item => {
           const update = result.updatedItems.find((u: any) => u.id === item.id);
           return update ? { ...item, assignedTo: update.assignedTo } : item;
        });
        return { ...prev, items: newItems };
      });

      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: result.message, timestamp: Date.now() }]);

    } catch (error) {
       setMessages(prev => [...prev, { id: Date.now().toString(), role: 'system', text: 'Lo siento, tuve problemas para entender ese comando.', timestamp: Date.now() }]);
    } finally {
      setIsProcessingChat(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSendMessage();
  };

  const triggerGallery = () => {
    fileInputRef.current?.click();
  };

  const triggerCamera = () => {
    // Robust detection for mobile devices
    const isMobileUserAgent = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const isSmallScreen = window.innerWidth < 1024; // Treat small tablets/phones as mobile
    
    if (isMobileUserAgent || isSmallScreen) {
        // Force click on the hidden capture input
        if (cameraInputRef.current) {
            cameraInputRef.current.click();
        } else {
            alert("Error al acceder a la cámara nativa.");
        }
    } else {
        // Desktop Webcam Modal
        setShowWebcam(true);
        startWebcam();
    }
  };

  // --- Webcam Logic (Desktop) ---

  const startWebcam = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
        });
        streamRef.current = stream;
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
        }
    } catch (err) {
        console.error("Error accessing webcam:", err);
        alert("No se pudo acceder a la cámara. Asegúrate de dar permisos y usar HTTPS o Localhost.");
        setShowWebcam(false);
    }
  };

  const stopWebcam = () => {
      if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
      }
  };

  const captureWebcam = () => {
      if (videoRef.current) {
          const canvas = document.createElement('canvas');
          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
              ctx.drawImage(videoRef.current, 0, 0);
              canvas.toBlob((blob) => {
                  if (blob) {
                      processImageFile(blob);
                      setShowWebcam(false);
                      stopWebcam();
                  }
              }, 'image/jpeg');
          }
      }
  };

  const closeWebcam = () => {
      setShowWebcam(false);
      stopWebcam();
  };

  // --- CRUD Operations ---

  const openEditModal = (item: ReceiptItem) => {
      setEditModal({ isOpen: true, mode: 'edit', item });
      setEditForm({ 
          name: item.name, 
          price: item.price.toString(), 
          quantity: item.quantity.toString() 
      });
  };

  const openAddModal = () => {
      setEditModal({ isOpen: true, mode: 'add' });
      setEditForm({ name: '', price: '', quantity: '1' });
  };

  const handleSaveItem = () => {
      const price = parseFloat(editForm.price);
      const quantity = parseFloat(editForm.quantity);
      
      if (!editForm.name || isNaN(price) || isNaN(quantity)) return; // Simple validation

      if (editModal.mode === 'add') {
          const newItem: ReceiptItem = {
              id: `manual-${Date.now()}`,
              name: editForm.name,
              price: price,
              quantity: quantity,
              assignedTo: []
          };
          setReceiptData(prev => calculateTotal({
              ...prev,
              items: [...prev.items, newItem]
          }));
      } else if (editModal.mode === 'edit' && editModal.item) {
          setReceiptData(prev => calculateTotal({
              ...prev,
              items: prev.items.map(i => i.id === editModal.item!.id ? {
                  ...i,
                  name: editForm.name,
                  price: price,
                  quantity: quantity
              } : i)
          }));
      }
      setEditModal({ ...editModal, isOpen: false });
  };

  const updateTip = (newTipAmount: number) => {
      setReceiptData(prev => ({
          ...prev,
          tip: newTipAmount,
          total: prev.subtotal + prev.tax + newTipAmount
      }));
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900">
      
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex justify-between items-center shadow-sm shrink-0 z-10">
        <div className="flex items-center gap-2">
           <div className="bg-indigo-600 p-1.5 rounded-lg">
             <Receipt className="text-white w-5 h-5" />
           </div>
           <h1 className="font-bold text-lg tracking-tight text-gray-800 hidden sm:block">BillSplit<span className="text-indigo-600">AI</span></h1>
           <h1 className="font-bold text-lg tracking-tight text-gray-800 sm:hidden">Split<span className="text-indigo-600">AI</span></h1>
        </div>
        <div className="flex gap-2">
            {receiptImage && (
                <button 
                    onClick={() => setShowImageModal(true)}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                    title="Ver recibo original"
                >
                    <Eye size={20} />
                </button>
            )}
            
            {/* Gallery Button */}
            <button 
                onClick={triggerGallery}
                disabled={isAnalyzing}
                className="flex items-center gap-2 bg-white text-gray-700 border border-gray-300 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition active:scale-95 disabled:opacity-50"
                title="Subir desde galería"
            >
                <ImageIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Subir</span>
            </button>

            {/* Camera Button */}
            <button 
                onClick={triggerCamera}
                disabled={isAnalyzing}
                className="flex items-center gap-2 bg-gray-900 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition active:scale-95 disabled:opacity-50"
                title="Hacer foto"
            >
                {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                <span className="hidden sm:inline">Cámara</span>
                <span className="sm:hidden">Foto</span>
            </button>
        </div>
        
        {/* Hidden Inputs */}
        <input 
            type="file" 
            ref={fileInputRef} 
            accept="image/*" 
            onChange={handleFileUpload}
            style={{ display: 'none' }} 
        />
        {/* Important: Do NOT use display:none for the capture input on mobile, use opacity 0 */}
        <input 
            type="file" 
            ref={cameraInputRef} 
            accept="image/*" 
            capture="environment"
            onChange={handleFileUpload}
            style={{ 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                opacity: 0, 
                width: '1px', 
                height: '1px', 
                /* pointerEvents: 'none'  */
            }}
        />
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        
        {/* LEFT PANEL */}
        <div className={`flex-1 flex flex-col min-h-0 bg-white md:border-r md:border-gray-200 transition-all duration-300 ${activeTab === 'receipt' ? 'block' : 'hidden md:block'}`}>
            <div className="p-3 bg-gray-50/50 border-b border-gray-100 flex justify-between items-center sticky top-0 backdrop-blur-sm z-10">
                <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-2">
                    <Receipt className="w-4 h-4" /> Items ({receiptData.items.length})
                </h2>
                <button 
                    onClick={openAddModal} 
                    className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded hover:bg-indigo-100 transition"
                >
                    <Plus size={14} /> Añadir
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
                {receiptData.items.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center p-8 text-center text-gray-400">
                        <div className="bg-gray-100 p-6 rounded-full mb-4">
                            <ImagePlus className="w-10 h-10 text-gray-300" />
                        </div>
                        <p className="max-w-xs text-sm mb-4">Sube una foto del recibo para empezar, o añade artículos manualmente.</p>
                        <button onClick={openAddModal} className="text-indigo-600 text-sm font-medium hover:underline">
                            + Añadir artículo manualmente
                        </button>
                    </div>
                ) : (
                    <div className="pb-20 md:pb-0">
                        {receiptData.items.map((item) => (
                            <ReceiptItemRow 
                                key={item.id} 
                                item={item} 
                                currency={receiptData.currency} 
                                onEdit={openEditModal}
                            />
                        ))}
                        
                        <div className="p-4 border-t border-gray-100 mt-2 bg-gray-50 space-y-1">
                             <div className="flex justify-between text-xs text-gray-500">
                                <span>Subtotal</span>
                                <span>{receiptData.currency}{receiptData.subtotal.toFixed(2)}</span>
                             </div>
                             <div className="flex justify-between text-xs text-gray-500">
                                <span>Impuestos</span>
                                <span>{receiptData.currency}{receiptData.tax.toFixed(2)}</span>
                             </div>
                             <div className="flex justify-between text-xs text-gray-500">
                                <span>Propina</span>
                                <span>{receiptData.currency}{receiptData.tip.toFixed(2)}</span>
                             </div>
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* RIGHT PANEL */}
        <div className={`flex-1 flex flex-col min-h-0 bg-gray-50 transition-all duration-300 ${activeTab === 'summary' ? 'block' : 'hidden md:block'}`}>
             <div className="h-full p-4 overflow-hidden">
                <SummaryPanel data={receiptData} onUpdateTip={updateTip} />
             </div>
        </div>

        {/* Mobile Tab Switcher */}
        <div className="md:hidden absolute top-2 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur shadow-lg rounded-full p-1 flex items-center gap-1 border border-gray-200 z-20">
            <button 
                onClick={() => setActiveTab('receipt')}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${activeTab === 'receipt' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
                Items
            </button>
            <button 
                onClick={() => setActiveTab('summary')}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${activeTab === 'summary' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
                Resumen
            </button>
        </div>

      </main>

      {/* Chat Interface */}
      <div className="bg-white border-t border-gray-200 shrink-0 z-30">
        <div className="h-32 md:h-48 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
            {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                        msg.role === 'user' 
                        ? 'bg-indigo-600 text-white rounded-br-none' 
                        : msg.role === 'system'
                        ? 'bg-gray-200 text-gray-600 text-xs py-1 px-3'
                        : 'bg-white border border-gray-100 text-gray-800 rounded-bl-none'
                    }`}>
                        {msg.text}
                    </div>
                </div>
            ))}
            <div ref={chatEndRef} />
        </div>

        <div className="p-3 bg-white">
            <div className="relative flex items-center gap-2">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder={receiptData.items.length === 0 ? "Sube un recibo o añade items..." : "Ej: 'Emilia pidió la pizza', 'Pepe y Ana comparten vino'"}
                    disabled={receiptData.items.length === 0 || isProcessingChat}
                    className="flex-1 bg-gray-100 border-0 rounded-full px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button 
                    onClick={handleSendMessage}
                    disabled={!input.trim() || isProcessingChat || receiptData.items.length === 0}
                    className="bg-indigo-600 text-white p-3 rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-colors shadow-sm"
                >
                    {isProcessingChat ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
            </div>
        </div>
      </div>

      {/* WEBCAM MODAL (Desktop) */}
      {showWebcam && (
          <div className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-4">
              <div className="relative w-full max-w-2xl bg-black rounded-lg overflow-hidden shadow-2xl border border-gray-800">
                  <video ref={videoRef} autoPlay playsInline className="w-full h-auto bg-black" />
                  
                  <div className="absolute bottom-6 left-0 right-0 flex justify-center items-center gap-6">
                      <button 
                          onClick={closeWebcam}
                          className="p-3 bg-red-600/80 hover:bg-red-600 text-white rounded-full transition-all"
                          title="Cancelar"
                      >
                          <X size={24} />
                      </button>
                      <button 
                          onClick={captureWebcam}
                          className="p-4 bg-white text-black rounded-full hover:scale-105 transition-all shadow-lg border-4 border-gray-300"
                          title="Capturar Foto"
                      >
                          <div className="w-6 h-6 bg-black rounded-full"></div>
                      </button>
                  </div>
              </div>
              <p className="text-white mt-4 text-sm opacity-70">Asegura que el recibo esté bien iluminado</p>
          </div>
      )}

      {/* IMAGE MODAL */}
      {showImageModal && receiptImage && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowImageModal(false)}>
              <div className="relative max-w-full max-h-full">
                  <button onClick={() => setShowImageModal(false)} className="absolute -top-10 right-0 text-white p-2">
                      <X size={24} />
                  </button>
                  <img src={receiptImage} alt="Original Receipt" className="max-w-full max-h-[85vh] rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
              </div>
          </div>
      )}

      {/* MERGE RECEIPTS MODAL */}
      {mergeModal.isOpen && mergeModal.newData && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 text-center" onClick={(e) => e.stopPropagation()}>
                  <div className="mx-auto w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-4">
                      <Files size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">¿Más tickets?</h3>
                  <p className="text-gray-500 text-sm mb-6">
                      Has escaneado otro recibo con {mergeModal.newData.items.length} artículos.
                      ¿Quieres añadirlos a la cuenta actual o empezar una nueva?
                  </p>
                  
                  <div className="grid grid-cols-1 gap-3">
                      <button 
                          onClick={() => handleMergeOption('merge')}
                          className="w-full py-3 px-4 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2 shadow-sm"
                      >
                          <Merge size={18} />
                          Añadir a cuenta actual
                      </button>
                      
                      <button 
                          onClick={() => handleMergeOption('replace')}
                          className="w-full py-3 px-4 bg-white text-red-600 font-medium rounded-lg border border-gray-200 hover:bg-red-50 flex items-center justify-center gap-2"
                      >
                          <Trash2 size={18} />
                          Borrar anterior y empezar nuevo
                      </button>

                      <button 
                           onClick={() => setMergeModal({isOpen: false, newData: null})}
                           className="text-gray-400 text-xs font-medium hover:text-gray-600 mt-2"
                      >
                          Cancelar operación
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* EDIT/ADD ITEM MODAL */}
      {editModal.isOpen && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-xs p-5" onClick={(e) => e.stopPropagation()}>
                  <h3 className="text-lg font-bold text-gray-800 mb-4">{editModal.mode === 'add' ? 'Añadir Artículo' : 'Editar Artículo'}</h3>
                  <div className="space-y-3">
                      <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Nombre</label>
                          <input 
                              type="text" 
                              className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                              value={editForm.name}
                              onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                          />
                      </div>
                      <div className="flex gap-3">
                          <div className="flex-1">
                              <label className="block text-xs font-medium text-gray-500 mb-1">Precio Total</label>
                              <input 
                                  type="number" 
                                  step="0.01"
                                  className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                  value={editForm.price}
                                  onChange={(e) => setEditForm({...editForm, price: e.target.value})}
                              />
                          </div>
                          <div className="w-20">
                              <label className="block text-xs font-medium text-gray-500 mb-1">Cant.</label>
                              <input 
                                  type="number" 
                                  step="1"
                                  className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                  value={editForm.quantity}
                                  onChange={(e) => setEditForm({...editForm, quantity: e.target.value})}
                              />
                          </div>
                      </div>
                  </div>
                  <div className="flex gap-2 mt-6">
                      <button 
                          onClick={() => setEditModal({ ...editModal, isOpen: false })}
                          className="flex-1 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                      >
                          Cancelar
                      </button>
                      <button 
                          onClick={handleSaveItem}
                          className="flex-1 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 flex justify-center items-center gap-2"
                      >
                          <Save size={16} /> Guardar
                      </button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default App;
