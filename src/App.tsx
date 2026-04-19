import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { db, auth } from './firebase';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User as FirebaseUser, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, setDoc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { Loader2, Upload, Search, LogOut, LogIn, Trash2, Package, Phone, Wrench, Store, Heart, Edit, MapPin, BarChart2, MessageCircle, Filter, Moon, Sun, ChevronRight, ChevronLeft, User, Stethoscope, TrendingUp, Bot, Activity, Share2, ShoppingCart, Truck, CreditCard, ScanLine, CheckCircle2, Star, ShieldCheck, Camera, PlusCircle, Sparkles, AlertCircle, Users } from 'lucide-react';

// تهيئة Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

type UserRole = 'merchant' | 'customer' | 'broker' | null;

const SAUDI_CITIES = ['الرياض', 'جدة', 'مكة المكرمة', 'المدينة المنورة', 'الدمام', 'الخبر', 'أبها', 'خميس مشيط', 'تبوك', 'بريدة', 'حائل', 'جازان', 'نجران', 'الطائف'];

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [isCheckingRole, setIsCheckingRole] = useState(true);

  // مصادقة مخصصة (Custom Auth)
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authPhoneForm, setAuthPhoneForm] = useState('');
  const [authPass, setAuthPass] = useState('');
  const [authName, setAuthName] = useState('');

  // الرفع اليدوي والوسيط
  const [isManualMode, setIsManualMode] = useState(false);
  const [ownerPhone, setOwnerPhone] = useState(''); // خاص بحساب الوسيط

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
  const [merchantTab, setMerchantTab] = useState<'inventory' | 'requests' | 'radar' | 'sales'>('inventory');

  // صفحة المتجر الخاص
  const [viewingMerchantId, setViewingMerchantId] = useState<string | null>(null);
  const [merchantProfile, setMerchantProfile] = useState<any | null>(null);
  const [merchantStoreParts, setMerchantStoreParts] = useState<any[]>([]);
  const [merchantReviews, setMerchantReviews] = useState<any[]>([]);
  const [checkoutPart, setCheckoutPart] = useState<any | null>(null);
  const [ratingModal, setRatingModal] = useState<string | null>(null); // merchantId
  const [newReview, setNewReview] = useState({ rating: 5, comment: '' });
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [merchantOrders, setMerchantOrders] = useState<any[]>([]);
  
  // مقارنة القطع
  const [comparisonList, setComparisonList] = useState<any[]>([]);
  const [showComparison, setShowComparison] = useState(false);

  // حالات البحث النصي المتقدمة
  const [searchFilterMake, setSearchFilterMake] = useState('');
  const [searchFilterModel, setSearchFilterModel] = useState('');

  // الرفع الجماعي (تاجر)
  const [bulkPendingParts, setBulkPendingParts] = useState<any[]>([]);

  // القطع الأكثر طلباً
  const [trendingParts, setTrendingParts] = useState<any[]>([]);

  // حالات الرفع (تاجر)
  const [isDragging, setIsDragging] = useState(false);

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

  // 0. دوال المصادقة המخصصة
  const handleCustomAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authPhoneForm || !authPass) {
      setResult('يرجى تعبئة جميع الحقول');
      return;
    }
    const fakeEmail = `${authPhoneForm}@smartscrap.local`;
    setIsCheckingRole(true);
    setResult('');
    try {
      if (authMode === 'register') {
        if (!authName) {
          setResult('يرجى إدخال الاسم');
          setIsCheckingRole(false);
          return;
        }
        const cred = await createUserWithEmailAndPassword(auth, fakeEmail, authPass);
        await updateProfile(cred.user, { displayName: authName });
        await setDoc(doc(db, 'users', cred.user.uid), {
          phone: authPhoneForm,
          name: authName,
          createdAt: new Date().toISOString()
        }, { merge: true });
      } else {
        await signInWithEmailAndPassword(auth, fakeEmail, authPass);
      }
      setShowAuthModal(false);
      setAuthPhoneForm('');
      setAuthPass('');
      setAuthName('');
    } catch (error: any) {
      console.error(error);
      setResult('تعذر تسجيل الدخول، تأكد من البيانات.');
      setIsCheckingRole(false);
    }
  };

  // تحديد دور المستخدم (تاجر أو مهندس أو وسيط)
  const selectRole = async (role: UserRole) => {
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
    if (!confirm('هل تريد حفظ تغييرات الملف الشخصي والاتصال؟')) return;
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

  // 1.5 دالة الرفع الجماعي (Bulk Upload)
  const identifyBulkPartsForMerchant = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !user) return;

    if (!isProfileSaved || !merchantPhone || !merchantCity) {
      alert('يرجى حفظ إعدادات التواصل (الرقم والمدينة) أولاً لتتمكن من إضافة القطع.');
      return;
    }

    setIsAnalyzing(true);
    setResult(`جاري تحليل ${files.length} صور بالذكاء الاصطناعي...`);

    try {
      const processed = [];
      // الحد الأقصى 10 صور في المرة للرفع الجماعي
      const filesArray = Array.from(files).slice(0, 10);
      
      for (const file of filesArray) {
        const compressedBase64 = await compressImage(file as File);
        const base64Data = compressedBase64.split(',')[1];

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
        processed.push({
          ...partData,
          imageUrl: compressedBase64,
          price: partData.suggestedPrice || '',
          condition: 'مستعمل - ممتاز',
          quantity: 1
        });
      }
      setBulkPendingParts(processed);
      setResult(`تم استيراد ${processed.length} قطع بنجاح بنظام الرفع الجماعي.`);
    } catch (error) {
      console.error("خطأ في التحليل الجماعي:", error);
      setResult('حدث خطأ أثناء التحليل الجماعي للملفات.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const saveBulkParts = async () => {
    if (bulkPendingParts.length === 0 || !user) return;
    if (!confirm(`هل أنت متأكد من إضافة ${bulkPendingParts.length} قطعة للمخزون دفعة واحدة؟`)) return;
    
    try {
      setIsAnalyzing(true);
      setResult('جاري الحفظ الجماعي...');
      await Promise.all(bulkPendingParts.map(p => 
        addDoc(collection(db, 'parts'), {
          ...p,
          merchantId: user.uid,
          merchantName: user.displayName,
          merchantPhone: merchantPhone,
          merchantCity: merchantCity,
          whatsappClicks: 0,
          createdAt: new Date().toISOString()
        })
      ));
      setBulkPendingParts([]);
      setResult('تمت إضافة جميع القطع للمخزون بنجاح!');
      fetchMerchantParts();
    } catch (e) {
      console.error(e);
      setResult('خطأ في الحفظ الجماعي.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // جلب الطلبات (Orders)
  const fetchCustomerOrders = async (uid: string) => {
    const q = query(collection(db, 'orders'), where('buyerId', '==', uid));
    const snap = await getDocs(q);
    const ords: any[] = [];
    snap.forEach(doc => ords.push({ id: doc.id, ...doc.data() }));
    setCustomerOrders(ords.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  };

  // جلب طلبات التاجر (المبيعات)
  const fetchMerchantOrders = async (merchantId: string) => {
    const q = query(collection(db, 'orders'), where('merchantId', '==', merchantId));
    const snap = await getDocs(q);
    const ords: any[] = [];
    snap.forEach(doc => ords.push({ id: doc.id, ...doc.data() }));
    setMerchantOrders(ords.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  };

  // تحديث حالة الطلب (من قبل التاجر أو الزبون)
  const updateOrderStatus = async (orderId: string, newStatus: string, isMerchant: boolean, trackingInfo?: string) => {
    try {
      const orderRef = doc(db, 'orders', orderId);
      const updateData: any = { status: newStatus };
      if (trackingInfo) updateData.trackingNumber = trackingInfo;
      
      await updateDoc(orderRef, updateData);
      setResult('تم تحديث حالة الطلب بنجاح');
      
      // إعادة جلب البيانات لتحديث الـ UI
      if (user) {
        if (isMerchant) {
          fetchMerchantOrders(user.uid);
        } else {
          fetchCustomerOrders(user.uid);
        }
      }
      setTimeout(() => setResult(''), 3000);
    } catch (err) {
      console.error(err);
      setResult('فشل تحديث الحالة');
    }
  };

  const handleCheckoutClick = (part: any) => {
    if (!user) {
      setResult('يرجى تسجيل الدخول للشراء');
      setTimeout(() => setResult(''), 3000);
      return;
    }
    setCheckoutPart(part);
  };

  // نظام الدفع وحجز القطع (Checkout)
  const handleCheckout = async () => {
    if (!user || !checkoutPart) return;
    try {
      setResult('جاري إنشاء الطلب وشراء القطعة...');
      await addDoc(collection(db, 'orders'), {
        buyerId: user.uid,
        buyerName: user.displayName,
        merchantId: checkoutPart.merchantId,
        merchantName: checkoutPart.merchantName,
        partId: checkoutPart.id,
        partName: checkoutPart.name,
        price: checkoutPart.price,
        status: 'escrow', // مدفوع ومحجوز
        createdAt: new Date().toISOString()
      });
      setResult('تم الشراء بنجاح! تم حجز المبلغ حتى الاستلام.');
      setCheckoutPart(null);
      fetchCustomerOrders(user.uid);
      setTimeout(() => setResult(''), 3000);
    } catch (err) {
      console.error(err);
      setResult('حدث خطأ أثناء إتمام عملية الشراء.');
    }
  };

  // نظام التقييم (Reviews)
  const submitReview = async () => {
    if (!user || !ratingModal) return;
    try {
      await addDoc(collection(db, 'reviews'), {
        reviewerId: user.uid,
        reviewerName: user.displayName,
        merchantId: ratingModal,
        rating: newReview.rating,
        comment: newReview.comment,
        createdAt: new Date().toISOString()
      });
      setResult('تم إرسال التقييم بنجاح. شكراً لك!');
      setRatingModal(null);
      setNewReview({ rating: 5, comment: '' });
      setTimeout(() => setResult(''), 3000);
      
      // تحديث مراجعات المتجر إذا كنا فاتحينه
      if (viewingMerchantId === ratingModal) {
        openMerchantStore(ratingModal);
      }
    } catch (err) {
      console.error(err);
      setResult('حدث خطأ أثناء حفظ التقييم.');
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
  // 1.8 دالة المعالجة اليدوية للصور (بدون ذكاء اصطناعي)
  const processManualImages = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !user) return;
    try {
      const compressedImages = await Promise.all(Array.from(files).slice(0, 5).map(file => compressImage(file as File)));
      setPendingPart({
        ...(pendingPart || { name: '', carMake: '', model: '', price: '', condition: 'جديد', quantity: 1 }),
        imageUrls: compressedImages,
        imageUrl: compressedImages[0],
      });
    } catch (e) {
      console.error(e);
      setResult('خطأ في معالجة الصور.');
    }
  };

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
        addedByRole: userRole,
        ownerPhone: userRole === 'broker' ? ownerPhone : null,
        createdAt: new Date().toISOString()
      });
      setPendingPart(null);
      setIsManualMode(false);
      setOwnerPhone('');
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

  // جلب قطع التريند (الأكثر طلباً)
  const fetchTrendingParts = async () => {
    try {
      const partsRef = collection(db, 'parts');
      const q = query(partsRef, where('whatsappClicks', '>', 0));
      const querySnapshot = await getDocs(q);
      const parts: any[] = [];
      querySnapshot.forEach((doc) => {
        parts.push({ id: doc.id, ...doc.data() });
      });
      // ترتيب حسب النقرات
      parts.sort((a, b) => (b.whatsappClicks || 0) - (a.whatsappClicks || 0));
      setTrendingParts(parts.slice(0, 6)); // أفضل 6 قطع
    } catch (e) {
      console.error(e);
    }
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
    if (!queryToUse.trim() && !searchFilterCity && !searchFilterMake && !searchFilterModel) {
      setResult('يرجى إدخال كلمة للبحث أو اختيار معايير فلترة.');
      setTimeout(() => setResult(''), 3000);
      return;
    }

    setIsSearchingText(true);
    setResult('جاري البحث...');
    setSearchResults([]);

    try {
      const partsRef = collection(db, 'parts');
      // فلترة أولية حسب المدينة لو وجدت
      let q = query(partsRef);
      if (searchFilterCity) {
        q = query(partsRef, where('merchantCity', '==', searchFilterCity));
      }
      
      const querySnapshot = await getDocs(q);
      const results: any[] = [];
      const searchLower = queryToUse.toLowerCase().trim();
      const makeLower = searchFilterMake.toLowerCase().trim();
      const modelLower = searchFilterModel.toLowerCase().trim();
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const dataName = (data.name || '').toLowerCase();
        const dataMake = (data.carMake || '').toLowerCase();
        const dataModel = (data.model || '').toLowerCase();

        // تطبيق الفلاتر المتقدمة
        const matchQuery = !searchLower || (dataName.includes(searchLower) || dataMake.includes(searchLower) || dataModel.includes(searchLower));
        const matchMake = !makeLower || dataMake.includes(makeLower);
        const matchModel = !modelLower || dataModel.includes(modelLower);

        if (matchQuery && matchMake && matchModel) {
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
    setMerchantReviews([]);
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

      // جلب مراجعات التاجر
      const rQuery = query(collection(db, 'reviews'), where('merchantId', '==', merchantId));
      const rSnap = await getDocs(rQuery);
      const revs: any[] = [];
      rSnap.forEach(r => revs.push({ id: r.id, ...r.data() }));
      setMerchantReviews(revs);
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
  const handleWhatsAppClick = async (part: any, specificPhone?: string) => {
    const phoneToUse = specificPhone || part.merchantPhone;
    if (!phoneToUse) return;
    
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
    window.open(`https://wa.me/${phoneToUse}?text=${encodeURIComponent(message)}`, '_blank');
  };

  // 7.5 إدارة قائمة المقارنة
  const toggleComparison = (part: any) => {
    setComparisonList(prev => {
      const exists = prev.find(p => p.id === part.id);
      if (exists) {
        return prev.filter(p => p.id !== part.id);
      }
      if (prev.length >= 3) {
        setResult('يمكنك مقارنة 3 قطع كحد أقصى');
        setTimeout(() => setResult(''), 3000);
        return prev;
      }
      return [...prev, part];
    });
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

  // المساعد الميكانيكي الذكي
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const role = userDoc.data().role;
          setUserRole(role);
          if (role === 'merchant' || role === 'broker') {
            fetchMerchantProfile(currentUser.uid);
            fetchMerchantParts();
            fetchPartRequests();
            fetchMerchantOrders(currentUser.uid);
          } else if (role === 'customer') {
            fetchFavorites(currentUser.uid);
            fetchPartRequests();
            fetchCustomerOrders(currentUser.uid);
            fetchTrendingParts();
          }
        } else {
          setUserRole(null);
          fetchPartRequests();
          fetchTrendingParts();
        }
      } else {
        setUserRole(null);
        setMerchantParts([]);
        setMerchantPhone('');
        setMerchantCity('');
        setIsProfileSaved(false);
        setFavorites([]);
        fetchTrendingParts();
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
    const isInComparison = comparisonList.some(p => p.id === part.id);
    
    return (
      <div className="bg-white border rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all flex flex-col relative group">
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
          {userRole === 'customer' && (
            <button 
              onClick={() => toggleComparison(part)}
              className={`p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-md hover:scale-110 transition-transform ${isInComparison ? 'text-blue-600 bg-blue-50' : 'text-gray-400'}`}
              title="مقارنة القطعة"
            >
              <BarChart2 className="w-5 h-5" />
            </button>
          )}
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
            <div className="flex flex-col gap-2">
              {part.merchantPhone ? (
                <>
                  <button onClick={() => handleWhatsAppClick(part, part.merchantPhone)} className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold py-2.5 rounded-lg transition shadow-sm hover:shadow-md text-sm">
                    <MessageCircle className="w-5 h-5" /> تواصل واتساب {part.addedByRole === 'broker' ? '(الوسيط)' : ''}
                  </button>
                  {part.addedByRole === 'broker' && part.ownerPhone && (
                     <button onClick={() => handleWhatsAppClick(part, part.ownerPhone)} className="w-full flex items-center justify-center gap-2 bg-purple-500 hover:bg-purple-600 text-white font-bold py-2.5 rounded-lg transition shadow-sm hover:shadow-md text-sm">
                        <MessageCircle className="w-5 h-5" /> واتساب المالك
                     </button>
                  )}
                </>
              ) : (
                <button disabled className="w-full text-center bg-gray-100 text-gray-400 font-bold py-2.5 rounded-lg cursor-not-allowed">
                  رقم التواصل غير متوفر
                </button>
              )}
              {userRole === 'customer' && (
                <button onClick={() => handleCheckoutClick(part)} className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg transition shadow-sm hover:shadow-md">
                  <ShoppingCart className="w-5 h-5" /> شراء وتوصيل آمن
                </button>
              )}
            </div>
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
              <button onClick={() => setShowAuthModal(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl transition shadow-md hover:shadow-lg font-bold">
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

        {/* زر المقارنة العائم */}
        {comparisonList.length > 0 && !showComparison && (
          <button 
            onClick={() => setShowComparison(true)}
            className="fixed bottom-24 right-6 z-40 bg-blue-600 text-white px-6 py-4 rounded-full shadow-2xl hover:bg-blue-700 transition-all scale-110 flex items-center gap-3 animate-in slide-in-from-right-10"
          >
            <div className="bg-white text-blue-600 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
              {comparisonList.length}
            </div>
            <span className="font-bold">قارن القطع المحددة</span>
            <BarChart2 className="w-6 h-6" />
          </button>
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
                  {user && userRole === 'customer' && (
                    <button 
                      onClick={() => setRatingModal(viewingMerchantId)}
                      className="flex items-center gap-1.5 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 px-4 py-1.5 rounded-lg border border-yellow-200 transition-colors font-bold shadow-sm"
                    >
                      <Star className="w-4 h-4" /> تقييم التاجر
                    </button>
                  )}
                </div>

                {merchantReviews.length > 0 && (
                  <div className="mt-6 border-t border-gray-100 pt-6">
                    <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                      <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" /> 
                      تقييمات الزبائن ({(merchantReviews.reduce((acc, r) => acc + r.rating, 0) / merchantReviews.length).toFixed(1)} / 5)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {merchantReviews.map(review => (
                        <div key={review.id} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-bold text-sm">{review.customerName}</span>
                            <div className="flex text-yellow-400">
                              {[...Array(review.rating)].map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-yellow-400" />)}
                            </div>
                          </div>
                          {review.comment && <p className="text-sm text-gray-600">{review.comment}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                onClick={() => selectRole('broker')}
                className="flex flex-col items-center p-8 bg-white border-2 border-transparent hover:border-purple-500 rounded-3xl shadow-sm hover:shadow-xl transition-all group"
              >
                <div className="w-24 h-24 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-purple-100 transition-all">
                  <Users className="w-12 h-12" />
                </div>
                <h3 className="text-2xl font-bold mb-3">وسيط (دلال)</h3>
                <p className="text-gray-500 text-sm leading-relaxed">أريد مساعدة الآخرين في بيع قطعهم وإدارة طلباتهم واستقبال العروض.</p>
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
                  onClick={() => setMerchantTab('sales')}
                  className={`flex-1 min-w-[120px] px-4 py-3 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 ${merchantTab === 'sales' ? 'bg-green-50 text-green-700 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  <TrendingUp className="w-4 h-4" /> مبيعاتي ({merchantOrders.filter(o => o.status === 'escrow').length})
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
                {/* خيار الرفع الجماعي (Bulk Upload) */}
                {bulkPendingParts.length > 0 && (
                  <div className="bg-indigo-50 border-2 border-indigo-200 p-8 rounded-[32px] mb-8 animate-in zoom-in-95">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-2xl font-black text-indigo-900 flex items-center gap-3">
                        <Sparkles className="w-7 h-7 text-indigo-600" /> مراجعة الرفع الجماعي ({bulkPendingParts.length} قطع)
                      </h3>
                      <div className="flex gap-3">
                         <button onClick={saveBulkParts} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-bold transition flex items-center gap-2">
                           <CheckCircle2 className="w-5 h-5" /> حفظ الكل للمخزون
                         </button>
                         <button onClick={() => setBulkPendingParts([])} className="bg-white text-gray-500 border border-gray-200 px-6 py-3 rounded-2xl font-bold hover:bg-red-50 hover:text-red-600 transition">إلغاء الكل</button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {bulkPendingParts.map((part, idx) => (
                        <div key={idx} className="bg-white p-4 rounded-2xl border border-indigo-100 shadow-sm relative group">
                          <img src={part.imageUrl} className="w-full h-32 object-cover rounded-xl mb-3" />
                          <input 
                            value={part.name} 
                            onChange={(e) => {
                              const newBulk = [...bulkPendingParts];
                              newBulk[idx].name = e.target.value;
                              setBulkPendingParts(newBulk);
                            }}
                            className="w-full text-sm font-bold border-none bg-gray-50 rounded-lg p-2 mb-2" 
                          />
                          <div className="flex gap-2">
                            <input 
                              type="number"
                              value={part.price}
                              onChange={(e) => {
                                const newBulk = [...bulkPendingParts];
                                newBulk[idx].price = e.target.value;
                                setBulkPendingParts(newBulk);
                              }}
                              className="w-full text-sm font-black text-green-600 bg-green-50 rounded-lg p-2" 
                              placeholder="السعر"
                            />
                            <button onClick={() => setBulkPendingParts(bulkPendingParts.filter((_, i) => i !== idx))} className="bg-red-50 text-red-500 p-2 rounded-lg hover:bg-red-100 transition">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* إضافة قطعة جديدة / تعديل قطعة */}
                <div className={`bg-white p-6 rounded-3xl shadow-sm border border-gray-100 transition-opacity duration-300 ${!isProfileSaved ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  {editingPart ? <Edit className="w-6 h-6 text-blue-500" /> : <Upload className="w-6 h-6 text-blue-500" />}
                  {editingPart ? 'تعديل بيانات القطعة' : 'إضافة قطعة جديدة للحراج'}
                </h2>
                {!editingPart && (
                  <label className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl text-xs font-black cursor-pointer hover:bg-indigo-100 transition flex items-center gap-2">
                    <PlusCircle className="w-4 h-4" /> رفع جماعي (حتى 10 صور)
                    <input type="file" multiple accept="image/*" className="hidden" onChange={identifyBulkPartsForMerchant} />
                  </label>
                )}
              </div>
              
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
                <div className="space-y-6">
                  <div 
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => { 
                      e.preventDefault(); 
                      setIsDragging(false);
                      const files = Array.from(e.dataTransfer.files);
                      if (files.length > 0) {
                        const event = { target: { files } } as any;
                        identifyPartForMerchant(event);
                      }
                    }}
                    className={`relative border-2 border-dashed ${isDragging ? 'border-blue-600 bg-blue-100/50' : (darkMode ? 'border-blue-800 bg-blue-900/20' : 'border-blue-200 bg-blue-50/30')} rounded-3xl p-12 text-center transition-all cursor-pointer group flex flex-col items-center justify-center min-h-[300px]`}
                  >
                    <input type="file" multiple accept="image/*" onChange={identifyPartForMerchant} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={isAnalyzing || !isProfileSaved} />
                    {isAnalyzing ? (
                      <div className="flex flex-col items-center text-blue-600 dark:text-blue-400">
                        <Loader2 className="w-16 h-16 animate-spin mb-4" />
                        <p className="font-black text-xl">جاري تحليل البيانات بالذكاء الاصطناعي...</p>
                        <p className="text-gray-500 mt-2">نحاول قراءة رقم القطعة والتعرف على نوع السيارة</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center text-blue-500 dark:text-blue-400">
                        <div className={`w-20 h-20 ${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-full flex items-center justify-center shadow-xl mb-6 group-hover:scale-110 transition-transform`}>
                          <Camera className="w-10 h-10" />
                        </div>
                        <p className={`font-black text-2xl ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                          {isDragging ? 'أسقط الصور هنا الآن!' : 'اسحب الصور وأسقطها هنا'}
                        </p>
                        <p className={`text-gray-500 mt-4 max-w-sm leading-relaxed`}>
                          أو اضغط لاختيار الصور من جهازك. سنقوم تلقائياً بملء بيانات القطعة والسعر المقترح لك.
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-center gap-4 py-4">
                    <div className="h-px bg-gray-200 flex-1"></div>
                    <span className="text-gray-400 font-bold text-sm">أو</span>
                    <div className="h-px bg-gray-200 flex-1"></div>
                  </div>
                  
                  <button 
                    onClick={() => {
                       setIsManualMode(true);
                       setPendingPart({ name: '', carMake: '', model: '', price: '', condition: 'جديد', quantity: 1, imageUrls: [] });
                       setOwnerPhone('');
                    }}
                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-4 rounded-2xl font-bold transition flex items-center justify-center gap-2 border border-gray-200"
                  >
                    <PlusCircle className="w-5 h-5" /> إضافة إعلان بالطريقة اليدوية
                  </button>
                </div>
              ) : (
                /* نموذج استكمال بيانات القطعة بعد التعرف عليها */
                <div className={`${isManualMode ? 'bg-gray-50' : 'bg-green-50/20'} p-8 rounded-[32px] border ${isManualMode ? 'border-gray-200' : 'border-green-100'} animate-in fade-in slide-in-from-bottom-4 shadow-sm`}>
                  <div className="flex items-center justify-between mb-8">
                    {isManualMode ? (
                       <h3 className="font-black text-2xl text-gray-800 flex items-center gap-3">
                         <Edit className="w-6 h-6 text-gray-500" /> 
                         الإضافة اليدوية للقطعة
                       </h3>
                    ) : (
                      <>
                        <h3 className="font-black text-2xl text-green-800 dark:text-green-400 flex items-center gap-3">
                          <div className="w-4 h-4 bg-green-500 rounded-full animate-pulse shadow-glow shadow-green-500/50"></div> 
                          تم التعرف على القطعة بنجاح!
                        </h3>
                        <div className="bg-green-100 text-green-700 font-bold px-4 py-1.5 rounded-full text-xs">AI Verified</div>
                      </>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-4">
                      {pendingPart.imageUrls && pendingPart.imageUrls.length > 0 ? (
                        <div className="grid grid-cols-2 gap-4">
                          {pendingPart.imageUrls.map((url: string, idx: number) => (
                            <img key={idx} src={url} alt={`صورة ${idx + 1}`} className="w-full h-40 object-cover rounded-2xl shadow-md border-2 border-white" />
                          ))}
                        </div>
                      ) : isManualMode ? (
                        <div className="border-2 border-dashed border-gray-300 rounded-3xl p-10 text-center relative hover:bg-gray-100 transition-colors cursor-pointer">
                          <input type="file" multiple accept="image/*" onChange={processManualImages} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                          <p className="font-bold text-gray-600">اضغط لرفع صور القطعة</p>
                        </div>
                      ) : (
                        <img src={pendingPart.imageUrl} alt="القطعة" className="w-full h-80 object-cover rounded-3xl shadow-xl border-4 border-white" />
                      )}
                      <p className="text-xs text-gray-400 text-center font-medium">يرجى التأكد من أن الصور واضحة وتظهر حالة القطعة بدقة</p>
                    </div>

                    <div className="space-y-6">
                      <div className="group">
                        <label className="block text-sm font-black text-gray-700 mb-2">اسم القطعة</label>
                        <input 
                          type="text" 
                          value={pendingPart.name} 
                          onChange={e => setPendingPart({...pendingPart, name: e.target.value})} 
                          className={`w-full p-4 bg-white border-2 ${pendingPart.name ? 'border-green-200' : 'border-red-200 animate-pulse-subtle'} rounded-2xl focus:ring-4 focus:ring-green-500/20 outline-none font-bold text-lg transition-all`} 
                          placeholder="اسم القطعة (مطلوب)"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-black text-gray-700 mb-2">صانع السيارة</label>
                          <input 
                            type="text" 
                            value={pendingPart.carMake} 
                            onChange={e => setPendingPart({...pendingPart, carMake: e.target.value})} 
                            className="w-full p-4 bg-white border-2 border-gray-100 rounded-2xl focus:ring-4 focus:ring-green-500/20 outline-none font-bold" 
                            placeholder="مثل: تويوتا"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-black text-gray-700 mb-2">الموديل</label>
                          <input 
                            type="text" 
                            value={pendingPart.model} 
                            onChange={e => setPendingPart({...pendingPart, model: e.target.value})} 
                            className="w-full p-4 bg-white border-2 border-gray-100 rounded-2xl focus:ring-4 focus:ring-green-500/20 outline-none font-bold" 
                            placeholder="مثل: كامري 2020"
                          />
                        </div>
                      </div>

                      {userRole === 'broker' && (
                        <div className="mb-4">
                          <label className="block text-sm font-black text-purple-700 mb-2">رقم هاتف مالك القطعة (خاص بك فقط للتواصل السريع)</label>
                          <input 
                            type="tel" 
                            value={ownerPhone} 
                            onChange={e => setOwnerPhone(e.target.value)} 
                            className="w-full p-4 bg-purple-50 border-2 border-purple-100 rounded-2xl focus:ring-4 focus:ring-purple-500/20 outline-none font-bold text-gray-800" 
                            placeholder="رقم هاتف المالك الأصلي"
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-1">
                          <label className="block text-sm font-black text-blue-600 mb-2">السعر (ريال)</label>
                          <input 
                            type="number" 
                            placeholder="0" 
                            value={pendingPart.price} 
                            onChange={e => setPendingPart({...pendingPart, price: e.target.value})} 
                            className="w-full p-4 bg-blue-50 border-2 border-blue-100 rounded-2xl focus:ring-4 focus:ring-blue-500/20 outline-none font-black text-blue-700 text-xl" 
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-black text-gray-700 mb-2">الكمية</label>
                          <input type="number" value={pendingPart.quantity} onChange={e => setPendingPart({...pendingPart, quantity: e.target.value})} className="w-full p-4 bg-white border-2 border-gray-100 rounded-2xl focus:ring-4 focus:ring-green-500/20 outline-none font-bold" />
                        </div>
                        <div>
                          <label className="block text-sm font-black text-gray-700 mb-2">الحالة</label>
                          <select value={pendingPart.condition} onChange={e => setPendingPart({...pendingPart, condition: e.target.value})} className="w-full p-4 bg-white border-2 border-gray-100 rounded-2xl focus:ring-4 focus:ring-green-500/20 outline-none font-bold">
                            <option>جديد</option>
                            <option>مستعمل - أخو الجديد</option>
                            <option>مستعمل - ممتاز</option>
                            <option>مستعمل - جيد</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex gap-4 pt-6">
                        <button 
                          onClick={savePendingPart} 
                          disabled={!pendingPart.name || !pendingPart.price || (userRole === 'broker' && !ownerPhone)}
                          className="flex-[2] bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white py-5 rounded-[20px] font-black text-xl transition-all shadow-xl shadow-green-100 hover:scale-[1.02] flex items-center justify-center gap-3"
                        >
                          <CheckCircle2 className="w-7 h-7" /> نشر القطعة الآن
                        </button>
                        <button onClick={() => { setPendingPart(null); setIsManualMode(false); setOwnerPhone(''); }} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-5 rounded-[20px] font-bold transition-all">إلغاء</button>
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

            {merchantTab === 'sales' && (
              <div className="animate-in fade-in slide-in-from-bottom-4">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <TrendingUp className="w-7 h-7 text-green-600" /> المبيعات والطلبات الواردة
                  </h3>
                  <div className="bg-green-100 text-green-700 px-4 py-2 rounded-xl text-sm font-bold">
                    إجمالي المبيعات: {merchantOrders.reduce((acc, o) => acc + (o.status === 'completed' ? o.price : 0), 0)} ريال
                  </div>
                </div>

                {merchantOrders.length === 0 ? (
                  <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 shadow-sm">
                    <TrendingUp className="w-16 h-16 text-gray-200 mx-auto mb-5" />
                    <p className="text-gray-500 text-xl font-medium">لا توجد مبيعات حالياً.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {merchantOrders.map(order => {
                      const statuses = [
                        { id: 'escrow', label: 'مدفوع', icon: CreditCard },
                        { id: 'packaged', label: 'تم التجهيز', icon: Package },
                        { id: 'shipping', label: 'مشحون', icon: Truck },
                        { id: 'out_for_delivery', label: 'مع المندوب', icon: MapPin },
                        { id: 'delivered', label: 'وصل للعميل', icon: CheckCircle2 },
                        { id: 'completed', label: 'مكتمل', icon: ShieldCheck },
                      ];
                      const currentIndex = statuses.findIndex(s => s.id === order.status);

                      return (
                        <div key={order.id} className="bg-white border border-gray-100 rounded-[32px] p-8 shadow-sm hover:shadow-md transition-all">
                          <div className="flex flex-col lg:flex-row gap-8">
                            {/* معلومات الطلب */}
                            <div className="flex-1">
                              <div className="flex justify-between items-start mb-6">
                                <div>
                                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 block">رقم الطلب: #{order.id.slice(-6)}</span>
                                  <h4 className="font-black text-2xl text-gray-800">{order.partName}</h4>
                                  <p className="text-gray-500 flex items-center gap-1 mt-1">
                                    <User className="w-4 h-4" /> المشتري: {order.buyerName}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <div className="text-3xl font-black text-green-600">{order.price} ريال</div>
                                  <p className="text-xs text-gray-400 mt-1">{new Date(order.createdAt).toLocaleString('ar-SA')}</p>
                                </div>
                              </div>

                              {/* تتبع الحالة (الشريط) */}
                              <div className="relative flex justify-between items-center mb-8 px-2">
                                <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-100 -translate-y-1/2 z-0"></div>
                                <div 
                                  className="absolute top-1/2 left-0 h-1 bg-green-500 -translate-y-1/2 z-0 transition-all duration-500"
                                  style={{ width: `${(currentIndex / (statuses.length - 1)) * 100}%` }}
                                ></div>
                                {statuses.map((step, idx) => {
                                  const Icon = step.icon;
                                  const isActive = idx <= currentIndex;
                                  const isCurrent = idx === currentIndex;
                                  return (
                                    <div key={step.id} className="relative z-10 flex flex-col items-center gap-2">
                                      <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                                        isCurrent ? 'bg-green-600 text-white scale-125 shadow-lg' : 
                                        isActive ? 'bg-green-100 text-green-600' : 
                                        'bg-white border-2 border-gray-100 text-gray-300'
                                      }`}>
                                        <Icon className="w-5 h-5" />
                                      </div>
                                      <span className={`text-[10px] font-bold ${isActive ? 'text-gray-800' : 'text-gray-400'}`}>{step.label}</span>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* تحديث الحالة */}
                              {order.status !== 'completed' && (
                                <div className="bg-gray-50 p-4 rounded-2xl flex flex-wrap items-center gap-4">
                                  <span className="text-sm font-bold text-gray-700">تحديث الحالة إلى:</span>
                                  <div className="flex flex-wrap gap-2">
                                    {currentIndex < statuses.length - 2 && (
                                      <button 
                                        onClick={() => {
                                          const nextStatus = statuses[currentIndex + 1].id;
                                          if (nextStatus === 'shipping') {
                                            const track = prompt('أدخل رقم التتبع (اختياري):');
                                            updateOrderStatus(order.id, nextStatus, true, track || '');
                                          } else {
                                            updateOrderStatus(order.id, nextStatus, true);
                                          }
                                        }}
                                        className="bg-white border border-gray-200 text-gray-700 hover:bg-green-600 hover:text-white hover:border-green-600 px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm"
                                      >
                                        {statuses[currentIndex + 1].label}
                                      </button>
                                    )}
                                  </div>
                                  {order.trackingNumber && (
                                    <div className="mr-auto flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-xl border border-blue-100">
                                      <Truck className="w-4 h-4" />
                                      <span className="text-xs font-bold">رقم التتبع: {order.trackingNumber}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
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
                <button 
                  onClick={() => setCustomerTab('orders')}
                  className={`flex-1 min-w-[120px] px-4 py-3 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 ${customerTab === 'orders' ? 'bg-green-50 text-green-700 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  <Truck className="w-4 h-4" /> طلباتي ومشترياتي
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

                {/* قسم القطع الرائجة (Trending Parts) */}
                {trendingParts.length > 0 && searchResults.length === 0 && (
                  <div className="mt-12 animate-in fade-in slide-in-from-bottom-6 duration-1000">
                    <div className="flex items-center justify-between mb-8">
                      <h3 className="text-2xl font-black text-gray-800 flex items-center gap-3">
                        <TrendingUp className="w-7 h-7 text-red-500" />
                        القطع الأكثر طلباً حالياً في السوق 🔥
                      </h3>
                      <div className="bg-red-50 text-red-600 px-4 py-1.5 rounded-full text-xs font-black shadow-sm ring-1 ring-red-100">HOT DEALS</div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5">
                      {trendingParts.map(part => (
                        <div 
                          key={part.id} 
                          className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group" 
                          onClick={() => { setSearchResults([part]); setCustomerTab('textSearch'); }}
                        >
                          <div className="relative overflow-hidden rounded-2xl mb-3">
                            <img src={part.imageUrl} className="w-full h-28 object-cover group-hover:scale-110 transition-transform duration-500" />
                            <div className="absolute bottom-0 right-0 bg-blue-600 text-white text-[10px] font-black px-2 py-1 rounded-tl-lg">
                              {part.price} ريال
                            </div>
                          </div>
                          <h4 className="text-xs font-black text-gray-800 line-clamp-1 mb-1">{part.name}</h4>
                          <p className="text-[10px] text-gray-400 font-bold">{part.carMake} {part.model}</p>
                          <div className="mt-2 flex items-center gap-1 text-[9px] text-blue-500 font-bold">
                             <BarChart2 className="w-3 h-3" /> {part.whatsappClicks || 0} طلب
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {customerTab === 'textSearch' && (
              <div className="bg-white p-8 rounded-[36px] shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-4">
                <h2 className="text-2xl font-black mb-8 flex items-center gap-3 text-gray-800">
                  <div className="bg-blue-100 p-3 rounded-2xl">
                    <Filter className="w-6 h-6 text-blue-600" />
                  </div>
                  فلترة البحث المتقدمة
                  <span className="text-xs font-bold text-gray-400 mr-auto">حدد معايير البحث بدقة للحصول على أفضل النتائج</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                  <div className="md:col-span-12 lg:col-span-4">
                    <label className="block text-xs font-black text-gray-400 mb-2 uppercase tracking-wide">كلمة البحث</label>
                    <input 
                      type="text" 
                      placeholder="اسم القطعة (مثال: شمعة)" 
                      value={textSearchQuery}
                      onChange={(e) => setTextSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && searchPartByText()}
                      className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none text-lg font-bold transition-all"
                    />
                  </div>
                  <div className="md:col-span-4 lg:col-span-2">
                    <label className="block text-xs font-black text-gray-400 mb-2 uppercase tracking-wide">الشركة</label>
                    <input 
                      type="text" 
                      placeholder="مثال: تويوتا" 
                      value={searchFilterMake}
                      onChange={(e) => setSearchFilterMake(e.target.value)}
                      className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none text-lg font-bold transition-all"
                    />
                  </div>
                  <div className="md:col-span-4 lg:col-span-2">
                    <label className="block text-xs font-black text-gray-400 mb-2 uppercase tracking-wide">الموديل</label>
                    <input 
                      type="text" 
                      placeholder="مثال: كامري" 
                      value={searchFilterModel}
                      onChange={(e) => setSearchFilterModel(e.target.value)}
                      className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none text-lg font-bold transition-all"
                    />
                  </div>
                  <div className="md:col-span-4 lg:col-span-3">
                    <label className="block text-xs font-black text-gray-400 mb-2 uppercase tracking-wide">المدينة</label>
                    <select 
                      value={searchFilterCity}
                      onChange={(e) => setSearchFilterCity(e.target.value)}
                      className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none text-lg font-black text-gray-700 transition-all"
                    >
                      <option value="">كل المدن</option>
                      {SAUDI_CITIES.map(city => (
                        <option key={city} value={city}>{city}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-12 lg:col-span-1 flex items-end">
                    <button 
                      onClick={searchPartByText}
                      disabled={isSearchingText}
                      className="w-full h-[62px] bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-2xl transition shadow-xl shadow-blue-100 flex items-center justify-center hover:scale-[1.05]"
                    >
                      {isSearchingText ? <Loader2 className="w-8 h-8 animate-spin" /> : <Search className="w-8 h-8" />}
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
                    <button onClick={() => setShowAuthModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl transition shadow-md">تسجيل الدخول</button>
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
                    <button onClick={() => setShowAuthModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-3 rounded-xl transition shadow-md">تسجيل الدخول</button>
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

             {customerTab === 'orders' && (
              <div className="animate-in fade-in slide-in-from-bottom-4">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center text-green-600">
                    <Truck className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800">تتبع مشترياتي</h2>
                    <p className="text-gray-500 text-sm">تتبع حالة قطع الغيار التي قمت بشرائها عبر الضمان الآمن</p>
                  </div>
                </div>

                {!user ? (
                  <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 shadow-sm">
                    <LogIn className="w-20 h-20 text-gray-200 mx-auto mb-5" />
                    <p className="text-gray-500 text-xl font-medium mb-4">يرجى تسجيل الدخول لعرض المشتريات.</p>
                    <button onClick={() => setShowAuthModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl transition shadow-md">تسجيل الدخول</button>
                  </div>
                ) : customerOrders.length === 0 ? (
                  <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 shadow-sm">
                    <ShoppingCart className="w-16 h-16 text-gray-200 mx-auto mb-5" />
                    <p className="text-gray-500 text-xl font-medium">ليس لديك أي مشتريات حالياً.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {customerOrders.map(order => {
                      const statuses = [
                        { id: 'escrow', label: 'مدفوع', icon: CreditCard },
                        { id: 'packaged', label: 'تم التجهيز', icon: Package },
                        { id: 'shipping', label: 'مشحون', icon: Truck },
                        { id: 'out_for_delivery', label: 'مع المندوب', icon: MapPin },
                        { id: 'delivered', label: 'وصل الاستلام', icon: CheckCircle2 },
                        { id: 'completed', label: 'مكتمل', icon: ShieldCheck },
                      ];
                      const currentIndex = statuses.findIndex(s => s.id === order.status);

                      return (
                        <div key={order.id} className="bg-white border border-gray-100 rounded-[32px] p-8 shadow-sm hover:border-green-200 transition-all">
                          <div className="flex flex-col lg:flex-row gap-8">
                            {/* صورة القطعة */}
                            {order.imageUrl && (
                              <div className="w-full lg:w-48 h-48 rounded-2xl overflow-hidden shadow-inner flex-shrink-0">
                                <img src={order.imageUrl} alt="" className="w-full h-full object-cover" />
                              </div>
                            )}

                            {/* معلومات الطلب */}
                            <div className="flex-1">
                              <div className="flex justify-between items-start mb-6">
                                <div>
                                  <h4 className="font-black text-2xl text-gray-800">{order.partName}</h4>
                                  <p className="text-gray-500 flex items-center gap-1 mt-1 font-bold">
                                    <Store className="w-4 h-4" /> التاجر: {order.merchantName}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <div className="text-3xl font-black text-green-600">{order.price} ريال</div>
                                  <span className="text-xs font-bold text-gray-400">#{order.id.slice(-6)}</span>
                                </div>
                              </div>

                              {/* تتبع الحالة (الشريط) */}
                              <div className="relative flex justify-between items-center mb-8 px-2 max-w-2xl mx-auto lg:mx-0">
                                <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-100 -translate-y-1/2 z-0"></div>
                                <div 
                                  className="absolute top-1/2 left-0 h-1 bg-green-500 -translate-y-1/2 z-0 transition-all duration-500"
                                  style={{ width: `${(currentIndex / (statuses.length - 1)) * 100}%` }}
                                ></div>
                                {statuses.map((step, idx) => {
                                  const Icon = step.icon;
                                  const isActive = idx <= currentIndex;
                                  const isCurrent = idx === currentIndex;
                                  return (
                                    <div key={step.id} className="relative z-10 flex flex-col items-center gap-2">
                                      <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                                        isCurrent ? 'bg-green-600 text-white scale-125 shadow-lg' : 
                                        isActive ? 'bg-green-100 text-green-600' : 
                                        'bg-white border-2 border-gray-100 text-gray-300'
                                      }`}>
                                        <Icon className="w-5 h-5" />
                                      </div>
                                      <span className={`text-[10px] font-bold ${isActive ? 'text-gray-800' : 'text-gray-400'}`}>{step.label}</span>
                                    </div>
                                  );
                                })}
                              </div>

                              <div className="flex flex-wrap items-center gap-4">
                                {order.status === 'shipping' || order.status === 'out_for_delivery' || order.status === 'delivered' ? (
                                  <button 
                                    onClick={() => updateOrderStatus(order.id, 'completed', false)}
                                    className="bg-green-600 hover:bg-green-700 text-white font-black py-4 px-8 rounded-2xl text-lg shadow-xl shadow-green-100 transition-all flex items-center justify-center gap-3 animate-bounce-slow"
                                  >
                                    <ShieldCheck className="w-6 h-6" /> تأكيد استلام القطعة وفك الضمان
                                  </button>
                                ) : order.status === 'completed' ? (
                                  <div className="bg-green-50 text-green-700 px-6 py-3 rounded-2xl border border-green-100 flex items-center gap-2">
                                    <CheckCircle2 className="w-6 h-6" />
                                    <span className="font-bold">تم الاستلام وإغلاق الطلب بنجاح</span>
                                  </div>
                                ) : (
                                  <div className="bg-blue-50 text-blue-700 px-6 py-3 rounded-2xl border border-blue-100 flex items-center gap-2">
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span className="font-bold text-sm">بانتظار تجهيز التاجر للقطعة...</span>
                                  </div>
                                )}
                                
                                {order.trackingNumber && (
                                  <div className="flex items-center gap-2 bg-gray-50 text-gray-600 px-6 py-3 rounded-2xl border border-gray-100">
                                    <Truck className="w-5 h-5" />
                                    <span className="text-sm font-black">رقم التتبع: {order.trackingNumber}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* عرض نتائج البحث أو المفضلة */}
            {(searchResults.length > 0 || (customerTab === 'favorites' && favorites.length > 0)) && (
              <div className="mt-8 animate-in fade-in slide-in-from-bottom-4">
                <div className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4">
                  <h3 className="text-2xl font-black text-gray-800">
                    {customerTab === 'favorites' ? 'القطع المفضلة' : `نتائج البحث (${searchResults.length}):`}
                  </h3>
                  {customerTab !== 'favorites' && user && (
                    <button 
                      onClick={() => setCustomerTab('aiMechanic')}
                      className="flex items-center gap-3 bg-purple-50 text-purple-700 font-black px-6 py-3 rounded-[20px] border-2 border-purple-100 hover:bg-purple-100 transition shadow-lg shadow-purple-50"
                    >
                      <Stethoscope className="w-5 h-5" /> لم تجد ما تبحث عنه؟ مشخص الأعطال الذكي يساعدك 🤖
                    </button>
                  )}
                </div>
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

        {/* Modal: Checkout */}
        {checkoutPart && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-green-500" />
                الدفع الآمن (ضمان التطبيق)
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                سيتم الدفع وتُحفظ الأموال لدى التطبيق، ولا تُحوّل للتاجر حتى تستلم القطعة وتؤكد مطابقتها.
              </p>
              <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-100 flex items-start gap-4">
                <img src={checkoutPart.imageUrl} alt="" className="w-16 h-16 rounded-lg object-cover bg-gray-200" />
                <div>
                  <h4 className="font-bold">{checkoutPart.name}</h4>
                  <p className="text-sm text-gray-500">{checkoutPart.carMake} - {checkoutPart.model}</p>
                  <p className="text-green-600 font-bold mt-1">{checkoutPart.price} ريال</p>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <button onClick={handleCheckout} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition shadow-sm flex items-center justify-center gap-2">
                  <CreditCard className="w-5 h-5" /> ادفع الآن ببطاقة مدى / ائتمان
                </button>
                <button onClick={() => setCheckoutPart(null)} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3.5 rounded-xl transition">
                  إلغاء الأمر
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Rating Review */}
        {ratingModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Star className="w-6 h-6 text-yellow-400 fill-yellow-400" /> تقييم التاجر
              </h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">التقييم (من 1 إلى 5)</label>
                <div className="flex gap-2">
                  {[1,2,3,4,5].map(star => (
                    <button 
                      key={star}
                      onClick={() => setNewReview({...newReview, rating: star})}
                      className={`p-2 rounded-lg transition ${newReview.rating >= star ? 'text-yellow-400' : 'text-gray-300'}`}
                    >
                      <Star className={`w-8 h-8 ${newReview.rating >= star ? 'fill-yellow-400' : ''}`} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">تعليقك (اختياري)</label>
                <textarea 
                  value={newReview.comment}
                  onChange={(e) => setNewReview({...newReview, comment: e.target.value})}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none min-h-[100px] resize-none"
                  placeholder="كيف كانت تجربتك مع هذا التاجر؟"
                ></textarea>
              </div>
              <div className="flex gap-3">
                <button onClick={submitReview} className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3.5 rounded-xl transition shadow-sm">
                  اعتماد التقييم
                </button>
                <button onClick={() => setRatingModal(null)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3.5 rounded-xl transition">
                  إلغاء الأمر
                </button>
              </div>
            </div>
          </div>
        )}
        {/* مودال مقارنة القطع */}
        {showComparison && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col scale-in-center overflow-y-auto">
              <div className="p-8 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
                <div className="flex items-center gap-3 text-blue-600">
                  <BarChart2 className="w-8 h-8" />
                  <h2 className="text-3xl font-black">مقارنة القطع المحددة</h2>
                </div>
                <button 
                  onClick={() => setShowComparison(false)}
                  className="p-3 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-800"
                >
                  <Package className="w-6 h-6 rotate-45" />
                </button>
              </div>

              <div className="p-8">
                <div className="grid grid-cols-[150px_1fr_1fr_1fr] gap-4">
                  {/* العناوين الجانبية */}
                  <div className="space-y-8 pt-48 font-bold text-gray-400 text-sm uppercase tracking-wider">
                    <div className="h-20 flex items-center">صورة القطعة</div>
                    <div className="h-12 flex items-center border-t border-gray-50">اسم القطعة</div>
                    <div className="h-12 flex items-center border-t border-gray-50">السعر</div>
                    <div className="h-12 flex items-center border-t border-gray-50">نوع السيارة</div>
                    <div className="h-12 flex items-center border-t border-gray-50">الحالة</div>
                    <div className="h-12 flex items-center border-t border-gray-50">المدينة</div>
                    <div className="h-12 flex items-center border-t border-gray-50">التاجر</div>
                  </div>

                  {/* القطع للمقارنة */}
                  {comparisonList.map((part, idx) => (
                    <div key={part.id} className="space-y-8 text-center animate-in slide-in-from-bottom-4" style={{ animationDelay: `${idx * 100}ms` }}>
                      <div className="h-48 relative group">
                        <img src={part.imageUrl} alt="" className="w-full h-full object-cover rounded-3xl shadow-lg" />
                        <button 
                          onClick={() => toggleComparison(part)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white p-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="h-12 flex items-center justify-center font-black text-gray-800 border-t border-gray-100">{part.name}</div>
                      <div className="h-12 flex items-center justify-center font-black text-2xl text-green-600 border-t border-gray-100">
                        {part.price} <span className="text-xs font-normal mr-1">ريال</span>
                      </div>
                      <div className="h-12 flex items-center justify-center text-gray-600 border-t border-gray-100">{part.carMake} {part.model}</div>
                      <div className="h-12 flex items-center justify-center border-t border-gray-100">
                        <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">{part.condition}</span>
                      </div>
                      <div className="h-12 flex items-center justify-center text-gray-600 border-t border-gray-100 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {part.merchantCity}
                      </div>
                      <div className="h-12 flex items-center justify-center border-t border-gray-100">
                        <button onClick={() => { setShowComparison(false); openMerchantStore(part.merchantId); }} className="text-blue-600 font-bold hover:underline">
                          {part.merchantName}
                        </button>
                      </div>
                      <button 
                        onClick={() => { setShowComparison(false); handleCheckoutClick(part); }}
                        className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                      >
                        <ShoppingCart className="w-5 h-5" /> شراء الآن
                      </button>
                    </div>
                  ))}

                  {/* أماكن فارغة */}
                  {Array.from({ length: 3 - comparisonList.length }).map((_, i) => (
                    <div key={i} className="border-2 border-dashed border-gray-100 rounded-[40px] flex flex-col items-center justify-center text-gray-300 gap-4 p-8">
                      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
                        <Package className="w-8 h-8" />
                      </div>
                      <p className="font-bold text-sm">أضف قطعة للمقارنة</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Custom Auth */}
        {showAuthModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 relative">
              <button onClick={() => setShowAuthModal(false)} className="absolute top-4 left-4 text-gray-400 hover:text-gray-800 transition">✕</button>
              
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <User className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black text-gray-800">
                  {authMode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}
                </h3>
                <p className="text-sm text-gray-500 mt-2">مرحباً بك في سوق التشليح الذكي</p>
              </div>

              <form onSubmit={handleCustomAuth} className="space-y-4">
                {authMode === 'register' && (
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">الاسم</label>
                    <input 
                      type="text" 
                      value={authName} 
                      onChange={(e) => setAuthName(e.target.value)} 
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" 
                      placeholder="اسمك الكريم" 
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">رقم الجوال أو اسم المستخدم</label>
                  <input 
                    type="text" 
                    value={authPhoneForm} 
                    onChange={(e) => setAuthPhoneForm(e.target.value)} 
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-left" 
                    dir="ltr"
                    placeholder="05XXXXXXXX" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">كلمة المرور</label>
                  <input 
                    type="password" 
                    value={authPass} 
                    onChange={(e) => setAuthPass(e.target.value)} 
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-left" 
                    dir="ltr"
                    placeholder="••••••••" 
                  />
                </div>

                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition shadow-md mt-6 flex justify-center items-center gap-2">
                  {isCheckingRole && <Loader2 className="w-5 h-5 animate-spin" />}
                  {authMode === 'login' ? 'دخول' : 'إنشاء حساب'}
                </button>
              </form>

              <div className="mt-8 pt-6 border-t border-gray-100 space-y-4">
                <button 
                  onClick={() => {
                    setAuthMode(authMode === 'login' ? 'register' : 'login');
                    setResult('');
                  }} 
                  className="w-full text-blue-600 font-bold hover:underline transition text-sm"
                >
                  {authMode === 'login' ? 'ليس لديك حساب؟ أنشئ حساباً جديداً' : 'لديك حساب أصلًا؟ سجل دخولك'}
                </button>
                <button 
                  onClick={() => {
                    signInWithPopup(auth, new GoogleAuthProvider());
                    setShowAuthModal(false);
                  }} 
                  className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 hover:bg-gray-50 text-gray-700 font-bold py-3.5 rounded-xl transition shadow-sm"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                  الدخول باستخدام جوجل
                </button>
              </div>
            </div>
          </div>
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
