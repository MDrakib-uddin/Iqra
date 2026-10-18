# রামু ইকরা মডেল একাডেমি মেধাবৃত্তি ২০২৬ — Next.js Project

এই প্রজেক্টে আছে:
- ধাপ ১: শিক্ষার্থীর তথ্য ও ছবি
- ধাপ ২: বিকাশ/নগদ পদ্ধতি, Transaction ID এবং পেমেন্টে ব্যবহৃত মোবাইল নম্বর সরাসরি লেখা (কোনো PIN/OTP/স্ক্রিনশট নয়)
- ধাপ ৩: তথ্য যাচাই করে final submit
- ধাপ ৪: Application ID ও PDF deposit receipt download
- পিতা ও মাতার মোবাইল নম্বর ঐচ্ছিক; শিক্ষক প্রতিনিধির এবং পেমেন্ট করা নম্বর আবশ্যক
- নতুন আবেদন আইডির format: `IQRA2026-XXXXXXXX`
- Google Sheets-এ আবেদন সংরক্ষণ এবং Google Drive-এ শিক্ষার্থীর ছবি রাখা
- Vercel deployment-এর উপযোগী Next.js API route

## 1. VS Code-এ চালানো

Node.js 20 বা তার নতুন LTS সংস্করণ ইনস্টল করুন। ZIP extract করে VS Code-এ project folder খুলুন। Terminal-এ:

```bash
npm install
```

`.env.example` ফাইল কপি করে `.env.local` নামে রাখুন। Google Apps Script deploy করার পরে নিচের দুইটি value পূরণ করুন:

```env
GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/DEPLOYMENT_ID/exec
SCHOLARSHIP_API_SECRET=একটি_দীর্ঘ_এলোমেলো_গোপন_স্ট্রিং
NEXT_PUBLIC_APPLICATION_FEE=300
NEXT_PUBLIC_EXAM_DATE=পরীক্ষার তারিখ পরে জানানো হবে
NEXT_PUBLIC_EXAM_TIME=সময় পরে জানানো হবে
NEXT_PUBLIC_EXAM_CENTER=পরীক্ষাকেন্দ্র পরে জানানো হবে
```

তারপর:

```bash
npm run dev
```

Browser-এ http://localhost:3000 খুলুন।

## 2. Google Sheets সংযোগ

1. https://sheets.google.com খুলে নতুন spreadsheet তৈরি করুন।
2. Spreadsheet-এ Extensions → Apps Script নির্বাচন করুন।
3. `google-apps-script/Code.gs` ফাইলের কোড Apps Script editor-এ বসান।
4. Project Settings → Script Properties-এ `API_SECRET` নামে property যোগ করুন। Value হবে `.env.local`-এর `SCHOLARSHIP_API_SECRET`-এর ঠিক একই secret। এটি কখনো frontend code-এ লিখবেন না।
5. `setup()` function একবার Run করুন এবং Google permission অনুমোদন করুন। এতে `Applications` sheet header, Transaction ID ও Payer Mobile column এবং `Ramu Iqra Model Academy Scholarship Photos 2026` নামের Drive folder তৈরি হবে।
6. Deploy → New deployment → Web app নির্বাচন করুন। Execute as: **Me**। Who has access: **Anyone** (প্রয়োজন হলে আপনার Google Workspace-এর নীতি অনুযায়ী সেটিং বদলাতে হবে)।
7. Deploy করুন এবং `/exec` URL কপি করে `.env.local`-এর `GOOGLE_APPS_SCRIPT_URL`-এ বসান।
8. `npm run dev` দিয়ে একটি test application submit করে Sheet এবং Drive পরীক্ষা করুন।

আগে Apps Script deploy করা থাকলে, পরিবর্তিত `Code.gs` কার্যকর করতে Deploy → Manage deployments → Edit → New version নির্বাচন করে redeploy করুন। নতুন ছবি নির্ধারিত Academy folder-এ যাবে; পুরোনো folder-এর ছবি সরানো হবে না।

**গুরুত্বপূর্ণ:** Apps Script Web App public endpoint হিসেবে প্রকাশিত হলেও, script secret না মিললে request প্রত্যাখ্যান করবে। Secret শক্তিশালী রাখুন, কাউকে শেয়ার করবেন না। প্রতিষ্ঠানের Google Workspace policy যদি anonymous access নিষিদ্ধ করে, এই deployment পদ্ধতি কাজ নাও করতে পারে।

## 3. Vercel-এ deploy

1. Project GitHub repository-তে push করুন।
2. https://vercel.com-এ repository import করুন।
3. Project Settings → Environment Variables-এ `.env.local`-এর সব প্রয়োজনীয় variable যোগ করুন।
4. Deploy করুন। Environment variable পরিবর্তন করলে redeploy করুন।

`GOOGLE_APPS_SCRIPT_URL` এবং `SCHOLARSHIP_API_SECRET` server-side secrets; এগুলো `NEXT_PUBLIC_` prefix দিয়ে রাখবেন না।

## 4. নিজের পরীক্ষার নিয়ম অনুযায়ী বদলাতে হবে

- আবেদনটি বর্তমানে শুধু তৃতীয় শ্রেণি ও রামু উপজেলার জন্য নির্ধারিত: `src/app/page.tsx`, `src/app/api/applications/route.ts` এবং Apps Script validation।
- ফি: `NEXT_PUBLIC_APPLICATION_FEE`
- পরীক্ষার তারিখ, সময় ও কেন্দ্র: `.env.local`-এর `NEXT_PUBLIC_EXAM_DATE`, `NEXT_PUBLIC_EXAM_TIME`, `NEXT_PUBLIC_EXAM_CENTER`
- ঠিকানা ও যোগাযোগ নম্বর: `src/app/page.tsx`

## 5. গুরুত্বপূর্ণ সীমাবদ্ধতা

- Transaction ID জমা দিলেও পেমেন্ট স্বয়ংক্রিয়ভাবে যাচাই হয় না। Sheet-এ status `PENDING VERIFICATION - TRANSACTION ID SUBMITTED` থাকবে।
- final submission-এর পর PDF deposit receipt ডাউনলোড করা যায়। এটি পেমেন্ট নিশ্চিত করে না এবং admit card নয়।
- PDF deposit receipt browser canvas থেকে তৈরি হয়, তাই বাংলা লেখা ও শিক্ষার্থীর ছবি দেখা যায়। এতে পরীক্ষার তারিখ, সময় ও কেন্দ্রও থাকে; এগুলো `.env.local`-এর `NEXT_PUBLIC_EXAM_DATE`, `NEXT_PUBLIC_EXAM_TIME` ও `NEXT_PUBLIC_EXAM_CENTER` থেকে নেওয়া হয়।
- Deposit receipt browser-side-এ তৈরি হয়। এই version-এ আবেদন আইডি দিয়ে পরে লগইন/রসিদ পুনরায় ডাউনলোডের ব্যবস্থা নেই।
- production-এ ব্যবহারের আগে spam protection, rate limiting, admin verification, privacy notice, backup, duplicate application checks এবং end-to-end tests যোগ করুন।
- Google Drive-এ ছবি private রাখুন; public sharing চালু করবেন না। Apps Script owner এবং অনুমোদিত admin-দের access-ই যথেষ্ট।
