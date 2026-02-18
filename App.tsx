import React, { useState, useRef, useEffect, useMemo } from 'react';
import { db, getTrips, saveTrip, deleteTrip, migrateFromLocalStorage } from './services/db';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Icons, CategoryIcon } from './components/Icon';
import { SnapTripLogo } from './components/Logo';
import ReceiptCard from './components/ReceiptCard';
import Stats from './components/Stats';
import { analyzeReceipt, geocodeLocation } from './services/geminiService';
import { ScannedReceipt, AnalysisState, Trip, Category } from './types';
import { v4 as uuidv4 } from 'uuid';

// --- MOCK DATA GENERATION ---
const generateMockReceipts = (): ScannedReceipt[] => {
  const mockDB: { name: string; category: Category; lat: number; lng: number }[] = [
    { name: '이치란 라멘 시부야', category: '식비', lat: 35.6617, lng: 139.7011 },
    { name: '스타벅스 시부야 츠타야', category: '식비', lat: 35.6595, lng: 139.7005 },
    { name: '블루보틀 신주쿠', category: '식비', lat: 35.6885, lng: 139.7011 },
    { name: '스시로 시부야', category: '식비', lat: 35.6580, lng: 139.6990 },
    { name: 'JR 야마노테선 시부야역', category: '교통', lat: 35.6585, lng: 139.7013 },
    { name: '돈키호테 메가 시부야', category: '쇼핑', lat: 35.6599, lng: 139.6968 },
    { name: '디즈니랜드 티켓', category: '관광', lat: 35.6329, lng: 139.8804 },
    { name: '도쿄 타워', category: '관광', lat: 35.6586, lng: 139.7454 },
    { name: 'APA 호텔 신주쿠', category: '숙소', lat: 35.6980, lng: 139.7031 },
  ];

  const receipts: ScannedReceipt[] = [];
  const baseDate = new Date('2024-05-20T10:00:00');

  for (let i = 0; i < 40; i++) {
    const dayOffset = Math.floor(Math.random() * 8);
    const hour = 9 + Math.floor(Math.random() * 12);
    const minute = Math.floor(Math.random() * 60);
    const dateObj = new Date(baseDate);
    dateObj.setDate(baseDate.getDate() + dayOffset);
    dateObj.setHours(hour, minute);
    const dateStr = dateObj.toISOString().split('T')[0];
    const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    const timestamp = dateObj.getTime();

    const item = mockDB[Math.floor(Math.random() * mockDB.length)];
    const lat = item.lat + (Math.random() - 0.5) * 0.005;
    const lng = item.lng + (Math.random() - 0.5) * 0.005;

    const amountJPY = Math.floor(Math.random() * 14700) + 300;
    const amountKRW = Math.round(amountJPY * 9);

    receipts.push({
      id: `mock-${i}`,
      merchant_name: item.name,
      category: item.category,
      amount: amountKRW,
      currency: 'KRW',
      date: dateStr,
      time: timeStr,
      address: `Tokyo, Japan`,
      latitude: lat,
      longitude: lng,
      reasoning: 'AI가 자동으로 분류한 항목입니다.',
      timestamp: timestamp
    });
  }
  return receipts.sort((a, b) => b.timestamp - a.timestamp);
};

const INITIAL_TRIP: Trip = {
  id: 'trip-tokyo-sample',
  title: '도쿄 미식 여행',
  startDate: '2024-05-20',
  endDate: '2024-05-27',
  budget: 5000000,
  targetCurrency: 'JPY',
  exchangeRate: 900,
  receipts: generateMockReceipts()
};

const CHART_COLORS = {
  '식비': '#fb923c',
  '숙소': '#60a5fa',
  '교통': '#4ade80',
  '쇼핑': '#c084fc',
  '관광': '#ec4899',
  '기타': '#94a3b8',
};

// --- Map Component ---
const MapComponent: React.FC<{ receipts: ScannedReceipt[], isDarkMode: boolean }> = ({ receipts, isDarkMode }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<any>(null);
  const layerGroupRef = useRef<any>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    if (!leafletMap.current) {
      leafletMap.current = (window as any).L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false,
      }).setView([35.6895, 139.6917], 13);
      layerGroupRef.current = (window as any).L.featureGroup().addTo(leafletMap.current);
    }

    const map = leafletMap.current;
    const layerGroup = layerGroupRef.current;
    layerGroup.clearLayers();

    const tileUrl = isDarkMode
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    (window as any).L.tileLayer(tileUrl).addTo(map);

    const validReceipts = [...receipts]
      .filter(r => r.latitude && r.longitude)
      .sort((a, b) => a.timestamp - b.timestamp);

    if (validReceipts.length === 0) return;

    const latLngs: [number, number][] = [];

    validReceipts.forEach((r, idx) => {
      const pos: [number, number] = [r.latitude!, r.longitude!];
      latLngs.push(pos);

      const color = CHART_COLORS[r.category] || '#94a3b8';
      const icon = (window as any).L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color: ${color}; width: 22px; height: 22px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); font-size: 10px; font-weight: bold;">${idx + 1}</div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      });

      (window as any).L.marker(pos, { icon })
        .bindPopup(`
          <div style="font-family: sans-serif; padding: 4px;">
            <div style="font-weight: bold; font-size: 14px;">${r.merchant_name}</div>
            <div style="color: ${color}; font-weight: bold;">${r.amount.toLocaleString()}원</div>
          </div>
        `)
        .addTo(layerGroup);
    });

    if (latLngs.length > 1) {
      (window as any).L.polyline(latLngs, {
        color: isDarkMode ? '#60a5fa' : '#3b82f6',
        weight: 3,
        opacity: 0.5,
        dashArray: '5, 10'
      }).addTo(layerGroup);
    }

    if (validReceipts.length > 0) {
      map.fitBounds(layerGroup.getBounds().pad(0.2));
    }

    return () => {
      if (layerGroup) layerGroup.clearLayers();
    };
  }, [receipts, isDarkMode]);

  return <div ref={mapRef} className="w-full h-full rounded-3xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-700" />;
};

