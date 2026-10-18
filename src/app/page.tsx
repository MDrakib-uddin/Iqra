"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import Image from "next/image";
import { jsPDF } from "jspdf";
import logoImage from "../../Asset/logo.jpeg";

type Application = {
  studentBn: string; studentEn: string; fatherBn: string; fatherEn: string;
  fatherMobile: string; motherBn: string; motherEn: string; motherMobile: string;
  studentClass: string; roll: string; upazila: string; institution: string;
  teacher: string; teacherMobile: string; paymentMethod: "bkash" | "nagad";
  transactionId: string; payerMobile: string;
  photoDataUrl: string; photoType: string;
};
type SavedApplication = Application & { applicationId: string; submittedAt?: string };

const emptyForm: Application = {
  studentBn: "", studentEn: "", fatherBn: "", fatherEn: "", fatherMobile: "",
  motherBn: "", motherEn: "", motherMobile: "", studentClass: "3", roll: "",
  upazila: "রামু", institution: "", teacher: "", teacherMobile: "",
  paymentMethod: "bkash", transactionId: "", payerMobile: "fatherMobile",
  photoDataUrl: "", photoType: ""
};

const labels: Record<string, string> = {
  studentBn: "পরীক্ষার্থীর নাম (বাংলায়)", studentEn: "পরীক্ষার্থীর নাম (English)",
  fatherBn: "পিতার নাম (বাংলায়)", fatherEn: "পিতার নাম (English)",
  fatherMobile: "পিতার মোবাইল নম্বর", motherBn: "মাতার নাম (বাংলায়)",
  motherEn: "মাতার নাম (English)", motherMobile: "মাতার মোবাইল নম্বর",
  studentClass: "শ্রেণি", roll: "ক্লাস রোল", upazila: "উপজেলা",
  institution: "শিক্ষাপ্রতিষ্ঠান", teacher: "শিক্ষক প্রতিনিধির নাম",
  teacherMobile: "শিক্ষক প্রতিনিধির মোবাইল", paymentMethod: "পেমেন্ট পদ্ধতি",
  transactionId: "লেনদেন আইডি (Transaction ID)",
  payerMobile: "যে নম্বর থেকে পেমেন্ট করেছেন"
};

function Field({ label, name, value, onChange, required = true, type = "text", placeholder, pattern }: {
  label: string; name: keyof Application; value: string; onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  required?: boolean; type?: string; placeholder?: string; pattern?: string;
}) {
  return <div className="field"><label htmlFor={name}>{label}{required ? " *" : ""}</label>
    <input id={name} name={name} type={type} value={value} onChange={onChange}
      required={required} maxLength={name === "institution" ? 200 : 100}
      placeholder={placeholder} pattern={pattern} />
  </div>;
}

