import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const mobilePattern = /^(\+?88)?01[3-9]\d{8}$/;

export async function POST(request: NextRequest) {
  try {
    const endpoint = process.env.GOOGLE_APPS_SCRIPT_URL;
    const secret = process.env.SCHOLARSHIP_API_SECRET;

    if (!endpoint || !secret) {
      return NextResponse.json(
        { success: false, message: "সার্ভার কনফিগার করা হয়নি। .env.local ফাইল যাচাই করুন।" },
        { status: 500 }
      );
    }

    const data = await request.json();
    const required = [
      "studentBn", "studentEn", "fatherBn", "fatherEn",
      "motherBn", "motherEn", "studentClass", "roll",
      "upazila", "institution", "teacher", "teacherMobile",
      "paymentMethod", "transactionId", "payerMobile", "photoBase64", "photoType"
    ];

    for (const key of required) {
      if (typeof data[key] !== "string" || !data[key].trim()) {
        return NextResponse.json({ success: false, message: `আবশ্যক তথ্য অনুপস্থিত: ${key}` }, { status: 400 });
      }
    }

    for (const key of ["fatherMobile", "motherMobile", "teacherMobile", "payerMobile"]) {
      if (data[key] !== undefined && data[key] !== "" &&
          (typeof data[key] !== "string" || !mobilePattern.test(data[key].trim()))) {
        return NextResponse.json({ success: false, message: "মোবাইল নম্বর সঠিক নয়।" }, { status: 400 });
      }
    }
    if (!data.payerMobile || typeof data.payerMobile !== "string") {
      return NextResponse.json({ success: false, message: "পেমেন্টে ব্যবহৃত মোবাইল নম্বর আবশ্যক।" }, { status: 400 });
    }

    if (data.studentClass !== "3") {
      return NextResponse.json({ success: false, message: "শ্রেণি সঠিক নয়।" }, { status: 400 });
    }
    if (data.upazila !== "রামু") {
      return NextResponse.json({ success: false, message: "উপজেলা সঠিক নয়।" }, { status: 400 });
    }
    if (!/^[1-9]\d*$/.test(data.roll)) {
      return NextResponse.json({ success: false, message: "ক্লাস রোল সঠিক নয়।" }, { status: 400 });
    }
    if (!["bkash", "nagad"].includes(data.paymentMethod)) {
      return NextResponse.json({ success: false, message: "পেমেন্ট পদ্ধতি সঠিক নয়।" }, { status: 400 });
    }
    if (!/^[A-Za-z0-9-]{6,30}$/.test(data.transactionId.trim())) {
      return NextResponse.json({ success: false, message: "Transaction ID সঠিক নয়।" }, { status: 400 });
    }
    if (!["image/jpeg", "image/png"].includes(data.photoType)) {
      return NextResponse.json({ success: false, message: "শুধু JPG বা PNG ছবি গ্রহণযোগ্য।" }, { status: 400 });
    }

    const base64 = data.photoBase64 as string;
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length > 2_900_000) {
      return NextResponse.json({ success: false, message: "ছবির তথ্য সঠিক নয় বা অনেক বড়।" }, { status: 400 });
    }

    const payload = {
      ...data,
      apiSecret: secret,
      photoName: "student-photo",
      fee: String(process.env.NEXT_PUBLIC_APPLICATION_FEE || "300")
    };

    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      redirect: "follow",
      cache: "no-store"
    });

    const text = await upstream.text();
    let result: { success?: boolean; message?: string; applicationId?: string; submittedAt?: string };
    try { result = JSON.parse(text); }
    catch {
      console.error("Apps Script returned non-JSON response:", text.slice(0, 300));
      return NextResponse.json({ success: false, message: "Google Sheets সার্ভার থেকে সঠিক উত্তর পাওয়া যায়নি। Apps Script deployment যাচাই করুন।" }, { status: 502 });
    }

    if (!upstream.ok || !result.success) {
      return NextResponse.json({ success: false, message: result.message || "আবেদন সংরক্ষণ করা যায়নি।" }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      applicationId: result.applicationId,
      submittedAt: result.submittedAt || new Date().toISOString()
    });
  } catch (error) {
    console.error("Application submission failed:", error);
    return NextResponse.json({ success: false, message: "সার্ভারে সমস্যা হয়েছে। পরে আবার চেষ্টা করুন।" }, { status: 500 });
  }
}