type Tab = 'home' | 'map' | 'report' | 'settings';
type ViewMode = 'timeline' | 'map';

const App: React.FC = () => {
  const [trips, setTrips] = useState<Trip[]>([INITIAL_TRIP]);
  const [currentTripId, setCurrentTripId] = useState<string>(INITIAL_TRIP.id);
  const [status, setStatus] = useState<AnalysisState>({ isLoading: false, error: null });
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [selectedReceipt, setSelectedReceipt] = useState<ScannedReceipt | null>(null);
  const [editingReceipt, setEditingReceipt] = useState<ScannedReceipt | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>('All');
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [mapViewMode, setMapViewMode] = useState<ViewMode>('map');
  const [isTripDropdownOpen, setIsTripDropdownOpen] = useState(false);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [isNewTripModalOpen, setIsNewTripModalOpen] = useState(false);
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [isEntryOptionOpen, setIsEntryOptionOpen] = useState(false);
  const [reportDateIndex, setReportDateIndex] = useState<number>(0);
  const [chartActiveIndex, setChartActiveIndex] = useState<number | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Scroll Drag State
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const [newTripForm, setNewTripForm] = useState({
    title: '', budget: '', startDate: '', endDate: '', targetCurrency: 'JPY', exchangeRate: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const currentTrip = useMemo(() => trips.find(t => t.id === currentTripId) || trips[0], [trips, currentTripId]);
  const receipts = currentTrip.receipts;
  const totalAmount = useMemo(() => receipts.reduce((sum, r) => sum + r.amount, 0), [receipts]);
  const remainingBudget = currentTrip.budget - totalAmount;

  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
  }, [theme]);

  useEffect(() => {
    const initData = async () => {
      // Migrate from localStorage if needed
      await migrateFromLocalStorage();

      // Load trips from DB
      try {
        const loadedTrips = await getTrips();
        if (loadedTrips.length > 0) {
          setTrips(loadedTrips);
          // Restore active trip ID from localStorage (keep UI preference in localStorage)
          const savedActiveId = localStorage.getItem('travel_admin_sorter_active_trip_id');
          if (savedActiveId && loadedTrips.find(t => t.id === savedActiveId)) {
            setCurrentTripId(savedActiveId);
          } else {
            setCurrentTripId(loadedTrips[0].id);
          }
        } else {
          // First time load or empty DB
          // Save initial trip to DB
          await saveTrip(INITIAL_TRIP);
          setTrips([INITIAL_TRIP]);
        }
      } catch (e) {
        console.error("Failed to load trips", e);
        setTrips([INITIAL_TRIP]);
      }
    };
    initData();

    const savedTheme = localStorage.getItem('snap_trip_theme') as 'light' | 'dark';
    if (savedTheme) setTheme(savedTheme || 'dark');
  }, []);

  // Effect to save changes to DB whenever trips change
  useEffect(() => {
    // We need to identify which trip changed and save only that one, or save all.
    // For simplicity with dexie bulkPut or specific put, we can save the currentTrip if it changed.
    // However, since trips state is the source of truth for UI, we should sync it to DB.
    // A robust way is to save the modified trip in the specific handler, but as a safeguard we can save updated trips here.
    // But saving ALL trips on every render might be inefficient. 
    // Ideally, we move save logic to the event handlers (add receipt, edit trip, etc).
    // For this migration, to keep it simple, we will effectively "Auto-Save" the current trip when it changes.
    // But `trips` changes when currentTrip changes.

    // BETTER APPROACH: modify handlers to call saveTrip() and remove this effect for data persistence.
    // BUT to minimize code changes in this refactor, we can use a debounced save or just save the current trip.

    if (currentTrip) {
      saveTrip(currentTrip).catch(e => console.error("Failed to auto-save trip", e));
    }

    localStorage.setItem('travel_admin_sorter_active_trip_id', currentTripId);
    localStorage.setItem('snap_trip_theme', theme);
  }, [trips, currentTrip, currentTripId, theme]);

  const sortedReceipts = useMemo(() => {
    return [...receipts].sort((a, b) => b.timestamp - a.timestamp);
  }, [receipts]);

  const filteredReceipts = useMemo(() => {
    if (selectedCategory === 'All') return sortedReceipts;
    return sortedReceipts.filter(r => r.category === selectedCategory);
  }, [sortedReceipts, selectedCategory]);

  const categoryData = useMemo(() => {
    const grouped = receipts.reduce((acc, curr) => {
      const existing = acc.find(item => item.name === curr.category);
      if (existing) { existing.value += curr.amount; }
      else { acc.push({ name: curr.category, value: curr.amount }); }
      return acc;
    }, [] as { name: string; value: number }[]);
    return grouped.sort((a, b) => b.value - a.value);
  }, [receipts]);

  const { sortedDates, receiptsByDate } = useMemo(() => {
    const grouped: Record<string, ScannedReceipt[]> = {};
    receipts.forEach(r => {
      if (!grouped[r.date]) grouped[r.date] = [];
      grouped[r.date].push(r);
    });
    const dates = Object.keys(grouped).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    return { sortedDates: dates, receiptsByDate: grouped };
  }, [receipts]);

  // Scroll Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
    setScrollLeft(scrollContainerRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startX) * 2; // scroll speed multiplier
    scrollContainerRef.current.scrollLeft = scrollLeft - walk;
  };

  const triggerUpload = () => fileInputRef.current?.click();

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith('image/')) { alert('이미지 파일만 업로드 가능합니다.'); return; }
    setIsEntryOptionOpen(false);
    setStatus({ isLoading: true, error: null });
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      setUploadPreview(base64);
      try {
        const result = await analyzeReceipt(base64, null);
        let finalAmount = result.amount;
        const timeStr = result.time || "12:00";
        const dateTimeStr = `${result.date}T${timeStr}:00`;
        const timestamp = new Date(dateTimeStr).getTime();
        const newReceipt: ScannedReceipt = {
          ...result, time: timeStr, amount: Math.round(finalAmount), id: uuidv4(), timestamp: isNaN(timestamp) ? Date.now() : timestamp,
        };
        setTrips(prev => prev.map(t => t.id === currentTripId ? { ...t, receipts: [newReceipt, ...t.receipts] } : t));
        setStatus({ isLoading: false, error: null });
        setActiveTab('home');
      } catch (err: any) {
        setStatus({ isLoading: false, error: err.message || '분석 실패' });
      } finally { setUploadPreview(null); }
    };
    reader.readAsDataURL(file);
  };

  const handleManualAdd = () => {
    setIsEntryOptionOpen(false);
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().slice(0, 5);
    const newReceipt: ScannedReceipt = {
      id: uuidv4(), merchant_name: '', category: '식비', amount: 0, currency: 'KRW', date: dateStr, time: timeStr, address: null, reasoning: '수동으로 추가한 내역입니다.', timestamp: now.getTime()
    };
    setEditingReceipt(newReceipt);
  };

  const handleSaveReceipt = () => {
    if (!editingReceipt) return;
    setTrips(prev => prev.map(t => {
      if (t.id !== currentTripId) return t;
      const exists = t.receipts.find(r => r.id === editingReceipt.id);
      if (exists) {
        return { ...t, receipts: t.receipts.map(r => r.id === editingReceipt.id ? editingReceipt : r) };
      } else {
        return { ...t, receipts: [editingReceipt, ...t.receipts] };
      }
    }));
    setEditingReceipt(null);
    setSelectedReceipt(null);
    setIsCategoryDropdownOpen(false);
  };

  // Improved handleTripSubmit to handle both create and edit
  const handleTripSubmit = async () => {
    if (!newTripForm.title) { alert('여행 이름을 입력해주세요.'); return; }

    if (editingTripId) {
      // Update existing trip
      const updatedTrip = trips.find(t => t.id === editingTripId);
      if (updatedTrip) {
        const newTripData = {
          ...updatedTrip,
          title: newTripForm.title,
          budget: parseInt(newTripForm.budget.replace(/,/g, '')) || 0,
          startDate: newTripForm.startDate,
          endDate: newTripForm.endDate,
          targetCurrency: newTripForm.targetCurrency,
          exchangeRate: parseFloat(newTripForm.exchangeRate) || undefined
        };

        setTrips(prev => prev.map(t => t.id === editingTripId ? newTripData : t));
        await saveTrip(newTripData);
      }
    } else {
      // Create new trip
      const newTrip: Trip = {
        id: uuidv4(),
        title: newTripForm.title,
        budget: parseInt(newTripForm.budget.replace(/,/g, '')) || 0,
        startDate: newTripForm.startDate,
        endDate: newTripForm.endDate,
        targetCurrency: newTripForm.targetCurrency || 'JPY',
        exchangeRate: parseFloat(newTripForm.exchangeRate) || undefined,
        receipts: []
      };
      setTrips([newTrip, ...trips]);
      setCurrentTripId(newTrip.id);
      await saveTrip(newTrip); // Persist new trip
    }
    setIsNewTripModalOpen(false);
    setEditingTripId(null);
    setNewTripForm({ title: '', budget: '', startDate: '', endDate: '', targetCurrency: 'JPY', exchangeRate: '' });
  };

  const handleDeleteTrip = async (e?: React.MouseEvent) => {
    // Prevent default behavior if triggered by event
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!editingTripId) return;

    // Minimum one trip requirement check
    if (trips.length <= 1) {
      window.alert('최소 하나의 여행은 존재해야 합니다.');
      return;
    }

    // Delete Confirmation
    if (window.confirm('정말 이 여행 기록을 삭제하시겠습니까? 복구할 수 없습니다.')) {
      const idToDelete = editingTripId; // Capture ID
      const newTrips = trips.filter(t => t.id !== idToDelete);
      setTrips(newTrips);

      await deleteTrip(idToDelete); // Delete from DB

      // If the deleted trip was the active one, switch to the first available trip
      if (currentTripId === idToDelete) {
        setCurrentTripId(newTrips[0].id);
      }

      setIsNewTripModalOpen(false);
      setEditingTripId(null);
    }
  };

  // Deprecated handleSaveTrip in favor of handleTripSubmit, but kept for compatibility if needed or removed
  const handleSaveTrip = handleTripSubmit;

  const handleResetData = () => {
    if (confirm("현재 여행의 모든 데이터를 초기화하시겠습니까?")) {
      setTrips(prev => {
        const newTrips = prev.map(t => t.id === currentTripId ? { ...t, receipts: [] } : t);
        const updatedTrip = newTrips.find(t => t.id === currentTripId);
        if (updatedTrip) saveTrip(updatedTrip); // Persist reset
        return newTrips;
      });
      alert("초기화되었습니다.");
    }
  };

  const handleDeleteReceipt = (id: string) => {
    setTrips(prev => prev.map(t => t.id === currentTripId ? { ...t, receipts: t.receipts.filter(r => r.id !== id) } : t));
    setEditingReceipt(null);
    setSelectedReceipt(null);
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentTrip, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${currentTrip.title}_backup.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };
};

