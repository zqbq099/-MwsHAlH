import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { db, auth } from './firebase';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, setDoc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { Loader2, Upload, Search, LogOut, LogIn, Trash2, Package, Phone, Wrench, Store, Heart, Edit, MapPin, BarChart2, MessageCircle, Filter, Moon, Sun, ChevronRight, ChevronLeft, User, Stethoscope, TrendingUp, Bot, Activity, Share2 } from 'lucide-react';

// تهيئة Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

type UserRole = 'merchant' | 'customer' | null;

const SAUDI_CITIES = ['الرياض', 'جدة', 'مكة المكرمة', 'المدينة المنورة', 'الدمام', 'الخبر', 'أبها', 'خميس مشيط', 'تبوك', 'بريدة', 'حائل', 'جازان', 'نجران', 'الطائف'];

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [isCheckingRole, setIsCheckingRole] = useState(true);
  
  const [result, setResult] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // حالات التاجر
  const [merchantParts, setMerchantParts] = useState<any[]>([]);
  const [pendingPart, setPendingPart] = useState<any | null>(null);
  const [editingPart, setEditingPart] = useState<any | null>(null);
  const [merchantPhone, setMerchantPhone] = useState<string>('');
  const [merchantCity, setMerchantCity] = useState<string>('');
  const [isProfileSaved, setIsProfileSaved] = useState(false);

  // حالات الزبون/المهندس
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [customerTab, setCustomerTab] = useState<'imageSearch' | 'textSearch' | 'favorites' | 'requests' | 'aiMechanic'>('imageSearch');
  
  // حالات البحث النصي
  const [textSearchQuery, setTextSearchQuery] = useState('');
  const [searchFilterCity, setSearchFilterCity] = useState('');
  const [isSearchingText, setIsSearchingText] = useState(false);

  // حالات الطلبات الخاصة
  const [partRequests, setPartRequests] = useState<any[]>([]);
  const [newRequest, setNewRequest] = useState({ partName: '', carMake: '', model: '', description: '' });
  const [offerData, setOfferData] = useState({ price: '', condition: 'مستعمل - ممتاز', notes: '' });
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [merchantTab, setMerchantTab] = useState<'inventory' | 'requests' | 'radar'>('inventory');

  // صفحة المتجر الخاص
  const [viewingMerchantId, setViewingMerchantId] = useState<string | null>(null);
  const [merchantProfile, setMerchantProfile] = useState<any | null>(null);
  const [merchantStoreParts, setMerchantStoreParts] = useState<any[]>([]);

  // حالات المساعد الذكي
  const [symptoms, setSymptoms] = useState('');
  const [diagnosis, setDiagnosis] = useState<{explanation: string, parts: string[]} | null>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);

  // الوضع الليلي
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // دالة ضغط الصورة لتصغير حجمها
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 600;
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
      };
    });
  };

  // تحديد دور المستخدم (تاجر أو مهندس)
  const selectRole = async (role: 'merchant' | 'customer') => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), {
        name: user.displayName,
        email: user.email,
        role: role,
        createdAt: new Date().toISOString()
      }, { merge: true });
      setUserRole(role);
    } catch (error) {
      console.error("خطأ في تحديد الصلاحية:", error);
    }
  };

  // جلب بيانات التاجر (رقم الجوال والمدينة)
  const fetchMerchantProfile = async (uid: string) => {
    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists() && docSnap.data().phone) {
      setMerchantPhone(docSnap.data().phone);
      setMerchantCity(docSnap.data().city || '');
      setIsProfileSaved(true);
    }
  };

  // حفظ إعدادات التاجر
  const saveMerchantProfile = async () => {
    if (!user || !merchantPhone || !merchantCity) {
      setResult('يرجى إدخال رقم الواتساب والمدينة.');
      setTimeout(() => setResult(''), 3000);
      return;
    }
    try {
      await setDoc(doc(db, 'users', user.uid), {
        phone: merchantPhone,
        city: merchantCity
      }, { merge: true });
      setIsProfileSaved(true);
      setResult('تم حفظ الإعدادات بنجاح!');
      setTimeout(() => setResult(''), 3000);
    } catch (error) {
      console.error("خطأ في حفظ الإعدادات:", error);
      setResult('حدث خطأ أثناء حفظ الإعدادات.');
    }
  };

  // 1. دالة التاجر: التعرف على القطعة وتجهيزها للإضافة
  const identifyPartForMerchant = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !user) return;

    if (!isProfileSaved || !merchantPhone || !merchantCity) {
      alert('يرجى حفظ إعدادات التواصل (الرقم والمدينة) أولاً لتتمكن من إضافة القطع.');
      return;
    }

    setIsAnalyzing(true);
    setResult('جاري تحليل الصور بواسطة الذكاء الاصطناعي...');

    try {
      const compressedImages = await Promise.all(Array.from(files).slice(0, 4).map(file => compressImage(file as File)));
      const base64Data = compressedImages[0].split(',')[1];

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { text: 'أنت خبير في قطع غيار السيارات. قم بتحليل هذه الصورة. أرجع اسم القطعة، موديل السيارة المتوافق، صانع السيارة، وسعر تقريبي مقترح بالريال السعودي بتنسيق JSON فقط. مثال: {"name": "شمعة أمامية يمين", "model": "كامري 2018-2022", "carMake": "تويوتا", "suggestedPrice": 250}' },
            { inlineData: { mimeType: 'image/jpeg', data: base64Data } }
          ],
        },
        config: { responseMimeType: "application/json" }
      });

      const partData = JSON.parse(response.text || '{}');
      
      setPendingPart({
        ...partData,
        imageUrls: compressedImages,
        imageUrl: compressedImages[0], // For backward compatibility
        price: partData.suggestedPrice || '',
        condition: 'مستعمل - ممتاز',
        quantity: 1
      });
      setResult('تم تحليل الصورة بنجاح. تم اقتراح سعر بناءً على حالة السوق.');
    } catch (error) {
      console.error("خطأ:", error);
      setResult('حدث خطأ أثناء التعرف على القطعة. يرجى المحاولة بصورة أوضح.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // المساعد الميكانيكي الذكي
  const diagnoseIssue = async () => {
    if (!symptoms) return;
    setIsDiagnosing(true);
    setResult('جاري تحليل الأعطال...');
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `أنت مهندس سيارات خبير. يشتكي العميل من الأعراض التالية في سيارته: "${symptoms}".
        قم بتشخيص المشكلة المحتملة باختصار، واذكر أسماء قطع الغيار التي قد تحتاج إلى استبدال.
        أرجع النتيجة بتنسيق JSON فقط كالتالي:
        {"explanation": "شرح مبسط للمشكلة", "parts": ["اسم القطعة 1", "اسم القطعة 2"]}`,
        config: { responseMimeType: "application/json" }
      });
      const data = JSON.parse(response.text || '{}');
      setDiagnosis(data);
      setResult('');
    } catch (error) {
      console.error(error);
      setResult('حدث خطأ أثناء التشخيص.');
    } finally {
      setIsDiagnosing(false);
    }
  };

  // 2. دالة التاجر: حفظ القطعة نهائياً في المخزون
  const savePendingPart = async () => {
    if (!pendingPart || !user) return;
    try {
      await addDoc(collection(db, 'parts'), {
        name: pendingPart.name || 'قطعة غير معروفة',
        model: pendingPart.model || 'غير محدد',
        carMake: pendingPart.carMake || 'غير محدد',
        price: Number(pendingPart.price) || 0,
        condition: pendingPart.condition,
        quantity: Number(pendingPart.quantity) || 1,
        imageUrl: pendingPart.imageUrl || pendingPart.imageUrls?.[0],
        imageUrls: pendingPart.imageUrls || [pendingPart.imageUrl],
        merchantId: user.uid,
        merchantName: user.displayName,
        merchantPhone: merchantPhone,
        merchantCity: merchantCity,
        whatsappClicks: 0, // تتبع النقرات V2
        createdAt: new Date().toISOString()
      });
      setPendingPart(null);
      setResult('تمت إضافة القطعة إلى مخزونك بنجاح!');
      fetchMerchantParts();
      setTimeout(() => setResult(''), 3000);
    } catch (error) {
      console.error("خطأ في الحفظ:", error);
      setResult('حدث خطأ أثناء حفظ القطعة.');
    }
  };

  // 3. دالة جلب مخزون التاجر
  const fetchMerchantParts = async () => {
    if (!user) return;
    const partsRef = collection(db, 'parts');
    const q = query(partsRef, where('merchantId', '==', user.uid));
    const querySnapshot = await getDocs(q);
    const parts: any[] = [];
    querySnapshot.forEach((doc) => {
      parts.push({ id: doc.id, ...doc.data() });
    });
    // ترتيب تنازلي حسب تاريخ الإضافة (أحدث أولاً)
    parts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setMerchantParts(parts);
  };

  // 4. دالة حذف قطعة من المخزون
  const deletePart = async (partId: string) => {
    if(confirm('هل أنت متأكد من حذف هذه القطعة؟')) {
      await deleteDoc(doc(db, 'parts', partId));
      fetchMerchantParts();
    }
  };

  // 4.5. دالة تحديث قطعة في المخزون
  const updatePart = async () => {
    if (!editingPart || !user) return;
    try {
      await setDoc(doc(db, 'parts', editingPart.id), {
        name: editingPart.name || 'قطعة غير معروفة',
        model: editingPart.model || 'غير محدد',
        carMake: editingPart.carMake || 'غير محدد',
        price: Number(editingPart.price) || 0,
        condition: editingPart.condition,
        quantity: Number(editingPart.quantity) || 1,
        imageUrl: editingPart.imageUrl || editingPart.imageUrls?.[0],
        imageUrls: editingPart.imageUrls || [editingPart.imageUrl],
        merchantId: user.uid,
        merchantName: user.displayName,
        merchantPhone: merchantPhone,
        merchantCity: merchantCity,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      setEditingPart(null);
      setResult('تم تحديث القطعة بنجاح!');
      fetchMerchantParts();
      setTimeout(() => setResult(''), 3000);
    } catch (error) {
      console.error("خطأ في التحديث:", error);
      setResult('حدث خطأ أثناء تحديث القطعة.');
    }
  };

  // 5. دالة الزبون/المهندس: البحث عن قطعة بالصورة
  const searchPartByImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    setResult('جاري البحث عن القطعة في متاجر التشليح...');
    setSearchResults([]);

    try {
      const compressedBase64 = await compressImage(file);
      const base64Data = compressedBase64.split(',')[1];

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { text: 'ما اسم هذه القطعة؟ أرجع JSON يحتوي على "name" و "carMake" إن أمكن. مثال: {"name": "شمعة أمامية", "carMake": "تويوتا"}' },
            { inlineData: { mimeType: 'image/jpeg', data: base64Data } }
          ],
        },
        config: { responseMimeType: "application/json" }
      });

      const partData = JSON.parse(response.text || '{}');
      
      const partsRef = collection(db, 'parts');
      const querySnapshot = await getDocs(partsRef);
      
      const results: any[] = [];
      const searchName = (partData.name || '').toLowerCase();
      const searchMake = (partData.carMake || '').toLowerCase();
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const dataName = (data.name || '').toLowerCase();
        const dataMake = (data.carMake || '').toLowerCase();
        
        if (dataName.includes(searchName) || (searchMake && dataMake.includes(searchMake))) {
          results.push({ id: doc.id, ...data });
        }
      });

      setSearchResults(results);
      setResult(results.length > 0 ? `تم العثور على ${results.length} نتيجة لـ "${partData.name}"` : `عذراً، لم نجد "${partData.name}" في المتاجر حالياً.`);
    } catch (error) {
      console.error("خطأ في البحث:", error);
      setResult('حدث خطأ أثناء البحث.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 5.5 دالة الزبون: البحث النصي V2
  const searchPartByText = async (overrideQuery?: string | React.SyntheticEvent) => {
    const queryToUse = typeof overrideQuery === 'string' ? overrideQuery : textSearchQuery;
    if (!queryToUse.trim() && !searchFilterCity) {
      setResult('يرجى إدخال كلمة للبحث أو اختيار مدينة.');
      setTimeout(() => setResult(''), 3000);
      return;
    }

    setIsSearchingText(true);
    setResult('جاري البحث...');
    setSearchResults([]);

    try {
      const partsRef = collection(db, 'parts');
      // إذا اختار مدينة فقط بدون نص، نجلب كل قطع المدينة
      let q = query(partsRef);
      if (searchFilterCity) {
        q = query(partsRef, where('merchantCity', '==', searchFilterCity));
      }
      
      const querySnapshot = await getDocs(q);
      const results: any[] = [];
      const searchLower = queryToUse.toLowerCase().trim();
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // فلترة نصية في الواجهة الأمامية (لأن Firestore لا يدعم البحث النصي الجزئي بسهولة)
        if (!searchLower || 
            (data.name && data.name.toLowerCase().includes(searchLower)) || 
            (data.carMake && data.carMake.toLowerCase().includes(searchLower)) ||
            (data.model && data.model.toLowerCase().includes(searchLower))) {
          results.push({ id: doc.id, ...data });
        }
      });

      setSearchResults(results);
      setResult(results.length > 0 ? `تم العثور على ${results.length} نتيجة.` : `عذراً، لم نجد نتائج مطابقة لبحثك.`);
    } catch (error) {
      console.error("خطأ في البحث النصي:", error);
      setResult('حدث خطأ أثناء البحث.');
    } finally {
      setIsSearchingText(false);
    }
  };

  // 6. دوال المفضلة للزبون
  const fetchFavorites = async (uid: string) => {
    const favRef = collection(db, 'favorites');
    const q = query(favRef, where('userId', '==', uid));
    const snapshot = await getDocs(q);
    const favs: any[] = [];
    snapshot.forEach(doc => favs.push({ favId: doc.id, ...doc.data() }));
    setFavorites(favs);
  };

  // 6.5. دوال الطلبات الخاصة
  const fetchPartRequests = async () => {
    const reqRef = collection(db, 'part_requests');
    const snapshot = await getDocs(reqRef);
    const reqs: any[] = [];
    snapshot.forEach(doc => reqs.push({ id: doc.id, ...doc.data() }));
    reqs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setPartRequests(reqs);
  };

  const submitPartRequest = async () => {
    if (!user) {
      setResult('يرجى تسجيل الدخول لتقديم طلب خاص.');
      setTimeout(() => setResult(''), 3000);
      return;
    }
    if (!newRequest.partName) {
      setResult('يرجى إدخال اسم القطعة على الأقل.');
      setTimeout(() => setResult(''), 3000);
      return;
    }
    try {
      await addDoc(collection(db, 'part_requests'), {
        ...newRequest,
        customerId: user.uid,
        customerName: user.displayName,
        status: 'open',
        offers: [],
        createdAt: new Date().toISOString()
      });
      setNewRequest({ partName: '', carMake: '', model: '', description: '' });
      setResult('تم إرسال طلبك بنجاح! سيقوم التجار بالرد عليك قريباً.');
      fetchPartRequests();
      setTimeout(() => setResult(''), 3000);
    } catch (error) {
      console.error("Error submitting request:", error);
      setResult('حدث خطأ أثناء إرسال الطلب.');
    }
  };

  const submitOffer = async () => {
    if (!user || !selectedRequest || !offerData.price) return;
    try {
      const newOffer = {
        merchantId: user.uid,
        merchantName: user.displayName,
        merchantPhone: merchantPhone,
        price: offerData.price,
        condition: offerData.condition,
        notes: offerData.notes,
        createdAt: new Date().toISOString()
      };
      
      const reqRef = doc(db, 'part_requests', selectedRequest.id);
      await updateDoc(reqRef, {
        offers: [...(selectedRequest.offers || []), newOffer]
      });
      
      setOfferData({ price: '', condition: 'مستعمل - ممتاز', notes: '' });
      setSelectedRequest(null);
      setResult('تم إرسال عرضك للزبون بنجاح!');
      fetchPartRequests();
      setTimeout(() => setResult(''), 3000);
    } catch (error) {
      console.error("Error submitting offer:", error);
      setResult('حدث خطأ أثناء إرسال العرض.');
    }
  };

  // 7. دوال صفحة المتجر الخاص
  const openMerchantStore = async (merchantId: string) => {
    setViewingMerchantId(merchantId);
    setMerchantProfile(null);
    setMerchantStoreParts([]);
    window.scrollTo(0, 0);

    try {
      // جلب بيانات التاجر
      const userDoc = await getDoc(doc(db, 'users', merchantId));
      if (userDoc.exists()) {
        setMerchantProfile(userDoc.data());
      }

      // جلب قطع التاجر
      const q = query(collection(db, 'parts'), where('merchantId', '==', merchantId));
      const snapshot = await getDocs(q);
      const parts: any[] = [];
      snapshot.forEach(doc => parts.push({ id: doc.id, ...doc.data() }));
      setMerchantStoreParts(parts);
    } catch (error) {
      console.error("Error fetching merchant store:", error);
    }
  };

  const closeMerchantStore = () => {
    setViewingMerchantId(null);
    setMerchantProfile(null);
    setMerchantStoreParts([]);
  };

  const toggleFavorite = async (part: any) => {
    if (!user) {
      setResult('يرجى تسجيل الدخول لإضافة القطع للمفضلة.');
      setTimeout(() => setResult(''), 3000);
      return;
    }
    const existing = favorites.find(f => f.partId === part.id);
    if (existing) {
      await deleteDoc(doc(db, 'favorites', existing.favId));
      setFavorites(favorites.filter(f => f.favId !== existing.favId));
    } else {
      const docRef = await addDoc(collection(db, 'favorites'), {
        userId: user.uid,
        partId: part.id,
        partData: part
      });
      setFavorites([...favorites, { favId: docRef.id, userId: user.uid, partId: part.id, partData: part }]);
    }
  };

  // 7. تتبع نقرات الواتساب V2
  const handleWhatsAppClick = async (part: any) => {
    if (!part.merchantPhone) return;
    
    // زيادة العداد في قاعدة البيانات
    try {
      const partRef = doc(db, 'parts', part.id);
      await updateDoc(partRef, {
        whatsappClicks: increment(1)
      });
    } catch (error) {
      console.error("Error tracking click:", error);
    }

    // فتح الواتساب
    const message = `مرحباً، أريد الاستفسار عن القطعة: ${part.name} المعروضة بسعر ${part.price} ريال في تطبيق سوق التشليح الذكي.`;
    window.open(`https://wa.me/${part.merchantPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  // 8. مشاركة القطعة
  const handleShare = async (part: any) => {
    const shareData = {
      title: `قطعة غيار: ${part.name}`,
      text: `شاهد هذه القطعة (${part.name}) لسيارة ${part.carMake} ${part.model} بسعر ${part.price} ريال على سوق التشليح الذكي!`,
      url: window.location.href,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
        setResult('تم نسخ تفاصيل القطعة للحافظة!');
        setTimeout(() => setResult(''), 3000);
      }
    } catch (err) {
      console.error('Error sharing:', err);
    }
  };

  // مراقبة حالة تسجيل الدخول وجلب الصلاحيات
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const role = userDoc.data().role;
          setUserRole(role);
          if (role === 'merchant') {
            fetchMerchantProfile(currentUser.uid);
            fetchMerchantParts();
            fetchPartRequests();
          } else if (role === 'customer') {
            fetchFavorites(currentUser.uid);
            fetchPartRequests();
          }
        } else {
          setUserRole(null);
          fetchPartRequests();
        }
      } else {
        setUserRole(null);
        setMerchantParts([]);
        setMerchantPhone('');
        setMerchantCity('');
        setIsProfileSaved(false);
        setFavorites([]);
      }
      setIsCheckingRole(false);
    });
    return () => unsubscribe();
  }, []);

  if (isCheckingRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </div>
    );
  }

  // مكون بطاقة القطعة (يستخدم في البحث والمفضلة)
  const PartCard: React.FC<{ part: any, isFav?: boolean }> = ({ part, isFav }) => {
    const isFavorited = favorites.some(f => f.partId === part.id);
    return (
      <div className="bg-white border rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-shadow flex flex-col relative group">
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
          {userRole === 'customer' && (
            <button 
              onClick={() => toggleFavorite(part)}
              className="p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-md hover:scale-110 transition-transform"
              title="إضافة للمفضلة"
            >
              <Heart className={`w-5 h-5 ${isFavorited ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
            </button>
          )}
          <button 
            onClick={() => handleShare(part)}
            className="p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-md hover:scale-110 transition-transform text-gray-500 hover:text-blue-600"
            title="مشاركة القطعة"
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>
        <div className="relative">
          <img src={part.imageUrl} alt={part.name} className="w-full h-48 object-cover" />
          {part.merchantCity && (
            <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1">
              <MapPin className="w-3 h-3" /> {part.merchantCity}
            </div>
          )}
        </div>
        <div className="p-5 flex-1 flex flex-col">
          <h4 className="font-bold text-lg mb-1 line-clamp-1">{part.name}</h4>
          <p className="text-sm text-gray-500 mb-4">{part.carMake} - {part.model}</p>
          
          <div className="flex justify-between items-center mb-4 mt-auto">
            <div className="text-2xl font-black text-green-600">{part.price} <span className="text-sm font-normal">ريال</span></div>
            <div className="text-xs font-medium bg-blue-50 text-blue-700 px-3 py-1 rounded-full">{part.condition}</div>
          </div>
          
          <div className="border-t pt-4">
            <button 
              onClick={() => openMerchantStore(part.merchantId)}
              className="text-xs text-blue-600 hover:text-blue-800 mb-3 flex items-center gap-1 font-bold transition-colors text-right w-full"
            >
              <Store className="w-3 h-3" /> التاجر: {part.merchantName} <ChevronLeft className="w-3 h-3 mr-auto" />
            </button>
            {part.merchantPhone ? (
              <button onClick={() => handleWhatsAppClick(part)} className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold py-2.5 rounded-xl transition shadow-sm hover:shadow-md">
                <MessageCircle className="w-5 h-5" /> تواصل واتساب
              </button>
            ) : (
              <button disabled className="w-full text-center bg-gray-100 text-gray-400 font-bold py-2.5 rounded-xl cursor-not-allowed">
                رقم التواصل غير متوفر
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`min-h-screen font-sans ${darkMode ? 'dark bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'}`} dir="rtl">
      {/* شريط التنقل العُلوي */}
      <header className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white shadow-sm'} sticky top-0 z-20 transition-colors`}>
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <Package className="w-6 h-6 sm:w-8 sm:h-8" />
            <h1 className="text-lg sm:text-2xl font-bold tracking-tight">سوق التشليح <span className="text-blue-400 dark:text-blue-300">الذكي</span></h1>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setDarkMode(!darkMode)} className={`p-2 rounded-full ${darkMode ? 'bg-gray-700 text-yellow-400' : 'bg-gray-100 text-gray-600'} transition-colors`}>
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            {user ? (
              <div className="flex items-center gap-3">
                <span className="hidden md:inline text-sm font-medium text-gray-600 dark:text-gray-300">
                  {user.displayName}
                </span>
                <button onClick={() => signOut(auth)} className={`flex items-center gap-2 ${darkMode ? 'bg-gray-700 text-gray-300 hover:text-red-400 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:text-red-600 hover:bg-red-50'} transition px-4 py-2 rounded-xl border ${darkMode ? 'border-gray-600' : 'border-gray-200'}`}>
                  <LogOut className="w-5 h-5" />
                  <span className="font-bold text-sm">تسجيل الخروج</span>
                </button>
              </div>
            ) : (
              <button onClick={() => signInWithPopup(auth, new GoogleAuthProvider())} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl transition shadow-md hover:shadow-lg font-bold">
                <LogIn className="w-5 h-5" />
                <span>تسجيل الدخول</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* رسائل النظام */}
        {result && !isAnalyzing && !isSearchingText && (
          <div className="mb-6 p-4 bg-blue-50 text-blue-800 rounded-xl border border-blue-100 font-medium text-center shadow-sm animate-in fade-in slide-in-from-top-2">
            {result}
          </div>
        )}

        {/* صفحة المتجر الخاص */}
        {viewingMerchantId ? (
          <div className="animate-in fade-in slide-in-from-bottom-4">
            <button 
              onClick={closeMerchantStore}
              className="mb-6 flex items-center gap-2 text-gray-500 hover:text-gray-800 font-bold transition-colors"
            >
              <ChevronRight className="w-5 h-5" /> العودة
            </button>
            
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden mb-8">
              <div className="h-32 bg-gradient-to-r from-blue-600 to-indigo-800"></div>
              <div className="px-8 pb-8 relative">
                <div className="w-24 h-24 bg-white rounded-2xl shadow-md border-4 border-white flex items-center justify-center -mt-12 mb-4 text-blue-600">
                  <Store className="w-12 h-12" />
                </div>
                <h2 className="text-3xl font-black text-gray-800 mb-2">{merchantProfile?.displayName || 'متجر تشليح'}</h2>
                <div className="flex flex-wrap gap-4 text-sm font-medium text-gray-500">
                  {merchantProfile?.city && (
                    <span className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                      <MapPin className="w-4 h-4 text-gray-400" /> {merchantProfile.city}
                    </span>
                  )}
                  {merchantProfile?.phone && (
                    <a 
                      href={`https://wa.me/${merchantProfile.phone}?text=مرحباً، أتواصل معك بخصوص متجرك في تطبيق سوق التشليح الذكي`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 bg-green-50 hover:bg-green-100 text-green-700 px-4 py-1.5 rounded-lg border border-green-200 transition-colors font-bold shadow-sm"
                    >
                      <MessageCircle className="w-4 h-4" /> تواصل واتساب
                    </a>
                  )}
                </div>
              </div>
            </div>

            <h3 className="text-2xl font-bold mb-6 text-gray-800 flex items-center gap-2">
              <Package className="w-6 h-6 text-blue-500" /> قطع الغيار المتوفرة ({merchantStoreParts.length})
            </h3>
            
            {merchantStoreParts.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 shadow-sm">
                <Package className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                <p className="text-gray-500 text-lg font-medium">لا توجد قطع معروضة في هذا المتجر حالياً.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {merchantStoreParts.map((part) => <PartCard key={part.id} part={part} />)}
              </div>
            )}
          </div>
        ) : (
          <>
        {/* شاشة اختيار نوع الحساب (للمستخدمين الجدد) */}
        {user && !userRole && (
          <div className="max-w-2xl mx-auto text-center space-y-8 animate-in fade-in zoom-in duration-300 py-12">
            <h2 className="text-3xl font-bold text-gray-800 mb-2">مرحباً بك يا {user.displayName}! 👋</h2>
            <p className="text-gray-600 text-lg mb-8">لتخصيص تجربتك، يرجى إخبارنا بنوع حسابك:</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <button 
                onClick={() => selectRole('merchant')}
                className="flex flex-col items-center p-8 bg-white border-2 border-transparent hover:border-blue-500 rounded-3xl shadow-sm hover:shadow-xl transition-all group"
              >
                <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-blue-100 transition-all">
                  <Store className="w-12 h-12" />
                </div>
                <h3 className="text-2xl font-bold mb-3">تاجر تشليح</h3>
                <p className="text-gray-500 text-sm leading-relaxed">أريد عرض قطع الغيار وإدارة مخزوني واستقبال طلبات الزبائن.</p>
              </button>

              <button 
                onClick={() => selectRole('customer')}
                className="flex flex-col items-center p-8 bg-white border-2 border-transparent hover:border-green-500 rounded-3xl shadow-sm hover:shadow-xl transition-all group"
              >
                <div className="w-24 h-24 bg-green-50 text-green-600 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-green-100 transition-all">
                  <Wrench className="w-12 h-12" />
                </div>
                <h3 className="text-2xl font-bold mb-3">مهندس / زبون</h3>
                <p className="text-gray-500 text-sm leading-relaxed">أريد البحث عن قطع الغيار باستخدام الصور والتواصل مع التجار.</p>
              </button>
            </div>
          </div>
        )}

        {/* ================= واجهة التاجر ================= */}
        {user && userRole === 'merchant' && (
          <div className="space-y-8 animate-in fade-in">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-900 p-5 rounded-2xl font-bold flex items-center gap-3 border border-blue-100 shadow-sm">
              <Store className="w-6 h-6 text-blue-600" /> لوحة تحكم متجرك: {user.displayName}
            </div>
            
            {/* إعدادات التاجر (رقم الواتساب والمدينة) */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <h2 className="text-xl font-bold mb-5 flex items-center gap-2">
                <Store className="w-6 h-6 text-indigo-500" />
                إعدادات المتجر (مطلوب)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">رقم الواتساب</label>
                  <input 
                    type="text" 
                    value={merchantPhone} 
                    onChange={(e) => setMerchantPhone(e.target.value)} 
                    placeholder="مثال: 966500000000"
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition outline-none"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">المدينة</label>
                  <select 
                    value={merchantCity} 
                    onChange={(e) => setMerchantCity(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition outline-none"
                  >
                    <option value="">اختر مدينتك...</option>
                    {SAUDI_CITIES.map(city => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                </div>
                <button 
                  onClick={saveMerchantProfile} 
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold transition shadow-sm"
                >
                  {isProfileSaved ? 'تحديث الإعدادات' : 'حفظ الإعدادات'}
                </button>
              </div>
              {!isProfileSaved && <p className="text-red-500 text-sm mt-3 font-medium flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span> يجب حفظ الإعدادات لتتمكن من إضافة القطع.</p>}
            </div>

            {/* تبويبات التاجر */}
            {isProfileSaved && (
              <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100 overflow-x-auto hide-scrollbar mb-6">
                <button 
                  onClick={() => setMerchantTab('inventory')}
                  className={`flex-1 min-w-[120px] px-4 py-3 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 ${merchantTab === 'inventory' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  <Package className="w-4 h-4" /> مخزوني
                </button>
                <button 
                  onClick={() => setMerchantTab('requests')}
                  className={`flex-1 min-w-[120px] px-4 py-3 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 ${merchantTab === 'requests' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  <MessageCircle className="w-4 h-4" /> طلبات الزبائن ({partRequests.filter(r => r.status === 'open').length})
                </button>
                <button 
                  onClick={() => setMerchantTab('radar')}
                  className={`flex-1 min-w-[120px] px-4 py-3 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 ${merchantTab === 'radar' ? 'bg-green-50 text-green-700 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  <TrendingUp className="w-4 h-4" /> رادار السوق
                </button>
              </div>
            )}

            {merchantTab === 'inventory' && (
              <>
                {/* إضافة قطعة جديدة / تعديل قطعة */}
                <div className={`bg-white p-6 rounded-3xl shadow-sm border border-gray-100 transition-opacity duration-300 ${!isProfileSaved ? 'opacity-50 pointer-events-none' : ''}`}>
              <h2 className="text-xl font-bold mb-5 flex items-center gap-2">
                {editingPart ? <Edit className="w-6 h-6 text-blue-500" /> : <Upload className="w-6 h-6 text-blue-500" />}
                {editingPart ? 'تعديل بيانات القطعة' : 'إضافة قطعة جديدة للمخزون'}
              </h2>
              
              {editingPart ? (
                /* نموذج تعديل القطعة */
                <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 animate-in fade-in slide-in-from-bottom-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <img src={editingPart.imageUrl} alt="القطعة" className="w-full h-56 object-cover rounded-xl shadow-sm mb-4" />
                    </div>
                    <div className="space-y-5">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1.5">اسم القطعة</label>
                        <input type="text" value={editingPart.name} onChange={e => setEditingPart({...editingPart, name: e.target.value})} className="w-full p-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1.5">صانع السيارة</label>
                          <input type="text" value={editingPart.carMake} onChange={e => setEditingPart({...editingPart, carMake: e.target.value})} className="w-full p-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1.5">الموديل</label>
                          <input type="text" value={editingPart.model} onChange={e => setEditingPart({...editingPart, model: e.target.value})} className="w-full p-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1.5">السعر (ريال)</label>
                          <input type="number" placeholder="0" value={editingPart.price} onChange={e => setEditingPart({...editingPart, price: e.target.value})} className="w-full p-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1.5">الكمية</label>
                          <input type="number" value={editingPart.quantity} onChange={e => setEditingPart({...editingPart, quantity: e.target.value})} className="w-full p-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1.5">الحالة</label>
                          <select value={editingPart.condition} onChange={e => setEditingPart({...editingPart, condition: e.target.value})} className="w-full p-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none">
                            <option>جديد</option>
                            <option>مستعمل - أخو الجديد</option>
                            <option>مستعمل - ممتاز</option>
                            <option>مستعمل - جيد</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-3 pt-4">
                        <button onClick={updatePart} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold transition shadow-sm">حفظ التعديلات</button>
                        <button onClick={() => setEditingPart(null)} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-xl font-bold transition">إلغاء</button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : !pendingPart ? (
                <div className={`relative border-2 border-dashed ${darkMode ? 'border-blue-800 bg-blue-900/20 hover:bg-blue-900/40' : 'border-blue-200 bg-blue-50/30 hover:bg-blue-50/80'} rounded-2xl p-10 text-center transition cursor-pointer group`}>
                  <input type="file" multiple accept="image/*" onChange={identifyPartForMerchant} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={isAnalyzing || !isProfileSaved} />
                  {isAnalyzing ? (
                    <div className="flex flex-col items-center text-blue-600 dark:text-blue-400">
                      <Loader2 className="w-12 h-12 animate-spin mb-3" />
                      <p className="font-bold">جاري فحص الصور بالذكاء الاصطناعي...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-blue-500 dark:text-blue-400">
                      <div className={`w-16 h-16 ${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-full flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform`}>
                        <Upload className="w-8 h-8" />
                      </div>
                      <p className={`font-bold text-xl ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>التقط صور للقطعة (حتى 4 صور) أو اختر من الاستوديو</p>
                      <p className={`text-sm mt-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>سيقوم الذكاء الاصطناعي بالتعرف عليها واقتراح سعر لها</p>
                    </div>
                  )}
                </div>
              ) : (
                /* نموذج استكمال بيانات القطعة بعد التعرف عليها */
                <div className="bg-green-50/50 p-6 rounded-2xl border border-green-100 animate-in fade-in slide-in-from-bottom-4">
                  <h3 className="font-bold text-lg mb-5 text-green-800 dark:text-green-400 flex items-center gap-2"><div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div> تم التعرف على القطعة بنجاح! يرجى مراجعة البيانات:</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      {pendingPart.imageUrls && pendingPart.imageUrls.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2">
                          {pendingPart.imageUrls.map((url: string, idx: number) => (
                            <img key={idx} src={url} alt={`صورة ${idx + 1}`} className="w-full h-32 object-cover rounded-xl shadow-sm" />
                          ))}
                        </div>
                      ) : (
                        <img src={pendingPart.imageUrl} alt="القطعة" className="w-full h-56 object-cover rounded-xl shadow-sm mb-4" />
                      )}
                    </div>
                    <div className="space-y-5">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1.5">اسم القطعة</label>
                        <input type="text" value={pendingPart.name} onChange={e => setPendingPart({...pendingPart, name: e.target.value})} className="w-full p-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1.5">صانع السيارة</label>
                          <input type="text" value={pendingPart.carMake} onChange={e => setPendingPart({...pendingPart, carMake: e.target.value})} className="w-full p-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none" />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1.5">الموديل</label>
                          <input type="text" value={pendingPart.model} onChange={e => setPendingPart({...pendingPart, model: e.target.value})} className="w-full p-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none" />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1.5">السعر (ريال)</label>
                          <input type="number" placeholder="0" value={pendingPart.price} onChange={e => setPendingPart({...pendingPart, price: e.target.value})} className="w-full p-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none" />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1.5">الكمية</label>
                          <input type="number" value={pendingPart.quantity} onChange={e => setPendingPart({...pendingPart, quantity: e.target.value})} className="w-full p-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none" />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1.5">الحالة</label>
                          <select value={pendingPart.condition} onChange={e => setPendingPart({...pendingPart, condition: e.target.value})} className="w-full p-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none">
                            <option>جديد</option>
                            <option>مستعمل - أخو الجديد</option>
                            <option>مستعمل - ممتاز</option>
                            <option>مستعمل - جيد</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-3 pt-4">
                        <button onClick={savePendingPart} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-bold transition shadow-sm">إضافة للمخزون</button>
                        <button onClick={() => setPendingPart(null)} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-xl font-bold transition">إلغاء</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* قائمة المخزون */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Package className="w-6 h-6 text-gray-700" /> مخزونك الحالي ({merchantParts.length})
              </h2>
              {merchantParts.length === 0 ? (
                <div className="text-center py-16 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                  <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg font-medium">لا توجد قطع في مخزونك حالياً.</p>
                  <p className="text-gray-400 text-sm mt-2">ابدأ برفع صور القطع لإضافتها.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                  {merchantParts.map((part) => (
                    <div key={part.id} className="border border-gray-200 rounded-2xl overflow-hidden hover:shadow-lg transition-all bg-white flex flex-col group">
                      <div className="relative">
                        <img src={part.imageUrl} alt={part.name} className="w-full h-48 object-cover" />
                        {/* إحصائيات التاجر V2 */}
                        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm text-gray-800 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm">
                          <BarChart2 className="w-3.5 h-3.5 text-blue-600" />
                          <span>{part.whatsappClicks || 0} نقرة واتساب</span>
                        </div>
                      </div>
                      <div className="p-5 flex-1 flex flex-col">
                        <h3 className="font-bold text-lg mb-1 line-clamp-1">{part.name}</h3>
                        <p className="text-sm text-gray-500 mb-3">{part.carMake} - {part.model}</p>
                        <div className="flex justify-between items-center mt-auto pt-4 border-t border-gray-100">
                          <span className="font-black text-xl text-green-600">{part.price} <span className="text-sm font-normal">ريال</span></span>
                          <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">{part.condition}</span>
                        </div>
                        <div className="flex gap-2 mt-5">
                          <button onClick={() => setEditingPart(part)} className="flex-1 flex items-center justify-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 py-2.5 rounded-xl transition font-medium">
                            <Edit className="w-4 h-4" /> تعديل
                          </button>
                          <button onClick={() => deletePart(part.id)} className="flex-1 flex items-center justify-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 py-2.5 rounded-xl transition font-medium">
                            <Trash2 className="w-4 h-4" /> حذف
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            </>
            )}

            {merchantTab === 'requests' && (
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 animate-in fade-in">
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <MessageCircle className="w-6 h-6 text-indigo-500" /> طلبات الزبائن المفتوحة
                </h2>
                {partRequests.filter(r => r.status === 'open').length === 0 ? (
                  <div className="text-center py-16 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                    <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 text-lg font-medium">لا توجد طلبات مفتوحة حالياً.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {partRequests.filter(r => r.status === 'open').map(request => (
                      <div key={request.id} className="border border-gray-200 rounded-2xl p-5 hover:shadow-md transition-shadow bg-white">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="font-bold text-lg text-gray-800">{request.partName}</h3>
                            <p className="text-sm text-gray-500">{request.carMake} - {request.model}</p>
                          </div>
                          <span className="text-xs font-medium bg-green-100 text-green-700 px-2.5 py-1 rounded-full">مفتوح</span>
                        </div>
                        {request.description && (
                          <p className="text-gray-600 text-sm mb-4 bg-gray-50 p-3 rounded-xl border border-gray-100">{request.description}</p>
                        )}
                        <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
                          <User className="w-3.5 h-3.5" /> الزبون: {request.customerName}
                        </div>
                        
                        {/* نموذج تقديم عرض */}
                        {selectedRequest?.id === request.id ? (
                          <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 mt-4 animate-in fade-in">
                            <h4 className="font-bold text-indigo-800 mb-3 text-sm">تقديم عرض سعر</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                              <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">السعر (ريال)</label>
                                <input type="number" value={offerData.price} onChange={e => setOfferData({...offerData, price: e.target.value})} className="w-full p-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" placeholder="مثال: 500" />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">الحالة</label>
                                <select value={offerData.condition} onChange={e => setOfferData({...offerData, condition: e.target.value})} className="w-full p-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm">
                                  <option>جديد</option>
                                  <option>مستعمل - أخو الجديد</option>
                                  <option>مستعمل - ممتاز</option>
                                  <option>مستعمل - جيد</option>
                                </select>
                              </div>
                            </div>
                            <div className="mb-3">
                              <label className="block text-xs font-bold text-gray-700 mb-1">ملاحظات إضافية (اختياري)</label>
                              <input type="text" value={offerData.notes} onChange={e => setOfferData({...offerData, notes: e.target.value})} className="w-full p-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm" placeholder="مثال: متوفر لون أسود، ضمان شهر..." />
                            </div>
                            <div className="flex gap-2">
                              <button onClick={submitOffer} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg font-bold transition text-sm">إرسال العرض</button>
                              <button onClick={() => setSelectedRequest(null)} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 rounded-lg font-bold transition text-sm">إلغاء</button>
                            </div>
                          </div>
                        ) : (
                          <button 
                            onClick={() => setSelectedRequest(request)}
                            className="w-full sm:w-auto bg-indigo-50 hover:bg-indigo-100 text-indigo-700 py-2 px-6 rounded-xl font-bold transition text-sm flex items-center justify-center gap-2"
                          >
                            <MessageCircle className="w-4 h-4" /> تقديم عرض
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {merchantTab === 'radar' && (
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 animate-in fade-in">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center text-green-600">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">رادار السوق (القطع الأكثر طلباً)</h2>
                    <p className="text-gray-500 text-sm">اكتشف القطع التي يبحث عنها الزبائن بكثرة لتوفيرها في متجرك</p>
                  </div>
                </div>

                {(() => {
                  const trending = partRequests.reduce((acc: any, req) => {
                    const key = `${req.carMake} - ${req.partName}`;
                    if (!acc[key]) acc[key] = { name: req.partName, count: 0, make: req.carMake, model: req.model };
                    acc[key].count += 1;
                    return acc;
                  }, {});
                  const topTrending = Object.values(trending).sort((a: any, b: any) => b.count - a.count).slice(0, 10);

                  if (topTrending.length === 0) {
                    return (
                      <div className="text-center py-16 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                        <Activity className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500 text-lg font-medium">لا توجد بيانات كافية حالياً.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {topTrending.map((item: any, idx: number) => (
                        <div key={idx} className="bg-gray-50 border border-gray-100 rounded-2xl p-4 flex items-center justify-between hover:shadow-md transition-shadow">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center font-black text-green-600 shadow-sm border border-gray-100">
                              #{idx + 1}
                            </div>
                            <div>
                              <h4 className="font-bold text-gray-800">{item.name}</h4>
                              <p className="text-xs text-gray-500">{item.make} - {item.model}</p>
                            </div>
                          </div>
                          <div className="text-center">
                            <span className="block text-2xl font-black text-green-600">{item.count}</span>
                            <span className="text-[10px] text-gray-400 font-bold uppercase">طلب</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* ================= واجهة الزبون / المهندس (أو الزائر غير المسجل) ================= */}
        {(!user || userRole === 'customer') && (
          <div className="space-y-6 animate-in fade-in">
            {user && userRole === 'customer' && (
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 text-green-700 font-bold text-lg">
                  <Wrench className="w-6 h-6" /> مرحباً بك يا مهندس: {user.displayName}
                </div>
              </div>
            )}

            {/* تبويبات الزبون V2 */}
            <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100 overflow-x-auto hide-scrollbar">
              <button 
                onClick={() => setCustomerTab('imageSearch')}
                className={`flex-1 min-w-[120px] px-4 py-3 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 ${customerTab === 'imageSearch' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                <Search className="w-4 h-4" /> بحث بالصورة
              </button>
              <button 
                onClick={() => setCustomerTab('textSearch')}
                className={`flex-1 min-w-[120px] px-4 py-3 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 ${customerTab === 'textSearch' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                <Filter className="w-4 h-4" /> بحث يدوي
              </button>
              {user && (
                <>
                <button 
                  onClick={() => setCustomerTab('favorites')}
                  className={`flex-1 min-w-[120px] px-4 py-3 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 ${customerTab === 'favorites' ? 'bg-red-50 text-red-600 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  <Heart className="w-4 h-4" /> المفضلة ({favorites.length})
                </button>
                <button 
                  onClick={() => setCustomerTab('requests')}
                  className={`flex-1 min-w-[120px] px-4 py-3 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 ${customerTab === 'requests' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  <MessageCircle className="w-4 h-4" /> طلباتي ({partRequests.filter(r => r.customerId === user.uid).length})
                </button>
                <button 
                  onClick={() => setCustomerTab('aiMechanic')}
                  className={`flex-1 min-w-[120px] px-4 py-3 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 ${customerTab === 'aiMechanic' ? 'bg-purple-50 text-purple-700 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  <Stethoscope className="w-4 h-4" /> المشخص الذكي
                </button>
                </>
              )}
            </div>

            {/* محتوى التبويبات */}
            {customerTab === 'imageSearch' && (
              <div className="animate-in fade-in slide-in-from-bottom-4">
                <div className="bg-gradient-to-br from-blue-600 to-indigo-800 p-10 rounded-3xl shadow-lg text-white text-center relative overflow-hidden">
                  <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white opacity-10 rounded-full blur-3xl"></div>
                  <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-blue-400 opacity-20 rounded-full blur-3xl"></div>
                  
                  <h2 className="text-3xl md:text-4xl font-black mb-4 relative z-10">ابحث عن أي قطعة بصورة! 📸</h2>
                  <p className="text-blue-100 mb-10 max-w-lg mx-auto text-lg relative z-10">لا تعرف اسم القطعة؟ التقط صورة لها وسيقوم الذكاء الاصطناعي بإيجادها لك في متاجر التشليح فوراً.</p>
                  
                  <div className="relative max-w-md mx-auto bg-white/10 backdrop-blur-md rounded-3xl p-2 shadow-2xl border border-white/20 z-10 hover:bg-white/20 transition-colors">
                    <input type="file" accept="image/*" onChange={searchPartByImage} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" disabled={isAnalyzing} />
                    <div className="flex items-center justify-center gap-3 bg-white text-blue-700 py-5 rounded-2xl shadow-inner">
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="w-7 h-7 animate-spin" />
                          <span className="font-bold text-lg">جاري البحث بالذكاء الاصطناعي...</span>
                        </>
                      ) : (
                        <>
                          <Search className="w-7 h-7" />
                          <span className="font-bold text-lg">التقط صورة للبحث الآن</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {customerTab === 'textSearch' && (
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-4">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-gray-800">
                  <Filter className="w-6 h-6 text-blue-500" /> البحث اليدوي المتقدم
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  <div className="md:col-span-6">
                    <input 
                      type="text" 
                      placeholder="اسم القطعة، الموديل، أو الشركة (مثال: شمعة كامري)" 
                      value={textSearchQuery}
                      onChange={(e) => setTextSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && searchPartByText()}
                      className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-lg"
                    />
                  </div>
                  <div className="md:col-span-4">
                    <select 
                      value={searchFilterCity}
                      onChange={(e) => setSearchFilterCity(e.target.value)}
                      className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-lg text-gray-700"
                    >
                      <option value="">كل المدن</option>
                      {SAUDI_CITIES.map(city => (
                        <option key={city} value={city}>{city}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <button 
                      onClick={searchPartByText}
                      disabled={isSearchingText}
                      className="w-full h-full min-h-[56px] bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-sm"
                    >
                      {isSearchingText ? <Loader2 className="w-6 h-6 animate-spin" /> : <Search className="w-6 h-6" />}
                      <span className="md:hidden">بحث</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {customerTab === 'favorites' && (
              <div className="animate-in fade-in slide-in-from-bottom-4">
                <h3 className="text-2xl font-bold mb-6 flex items-center gap-2 text-gray-800">
                  <Heart className="w-7 h-7 text-red-500 fill-red-500" /> القطع المفضلة
                </h3>
                {!user ? (
                  <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 shadow-sm">
                    <LogIn className="w-20 h-20 text-gray-200 mx-auto mb-5" />
                    <p className="text-gray-500 text-xl font-medium mb-4">يرجى تسجيل الدخول لعرض المفضلة.</p>
                    <button onClick={() => signInWithPopup(auth, new GoogleAuthProvider())} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl transition shadow-md">تسجيل الدخول</button>
                  </div>
                ) : favorites.length === 0 ? (
                  <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 shadow-sm">
                    <Heart className="w-20 h-20 text-gray-200 mx-auto mb-5" />
                    <p className="text-gray-500 text-xl font-medium">لم تقم بإضافة أي قطع للمفضلة بعد.</p>
                    <button onClick={() => setCustomerTab('imageSearch')} className="mt-6 bg-blue-50 text-blue-600 font-bold px-6 py-3 rounded-xl hover:bg-blue-100 transition">تصفح القطع الآن</button>
                  </div>
                ) : null}
              </div>
            )}

            {customerTab === 'requests' && (
              <div className="animate-in fade-in slide-in-from-bottom-4">
                {!user ? (
                  <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 shadow-sm mb-8">
                    <MessageCircle className="w-20 h-20 text-gray-200 mx-auto mb-5" />
                    <p className="text-gray-500 text-xl font-medium mb-4">يرجى تسجيل الدخول لتقديم طلبات خاصة.</p>
                    <button onClick={() => signInWithPopup(auth, new GoogleAuthProvider())} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-3 rounded-xl transition shadow-md">تسجيل الدخول</button>
                  </div>
                ) : (
                  <>
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-8">
                      <h3 className="text-xl font-bold mb-5 flex items-center gap-2 text-indigo-700">
                        <MessageCircle className="w-6 h-6" /> طلب قطعة غير متوفرة
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1.5">اسم القطعة (مطلوب)</label>
                          <input type="text" value={newRequest.partName} onChange={e => setNewRequest({...newRequest, partName: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="مثال: صدام أمامي" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1.5">الشركة</label>
                            <input type="text" value={newRequest.carMake} onChange={e => setNewRequest({...newRequest, carMake: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="مثال: تويوتا" />
                          </div>
                          <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1.5">الموديل</label>
                            <input type="text" value={newRequest.model} onChange={e => setNewRequest({...newRequest, model: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="مثال: 2020" />
                          </div>
                        </div>
                      </div>
                      <div className="mb-4">
                        <label className="block text-sm font-bold text-gray-700 mb-1.5">وصف إضافي</label>
                        <textarea value={newRequest.description} onChange={e => setNewRequest({...newRequest, description: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none min-h-[100px]" placeholder="أي تفاصيل إضافية عن القطعة المطلوبة..."></textarea>
                      </div>
                      <button onClick={submitPartRequest} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold transition shadow-sm">إرسال الطلب للتجار</button>
                    </div>

                    <h3 className="text-xl font-bold mb-5 flex items-center gap-2 text-gray-800">
                      <MessageCircle className="w-6 h-6 text-indigo-500" /> طلباتي السابقة ({partRequests.filter(r => r.customerId === user.uid).length})
                    </h3>
                    
                    {partRequests.filter(r => r.customerId === user.uid).length === 0 ? (
                      <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                        <p className="text-gray-500 font-medium">لم تقم بتقديم أي طلبات بعد.</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {partRequests.filter(r => r.customerId === user.uid).map(request => (
                          <div key={request.id} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <h4 className="font-bold text-lg text-gray-800">{request.partName}</h4>
                                <p className="text-sm text-gray-500">{request.carMake} - {request.model}</p>
                              </div>
                              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${request.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                {request.status === 'open' ? 'مفتوح' : 'مغلق'}
                              </span>
                            </div>
                            {request.description && (
                              <p className="text-gray-600 text-sm mb-4">{request.description}</p>
                            )}
                            
                            {/* عروض التجار */}
                            <div className="mt-4 pt-4 border-t border-gray-100">
                              <h5 className="font-bold text-sm text-gray-700 mb-3 flex items-center gap-1.5">
                                <Store className="w-4 h-4 text-indigo-500" /> عروض التجار ({request.offers?.length || 0})
                              </h5>
                              {(!request.offers || request.offers.length === 0) ? (
                                <p className="text-xs text-gray-400">بانتظار عروض التجار...</p>
                              ) : (
                                <div className="space-y-3">
                                  {request.offers.map((offer: any, idx: number) => (
                                    <div key={idx} className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                      <div>
                                        <button 
                                          onClick={() => openMerchantStore(offer.merchantId)}
                                          className="font-bold text-indigo-900 text-sm hover:text-indigo-600 transition-colors flex items-center gap-1"
                                        >
                                          {offer.merchantName} <ChevronLeft className="w-3 h-3" />
                                        </button>
                                        <div className="flex gap-2 text-xs text-gray-500 mt-1">
                                          <span className="bg-white px-2 py-0.5 rounded border border-gray-100">{offer.condition}</span>
                                          {offer.notes && <span className="bg-white px-2 py-0.5 rounded border border-gray-100 truncate max-w-[150px]">{offer.notes}</span>}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-3 w-full sm:w-auto">
                                        <span className="font-black text-green-600">{offer.price} ريال</span>
                                        <a 
                                          href={`https://wa.me/${offer.merchantPhone}?text=مرحباً، بخصوص عرضك لقطعة (${request.partName}) بسعر ${offer.price} ريال`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex-1 sm:flex-none bg-green-500 hover:bg-green-600 text-white text-xs font-bold py-2 px-3 rounded-lg transition text-center flex items-center justify-center gap-1"
                                        >
                                          <MessageCircle className="w-3.5 h-3.5" /> تواصل
                                        </a>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {customerTab === 'aiMechanic' && (
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-4">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center text-purple-600">
                    <Stethoscope className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800">المشخص الذكي للأعطال</h2>
                    <p className="text-gray-500 text-sm">صف المشكلة وسيقوم الذكاء الاصطناعي بتشخيصها واقتراح القطع المطلوبة</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <textarea 
                    value={symptoms}
                    onChange={e => setSymptoms(e.target.value)}
                    placeholder="مثال: السيارة ترجف عند الفرملة على سرعة 100، ويوجد صوت طقطقة من الكفر الأمامي اليمين..."
                    className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-purple-500 outline-none min-h-[120px] resize-none"
                  ></textarea>
                  
                  <button 
                    onClick={diagnoseIssue}
                    disabled={isDiagnosing || !symptoms}
                    className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white font-bold py-4 rounded-2xl transition shadow-sm flex items-center justify-center gap-2"
                  >
                    {isDiagnosing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Bot className="w-5 h-5" />}
                    {isDiagnosing ? 'جاري تحليل المشكلة...' : 'تشخيص العطل'}
                  </button>
                </div>

                {diagnosis && (
                  <div className="mt-8 p-6 bg-purple-50 border border-purple-100 rounded-3xl animate-in zoom-in-95">
                    <h3 className="text-lg font-bold text-purple-900 mb-3 flex items-center gap-2">
                      <Activity className="w-5 h-5" /> نتيجة التشخيص
                    </h3>
                    <p className="text-purple-800 mb-6 leading-relaxed">{diagnosis.explanation}</p>
                    
                    <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-gray-500" /> القطع المحتمل تلفها:
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {diagnosis.parts.map((part, idx) => (
                        <button 
                          key={idx}
                          onClick={() => {
                            setTextSearchQuery(part);
                            setCustomerTab('textSearch');
                            searchPartByText(part);
                          }}
                          className="bg-white border border-purple-200 text-purple-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-purple-600 hover:text-white transition-colors flex items-center gap-2 shadow-sm"
                        >
                          <Search className="w-3.5 h-3.5" /> ابحث عن: {part}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* عرض نتائج البحث أو المفضلة */}
            {(searchResults.length > 0 || (customerTab === 'favorites' && favorites.length > 0)) && (
              <div className="mt-8">
                {customerTab !== 'favorites' && <h3 className="text-xl font-bold mb-6 text-gray-800">نتائج البحث ({searchResults.length}):</h3>}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {customerTab === 'favorites' 
                    ? favorites.map((fav) => <PartCard key={fav.favId} part={fav.partData} isFav={true} />)
                    : searchResults.map((part) => <PartCard key={part.id} part={part} />)
                  }
                </div>
              </div>
            )}
          </div>
        )}
        </>
        )}
      </main>

      {/* الفوتر (تذييل الصفحة) */}
      <footer className={`${darkMode ? 'bg-gray-800 border-gray-700 text-gray-400' : 'bg-white border-gray-200 text-gray-500'} border-t mt-auto py-8 transition-colors`}>
        <div className="max-w-5xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4 text-blue-600 dark:text-blue-400">
            <Package className="w-6 h-6" />
            <span className="text-xl font-bold tracking-tight">سوق التشليح <span className="text-blue-400 dark:text-blue-300">الذكي</span></span>
          </div>
          <p className="mb-6 text-sm">المنصة الأولى لربط الباحثين عن قطع الغيار بمتاجر التشليح في المملكة بكل سهولة وموثوقية.</p>
          <div className="flex justify-center gap-6 text-sm font-medium">
            <a href="#" className="hover:text-blue-600 transition-colors">عن التطبيق</a>
            <a href="#" className="hover:text-blue-600 transition-colors">الشروط والأحكام</a>
            <a href="#" className="hover:text-blue-600 transition-colors">تواصل معنا</a>
          </div>
          <div className="mt-8 text-xs opacity-70">
            &copy; {new Date().getFullYear()} سوق التشليح الذكي. جميع الحقوق محفوظة.
          </div>
        </div>
      </footer>
    </div>
  );
}
