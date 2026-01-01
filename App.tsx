
import React, { useState, useEffect, useMemo } from 'react';
import { View, StockItem, LabelExtractionResult, Product, User, ReceiptHistory, ReleaseHistory } from './types';
import { Layout } from './components/Layout';
import { Scanner } from './components/Scanner';
import { extractLabelInfo } from './services/geminiService';
import { storageService } from './services/storageService';

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<View>(View.INVENTORY);
  const [items, setItems] = useState<StockItem[]>([]);
  const [receiptHistory, setReceiptHistory] = useState<ReceiptHistory[]>([]);
  const [releaseHistory, setReleaseHistory] = useState<ReleaseHistory[]>([]);
  const [registeredProducts, setRegisteredProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [scanResult, setScanResult] = useState<LabelExtractionResult | null>(null);
  const [matchedProduct, setMatchedProduct] = useState<Product | null>(null);
  const [potentialMatches, setPotentialMatches] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [inputQty, setInputQty] = useState<number>(1);
  const [patientName, setPatientName] = useState('');

  const [earliestExpInfo, setEarliestExpInfo] = useState<{ exp: string, batch: string } | null>(null);
  const [duplicateBatchInfo, setDuplicateBatchInfo] = useState<{ date: string, qty: number } | null>(null);
  const [duplicateProductWarning, setDuplicateProductWarning] = useState<{ name: string, manufacturer: string } | null>(null);
  const [loginAttemptUser, setLoginAttemptUser] = useState<User | null>(null);
  const [loginPassword, setLoginPassword] = useState('');

  const [newUser, setNewUser] = useState({ firstName: '', lastName: '', username: '', password: '' });
  const [sbConfig, setSbConfig] = useState({ url: '', key: '' });
  const [isConfigured, setIsConfigured] = useState(false);

  const [tempContact, setTempContact] = useState('');
  const [tempMinStock, setTempMinStock] = useState<number>(0);
  
  // State for manual selection
  const [isManualSelecting, setIsManualSelecting] = useState(false);
  const [manualProductSearch, setManualProductSearch] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('supabase_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSbConfig(parsed);
        if (parsed.url && parsed.key) {
          setIsConfigured(true);
          loadData();
        }
      } catch (e) {
        localStorage.removeItem('supabase_config');
      }
    } else {
      setActiveView(View.SETTINGS);
    }
    const savedUser = localStorage.getItem('current_user');
    if (savedUser) setCurrentUser(JSON.parse(savedUser));
  }, []);

  const loadData = async () => {
    if (!storageService.isConfigured()) return;
    setIsDataLoading(true);
    try {
      const [itemsData, productsData, usersData, historyData, outHistoryData] = await Promise.all([
        storageService.fetchItems(),
        storageService.fetchProducts(),
        storageService.fetchUsers(),
        storageService.fetchReceiptHistory(),
        storageService.fetchReleaseHistory()
      ]);
      setItems(itemsData || []);
      setRegisteredProducts(productsData || []);
      setUsers(usersData || []);
      setReceiptHistory(historyData || []);
      setReleaseHistory(outHistoryData || []);
    } catch (err: any) {
      setError("เกิดข้อผิดพลาด: " + (err.message || "Cloud Error"));
    } finally {
      setIsDataLoading(false);
    }
  };

  const handleTestConnection = async () => {
    if (!sbConfig.url || !sbConfig.key) {
      setError("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }
    setIsTestingConnection(true);
    setError(null);
    try {
      await storageService.testConnection(sbConfig.url, sbConfig.key);
      showSuccess("✅ เชื่อมต่อ Cloud สำเร็จ!");
    } catch (err: any) {
      setError("❌ เชื่อมต่อล้มเหลว: " + err.message);
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSaveConfig = () => {
    if (!sbConfig.url || !sbConfig.key) {
      setError("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }
    storageService.configure(sbConfig.url, sbConfig.key);
    setIsConfigured(true);
    showSuccess("บันทึก Cloud Config สำเร็จ");
    setActiveView(View.INVENTORY);
    loadData();
  };

  const handleUserReg = async () => {
    if (!newUser.firstName || !newUser.username || !newUser.password) {
      setError("กรุณากรอกข้อมูลให้ครบ");
      return;
    }
    setIsLoading(true);
    try {
      await storageService.registerUser(newUser);
      setNewUser({ firstName: '', lastName: '', username: '', password: '' });
      showSuccess("ลงทะเบียนผู้ใช้สำเร็จ");
      loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyPassword = () => {
    if (!loginAttemptUser) return;
    if (loginPassword === loginAttemptUser.password) {
      setCurrentUser(loginAttemptUser);
      localStorage.setItem('current_user', JSON.stringify(loginAttemptUser));
      showSuccess(`ยินดีต้อนรับ คุณ ${loginAttemptUser.firstName}`);
      setLoginAttemptUser(null);
      setLoginPassword('');
    } else {
      setError("รหัสผ่านไม่ถูกต้อง");
    }
  };

  const selectUser = (user: User) => {
    setLoginAttemptUser(user);
    setLoginPassword('');
    setError(null);
  };

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 2000);
  };

  const findMatches = (scannedThai: string, scannedEng: string) => {
    const normalize = (s: string) => (s || "").replace(/[\s\-\_\.]/g, '').toLowerCase();
    const normSThai = normalize(scannedThai);
    const normSEng = normalize(scannedEng);
    
    return registeredProducts.filter(p => {
      const pThai = normalize(p.thai_name);
      const pEng = normalize(p.english_name);
      
      const prefixLength = 10;
      const thaiPrefixMatch = normSThai.length >= prefixLength && pThai.length >= prefixLength && 
                             normSThai.substring(0, prefixLength) === pThai.substring(0, prefixLength);
      
      const engPrefixMatch = normSEng.length >= prefixLength && pEng.length >= prefixLength && 
                            normSEng.substring(0, prefixLength) === pEng.substring(0, prefixLength);

      const thaiContains = (normSThai && pThai.includes(normSThai)) || (normSThai && pThai.length > 0 && normSThai.includes(pThai));
      const engContains = (normSEng && pEng.includes(normSEng)) || (normSEng && pEng.length > 0 && normSEng.includes(pEng));

      return thaiPrefixMatch || engPrefixMatch || thaiContains || engContains;
    });
  };

  const handleRegisterScan = async (image: string) => {
    if (!currentUser) { setActiveView(View.USERS); return; }
    setIsLoading(true);
    setError(null);
    setDuplicateProductWarning(null);
    try {
      const data = await extractLabelInfo(image);
      const finalThaiName = (data.thaiName || "").trim() === "" ? (data.englishName || "").trim() : data.thaiName;
      
      const normalize = (s: string) => (s || "").replace(/[\s\-\_\.]/g, '').toLowerCase();
      const normalizedScanned = normalize(finalThaiName);
      const existingProduct = registeredProducts.find(p => {
        const pThai = normalize(p.thai_name);
        const pEng = normalize(p.english_name);
        return pThai === normalizedScanned || pEng === normalizedScanned || 
               (data.englishName && pEng === normalize(data.englishName));
      });

      if (existingProduct) {
        setDuplicateProductWarning({
          name: existingProduct.thai_name || existingProduct.english_name,
          manufacturer: existingProduct.manufacturer || 'ไม่ระบุ'
        });
      }

      setScanResult({ ...data, thaiName: finalThaiName, image: image });
      setTempContact('');
      setTempMinStock(0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const startManualRegistration = () => {
    setScanResult({
      thaiName: '',
      englishName: '',
      batchNo: '',
      mfd: '',
      exp: '',
      manufacturer: '',
    });
    setTempContact('');
    setTempMinStock(0);
  };

  const executeRegistration = async () => {
    if (!currentUser || !scanResult) return;
    setIsLoading(true);
    try {
      await storageService.registerProduct({
        thai_name: scanResult.thaiName,
        english_name: scanResult.englishName,
        manufacturer: scanResult.manufacturer,
        contact_number: tempContact,
        min_stock: tempMinStock,
        photo: scanResult.image
      }, currentUser.username);
      setScanResult(null);
      showSuccess("ลงทะเบียนสินค้าสำเร็จ");
      loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStockIn = async (image: string) => {
    if (!currentUser) { setActiveView(View.USERS); return; }
    setIsLoading(true);
    setError(null);
    setDuplicateBatchInfo(null);
    setPotentialMatches([]);
    setMatchedProduct(null);
    try {
      const data = await extractLabelInfo(image);
      const matches = findMatches(data.thaiName, data.englishName);
      if (matches.length === 0) { 
        setError(`⚠️ ไม่พบสินค้าในทะเบียน กรุณาลงทะเบียน Master Data ก่อน`); 
        return; 
      }
      setScanResult(data);
      setPotentialMatches(matches);
      if (matches.length === 1) selectItemForStockIn(matches[0], data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const selectItemForStockIn = (product: Product, data: LabelExtractionResult) => {
    setMatchedProduct(product);
    setScanResult({ ...data, thaiName: product.thai_name, englishName: product.english_name });
    setInputQty(1);
    setIsManualSelecting(false);
    const duplicate = items.find(i => i.batch_no === data.batchNo && i.status === 'In Stock') || receiptHistory.find(h => h.batch_no === data.batchNo);
    if (duplicate) {
      setDuplicateBatchInfo({ 
        date: new Date('created_at' in duplicate ? duplicate.created_at : duplicate.timestamp).toLocaleString('th-TH'), 
        qty: duplicate.quantity 
      });
    }
  };

  const startManualStockIn = () => {
    setIsManualSelecting(true);
    setManualProductSearch('');
    setMatchedProduct(null);
    setScanResult(null);
  };

  const executeStockIn = async () => {
    if (!currentUser || !scanResult) return;
    setIsLoading(true);
    try {
      await storageService.saveItem({
        thai_name: scanResult.thaiName,
        english_name: scanResult.englishName,
        batch_no: scanResult.batchNo,
        mfd: scanResult.mfd,
        exp: scanResult.exp,
        manufacturer: scanResult.manufacturer,
        quantity: inputQty
      }, currentUser.username);
      setScanResult(null);
      setMatchedProduct(null);
      showSuccess(`รับเข้าสำเร็จโดย ${currentUser.firstName}`);
      setActiveView(View.INVENTORY);
      loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStockOutScan = async (image: string) => {
    if (!currentUser) { setActiveView(View.USERS); return; }
    setIsLoading(true);
    setError(null);
    setPotentialMatches([]);
    setMatchedProduct(null);
    try {
      const data = await extractLabelInfo(image);
      const matches = findMatches(data.thaiName, data.englishName);
      if (matches.length === 0) {
        setError(`⚠️ ไม่พบสินค้าในคลัง`);
        return;
      }
      setScanResult(data);
      setPotentialMatches(matches);
      if (matches.length === 1) selectItemForStockOut(matches[0], data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const selectItemForStockOut = (product: Product, data: LabelExtractionResult) => {
    setMatchedProduct(product);
    setScanResult({ ...data, thaiName: product.thai_name, englishName: product.english_name });
    setInputQty(1);
    setPatientName('');
    setIsManualSelecting(false);
    const inStockItems = items.filter(i => i.status === 'In Stock' && ((i.thai_name === product.thai_name) || (i.english_name === product.english_name)));
    if (inStockItems.length > 0) {
      const earliest = inStockItems.reduce((prev, curr) => (prev.exp < curr.exp) ? prev : curr);
      if (data.exp > earliest.exp) setEarliestExpInfo({ exp: earliest.exp, batch: earliest.batch_no });
    }
  };

  const startManualStockOut = () => {
    setIsManualSelecting(true);
    setManualProductSearch('');
    setMatchedProduct(null);
    setScanResult(null);
  };

  const executeStockOut = async () => {
    if (!currentUser || !scanResult || !patientName.trim()) {
      if (!patientName.trim()) setError("กรุณาระบุชื่อผู้ป่วย");
      return;
    }
    setIsLoading(true);
    try {
      const releasedItem = await storageService.releaseItemByBatch(scanResult.batchNo, inputQty, currentUser.username, patientName);
      if (releasedItem) {
        showSuccess(`จ่ายออกสำเร็จโดย ${currentUser.firstName}`);
        setScanResult(null);
        setMatchedProduct(null);
        setPatientName('');
        setActiveView(View.INVENTORY);
        loadData();
      } else {
        setError(`❌ ไม่พบข้อมูล Batch หรือจำนวนไม่พอ`);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const groupedStock = useMemo(() => {
    const inStock = items.filter(i => i.status === 'In Stock');
    const groups: Record<string, any> = {};
    inStock.forEach(item => {
      const key = (item.thai_name || item.english_name || "Unknown").toLowerCase();
      if (!groups[key]) {
        const master = registeredProducts.find(p => (p.thai_name?.toLowerCase() === item.thai_name?.toLowerCase()) || (p.english_name?.toLowerCase() === item.english_name?.toLowerCase()));
        groups[key] = { 
          name: item.thai_name || item.english_name,
          thaiName: item.thai_name,
          englishName: item.english_name,
          manufacturer: item.manufacturer, 
          totalCount: 0,
          nearestExpiry: item.exp,
          minStock: master?.min_stock || 0
        };
      }
      groups[key].totalCount += (item.quantity || 1);
      if (item.exp && (!groups[key].nearestExpiry || item.exp < groups[key].nearestExpiry)) groups[key].nearestExpiry = item.exp;
    });
    return Object.values(groups).sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""));
  }, [items, registeredProducts]);

  const filteredProducts = useMemo(() => {
    if (!searchQuery) return registeredProducts;
    return registeredProducts.filter(p => (p.thai_name || "").toLowerCase().includes(searchQuery.toLowerCase()) || (p.english_name || "").toLowerCase().includes(searchQuery.toLowerCase()));
  }, [registeredProducts, searchQuery]);

  const filteredManualProducts = useMemo(() => {
    if (!manualProductSearch) return registeredProducts;
    return registeredProducts.filter(p => (p.thai_name || "").toLowerCase().includes(manualProductSearch.toLowerCase()) || (p.english_name || "").toLowerCase().includes(manualProductSearch.toLowerCase()));
  }, [registeredProducts, manualProductSearch]);

  const LoginRequired = () => (
    <div className="bg-blue-50/50 border-2 border-blue-100 p-10 rounded-[3rem] text-center space-y-6 shadow-sm">
      <div className="w-24 h-24 bg-blue-100/50 rounded-full flex items-center justify-center mx-auto text-4xl">👥</div>
      <h3 className="text-2xl font-black text-blue-900 leading-tight">กรุณาเลือกผู้รับผิดชอบรายการ</h3>
      <button onClick={() => setActiveView(View.USERS)} className="px-10 py-5 bg-blue-900 text-white font-black rounded-[2rem] shadow-xl hover:bg-blue-800 transition-all active:scale-95 flex items-center justify-center gap-3 mx-auto">
        <span className="text-xl">👤</span> เข้าหน้าเลือกผู้ใช้งาน
      </button>
    </div>
  );

  return (
    <Layout activeView={activeView} onViewChange={(v) => { 
      setActiveView(v); 
      setError(null); 
      setScanResult(null); 
      setMatchedProduct(null); 
      setPotentialMatches([]); 
      setEarliestExpInfo(null); 
      setDuplicateBatchInfo(null); 
      setDuplicateProductWarning(null); 
      setIsManualSelecting(false);
    }} currentUser={currentUser}>
      
      {/* Dropdown Selection for Potential Matches */}
      {(potentialMatches.length > 1 && !matchedProduct) && (
        <div className="fixed inset-0 bg-blue-900/90 backdrop-blur-md z-[550] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.3)] animate-in zoom-in-95">
            <div className="p-8 bg-blue-900 text-white">
              <h3 className="font-black text-xl text-white">พบรายการใกล้เคียง ({potentialMatches.length})</h3>
              <p className="text-[10px] font-bold text-blue-200 uppercase tracking-widest mt-1">กรุณาเลือกรายการสินค้าที่ถูกต้องจากระบบ</p>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto space-y-3 bg-slate-50">
              {potentialMatches.map((p) => (
                <button 
                  key={p.id}
                  onClick={() => activeView === View.STOCK_IN ? selectItemForStockIn(p, scanResult!) : selectItemForStockOut(p, scanResult!)}
                  className="w-full text-left p-5 bg-white border-2 border-slate-100 rounded-3xl hover:border-blue-500 hover:shadow-lg transition-all flex items-center gap-4 group"
                >
                  <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center border group-hover:border-blue-200 overflow-hidden shrink-0">
                    {p.photo ? <img src={p.photo} className="w-full h-full object-cover" /> : <span className="text-2xl text-blue-900">📦</span>}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="font-black text-blue-900 text-base group-hover:text-blue-700 truncate">{p.thai_name}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mt-0.5">{(p.manufacturer || 'ไม่ระบุผู้ผลิต')}</p>
                  </div>
                </button>
              ))}
            </div>
            <div className="p-6 bg-white border-t border-slate-100 text-center">
              <button onClick={() => { setScanResult(null); setPotentialMatches([]); }} className="text-sm font-black text-slate-400 hover:text-blue-900 transition-colors">ยกเลิกและถ่ายรูปใหม่</button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Product Selection Overlay (for Stock In/Out) */}
      {isManualSelecting && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[550] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-8 bg-purple-600 text-white">
              <h3 className="font-black text-xl text-white">เลือกสินค้าเพื่อ{activeView === View.STOCK_IN ? 'รับเข้า' : 'จ่ายออก'}</h3>
              <p className="text-[10px] font-bold text-purple-100 uppercase tracking-widest mt-1">กรุณาเลือกสินค้าจากรายการ Master Data</p>
            </div>
            <div className="p-6 border-b border-slate-100">
               <input 
                 type="text" 
                 placeholder="🔍 ค้นหาด้วยชื่อสินค้า..." 
                 className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-purple-100 font-black text-blue-900"
                 value={manualProductSearch}
                 onChange={e => setManualProductSearch(e.target.value)}
                 autoFocus
               />
            </div>
            <div className="p-4 overflow-y-auto space-y-3 bg-slate-50 flex-1">
              {filteredManualProducts.map((p) => (
                <button 
                  key={p.id}
                  onClick={() => {
                    const emptyResult = {
                      thaiName: p.thai_name,
                      englishName: p.english_name,
                      batchNo: '',
                      mfd: '',
                      exp: '',
                      manufacturer: p.manufacturer || '',
                    };
                    activeView === View.STOCK_IN ? selectItemForStockIn(p, emptyResult) : selectItemForStockOut(p, emptyResult);
                  }}
                  className="w-full text-left p-5 bg-white border-2 border-slate-100 rounded-3xl hover:border-purple-500 hover:shadow-lg transition-all flex items-center gap-4 group"
                >
                  <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center border group-hover:border-purple-200 overflow-hidden shrink-0">
                    {p.photo ? <img src={p.photo} className="w-full h-full object-cover" /> : <span className="text-2xl text-purple-600">📦</span>}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="font-black text-blue-900 text-base group-hover:text-purple-700 truncate">{p.thai_name}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mt-0.5">{(p.manufacturer || 'ไม่ระบุผู้ผลิต')}</p>
                  </div>
                </button>
              ))}
              {filteredManualProducts.length === 0 && (
                <div className="text-center py-10">
                  <p className="text-slate-400 font-black">ไม่พบข้อมูลสินค้าที่ค้นหา</p>
                  <button onClick={() => setActiveView(View.REGISTRATION)} className="mt-4 text-purple-600 font-black underline">ไปหน้าลงทะเบียน Master Data</button>
                </div>
              )}
            </div>
            <div className="p-6 bg-white border-t border-slate-100 text-center">
              <button onClick={() => setIsManualSelecting(false)} className="text-sm font-black text-slate-400 hover:text-red-500 transition-colors">ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {/* Login Password Modal */}
      {loginAttemptUser && (
        <div className="fixed inset-0 bg-blue-900/90 backdrop-blur-md z-[600] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 space-y-6 shadow-2xl">
            <div className="text-center">
              <div className="w-24 h-24 bg-blue-50 text-blue-900 rounded-full flex items-center justify-center mx-auto text-4xl font-black mb-6 shadow-inner">{loginAttemptUser.firstName[0]}</div>
              <h3 className="text-2xl font-black text-blue-900">ระบุรหัสผ่าน</h3>
              <p className="text-sm font-bold text-slate-400 mt-1">คุณ {loginAttemptUser.firstName} กรุณายืนยันตัวตน</p>
            </div>
            <input 
              type="password" 
              autoFocus 
              placeholder="••••••••" 
              className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-[2rem] outline-none focus:ring-4 focus:ring-blue-100 font-black text-center text-3xl tracking-widest text-blue-900" 
              value={loginPassword} 
              onChange={e => setLoginPassword(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && handleVerifyPassword()} 
            />
            <div className="flex gap-4 pt-2">
              <button onClick={() => setLoginAttemptUser(null)} className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-3xl font-black text-sm">ยกเลิก</button>
              <button onClick={handleVerifyPassword} className="flex-1 py-5 bg-blue-900 text-white rounded-3xl font-black text-sm shadow-xl">ตกลง</button>
            </div>
          </div>
        </div>
      )}

      {successMessage && <div className="fixed top-24 left-4 right-4 bg-emerald-600 text-white p-6 rounded-[2rem] shadow-2xl z-[700] text-center font-black animate-in slide-in-from-top-4 duration-500">{successMessage}</div>}

      {/* Main Views Container */}
      <div className="animate-in fade-in duration-500">
        {activeView === View.USERS && (
          <div className="space-y-8 pb-32">
            <div className="bg-blue-900 p-10 rounded-[3rem] text-white shadow-xl">
              <h2 className="text-3xl font-black leading-none text-white">ผู้รับผิดชอบรายการ</h2>
              <p className="text-xs font-bold text-blue-200 uppercase tracking-[0.2em] mt-3">Personnel Management</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {users.map(u => (
                <div key={u.id} onClick={() => selectUser(u)} className={`p-6 rounded-[2.5rem] border-4 cursor-pointer transition-all flex items-center justify-between group ${currentUser?.id === u.id ? 'bg-blue-900 border-blue-900 text-white shadow-2xl scale-[1.02]' : 'bg-white border-slate-50 hover:border-blue-100 hover:shadow-lg'}`}>
                  <div className="flex items-center gap-5">
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center font-black text-xl shadow-inner ${currentUser?.id === u.id ? 'bg-white/20' : 'bg-blue-50 text-blue-900'}`}>{u.firstName[0]}</div>
                    <div>
                      <p className={`font-black text-lg ${currentUser?.id === u.id ? 'text-white' : 'text-blue-900'}`}>{u.firstName}</p>
                      <p className={`text-[11px] font-bold ${currentUser?.id === u.id ? 'text-blue-200' : 'text-slate-400'}`}>@{u.username}</p>
                    </div>
                  </div>
                  {currentUser?.id === u.id && <span className="text-2xl text-white">✅</span>}
                </div>
              ))}
            </div>

            <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
              <h3 className="text-lg font-black text-blue-900 uppercase tracking-widest border-b-2 border-blue-50 pb-4">ลงทะเบียนผู้ใช้ใหม่</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ชื่อเรียก</label>
                  <input placeholder="เช่น หมอใจดี" className="w-full p-5 bg-slate-50 rounded-2xl outline-none font-black text-blue-900 placeholder:text-slate-300" value={newUser.firstName} onChange={e => setNewUser({...newUser, firstName: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">USERNAME</label>
                  <input placeholder="user123" className="w-full p-5 bg-slate-50 rounded-2xl outline-none font-black text-blue-900" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">รหัสผ่านลับ</label>
                  <input type="password" placeholder="••••••••" className="w-full p-5 bg-slate-50 rounded-2xl outline-none font-black text-blue-900" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
                </div>
              </div>
              <button onClick={handleUserReg} disabled={isLoading} className="w-full py-6 bg-blue-900 text-white font-black rounded-3xl shadow-2xl shadow-blue-900/20 active:scale-[0.98] transition-all">{isLoading ? 'กำลังประมวลผล...' : 'ลงทะเบียนผู้ใช้งาน'}</button>
            </div>
          </div>
        )}

        {activeView === View.INVENTORY && (
          <div className="space-y-8">
            <div className="flex justify-between items-end px-2">
              <div>
                <h2 className="text-3xl font-black text-blue-900">สต๊อก Cloud</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Real-time Central Stock</p>
              </div>
              <button onClick={loadData} className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-100 hover:rotate-180 transition-all duration-700">🔄</button>
            </div>
            
            <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50">
                    <tr>
                      <th className="px-8 py-6 text-[11px] font-black text-blue-900 uppercase tracking-widest">ชื่อสินค้า</th>
                      <th className="px-8 py-6 text-[11px] font-black text-blue-900 uppercase tracking-widest text-center">คงเหลือ</th>
                      <th className="px-8 py-6 text-[11px] font-black text-blue-900 uppercase tracking-widest text-center">หมดอายุเร็วสุด</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {groupedStock.length > 0 ? groupedStock.map((group: any, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-all group">
                        <td className="px-8 py-7">
                          <div className="font-black text-blue-900 text-base leading-tight group-hover:text-blue-700 transition-colors">{group.thaiName || group.englishName}</div>
                          <div className="text-[11px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">{(group.manufacturer || '-')}</div>
                        </td>
                        <td className="px-8 py-7 text-center">
                          <span className={`px-4 py-2 rounded-2xl font-black text-sm shadow-sm inline-block min-w-[3rem] ${group.totalCount < group.minStock ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-blue-50 text-blue-900 border border-blue-100'}`}>
                            {group.totalCount}
                          </span>
                        </td>
                        <td className="px-8 py-7 text-center">
                          <span className="text-[12px] font-black text-slate-600 bg-slate-100 px-3 py-1 rounded-lg">
                            {group.nearestExpiry || '-'}
                          </span>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={3} className="py-24 text-center">
                          <div className="text-slate-200 text-6xl mb-4">📦</div>
                          <p className="text-slate-300 font-black italic">ยังไม่มีข้อมูลในคลังสินค้า</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeView === View.STOCK_IN && (
          <div className="space-y-8">
            {!currentUser ? <LoginRequired /> : (
              <>
                <div className="bg-blue-900 p-10 rounded-[3rem] text-white shadow-xl relative overflow-hidden">
                  <div className="absolute right-[-10%] top-[-20%] text-[10rem] opacity-5">📥</div>
                  <h2 className="text-3xl font-black leading-none text-white">รับสินค้าเข้า</h2>
                  <p className="text-xs font-bold text-blue-200 uppercase tracking-[0.2em] mt-3">Inventory In-Flow</p>
                </div>
                <div className="flex flex-col gap-4">
                  <Scanner label="สแกนฉลากเพื่อรับเข้า" onScan={handleStockIn} isLoading={isLoading} />
                  <button onClick={startManualStockIn} className="w-full py-4 bg-white border-2 border-slate-100 rounded-[2rem] text-blue-900 font-black text-sm shadow-sm hover:bg-slate-50 transition-all">
                    ⌨️ กรณีกล้องเสีย/ไม่สำเร็จ: กรอกข้อมูลเอง (Manual)
                  </button>
                </div>
                
                {scanResult && matchedProduct && (
                  <div className="bg-white p-10 rounded-[3rem] shadow-2xl border-t-8 border-blue-900 space-y-8 animate-in slide-in-from-bottom-6">
                    <div className="bg-blue-50/50 p-6 rounded-[2rem] border-2 border-blue-100 flex justify-between items-center">
                        <div>
                          <p className="text-[10px] font-black text-blue-900/40 uppercase mb-2 tracking-widest">สินค้าที่เลือก</p>
                          <h4 className="font-black text-blue-900 text-xl leading-tight">{matchedProduct.thai_name}</h4>
                        </div>
                        <button onClick={() => {setMatchedProduct(null); setDuplicateBatchInfo(null); startManualStockIn();}} className="text-[11px] font-black text-blue-900 bg-white px-4 py-2 rounded-xl shadow-sm hover:shadow-md transition-all">เปลี่ยนรายการ</button>
                    </div>

                    {duplicateBatchInfo && (
                      <div className="bg-amber-50 border-2 border-amber-200 p-6 rounded-[2rem] flex items-start gap-4">
                          <span className="text-2xl shrink-0">⚠️</span>
                          <div>
                            <p className="text-sm font-black text-amber-900">ตรวจพบ BATCH ซ้ำในประวัติ!</p>
                            <p className="text-[11px] font-bold text-amber-800 leading-relaxed mt-1">Batch {scanResult.batchNo} เคยรับเข้าแล้วเมื่อ {duplicateBatchInfo.date} จำนวน {duplicateBatchInfo.qty} ชิ้น</p>
                          </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                          <p className="text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Batch Number</p>
                          <input 
                            className="w-full bg-transparent font-black text-blue-900 text-xl outline-none border-b-2 border-slate-200 focus:border-blue-400" 
                            value={scanResult.batchNo}
                            onChange={e => setScanResult({...scanResult, batchNo: e.target.value})}
                          />
                        </div>
                        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                          <p className="text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Expiry Date (หมดอายุ)</p>
                          <input 
                            type="date"
                            className="w-full bg-transparent font-black text-red-600 text-xl outline-none border-b-2 border-slate-200 focus:border-red-400" 
                            value={scanResult.exp}
                            onChange={e => setScanResult({...scanResult, exp: e.target.value})}
                          />
                        </div>
                    </div>

                    <div className="bg-blue-900 p-8 rounded-[2.5rem] text-center shadow-2xl">
                        <p className="text-[10px] font-black text-white/50 mb-4 uppercase tracking-[0.2em]">จำนวนที่รับเข้าจริง</p>
                        <div className="flex items-center justify-center gap-10">
                          <button onClick={() => setInputQty(Math.max(1, inputQty - 1))} className="w-16 h-16 bg-white/10 rounded-full text-white text-3xl font-black hover:bg-white/20 active:scale-90 transition-all border border-white/10">-</button>
                          <input type="number" className="w-32 bg-transparent text-center text-white text-6xl font-black outline-none border-b-4 border-white/20 pb-2" value={inputQty} onChange={e => setInputQty(parseInt(e.target.value) || 1)} />
                          <button onClick={() => setInputQty(inputQty + 1)} className="w-16 h-16 bg-white/10 rounded-full text-white text-3xl font-black hover:bg-white/20 active:scale-90 transition-all border border-white/10">+</button>
                        </div>
                    </div>
                    
                    <button disabled={isLoading} onClick={executeStockIn} className="w-full py-7 bg-blue-900 text-white rounded-[2rem] font-black shadow-2xl shadow-blue-900/30 hover:bg-blue-800 active:scale-[0.98] transition-all text-lg">
                      {isLoading ? 'กำลังบันทึกข้อมูล...' : 'บันทึกรับเข้าสต๊อก'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeView === View.STOCK_OUT && (
          <div className="space-y-8">
            {!currentUser ? <LoginRequired /> : (
              <>
                <div className="bg-slate-900 p-10 rounded-[3rem] text-white shadow-xl relative overflow-hidden">
                  <div className="absolute right-[-10%] top-[-20%] text-[10rem] opacity-5">📤</div>
                  <h2 className="text-3xl font-black leading-none text-white">จ่ายสินค้าออก</h2>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mt-3">Release & Distribution</p>
                </div>
                <div className="flex flex-col gap-4">
                  <Scanner label="สแกนฉลากเพื่อจ่ายออก" onScan={handleStockOutScan} isLoading={isLoading} />
                  <button onClick={startManualStockOut} className="w-full py-4 bg-white border-2 border-slate-100 rounded-[2rem] text-blue-900 font-black text-sm shadow-sm hover:bg-slate-50 transition-all">
                    ⌨️ กรณีกล้องเสีย/ไม่สำเร็จ: ค้นหาสินค้าและกรอกเอง
                  </button>
                </div>

                {scanResult && matchedProduct && (
                  <div className="bg-white p-10 rounded-[3rem] shadow-2xl border-t-8 border-red-600 space-y-8 animate-in slide-in-from-bottom-6">
                    <div className="bg-red-50/50 p-6 rounded-[2rem] border-2 border-red-100 flex justify-between items-center">
                        <div>
                          <p className="text-[10px] font-black text-red-900/40 uppercase mb-2 tracking-widest">สินค้าเป้าหมาย</p>
                          <h4 className="font-black text-blue-900 text-xl leading-tight">{matchedProduct.thai_name}</h4>
                        </div>
                        <button onClick={() => {setMatchedProduct(null); setEarliestExpInfo(null); startManualStockOut();}} className="text-[11px] font-black text-blue-900 bg-white px-4 py-2 rounded-xl shadow-sm">เปลี่ยน</button>
                    </div>

                    {earliestExpInfo && (
                      <div className="bg-amber-50 border-2 border-amber-200 p-6 rounded-[2rem] flex items-start gap-4">
                          <span className="text-2xl shrink-0">⌛</span>
                          <div>
                            <p className="text-sm font-black text-amber-900">ตรวจพบ Batch ใกล้หมดอายุกว่า!</p>
                            <p className="text-[11px] font-bold text-amber-800 leading-relaxed mt-1">มี Batch ที่หมดอายุวันที่ {earliestExpInfo.exp} ({earliestExpInfo.batch}) ควรจ่ายออกก่อนตามหลัก FEFO</p>
                          </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                          <p className="text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Batch Number (พิมพ์เลข Batch)</p>
                          <input 
                            className="w-full bg-transparent font-black text-blue-900 text-xl outline-none border-b-2 border-slate-200 focus:border-red-400" 
                            value={scanResult.batchNo}
                            placeholder="ระบุ Batch ที่ต้องการจ่าย"
                            onChange={e => setScanResult({...scanResult, batchNo: e.target.value})}
                          />
                       </div>
                       <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                          <p className="text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">ชื่อผู้ป่วย / หน่วยงานรับสินค้า</p>
                          <input 
                            type="text" 
                            placeholder="ระบุชื่อ-นามสกุล หรือ รหัสหน่วย" 
                            className="w-full bg-transparent font-black text-blue-900 text-xl outline-none border-b-2 border-slate-200 focus:border-red-400"
                            value={patientName}
                            onChange={e => setPatientName(e.target.value)}
                          />
                       </div>
                    </div>

                    <div className="bg-slate-100 p-8 rounded-[2.5rem] text-center flex flex-col items-center">
                        <p className="text-[10px] font-black text-slate-400 mb-6 uppercase tracking-widest">จำนวนที่ต้องการจ่าย</p>
                        <div className="flex items-center justify-center gap-10">
                          <button onClick={() => setInputQty(Math.max(1, inputQty - 1))} className="w-14 h-14 bg-white text-blue-900 rounded-full shadow-md text-3xl font-black active:scale-90 transition-all border border-slate-200">-</button>
                          <input type="number" className="w-24 bg-transparent text-center text-blue-900 text-6xl font-black outline-none border-b-4 border-slate-300 pb-2" value={inputQty} onChange={e => setInputQty(parseInt(e.target.value) || 1)} />
                          <button onClick={() => setInputQty(inputQty + 1)} className="w-14 h-14 bg-white text-blue-900 rounded-full shadow-md text-3xl font-black active:scale-90 transition-all border border-slate-200">+</button>
                        </div>
                    </div>

                    <button disabled={isLoading} onClick={executeStockOut} className="w-full py-7 bg-red-600 text-white rounded-[2rem] font-black shadow-2xl shadow-red-900/20 hover:bg-red-700 active:scale-[0.98] transition-all text-lg">
                      {isLoading ? 'กำลังประมวลผลการจ่ายออก...' : 'ยืนยันจ่ายสินค้าออก'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeView === View.REGISTRATION && (
          <div className="space-y-8 pb-32">
            {!currentUser ? <LoginRequired /> : (
              <>
                <div className="bg-white p-8 rounded-[3rem] border-t-8 border-purple-600 shadow-sm flex flex-col gap-6">
                  <h2 className="text-2xl font-black text-blue-900 mb-0">ลงทะเบียน Master Data สินค้า</h2>
                  <Scanner label="สแกนเพื่อเริ่มลงข้อมูล" onScan={handleRegisterScan} isLoading={isLoading} />
                  <button onClick={startManualRegistration} className="w-full py-4 bg-slate-50 border-2 border-slate-100 rounded-[2rem] text-purple-600 font-black text-sm shadow-sm hover:bg-slate-100 transition-all">
                    ⌨️ ไม่มีรูป/กล้องเสีย: กรอกข้อมูล Master Data เอง
                  </button>
                </div>

                {scanResult && (
                  <div className="bg-white p-10 rounded-[3rem] shadow-2xl border-t-8 border-emerald-500 space-y-8 animate-in slide-in-from-bottom-6">
                    {duplicateProductWarning && (
                      <div className="bg-amber-50 border-2 border-amber-200 p-6 rounded-[2rem] text-sm font-bold text-amber-800">
                        ⚠️ พบรายการใกล้เคียงในระบบ: <span className="font-black text-blue-900">{duplicateProductWarning.name}</span>
                      </div>
                    )}
                    <div className="space-y-6">
                      <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">ชื่อเรียกภาษาไทย (ห้ามเว้นว่าง)</p>
                        <input className="w-full bg-transparent font-black text-blue-900 outline-none text-xl border-b-2 border-slate-200 focus:border-emerald-500 transition-all" placeholder="เช่น น้ำยา PD สีเหลือง" value={scanResult.thaiName} onChange={e => setScanResult({...scanResult, thaiName: e.target.value})} />
                      </div>
                      <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">ผู้ผลิต / แบรนด์</p>
                        <input className="w-full bg-transparent font-black text-blue-900 outline-none text-base border-b-2 border-slate-200 focus:border-emerald-500 transition-all" placeholder="ระบุผู้ผลิต" value={scanResult.manufacturer} onChange={e => setScanResult({...scanResult, manufacturer: e.target.value})} />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                          <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">เบอร์ติดต่อสั่งซื้อ</p>
                          <input placeholder="เช่น 02-123-4567" className="w-full bg-transparent font-black text-blue-900 outline-none" value={tempContact} onChange={e => setTempContact(e.target.value)} />
                        </div>
                        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                          <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">ยอดคงคลังขั้นต่ำ (Min)</p>
                          <input type="number" className="w-full bg-transparent font-black text-blue-900 outline-none" value={tempMinStock} onChange={e => setTempMinStock(parseInt(e.target.value) || 0)} />
                        </div>
                      </div>
                    </div>
                    <button disabled={isLoading || !scanResult.thaiName.trim()} onClick={executeRegistration} className="w-full py-7 bg-emerald-600 text-white font-black rounded-[2rem] shadow-2xl shadow-emerald-900/20 active:scale-[0.98] transition-all text-lg disabled:bg-slate-300">
                      {isLoading ? 'กำลังบันทึก...' : 'บันทึกข้อมูลหลักสินค้า'}
                    </button>
                  </div>
                )}
              </>
            )}

            <div className="space-y-4">
              <div className="px-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h3 className="text-xl font-black text-blue-900">สินค้าในระบบทั้งหมด</h3>
                <div className="relative">
                  <input type="text" placeholder="🔍 ค้นหาชื่อสินค้า..." className="p-4 bg-white border border-slate-200 rounded-2xl text-sm font-black text-blue-900 outline-none focus:ring-4 focus:ring-purple-50 w-full md:w-64 shadow-sm" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredProducts.map((p) => (
                    <div key={p.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-5 hover:border-purple-200 hover:shadow-md transition-all">
                      <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                        {p.photo ? <img src={p.photo} className="w-full h-full object-cover" /> : <span className="text-2xl text-blue-900">📦</span>}
                      </div>
                      <div>
                        <p className="font-black text-blue-900 leading-tight">{p.thai_name}</p>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mt-1">{(p.manufacturer || 'Unknown')}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-[9px] font-black bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full border border-purple-100">Min: {p.min_stock || 0}</span>
                        </div>
                      </div>
                    </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeView === View.RECEIPT_HISTORY && (
          <div className="space-y-8 pb-32">
            <div className="bg-purple-900 p-10 rounded-[3rem] text-white shadow-xl">
              <h2 className="text-3xl font-black leading-none text-white">ประวัติการรับสินค้า</h2>
              <p className="text-xs font-bold text-purple-200 uppercase tracking-[0.2em] mt-3">Receipt Log</p>
            </div>
            
            <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50">
                    <tr>
                      <th className="px-6 py-4 text-[11px] font-black text-blue-900 uppercase tracking-widest">สินค้า</th>
                      <th className="px-6 py-4 text-[11px] font-black text-blue-900 uppercase tracking-widest">Batch/วันหมดอายุ</th>
                      <th className="px-6 py-4 text-[11px] font-black text-blue-900 uppercase tracking-widest text-center">จำนวน</th>
                      <th className="px-6 py-4 text-[11px] font-black text-blue-900 uppercase tracking-widest">ผู้บันทึก/วันที่</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {receiptHistory.length > 0 ? receiptHistory.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-all">
                        <td className="px-6 py-4">
                          <div className="font-black text-blue-900 text-sm leading-tight">{item.thai_name}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-[10px] font-black text-slate-500 uppercase">BATCH: {item.batch_no}</div>
                          <div className="text-[10px] font-black text-red-600">EXP: {item.exp}</div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="px-3 py-1 bg-blue-50 text-blue-900 rounded-lg font-black text-xs">{item.quantity}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-[10px] font-black text-blue-900">@{item.processed_by}</div>
                          <div className="text-[10px] font-bold text-slate-400">{new Date(item.created_at).toLocaleString('th-TH')}</div>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} className="py-24 text-center">
                          <p className="text-slate-300 font-black italic">ไม่มีประวัติการรับเข้า</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeView === View.RELEASE_HISTORY && (
          <div className="space-y-8 pb-32">
            <div className="bg-red-900 p-10 rounded-[3rem] text-white shadow-xl">
              <h2 className="text-3xl font-black leading-none text-white">ประวัติการจ่ายสินค้า</h2>
              <p className="text-xs font-bold text-red-200 uppercase tracking-[0.2em] mt-3">Release Log</p>
            </div>
            
            <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50">
                    <tr>
                      <th className="px-6 py-4 text-[11px] font-black text-blue-900 uppercase tracking-widest">สินค้า/ผู้ป่วย</th>
                      <th className="px-6 py-4 text-[11px] font-black text-blue-900 uppercase tracking-widest">Batch/EXP</th>
                      <th className="px-6 py-4 text-[11px] font-black text-blue-900 uppercase tracking-widest text-center">จำนวน</th>
                      <th className="px-6 py-4 text-[11px] font-black text-blue-900 uppercase tracking-widest">ผู้บันทึก/วันที่</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {releaseHistory.length > 0 ? releaseHistory.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-all">
                        <td className="px-6 py-4">
                          <div className="font-black text-blue-900 text-sm leading-tight">{item.thai_name}</div>
                          <div className="text-[10px] font-black text-purple-600 mt-1 uppercase">TO: {item.patient_name}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-[10px] font-black text-slate-500 uppercase">BATCH: {item.batch_no}</div>
                          <div className="text-[10px] font-black text-red-600">EXP: {item.exp}</div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="px-3 py-1 bg-red-50 text-red-600 rounded-lg font-black text-xs">{item.quantity}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-[10px] font-black text-blue-900">@{item.processed_by}</div>
                          <div className="text-[10px] font-bold text-slate-400">{new Date(item.created_at).toLocaleString('th-TH')}</div>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} className="py-24 text-center">
                          <p className="text-slate-300 font-black italic">ไม่มีประวัติการจ่ายออก</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeView === View.SETTINGS && (
          <div className="space-y-8 pb-32">
            <div className="bg-slate-900 p-10 rounded-[3rem] text-white shadow-xl flex justify-between items-center">
              <div>
                <h2 className="text-3xl font-black leading-none text-white">การตั้งค่าคลาวด์</h2>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mt-3">Supabase Integration</p>
              </div>
              {isConfigured && <span className="bg-emerald-500/20 text-emerald-400 px-4 py-2 rounded-full text-[11px] font-black border border-emerald-500/30">ONLINE 🟢</span>}
            </div>
            
            <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
              <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest text-slate-400">Supabase Project URL</label>
                  <input className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl font-mono text-sm text-blue-900 font-black" placeholder="https://..." value={sbConfig.url} onChange={e => setSbConfig({...sbConfig, url: e.target.value})} />
              </div>
              <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest text-slate-400">Supabase Anon Key</label>
                  <textarea className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl font-mono text-[11px] h-32 text-blue-900 font-black" placeholder="eyJhbG..." value={sbConfig.key} onChange={e => setSbConfig({...sbConfig, key: e.target.value})} />
              </div>
              
              <div className="flex flex-col gap-4">
                  <button onClick={handleTestConnection} disabled={isTestingConnection} className="w-full py-5 bg-slate-100 text-slate-600 font-black rounded-[2rem] border-2 border-slate-200 active:scale-95 transition-all">
                    {isTestingConnection ? 'กำลังทดสอบ...' : '🔍 ทดสอบการเชื่อมต่อ'}
                  </button>
                  <button onClick={handleSaveConfig} className="w-full py-6 bg-blue-900 text-white font-black rounded-[2rem] shadow-2xl shadow-blue-900/20 text-lg">
                    💾 บันทึกและเริ่มใช้งานระบบ Cloud
                  </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="fixed bottom-28 left-4 right-4 bg-red-600 text-white p-6 rounded-[2rem] shadow-2xl z-[800] flex items-center justify-between font-black animate-in slide-in-from-bottom-4">
          <div className="flex items-center gap-4">
            <span className="text-2xl text-white">⚠️</span>
            <span className="text-xs leading-tight text-white">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="bg-white/20 p-3 rounded-2xl text-[10px] font-black uppercase text-white">ปิด</button>
        </div>
      )}
    </Layout>
  );
};

export default App;