const handleExportCSV = () => {
  const headers = ['날짜', '시간', '카테고리', '상호명', '금액(KRW)', '통화', '메모'];
  const rows = currentTrip.receipts.map(r => [
    r.date,
    r.time,
    r.category,
    `"${r.merchant_name.replace(/"/g, '""')}"`,
    r.amount,
    r.currency,
    `"${(r.reasoning || '').replace(/"/g, '""')}"`
  ]);

  // Add BOM for Excel UTF-8 compatibility
  const csvContent = "data:text/csv;charset=utf-8,\uFEFF"
    + headers.join(",") + "\n"
    + rows.map(e => e.join(",")).join("\n");

  const encodedUri = encodeURI(csvContent);
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href", encodedUri);
  downloadAnchorNode.setAttribute("download", `${currentTrip.title}_export.csv`);
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
};

const handleGeocode = async () => {
  if (!editingReceipt) return;
  const query = editingReceipt.address || editingReceipt.merchant_name;
  if (!query) {
    alert("장소명이나 주소를 입력해주세요.");
    return;
  }

  setIsGeocoding(true);
  try {
    const result = await geocodeLocation(query);
    if (result) {
      setEditingReceipt(prev => prev ? ({
        ...prev,
        latitude: result.latitude,
        longitude: result.longitude,
        address: result.standardized_address || prev.address
      }) : null);
    } else {
      alert("위치를 찾을 수 없습니다. 더 상세한 주소를 입력해보세요.");
    }
  } catch (e) {
    console.error(e);
    alert("위치 검색 중 오류가 발생했습니다.");
  } finally {
    setIsGeocoding(false);
  }
};

const handleDateSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
  const date = e.target.value;
  if (!date) return;

  const element = document.getElementById(`date-${date}`);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Add a temporary highlight class for better visibility
    element.classList.add('bg-blue-50', 'dark:bg-blue-900/20', 'transition-colors', 'duration-500', 'rounded-xl', '-m-2', 'p-2');
    setTimeout(() => {
      element.classList.remove('bg-blue-50', 'dark:bg-blue-900/20', 'transition-colors', 'duration-500', 'rounded-xl', '-m-2', 'p-2');
    }, 2000);
  } else {
    alert(`${date}에 해당하는 지출 내역이 없습니다.`);
  }
};

// --- Render Sections ---

const renderHome = () => {
  const budgetPercent = Math.min(100, Math.round((totalAmount / currentTrip.budget) * 100));
  const isOverBudget = remainingBudget < 0;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="px-6 mb-6">
        <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-6 rounded-[30px] text-white shadow-xl shadow-blue-500/20 relative overflow-hidden">
          <p className="text-sm opacity-80 mb-1">현재까지 총 지출</p>
          <h2 className="text-3xl font-bold mb-4">{new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(totalAmount)}</h2>
          <div className="bg-white/10 rounded-2xl p-3 border border-white/10">
            <div className="flex justify-between text-xs mb-2"><span>예산 대비</span><span className="font-bold">{budgetPercent}%</span></div>
            <div className="w-full h-1.5 bg-black/20 rounded-full overflow-hidden mb-1">
              <div className={`h-full ${isOverBudget ? 'bg-red-400' : 'bg-green-400'}`} style={{ width: `${budgetPercent}%` }}></div>
            </div>
            <p className={`text-[10px] opacity-70 text-right ${isOverBudget ? 'font-bold text-red-100' : ''}`}>
              {isOverBudget
                ? `예산 초과: ${new Intl.NumberFormat('ko-KR').format(Math.abs(remainingBudget))}원`
                : `남은 예산: ${new Intl.NumberFormat('ko-KR').format(remainingBudget)}원`
              }
            </p>
          </div>
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
        </div>
      </div>
      <div className="px-6 mb-6"><Stats receipts={receipts} onClickDetail={() => setActiveTab('report')} /></div>

      {/* Category Filter Scroll View */}
      <div className="relative mb-6 group">
        <div
          ref={scrollContainerRef}
          className="w-full overflow-x-auto no-scrollbar flex items-center gap-2 px-6 py-1 touch-pan-x cursor-grab active:cursor-grabbing select-none"
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
        >
          <button
            onClick={() => setSelectedCategory('All')}
            className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all border shadow-sm active:scale-95 ${selectedCategory === 'All'
              ? 'bg-slate-800 dark:bg-white dark:text-slate-900 text-white border-transparent'
              : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
              }`}
          >
            전체
          </button>
          {['식비', '숙소', '교통', '쇼핑', '관광', '기타'].map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat as Category)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all border shadow-sm active:scale-95 ${selectedCategory === cat
                ? 'bg-blue-500 text-white border-transparent'
                : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                }`}
            >
              <CategoryIcon category={cat as Category} className="w-3.5 h-3.5" />
              {cat}
            </button>
          ))}
          {/* Spacer for right padding in overflow scroll */}
          <div className="w-6 flex-shrink-0"></div>
        </div>
        {/* Gradient Overlay to indicate scrolling */}
        <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#f9fafb] dark:from-slate-900 to-transparent pointer-events-none"></div>
      </div>

      <div className="px-6 pb-24">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
          최근 지출 <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-full">{filteredReceipts.length}건</span>
        </h3>
        {filteredReceipts.length === 0 ? <p className="text-center py-10 text-slate-400 text-xs font-medium">내역이 없습니다.</p> : filteredReceipts.map(r => <ReceiptCard key={r.id} receipt={r} onDelete={handleDeleteReceipt} onClick={(item) => { setSelectedReceipt(item); setEditingReceipt(item); }} isDarkMode={theme === 'dark'} />)}
      </div>
    </div>
  );
};

