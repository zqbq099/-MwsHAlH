# Smart Scrapyard - سوق التشليح الذكي 🚗🚙

[English](#english) | [العربية](#arabic)

---

<a name="english"></a>
## 🇬🇧 English

### Overview
**Smart Scrapyard** is an innovative platform designed to bridge the gap between car spare parts buyers, merchants, and brokers in the Kingdom of Saudi Arabia (and beyond). By leveraging cutting-edge Artificial Intelligence (Google Gemini API), the application simplifies the process of identifying, pricing, and selling used or new car parts.

### Key Features
*   **Role-Based Access Control:** Dedicated interfaces for **Customers** (buyers), **Merchants** (scrapyard owners), and **Brokers** (intermediaries).
*   **AI-Powered Part Identification:** Upload an image of a car part, and the AI will automatically identify the part name, compatible car models, maker, and suggest a market price.
*   **Bulk Image Upload:** Merchants can upload up to 10 images at once to quickly add multiple parts to their inventory.
*   **Manual & Automated Listings:** Flexibility to add parts manually or via AI analysis.
*   **Direct WhatsApp Communication:** Customers can contact merchants or brokers directly via WhatsApp with a pre-filled inquiry message.
*   **Dual Contact System for Brokers:** Brokers can list parts and provide both their contact number and the original owner's contact number for faster communication.
*   **Comparison Tool:** Users can compare multiple parts side-by-side (price, condition, location, etc.).
*   **Shopping Cart & Checkout:** Seamless experience for users to purchase and request secure delivery.
*   **Firebase Integration:** Real-time database (Firestore) and secure Authentication.

### Tech Stack
*   **Frontend:** React (Vite), TypeScript, Tailwind CSS, Lucide Icons.
*   **Backend / BaaS:** Firebase (Authentication, Firestore Database).
*   **AI Integration:** Google Gemini 3 Flash API.

### Installation & Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/smart-scrapyard.git
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables (Firebase config & Gemini API Key).
4. Run the development server:
   ```bash
   npm run dev
   ```

---

<a name="arabic"></a>
## 🇸🇦 العربية

### نظرة عامة
**سوق التشليح الذكي** هو منصة مبتكرة مصممة لربط الباحثين عن قطع غيار السيارات بمتاجر التشليح والوسطاء بكل سهولة وموثوقية. من خلال الاستفادة من أحدث تقنيات الذكاء الاصطناعي (Google Gemini)، يبسط التطبيق عملية التعرف على قطع الغيار المستعملة أو الجديدة وتسعيرها وعرضها للبيع.

### المميزات الرئيسية
*   **نظام صلاحيات متعدد:** واجهات مخصصة لكل من **الزبائن** (المشترين)، **التجار** (أصحاب التشاليح)، و **الوسطاء** (الدلالين).
*   **التعرف على القطع بالذكاء الاصطناعي:** بمجرد رفع صورة لقطعة الغيار، يقوم الذكاء الاصطناعي بتحليلها واستخراج اسم القطعة، موديلات السيارات المتوافقة، الشركة المصنعة، واقتراح سعر عادل بناءً على حالة السوق.
*   **الرفع الجماعي للصور:** يمكن للتجار رفع حتى 10 صور دفعة واحدة لإضافة مجموعة من القطع للمخزون بسرعة.
*   **إضافة يدوية أو آلية:** مرونة في إضافة إعلانات القطع إما يدوياً بالكامل أو بالاستعانة بالذكاء الاصطناعي.
*   **تواصل مباشر عبر الواتساب:** يمكن للزبائن التواصل مع التجار أو الوسطاء مباشرة عبر الواتساب مع رسالة استفسار جاهزة تحتوي على تفاصيل القطعة.
*   **نظام الاتصال المزدوج للوسطاء:** يمكن للوسيط عرض القطع وتوفير رقم التواصل الخاص به بالإضافة إلى رقم المالك الأصلي لتسهيل وتسريع عملية البيع.
*   **أداة المقارنة:** أداة تتيح للمستخدمين مقارنة عدة قطع جنباً إلى جنب (السعر، الحالة، المدينة، وغيرها).
*   **سلة المشتريات والدفع:** تجربة سلسة تتيح للمستخدمين الشراء وطلب التوصيل الآمن.
*   **قواعد بيانات لحظية:** تكامل كامل مع Firebase لإدارة المصادقة وقواعد البيانات (Firestore) بشكل آمن ولحظي.

### التقنيات المستخدمة
*   **واجهة المستخدم (Frontend):** React (Vite), TypeScript, Tailwind CSS.
*   **الخلفية وقواعد البيانات (Backend):** Firebase (Auth, Firestore).
*   **الذكاء الاصطناعي (AI):** Google Gemini 3 Flash API.

### التثبيت والتشغيل
1. استنساخ المستودع (Clone):
   ```bash
   git clone https://github.com/yourusername/smart-scrapyard.git
   ```
2. تثبيت الحزم المطلوبة:
   ```bash
   npm install
   ```
3. إعداد متغيرات البيئة (إعدادات Firebase ومفتاح API الخاص بـ Gemini).
4. تشغيل خادم التطوير:
   ```bash
   npm run dev
   ```