export default function Home() {
  const [form, setForm] = useState<Application>(emptyForm);
  const [step, setStep] = useState(1);
  const [photoName, setPhotoName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<SavedApplication | null>(null);

  const fee = process.env.NEXT_PUBLIC_APPLICATION_FEE || "300";
  const update = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handlePhoto = (e: ChangeEvent<HTMLInputElement>) => {
    setError("");
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setError("শুধু JPG বা PNG ছবি আপলোড করা যাবে।"); e.target.value = ""; return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("ছবির সাইজ সর্বোচ্চ ২ MB হতে পারবে।"); e.target.value = ""; return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm(prev => ({ ...prev, photoDataUrl: String(reader.result), photoType: file.type }));
      setPhotoName(file.name);
    };
    reader.onerror = () => setError("ছবি পড়তে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
    reader.readAsDataURL(file);
  };

  const classLabel = useMemo(() => {
    const classNames: Record<string, string> = { "3": "তৃতীয়" };
    return classNames[form.studentClass] || form.studentClass;
  }, [form.studentClass]);

  function validateMobile(value: string) {
    return /^(\+?88)?01[3-9]\d{8}$/.test(value.trim());
  }

  function nextToPayment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError("");
    if (!validateMobile(form.fatherMobile) || !validateMobile(form.motherMobile) || !validateMobile(form.teacherMobile)) {
      setError("বাংলাদেশের সঠিক মোবাইল নম্বর লিখুন।"); return;
    }
    if (!form.photoDataUrl) { setError("পরীক্ষার্থীর ছবি আপলোড করুন।"); return; }
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function continueToReview() {
    if (!/^[A-Za-z0-9-]{6,30}$/.test(form.transactionId.trim())) {
      setError("সঠিক Transaction ID লিখুন (৬–৩০টি ইংরেজি অক্ষর, সংখ্যা বা হাইফেন)।");
      return;
    }
    const payerNumbers: Record<string, string> = {
      fatherMobile: form.fatherMobile,
      motherMobile: form.motherMobile,
      teacherMobile: form.teacherMobile
    };
    if (!payerNumbers[form.payerMobile] || !validateMobile(payerNumbers[form.payerMobile])) {
      setError("পেমেন্টে ব্যবহৃত সঠিক মোবাইল নম্বর নির্বাচন করুন।");
      return;
    }
    setError("");
    setStep(2.5);
  }

  async function submitApplication() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/applications", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          photoBase64: form.photoDataUrl.split(",")[1],
          photoDataUrl: undefined,
          fee
        })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "আবেদন জমা দেওয়া যায়নি।");
      setSaved({ ...form, applicationId: result.applicationId, submittedAt: result.submittedAt });
      setStep(3);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "সার্ভারে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
    } finally { setBusy(false); }
  }

  async function downloadDepositReceipt() {
    if (!saved) return;
    await document.fonts.ready;
    const scale = 8;
    const canvas = document.createElement("canvas");
    canvas.width = 148 * scale;
    canvas.height = 210 * scale;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("রসিদের ছবি তৈরি করা যায়নি।");

    const mm = (value: number) => value * scale;
    const font = (size: number, weight = 400) =>
      `${weight} ${Math.round(size * scale / 2.834)}px "Noto Sans Bengali", sans-serif`;
    const drawText = (text: string, x: number, y: number, size: number, color: string, weight = 400, align: CanvasTextAlign = "left") => {
      context.font = font(size, weight);
      context.fillStyle = color;
      context.textAlign = align;
      context.fillText(text, mm(x), mm(y));
    };
    const wrapText = (text: string, maxWidth: number, size: number) => {
      context.font = font(size);
      const lines: string[] = [];
      let line = "";
      for (const word of text.split(/\s+/)) {
        const candidate = line ? `${line} ${word}` : word;
        if (line && context.measureText(candidate).width > mm(maxWidth)) {
          lines.push(line);
          line = word;
        } else {
          line = candidate;
        }
      }
      if (line) lines.push(line);
      return lines.length ? lines : ["-"];
    };

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#075b3e";
    context.fillRect(0, 0, canvas.width, mm(52));

    const logoResponse = await fetch(logoImage.src);
    if (!logoResponse.ok) throw new Error("লোগো লোড করা যায়নি।");
    const logo = new window.Image();
    logo.src = URL.createObjectURL(await logoResponse.blob());
    await logo.decode();
    context.drawImage(logo, mm(64), mm(3), mm(20), mm(20));
    URL.revokeObjectURL(logo.src);
    drawText("ইকরা মেধাবৃত্তি ২০২৬", 74, 32, 11, "#ffffff", 700, "center");
    drawText("দক্ষিণ ফতেখারকুল,রামু, কক্সবাজার", 74, 40, 7, "#e3fff2", 400, "center");
    drawText("01815-615530 · 01843-599802", 74, 48, 7, "#e3fff2", 400, "center");

    drawText("ডিপোজিট রসিদ", 74, 60, 14, "#192d23", 700, "center");
    context.strokeStyle = "#07734f";
    context.lineWidth = mm(0.5);
    context.beginPath();
    context.roundRect(mm(8), mm(65), mm(132), mm(127), mm(3));
    context.stroke();

    const rows: [string, string][] = [
      ["আবেদন আইডি", saved.applicationId],
      ["শিক্ষার্থীর নাম", saved.studentBn],
      ["শ্রেণি ও রোল", `${classLabel} / ${saved.roll}`],
      ["শিক্ষার্থীর ইংরেজি নাম", saved.studentEn],
      ["পিতার নাম", saved.fatherBn],
      ["প্রতিষ্ঠান", saved.institution],
      ["উপজেলা", saved.upazila],
      ["পেমেন্ট পদ্ধতি", saved.paymentMethod === "bkash" ? "বিকাশ" : "নগদ"],
      ["লেনদেন আইডি", saved.transactionId],
      ["পেমেন্ট করা নম্বর", saved.payerMobile === "fatherMobile" ? saved.fatherMobile : saved.payerMobile === "motherMobile" ? saved.motherMobile : saved.teacherMobile],
      ["আবেদন ফি", `${fee} টাকা`],
      ["পেমেন্ট অবস্থা", "যাচাই অপেক্ষমাণ"],
      ["পরীক্ষার তারিখ", process.env.NEXT_PUBLIC_EXAM_DATE || "পরে জানানো হবে"],
      ["পরীক্ষার সময়", process.env.NEXT_PUBLIC_EXAM_TIME || "পরে জানানো হবে"],
      ["পরীক্ষাকেন্দ্র", process.env.NEXT_PUBLIC_EXAM_CENTER || "পরে জানানো হবে"]
    ];
    let y = 73;
    rows.forEach(([label, value], index) => {
      if (y > 181) return;
      const compactWidth = index < 3 ? 52 : 78;
      const valueLines = wrapText(String(value || "-"), compactWidth, 8.5);
      drawText(label, 14, y, 8.5, "#5f6e64");
      valueLines.forEach((line, lineIndex) => {
        drawText(line, 56, y + lineIndex * 4.5, 8.5, "#192d23");
      });
      y += Math.max(7.5, valueLines.length * 4.5);
    });

    if (saved.photoDataUrl) {
      const studentPhoto = new window.Image();
      studentPhoto.src = saved.photoDataUrl;
      await studentPhoto.decode();
      context.save();
      context.strokeStyle = "#dfe8e2";
      context.lineWidth = mm(0.4);
      context.strokeRect(mm(112), mm(71), mm(22), mm(28));
      context.drawImage(studentPhoto, mm(112), mm(71), mm(22), mm(28));
      context.restore();
    }

    drawText("এই রসিদ পেমেন্ট যাচাইয়ের নিশ্চয়তা নয়।", 74, 200, 8, "#5a645f", 400, "center");
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a5" });
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 148, 210);
    const receiptReference = saved.applicationId.replace(/^CPS2026-/, "");
    pdf.save(`IQRA-${receiptReference}-deposit-receipt.pdf`);
  }

  async function handleDownloadDepositReceipt() {
    setError("");
    try {
      await downloadDepositReceipt();
    } catch (error) {
      console.error("Deposit receipt download failed:", error);
      setError(error instanceof Error ? error.message : "ডিপোজিট রসিদ তৈরি করা যায়নি।");
    }
  }

  return <main className="page">
    <header className="hero">
      <Image className="logoMark" src={logoImage} alt="ইকরা মডেল একাডেমির লোগো" priority/>
      <h1>ইকরা মেধাবৃত্তি ২০২৬</h1>
      <p className="location">দক্ষিণ ফতেখারকুল,রামু, কক্সবাজার</p>
      <p>01815-615530 · 01843-599802</p>
    </header>

    <div className="container"><section className="card">
      <div className="progress">
        <div className={`progressItem ${step === 1 ? "active" : "done"}`}><span className="num">{step > 1 ? "✓" : "1"}</span><span>আবেদন তথ্য</span></div>
        <div className={`progressItem ${step === 2 ? "active" : step > 2 ? "done" : ""}`}><span className="num">{step > 2 ? "✓" : "2"}</span><span>পেমেন্ট পদ্ধতি</span></div>
        <div className={`progressItem ${step === 3 ? "active" : ""}`}><span className="num">3</span><span>জমা ও রসিদ</span></div>
      </div>

      {step === 1 && <>
        <h2>বৃত্তির আবেদন ফর্ম</h2>
        <p className="subtitle">জন্ম নিবন্ধন সনদ অনুযায়ী তথ্য পূরণ করুন। (*) চিহ্নিত ঘরগুলো আবশ্যক।</p>
        <form onSubmit={nextToPayment}>
          <div className="formGrid">
            <Field label={labels.studentBn} name="studentBn" value={form.studentBn} onChange={update}/>
            <Field label={labels.studentEn} name="studentEn" value={form.studentEn} onChange={update}/>
            <Field label={labels.fatherBn} name="fatherBn" value={form.fatherBn} onChange={update}/>
            <Field label={labels.fatherEn} name="fatherEn" value={form.fatherEn} onChange={update}/>
            <Field label={labels.fatherMobile} name="fatherMobile" value={form.fatherMobile} onChange={update} type="tel" pattern="(\\+?88)?01[3-9][0-9]{8}" placeholder="01XXXXXXXXX"/>
            <Field label={labels.motherBn} name="motherBn" value={form.motherBn} onChange={update}/>
            <Field label={labels.motherEn} name="motherEn" value={form.motherEn} onChange={update}/>
            <Field label={labels.motherMobile} name="motherMobile" value={form.motherMobile} onChange={update} type="tel" pattern="(\\+?88)?01[3-9][0-9]{8}" placeholder="01XXXXXXXXX"/>
            <div className="field"><label htmlFor="studentClass">শ্রেণি *</label>
              <select id="studentClass" name="studentClass" value={form.studentClass} onChange={update} required>
                <option value="3">তৃতীয়</option>
              </select>
            </div>
            <Field label={labels.roll} name="roll" value={form.roll} onChange={update} type="number"/>
            <div className="field"><label htmlFor="upazila">উপজেলা *</label>
              <input id="upazila" name="upazila" value={form.upazila} readOnly required/>
            </div>
            <Field label={labels.institution} name="institution" value={form.institution} onChange={update}/>
            <Field label={labels.teacher} name="teacher" value={form.teacher} onChange={update}/>
            <Field label={labels.teacherMobile} name="teacherMobile" value={form.teacherMobile} onChange={update} type="tel" pattern="(\\+?88)?01[3-9][0-9]{8}" placeholder="01XXXXXXXXX"/>
            <div className="field full">
              <label htmlFor="photo">পরীক্ষার্থীর ছবি (JPG/PNG, সর্বোচ্চ ২ MB) *</label>
              <input id="photo" type="file" accept="image/jpeg,image/png" required onChange={handlePhoto}/>
              <span className="help">{photoName || "পরিষ্কার পাসপোর্ট সাইজের ছবি আপলোড করুন।"}</span>
              {form.photoDataUrl && <img className="preview" src={form.photoDataUrl} alt="পরীক্ষার্থীর ছবির প্রিভিউ"/>}
            </div>
          </div>
          {error && <div className="error" role="alert">{error}</div>}
          <div className="actions"><span></span><button className="btn primary" type="submit">পরবর্তী ধাপ: পেমেন্ট →</button></div>
        </form>
      </>}

      {step === 2 && <>
        <h2>পেমেন্ট পদ্ধতি নির্বাচন</h2>
        <p className="subtitle">পেমেন্ট পদ্ধতি নির্বাচন করে লেনদেনের Transaction ID লিখুন। PIN, OTP বা স্ক্রিনশট দেবেন না।</p>
        <div className="notice">আবেদন ফি: {fee} টাকা। Transaction ID জমা দিলেও পেমেন্ট স্বয়ংক্রিয়ভাবে যাচাই হয় না; কর্তৃপক্ষ যাচাই না করা পর্যন্ত অবস্থা অপেক্ষমাণ থাকবে।</div>
        <div className="paymentOptions">
          <button type="button" onClick={() => setForm(p => ({ ...p, paymentMethod: "bkash" }))} className={`paymentOption ${form.paymentMethod === "bkash" ? "selected bkash" : ""}`}>
            <span className="payLogo bkash">bKash</span><span><strong>বিকাশ</strong><small>পেমেন্ট পদ্ধতি নির্বাচন</small></span>
          </button>
          <button type="button" onClick={() => setForm(p => ({ ...p, paymentMethod: "nagad" }))} className={`paymentOption ${form.paymentMethod === "nagad" ? "selected nagad" : ""}`}>
            <span className="payLogo nagad">নগদ</span><span><strong>নগদ</strong><small>পেমেন্ট পদ্ধতি নির্বাচন</small></span>
          </button>
        </div>
        <div className="field transactionField">
          <label htmlFor="transactionId">লেনদেন আইডি (Transaction ID) *</label>
          <input id="transactionId" name="transactionId" value={form.transactionId} onChange={update}
            required minLength={6} maxLength={30} pattern="[A-Za-z0-9-]{6,30}"
            placeholder="যেমন: 8N4K7P2Q1A"/>
          <span className="help">bKash/Nagad-এর পেমেন্ট মেসেজে পাওয়া Transaction ID লিখুন।</span>
        </div>
        <fieldset className="payerMobileField">
          <legend>যে মোবাইল নম্বর থেকে পেমেন্ট করেছেন *</legend>
          {([
            ["fatherMobile", "পিতা", form.fatherMobile],
            ["motherMobile", "মাতা", form.motherMobile],
            ["teacherMobile", "শিক্ষক প্রতিনিধি", form.teacherMobile]
          ] as const).map(([key, label, number]) => (
            <label className="payerMobileOption" key={key}>
              <input type="radio" name="payerMobile" value={key}
                checked={form.payerMobile === key} onChange={update}/>
              <span><strong>{label}</strong><span dir="ltr">{number}</span></span>
            </label>
          ))}
        </fieldset>
        <div className="summary">
          {[
            ["পরীক্ষার্থী", form.studentBn], ["শ্রেণি", classLabel], ["ক্লাস রোল", form.roll],
            ["প্রতিষ্ঠান", form.institution], ["নির্বাচিত পদ্ধতি", form.paymentMethod === "bkash" ? "বিকাশ" : "নগদ"],
            ["পেমেন্ট করা নম্বর", form.payerMobile === "fatherMobile" ? form.fatherMobile : form.payerMobile === "motherMobile" ? form.motherMobile : form.teacherMobile],
            ["আবেদন ফি", `${fee} টাকা`]
          ].map(([k,v]) => <div className="summaryRow" key={k}><span>{k}</span><span>{v}</span></div>)}
        </div>
        {error && <div className="error" role="alert">{error}</div>}
        <div className="actions">
          <button className="btn secondary" type="button" onClick={() => { setError(""); setStep(1); }}>← আগের পেজ</button>
          <button className="btn primary" type="button" disabled={busy} onClick={continueToReview}>চূড়ান্ত সাবমিশনের আগে →</button>
        </div>
      </>}

      {step === 2.5 && <>
        <h2>আবেদন চূড়ান্ত করুন</h2>
        <p className="subtitle">সাবমিট করার আগে আপনার দেওয়া তথ্য যাচাই করুন।</p>
        <div className="summary">
          {Object.entries(labels).map(([key, label]) => {
            const val = form[key as keyof Application];
            return <div className="summaryRow" key={key}><span>{label}</span><span>{key === "paymentMethod" ? (val === "bkash" ? "বিকাশ" : "নগদ") : String(val || "-")}</span></div>;
          })}
          <div className="summaryRow"><span>আবেদন ফি</span><span>{fee} টাকা</span></div>
        </div>
        <p className="help" style={{marginTop: 15}}>সাবমিট করলে আবেদনটি Google Sheets-এ সংরক্ষণের জন্য পাঠানো হবে। রসিদে Transaction ID থাকবে, তবে এটি পেমেন্ট যাচাইয়ের নিশ্চয়তা নয়।</p>
        {error && <div className="error" role="alert">{error}</div>}
        <div className="actions">
          <button className="btn secondary" type="button" disabled={busy} onClick={() => { setError(""); setStep(2); }}>← পেমেন্ট পেজ</button>
          <button className="btn primary" type="button" disabled={busy} onClick={submitApplication}>{busy ? "জমা হচ্ছে..." : "চূড়ান্ত আবেদন জমা দিন"}</button>
        </div>
      </>}

      {step === 3 && saved && <>
        <div className="center">
          <div className="successIcon">✓</div>
          <h2>আবেদন জমা হয়েছে!</h2>
          <p className="subtitle">আপনার আবেদন আইডি নিচে দেওয়া হলো। এটি সংরক্ষণ করে রাখুন।</p>
          <p className="applicationId">{saved.applicationId}</p>
        </div>
        <div className="summary" style={{marginTop: 20}}>
          <div className="summaryRow"><span>পরীক্ষার্থী</span><span>{saved.studentBn}</span></div>
          <div className="summaryRow"><span>শ্রেণি ও রোল</span><span>{classLabel} / {saved.roll}</span></div>
          <div className="summaryRow"><span>পেমেন্ট পদ্ধতি</span><span>{saved.paymentMethod === "bkash" ? "বিকাশ" : "নগদ"}</span></div>
          <div className="summaryRow"><span>আবেদন ফি</span><span>{fee} টাকা</span></div>
          <div className="summaryRow"><span>Transaction ID</span><span>{saved.transactionId}</span></div>
          <div className="summaryRow"><span>পেমেন্ট করা নম্বর</span><span>{saved.payerMobile === "fatherMobile" ? saved.fatherMobile : saved.payerMobile === "motherMobile" ? saved.motherMobile : saved.teacherMobile}</span></div>
          <div className="summaryRow"><span>পেমেন্ট অবস্থা</span><span>যাচাই অপেক্ষমাণ</span></div>
        </div>
        <div className="notice" style={{marginTop: 16}}>ডিপোজিট রসিদে জমা দেওয়া তথ্য ও Transaction ID থাকবে। কর্তৃপক্ষ পেমেন্ট যাচাই করার পরই এটি নিশ্চিত হবে।</div>
        {error && <div className="error" role="alert">{error}</div>}
        <div className="actions">
          <button className="btn secondary" type="button" onClick={() => window.location.reload()}>নতুন আবেদন</button>
          <button className="btn primary" type="button" onClick={handleDownloadDepositReceipt}>PDF ডিপোজিট রসিদ ডাউনলোড ↓</button>
        </div>
      </>}
    </section></div>
    <footer>© 2026 Ramu Iqra Model Academy Scholarship · আবেদনকারীর তথ্য গোপন রাখুন</footer>
  </main>;
}