const renderMap = () => (
  <div className="px-6 py-4 pb-24 h-full flex flex-col animate-in fade-in duration-500">
    <div className="flex justify-between items-center mb-6">
      <h2 className="text-xl font-bold dark:text-white">동선 기록</h2>
      <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex shadow-inner">
        <button onClick={() => setMapViewMode('timeline')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${mapViewMode === 'timeline' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-400'}`}>타임라인</button>
        <button onClick={() => setMapViewMode('map')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${mapViewMode === 'map' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-400'}`}>지도</button>
      </div>
    </div>
    <div className="flex-1 relative overflow-hidden bg-slate-100 dark:bg-slate-800/50 rounded-3xl min-h-[400px]">
      {mapViewMode === 'map' ? (
        <MapComponent receipts={receipts} isDarkMode={theme === 'dark'} />
      ) : (
        <div className="h-full overflow-y-auto no-scrollbar p-6 relative">
          {sortedReceipts.map((r, idx) => (
            <div key={r.id} className="mb-8 relative pl-12 group cursor-pointer" onClick={() => { setSelectedReceipt(r); setEditingReceipt(r); }}>
              {idx !== sortedReceipts.length - 1 && (
                <div className="absolute left-5 top-2.5 -bottom-8 w-0.5 bg-slate-200 dark:bg-slate-700 -translate-x-1/2"></div>
              )}
              <div className="absolute left-2.5 top-0 w-5 h-5 rounded-full bg-blue-500 border-4 border-white dark:border-slate-900 z-10 flex items-center justify-center text-[8px] text-white font-bold">
                {sortedReceipts.length - idx}
              </div>
              <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 active:scale-[0.98] transition-all">
                <p className="text-[10px] text-blue-500 font-bold mb-1">{r.date} {r.time}</p>
                <h4 className="text-sm font-bold truncate dark:text-white">{r.merchant_name || '상호 정보 없음'}</h4>
                <p className="text-xs text-slate-400 flex items-center gap-1 mt-1 truncate"><Icons.MapPin className="w-3 h-3" />{r.address || '주소 정보 없음'}</p>
              </div>
            </div>
          ))}
          {sortedReceipts.length === 0 && <p className="text-center py-20 text-slate-400 text-xs">기록이 없습니다.</p>}
        </div>
      )}
    </div>
  </div>
);

const renderReport = () => (
  <div className="px-6 py-4 pb-24 h-full flex flex-col animate-in fade-in duration-500">
    <div className="mb-6">
      <h2 className="text-xl font-bold dark:text-white">지출 리포트</h2>
      <p className="text-xs text-slate-400">카테고리별 지출 현황을 확인하세요.</p>
    </div>

    {/* Pie Chart Section */}
    <div className="bg-white dark:bg-slate-800 rounded-[30px] p-6 shadow-sm border border-slate-100 dark:border-slate-700 mb-8 flex flex-col items-center relative">
      <div className="w-full h-64 relative z-10">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={categoryData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
              onMouseEnter={(_, index) => setChartActiveIndex(index)}
              onMouseLeave={() => setChartActiveIndex(null)}
            >
              {categoryData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={CHART_COLORS[entry.name as keyof typeof CHART_COLORS] || '#94a3b8'}
                  strokeWidth={0}
                  opacity={chartActiveIndex === index || chartActiveIndex === null ? 1 : 0.3}
                  className="transition-opacity duration-300"
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total</span>
          <span className="text-xl font-black text-slate-800 dark:text-white">
            {new Intl.NumberFormat('ko-KR', { notation: "compact" }).format(totalAmount)}
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-3 w-full mt-4">
        {categoryData.map((item, index) => (
          <div
            key={item.name}
            className={`flex items-center justify-between p-2 rounded-xl transition-colors ${chartActiveIndex === index ? 'bg-slate-50 dark:bg-slate-700/50' : ''}`}
            onMouseEnter={() => setChartActiveIndex(index)}
            onMouseLeave={() => setChartActiveIndex(null)}
          >
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: CHART_COLORS[item.name as keyof typeof CHART_COLORS] }}></div>
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{item.name}</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-xs font-black text-slate-800 dark:text-white">
                {Math.round((item.value / totalAmount) * 100)}%
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                {new Intl.NumberFormat('ko-KR').format(item.value)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* Daily Breakdown */}
    <div className="mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
          일별 상세 내역
        </h3>
        <div className="relative">
          <button
            onClick={() => {
              try {
                dateInputRef.current?.showPicker();
              } catch (e) {
                console.error(e);
                // Fallback for browsers not supporting showPicker
                dateInputRef.current?.focus();
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-700 hover:text-blue-500 transition-colors cursor-pointer"
          >
            <Icons.Calendar className="w-3.5 h-3.5" />
            날짜 이동
          </button>
          <input
            ref={dateInputRef}
            type="date"
            className="absolute opacity-0 w-px h-px pointer-events-none -z-10"
            onChange={handleDateSelect}
            tabIndex={-1}
          />
        </div>
      </div>
      <div className="space-y-6">
        {sortedDates.map(date => (
          <div key={date} id={`date-${date}`} className="scroll-mt-24 transition-all">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
              <h4 className="text-xs font-black text-slate-500 dark:text-slate-400">{date}</h4>
              <div className="h-[1px] flex-1 bg-slate-100 dark:bg-slate-800"></div>
              <span className="text-[10px] font-bold text-slate-400">
                {new Intl.NumberFormat('ko-KR').format(receiptsByDate[date].reduce((sum, r) => sum + r.amount, 0))}원
              </span>
            </div>
            {receiptsByDate[date].map(r => (
              <ReceiptCard key={r.id} receipt={r} onDelete={handleDeleteReceipt} onClick={(item) => { setSelectedReceipt(item); setEditingReceipt(item); }} isDarkMode={theme === 'dark'} />
            ))}
          </div>
        ))}
        {sortedDates.length === 0 && (
          <div className="text-center py-10 text-slate-400 text-xs">기록된 지출이 없습니다.</div>
        )}
      </div>
    </div>
  </div>
);

const renderSettings = () => (
  <div className="px-6 pt-2 pb-24 animate-in fade-in duration-500">
    <div className="mb-8 flex items-center justify-between">
      <h2 className="text-xl font-bold dark:text-white">설정</h2>
      <SnapTripLogo className="w-10 h-10" withText={false} />
    </div>

    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-[30px] border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm">
        <div className="p-5 flex justify-between items-center border-b border-slate-50 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-2xl text-indigo-500"><Icons.RefreshCw className="w-5 h-5" /></div>
            <span className="text-sm font-black dark:text-slate-200">다크 모드</span>
          </div>
          <div className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${theme === 'dark' ? 'bg-blue-600' : 'bg-slate-200'}`} onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>
            <div className={`w-4 h-4 bg-white rounded-full shadow-md transition-transform ${theme === 'dark' ? 'translate-x-6' : 'translate-x-0'}`}></div>
          </div>
        </div>
        <div className="p-5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 rounded-2xl text-blue-500"><Icons.Shield className="w-5 h-5" /></div>
            <span className="text-sm font-black dark:text-slate-200">개인정보 처리방침</span>
          </div>
          <Icons.ChevronRight className="w-4 h-4 text-slate-300" />
        </div>
      </div>

      {/* Data Export Group */}
      <div>
        <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 ml-4 mb-2 uppercase tracking-wider">데이터 관리</h3>
        <div className="bg-white dark:bg-slate-800 rounded-[30px] border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm">
          <div onClick={handleExportJSON} className="p-5 flex justify-between items-center border-b border-slate-50 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl text-emerald-500"><Icons.FileText className="w-5 h-5" /></div>
              <span className="text-sm font-black dark:text-slate-200">JSON 내보내기</span>
            </div>
            <Icons.Download className="w-4 h-4 text-slate-300" />
          </div>
          <div onClick={handleExportCSV} className="p-5 flex justify-between items-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl text-emerald-500"><Icons.FileSpreadsheet className="w-5 h-5" /></div>
              <span className="text-sm font-black dark:text-slate-200">Excel(CSV) 내보내기</span>
            </div>
            <Icons.Download className="w-4 h-4 text-slate-300" />
          </div>
        </div>
      </div>

      <button onClick={handleResetData} className="w-full bg-red-50 dark:bg-red-950/20 p-5 rounded-[24px] text-red-500 text-sm font-black flex justify-center items-center gap-2 active:scale-95 transition-all"><Icons.Trash2 className="w-4 h-4" /> 현재 여행 데이터 삭제</button>
    </div>
  </div>
);

return (
  <div className={`min-h-[100dvh] font-sans ${theme === 'dark' ? 'bg-slate-950' : 'bg-[#f9fafb]'} xl:bg-slate-200 xl:flex xl:justify-center xl:items-center xl:py-10 transition-colors duration-500`}>
    <div className={`w-full h-[100dvh] xl:w-[375px] xl:h-[812px] ${theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-[#f9fafb] text-slate-800'} relative xl:rounded-[56px] xl:border-[10px] xl:border-slate-800 xl:shadow-2xl overflow-hidden flex flex-col mx-auto transition-colors`}>
      <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => handleFiles(e.target.files)} />

      <div className="px-6 pt-6 pb-2 flex justify-between items-center relative z-20">
        <div className="cursor-pointer group" onClick={() => setIsTripDropdownOpen(!isTripDropdownOpen)}>
          <h2 className="text-2xl font-black flex items-center gap-2 group-hover:text-blue-500 transition-colors">
            {currentTrip.title} <Icons.ChevronDown className={`w-5 h-5 transition-transform ${isTripDropdownOpen ? 'rotate-180 text-blue-500' : '0'}`} />
          </h2>
        </div>
        <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400 border dark:border-slate-700 shadow-sm cursor-pointer active:scale-90 transition-all" onClick={() => setActiveTab('settings')}>
          <Icons.User className="w-5 h-5" />
        </div>
        {isTripDropdownOpen && (
          <div className="absolute top-16 left-6 w-64 bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl rounded-[28px] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.3)] border border-slate-100/50 dark:border-slate-700/50 p-2 z-30 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="max-h-[240px] overflow-y-auto no-scrollbar p-1 space-y-1">
              {trips.map(trip => (
                <div key={trip.id} onClick={() => { setCurrentTripId(trip.id); setIsTripDropdownOpen(false); }}
                  className={`
                        relative p-3.5 rounded-[20px] cursor-pointer flex items-center justify-between transition-all duration-200
                        ${currentTripId === trip.id
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-600 dark:text-slate-300'
                    }
                    `}
                >
                  <span className="font-bold text-sm truncate max-w-[140px] tracking-tight">{trip.title}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingTripId(trip.id);
                      setNewTripForm({
                        title: trip.title,
                        budget: trip.budget.toString(),
                        startDate: trip.startDate,
                        endDate: trip.endDate,
                        targetCurrency: trip.targetCurrency || 'JPY',
                        exchangeRate: trip.exchangeRate ? trip.exchangeRate.toString() : ''
                      });
                      setIsNewTripModalOpen(true);
                      setIsTripDropdownOpen(false);
                    }}
                    className={`
                            p-1.5 rounded-full transition-colors z-10
                            ${currentTripId === trip.id
                        ? 'text-blue-100 hover:bg-white/20'
                        : 'text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 hover:text-slate-500'
                      }
                        `}
                  >
                    <Icons.Settings className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="h-[1px] bg-slate-100 dark:bg-slate-700/50 mx-4 my-2"></div>

            <div onClick={() => {
              setIsNewTripModalOpen(true);
              setEditingTripId(null);
              setNewTripForm({ title: '', budget: '', startDate: '', endDate: '', targetCurrency: 'JPY', exchangeRate: '' });
              setIsTripDropdownOpen(false);
            }} className="p-3 mx-1 rounded-[20px] hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer flex items-center justify-center gap-2.5 transition-all group text-blue-500">
              <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform text-blue-500">
                <Icons.Plus className="w-4 h-4" />
              </div>
              <span className="font-bold text-sm">새 여행 등록</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar relative z-0">
        {activeTab === 'home' && renderHome()}
        {activeTab === 'map' && renderMap()}
        {activeTab === 'report' && renderReport()}
        {activeTab === 'settings' && renderSettings()}
      </div>

      <nav className="absolute bottom-0 w-full h-[96px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border-t dark:border-slate-800/60 flex justify-around items-start pt-3 z-20 pb-safe shadow-[0_-10px_35px_-15px_rgba(0,0,0,0.15)] transition-colors">
        <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-1.5 w-1/5 transition-colors ${activeTab === 'home' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-300 dark:text-slate-600'}`}><Icons.Home className="w-6 h-6" /><span className="text-[10px] font-black uppercase">Home</span></button>
        <button onClick={() => setActiveTab('map')} className={`flex flex-col items-center gap-1.5 w-1/5 transition-colors ${activeTab === 'map' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-300 dark:text-slate-600'}`}><Icons.MapPin className="w-6 h-6" /><span className="text-[10px] font-black uppercase">Map</span></button>
        <div className="relative w-1/5 flex justify-center -mt-9">
          <button
            onClick={() => setIsEntryOptionOpen(!isEntryOptionOpen)}
            className={`w-[68px] h-[68px] rounded-[24px] flex items-center justify-center text-white shadow-2xl bg-gradient-to-br from-blue-500 to-indigo-600 active:scale-90 transition-all z-30`}
          >
            {isEntryOptionOpen ? <Icons.X className="w-8 h-8" /> : <Icons.Camera className="w-8 h-8" />}
          </button>
          {isEntryOptionOpen && (
            <div className="absolute bottom-24 bg-white dark:bg-slate-800 rounded-[28px] shadow-2xl border dark:border-slate-700/60 p-2 flex flex-col gap-1 w-44 animate-in slide-in-from-bottom-6 duration-300 z-40">
              <button onClick={triggerUpload} className="p-4 rounded-[20px] flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left"><Icons.Camera className="w-4 h-4 text-blue-500" /><span className="text-xs font-black dark:text-slate-200">영수증 촬영</span></button>
              <button onClick={handleManualAdd} className="p-4 rounded-[20px] flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left"><Icons.Pencil className="w-4 h-4 text-blue-500" /><span className="text-xs font-black dark:text-slate-200">수기 지출</span></button>
            </div>
          )}
        </div>
        <button onClick={() => setActiveTab('report')} className={`flex flex-col items-center gap-1.5 w-1/5 transition-colors ${activeTab === 'report' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-300 dark:text-slate-600'}`}><Icons.PieChart className="w-6 h-6" /><span className="text-[10px] font-black uppercase">Report</span></button>
        <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center gap-1.5 w-1/5 transition-colors ${activeTab === 'settings' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-300 dark:text-slate-600'}`}><Icons.Settings className="w-6 h-6" /><span className="text-[10px] font-black uppercase">Info</span></button>
      </nav>

      {status.isLoading && (
        <div className="absolute inset-0 bg-slate-900/90 z-50 flex flex-col items-center justify-center text-white font-black backdrop-blur-md animate-in fade-in">
          <div className="w-16 h-16 border-[5px] border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
          <p className="animate-pulse tracking-tight text-lg">AI 분석 엔진 가동 중...</p>
        </div>
      )}

      {editingReceipt && (
        <div className="absolute inset-0 bg-black/75 z-40 flex items-end justify-center animate-in fade-in duration-300" onClick={() => setEditingReceipt(null)}>
          <div className="bg-white dark:bg-slate-900 w-full h-[88%] rounded-t-[50px] p-8 shadow-2xl animate-in slide-in-from-bottom-12 flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mb-10 flex-shrink-0"></div>

            <div className="flex-1 overflow-y-auto no-scrollbar space-y-8">
              <div className="flex items-center gap-6 mb-4">
                <div className="w-22 h-22 rounded-[30px] bg-blue-50 dark:bg-blue-900/40 text-blue-500 flex items-center justify-center shadow-inner flex-shrink-0">
                  <CategoryIcon category={editingReceipt.category} className="w-12 h-12" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1.5 opacity-60">장소명</p>
                  <input
                    className="w-full text-2xl font-black dark:text-white leading-tight bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none transition-all"
                    value={editingReceipt.merchant_name}
                    placeholder="가게 이름을 입력하세요"
                    onChange={(e) => setEditingReceipt({ ...editingReceipt, merchant_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="p-7 bg-blue-50 dark:bg-blue-900/30 rounded-[35px] border border-blue-100/50 dark:border-blue-800/30 shadow-sm">
                <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest mb-3">지출 금액 (KRW)</p>
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-black text-blue-600 dark:text-blue-400">₩</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="w-full text-4xl font-black text-blue-600 dark:text-blue-400 bg-transparent focus:outline-none"
                    value={editingReceipt.amount ? editingReceipt.amount.toLocaleString() : ''}
                    placeholder="0"
                    onChange={(e) => {
                      const val = e.target.value.replace(/,/g, '');
                      if (/^\d*$/.test(val)) {
                        setEditingReceipt({ ...editingReceipt, amount: Number(val) });
                      }
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-[28px] border border-transparent dark:border-slate-700/50">
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2 opacity-60">날짜</p>
                  <input
                    type="date"
                    className="w-full text-sm font-black dark:text-white bg-transparent focus:outline-none"
                    value={editingReceipt.date}
                    onChange={(e) => setEditingReceipt({ ...editingReceipt, date: e.target.value })}
                  />
                </div>
                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-[28px] border border-transparent dark:border-slate-700/50 relative z-20">
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2 opacity-60">분류</p>
                  <div className="relative">
                    <button
                      onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                      className="w-full text-left text-sm font-black dark:text-white bg-transparent focus:outline-none flex items-center justify-between active:opacity-70 transition-opacity"
                    >
                      <div className="flex items-center gap-2">
                        <CategoryIcon category={editingReceipt.category} className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                        {editingReceipt.category}
                      </div>
                      <Icons.ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isCategoryDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isCategoryDropdownOpen && (
                      <div className="absolute top-full right-0 left-0 mt-3 bg-white dark:bg-slate-800 rounded-[24px] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] border border-slate-100 dark:border-slate-700 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-2 space-y-1">
                          {['식비', '숙소', '교통', '쇼핑', '관광', '기타'].map(cat => (
                            <div
                              key={cat}
                              onClick={() => {
                                setEditingReceipt({ ...editingReceipt, category: cat as Category });
                                setIsCategoryDropdownOpen(false);
                              }}
                              className={`p-3 rounded-[16px] flex items-center gap-3 cursor-pointer transition-colors ${editingReceipt.category === cat ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-500' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 dark:text-slate-200'}`}
                            >
                              <CategoryIcon category={cat as Category} className={`w-4 h-4 ${editingReceipt.category === cat ? 'text-blue-500' : 'text-slate-400'}`} />
                              <span className="text-xs font-bold">{cat}</span>
                              {editingReceipt.category === cat && <Icons.CheckCircle2 className="w-3.5 h-3.5 ml-auto text-blue-500" />}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-[28px] border border-transparent dark:border-slate-700/50">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest opacity-60">위치</p>
                  {editingReceipt.latitude && editingReceipt.longitude && (
                    <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">
                      <Icons.MapPin className="w-3 h-3" /> 지도 표시 가능
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Icons.MapPin className="w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    className="w-full text-sm font-black dark:text-white bg-transparent focus:outline-none placeholder-slate-300 dark:placeholder-slate-600"
                    value={editingReceipt.address || ''}
                    placeholder="위치 정보를 입력하세요"
                    onChange={(e) => setEditingReceipt({ ...editingReceipt, address: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleGeocode();
                    }}
                  />
                  <button
                    onClick={handleGeocode}
                    disabled={isGeocoding || (!editingReceipt.address && !editingReceipt.merchant_name)}
                    className="flex-shrink-0 p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-bold hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-50"
                  >
                    {isGeocoding ? <Icons.RefreshCw className="w-4 h-4 animate-spin" /> : "좌표 검색"}
                  </button>
                </div>
              </div>

              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-[28px] border border-transparent dark:border-slate-700/50">
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1 opacity-60">추가 메모</p>
                <textarea
                  className="w-full text-sm dark:text-slate-300 font-medium bg-transparent focus:outline-none resize-none min-h-[90px]"
                  placeholder="상세 정보를 입력하세요."
                  value={editingReceipt.reasoning}
                  onChange={(e) => setEditingReceipt({ ...editingReceipt, reasoning: e.target.value })}
                />
              </div>
            </div>

            <div className="mt-8 flex gap-3 flex-shrink-0">
              {selectedReceipt && (
                <button onClick={() => handleDeleteReceipt(selectedReceipt.id)} className="p-5 text-red-500 bg-red-50 dark:bg-red-900/20 rounded-[22px] font-black text-sm flex-1">기록 삭제</button>
              )}
              <button onClick={handleSaveReceipt} className="p-5 bg-blue-600 text-white rounded-[22px] font-black text-sm flex-[2] shadow-xl shadow-blue-500/30 active:scale-95 transition-all">내역 저장하기</button>
            </div>
          </div>
        </div>
      )}

      {isNewTripModalOpen && (
        <div className="absolute inset-0 bg-black/75 z-50 flex items-center justify-center animate-in fade-in" onClick={() => setIsNewTripModalOpen(false)}>
          <div className="bg-white dark:bg-slate-900 w-[85%] max-h-[85vh] overflow-y-auto rounded-[32px] p-6 shadow-2xl animate-in zoom-in-95 no-scrollbar" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold dark:text-white mb-6 sticky top-0 bg-white dark:bg-slate-900 z-10 py-2">{editingTripId ? '여행 설정 수정' : '새 여행 만들기'}</h2>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">여행 이름</label>
                <input
                  className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl font-bold text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="예: 도쿄 먹방 여행"
                  value={newTripForm.title}
                  onChange={e => setNewTripForm({ ...newTripForm, title: e.target.value })}
                />
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">예산 (KRW)</label>
                  <input
                    type="number"
                    className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl font-bold text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                    value={newTripForm.budget}
                    onChange={e => setNewTripForm({ ...newTripForm, budget: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">통화 / 환율(선택)</label>
                  <div className="flex gap-2">
                    <select
                      className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl font-bold text-slate-700 dark:text-white focus:outline-none w-24"
                      value={newTripForm.targetCurrency}
                      onChange={e => setNewTripForm({ ...newTripForm, targetCurrency: e.target.value })}
                    >
                      <option value="JPY">JPY</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="CNY">CNY</option>
                      <option value="KRW">KRW</option>
                    </select>
                    <input
                      type="number"
                      className="flex-1 min-w-0 bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl font-bold text-slate-700 dark:text-white focus:outline-none"
                      placeholder="환율 (예: 900)"
                      value={newTripForm.exchangeRate}
                      onChange={e => setNewTripForm({ ...newTripForm, exchangeRate: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">시작일</label>
                  <input
                    type="date"
                    className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl font-bold text-slate-700 dark:text-white focus:outline-none"
                    value={newTripForm.startDate}
                    onChange={e => setNewTripForm({ ...newTripForm, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">종료일</label>
                  <input
                    type="date"
                    className="w-full bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl font-bold text-slate-700 dark:text-white focus:outline-none"
                    value={newTripForm.endDate}
                    onChange={e => setNewTripForm({ ...newTripForm, endDate: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              {editingTripId && (
                <button
                  type="button"
                  onClick={handleDeleteTrip}
                  className="p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-500 font-bold flex-1 active:scale-95 transition-transform"
                >
                  삭제
                </button>
              )}
              <button
                onClick={handleTripSubmit}
                className="p-4 rounded-2xl bg-blue-600 text-white font-bold flex-[2] shadow-lg shadow-blue-500/30"
              >
                {editingTripId ? '저장하기' : '여행 생성'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    <style>{`
        .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
        .custom-div-icon { background: none; border: none; }
        .leaflet-popup-content-wrapper { border-radius: 24px; padding: 0; box-shadow: 0 25px 30px -5px rgba(0,0,0,0.2); }
        .leaflet-popup-content { margin: 16px; }
      `}</style>
  </div>
);
};

export default App;