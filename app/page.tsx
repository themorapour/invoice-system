"use client";

import React, { useEffect, useRef, useState } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Trash2, Plus, Printer, Save } from "lucide-react";
import { useReactToPrint } from "react-to-print";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const numberToPersianWords = (number: number): string => {
    const ones = ["", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه"];
    const tens = ["", "ده", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"];
    const teens = ["ده", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده", "هفده", "هجده", " نوزده"];
    const hundreds = ["", "صد", "دویست", "سیصد", "چهارصد", "پانصد", "ششصد", "هفتصد", "هشتصد", "نهصد"];

    if (number === 0) return "صفر";

    const convertGroup = (n: number): string => {
        let result = "";
        const h = Math.floor(n / 100);
        const t = Math.floor((n % 100) / 10);
        const o = n % 10;

        if (h > 0) {
            result += hundreds[h];
            if (t > 0 || o > 0) result += " و ";
        }
        if (t > 1) {
            result += tens[t];
            if (o > 0) result += " و " + ones[o];
        } else if (t === 1) {
            result += teens[o];
        } else if (o > 0) {
            result += ones[o];
        }
        return result;
    };

    const groups = [];
    let tempNumber = number;

    const billion = Math.floor(tempNumber / 1000000000);
    if (billion > 0) {
        groups.push(convertGroup(billion) + " میلیارد");
        tempNumber %= 1000000000;
    }

    const million = Math.floor(tempNumber / 1000000);
    if (million > 0) {
        groups.push(convertGroup(million) + " میلیون");
        tempNumber %= 1000000;
    }

    const thousand = Math.floor(tempNumber / 1000);
    if (thousand > 0) {
        groups.push(convertGroup(thousand) + " هزار");
        tempNumber %= 1000;
    }

    if (tempNumber > 0) {
        groups.push(convertGroup(tempNumber));
    }

    return groups.join(" و ") + " ریال";
};

const invoiceSchema = z.object({
    invoiceNumber: z.number(),
    invoiceDate: z.string().min(1, "تاریخ الزامی است"),
    validUntil: z.string().optional(),
    buyerName: z.string().min(2, "نام خریدار الزامی است"),
    buyerDetails: z.string().optional(),
    items: z.array(
        z.object({
            description: z.string().min(1, "شرح کالا الزامی است"),
            model: z.string().optional(),
            unitPrice: z.number().min(0),
            quantity: z.number().min(1),
        })
    ),
    discountEnabled: z.boolean().default(false),
    discountRate: z.number().min(0).max(100).default(0),
    taxEnabled: z.boolean().default(false),
    taxRate: z.number().min(0).max(100).default(9),
    terms: z.array(
        z.object({
            text: z.string(),
            enabled: z.boolean(),
        })
    ),
    selectedBank: z.enum(["none", "mellat", "saman", "mellat2", "melli"]).default("none"),
    customNotes: z.string().optional(),
});

type InvoiceFormValues = z.infer<typeof invoiceSchema>;

// تبدیل ارقام لاتین به فارسی
const toPersianDigits = (s: string) => s.replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(d)]);

// تبدیل ارقام فارسی به لاتین (برای محاسبات)
const toLatinDigits = (s: string) => s.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));

// فرمت‌دهی نهایی: تبدیل به فارسی + جداکننده سه‌رقم
const formatPersianNumber = (num: number): string => {
    if (num === 0) return '۰';
    const formatted = new Intl.NumberFormat('fa-IR', {
        useGrouping: true,
        minimumFractionDigits: 0,
    }).format(num);
    return formatted;
};

const formatCurrency = (amount: number): string => {
    // تضمین می‌کند که ارقام فارسی و جداکننده سه‌رقم اعمال شود
    return new Intl.NumberFormat("fa-IR", {
        useGrouping: true,
        minimumFractionDigits: 0,
    }).format(amount);
};

export default function InvoicePage() {

    const componentRef = useRef<HTMLDivElement>(null);

    const defaultDate = new Date().toLocaleDateString("fa-IR");

    const defaultTerms = [
        { text: "• نحوه پرداخت: نقدی", enabled: true },
        { text: "• زمان تحویل: فوری", enabled: true },
        { text: "• گارانتی: ۵ سال ضمانت کمپرسور، ۱۸ ماه کلیه قطعات و ۱۰ سال خدمات پس از فروش", enabled: true },
        { text: "• قیمت‌های فوق با احتساب مالیات بر ارزش افزوده می‌باشند", enabled: true },
        { text: "• محل تحویل: انبار مرکزی شرکت (هزینه حمل تا پروژه به عهده خریدار محترم می‌باشد)", enabled: true },
    ];

    const form = useForm<InvoiceFormValues>({
        resolver: zodResolver(invoiceSchema),
        defaultValues: {
            invoiceNumber: 3541,
            invoiceDate: defaultDate,
            validUntil: "",
            buyerName: "",
            buyerDetails: "",
            items: [{ description: "", model: "", unitPrice: 0, quantity: 1 }],
            discountEnabled: false,
            discountRate: 0,
            taxEnabled: false,
            taxRate: 10,
            terms: defaultTerms,
            selectedBank: "none",
            customNotes: "",
        },
    });

    const { register, control, handleSubmit, setValue, getValues, formState: { errors } } = form;

    useEffect(() => {
        const savedInvoiceNum = localStorage.getItem("lastInvoiceNumber");
        if (savedInvoiceNum) {
            setValue("invoiceNumber", parseInt(savedInvoiceNum) + 1);
        } else {
            setValue("invoiceNumber", 3541);
        }
    }, [setValue]);

    const { fields: itemFields, append: appendItem, remove: removeItem } = useFieldArray({
        control,
        name: "items",
    });

    const { fields: termFields } = useFieldArray({
        control,
        name: "terms",
    });

// ---------------------------------------------------------
    // 1. دریافت همه مقادیر فرم (Watch Values) - بدون تکرار
    // ---------------------------------------------------------
    const items = useWatch({ control, name: "items" }) || [];
    const selectedBank = useWatch({ control, name: "selectedBank" });
    const terms = useWatch({ control, name: "terms" });
    const validUntil = useWatch({ control, name: "validUntil" }); // تاریخ اعتبار

    // تنظیمات تخفیف
    const discountEnabled = useWatch({ control, name: "discountEnabled" });
    const discountRate = useWatch({ control, name: "discountRate" }) || 0;

    // تنظیمات مالیات
    const taxEnabled = useWatch({ control, name: "taxEnabled" });
    const taxRate = useWatch({ control, name: "taxRate" }) || 0;

    // ---------------------------------------------------------
    // 2. انجام محاسبات ریاضی (Calculations)
    // ---------------------------------------------------------
    // جمع کل اقلام
    const subTotal = items.reduce((acc, item) => {
        return acc + ((item.unitPrice || 0) * (item.quantity || 0));
    }, 0);

    // محاسبه مبلغ تخفیف
    const discountAmount = discountEnabled ? Math.round((subTotal * discountRate) / 100) : 0;

    // مبلغ پس از تخفیف (برای محاسبه مالیات)
    const amountAfterDiscount = subTotal - discountAmount;

    // محاسبه مبلغ مالیات
    const taxAmount = taxEnabled ? Math.round((amountAfterDiscount * taxRate) / 100) : 0;

    // مبلغ نهایی قابل پرداخت
    const totalAmount = amountAfterDiscount + taxAmount;

    // ---------------------------------------------------------
    // 3. منطق‌های نمایش در چاپ (Print Logic) - جدید
    // ---------------------------------------------------------
    
    // شرط ۱: (خودکار در JSX اعمال می‌شود با !validUntil)

    // شرط ۲: آیا ردیف تخفیف نمایش داده شود؟ (باید فعال باشد و مبلغ داشته باشد)
    const showDiscountRow = discountEnabled && discountAmount > 0;

    // شرط ۲: آیا ردیف مالیات نمایش داده شود؟ (باید فعال باشد و مبلغ داشته باشد)
    const showTaxRow = taxEnabled && taxAmount > 0;

    // شرط ۳: آیا ردیف "جمع کل اقلام" نمایش داده شود؟
    // اگر نه تخفیف داریم و نه مالیات، جمع کل اقلام با مبلغ نهایی یکی است، پس حذف می‌شود.
    const showSubTotalRow = showDiscountRow || showTaxRow;

    // 🔑 اصلاح نهایی تابع پرینت
    const handlePrint = useReactToPrint({

        content: () => componentRef.current,
        documentTitle: `Invoice-${getValues("invoiceNumber")}`,

    });

    const onSubmit = (data: InvoiceFormValues) => {
        localStorage.setItem("lastInvoiceNumber", data.invoiceNumber.toString());
        console.log("Saving Data:", {
            ...data,
            calculatedAmounts: { subTotal, discountAmount, taxAmount, totalAmount }
        });
        alert(`فاکتور شماره ${data.invoiceNumber} ذخیره شد.`);
    };

    const [selectedHeader, setSelectedHeader] = useState<"header1" | "header2">("header1");

    return (
        <div className="min-h-screen bg-white p-8 flex flex-col items-center font-sans print:dir-rtl" dir="rtl">

        <div className="no-print mb-4 flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
                <input
                type="radio"
                name="header"
                value="header1"
                checked={selectedHeader === "header1"}
                onChange={() => setSelectedHeader("header1")}
                />
                البرز برج
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
                <input
                type="radio"
                name="header"
                value="header2"
                checked={selectedHeader === "header2"}
                onChange={() => setSelectedHeader("header2")}
                />
                هدر پنکه
            </label>
        </div>

            {/* هدر کنترل پنل */}
            <div className="w-full max-w-5xl flex justify-between items-center mb-6 print:hidden">
                <h1 className="text-2xl font-bold text-gray-800">سامانه صدور پیش‌فاکتور</h1>
                <div className="flex gap-2">
                    <Button onClick={handleSubmit(onSubmit)} className="bg-green-600 hover:bg-green-700">
                        <Save className="w-4 h-4 ml-2" />
                        ذخیره و ثبت شماره
                    </Button>
                    {/* 🔑 دکمه پرینت */}
                    <Button onClick={handlePrint} variant="outline">
                        <Printer className="w-4 h-4 ml-2" />
                        چاپ / PDF
                    </Button>
                </div>
            </div>

            <div ref={componentRef} className="w-full max-w-5xl">
                <Card className="shadow-2xl print:shadow-none print:border-none print:w-full print:max-w-none print-body" ref={componentRef}>
                    
                    {/* Header ثابت */}
                    <div className="print-header">
                    {selectedHeader === "header1" ? (
                        <img src="/alborz_head.svg" className="mx-auto" />
                    ) : (
                        <img src="/pankeh_head.svg" className="mx-auto" />
                    )}
                    </div>

                    <CardHeader className="pb-4 bg-white">
                        
                        <div className="flex flex-col justify-center items-center pt-6">
                            <CardTitle className="text-[16px] font-bold mb-2 ">پیش فاکتور فروش</CardTitle>
                        </div>

                        <div className="flex w-full -mt-2 p-4 justify-between print:flex print:bg-transparent print:border-none print:p-0">
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-bold text-gray-700 whitespace-nowrap">خریدار محترم:</label>
                                <Input
                                    {...register("buyerName")}
                                    className="h-8 bg-gray-50 border-gray-200 print:border-none print:bg-transparent print:px-0 print:font-bold print:h-auto"
                                    placeholder="نام شخص / شرکت..."
                                />
                            </div>

                            <div className="flex flex-col -space-y-1.5 move-left-print">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs w-13 font-bold text-right text-gray-700 font-normal">شماره:</span>
                                    <Input
                                        {...register("invoiceNumber", { valueAsNumber: true })}
                                        className="h-8 w-20 md:text-xs text-center bg-gray-50 border-gray-200 print:border-none print:bg-transparent print:p-0 print:text-right print:w-auto"
                                    />
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs w-13 font-bold text-right text-gray-700 font-normal">تاریخ:</span>
                                    <Input
                                        {...register("invoiceDate")}
                                        placeholder="1402/01/01"
                                        className="h-8 w-20 md:text-xs text-center bg-gray-50 border-gray-200 print:border-none print:bg-transparent print:p-0 print:text-right print:w-auto"
                                    />
                                </div>
                                <div className={`flex items-center gap-1.5 ${!validUntil ? "print:hidden" : ""}`}>
                                    <span className="text-xs w-13 font-bold text-right text-gray-700 font-normal">اعتبار تا:</span>
                                    <Input
                                        {...register("validUntil")}
                                        placeholder="-"
                                        className="h-8 w-20 md:text-xs text-center bg-gray-50 border-gray-200 print:border-none print:bg-transparent print:p-0 print:text-right print:w-auto"
                                    />
                                </div>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="p-4 -mt-9">
                        <div className="min-h-[300px]">
                            <Table className="border overflow-hidden table-auto whitespace-pre-wrap w-full">
                                <TableHeader className="bg-white">
                                    <TableRow className="bg-white">
                                        <TableHead className="w-[35px] text-center text-black font-bold border-l border-black">ردیف</TableHead>
                                        <TableHead className="text-right w-[35%] text-black font-bold border-l border-black">شرح کالا</TableHead>
                                        <TableHead className="text-right text-black border-l border-black">مدل/ظرفیت</TableHead>
                                        <TableHead className="text-center w-[50px] text-black font-bold border-l border-black">تعداد/متر</TableHead>
                                        <TableHead className="text-center w-[110px] text-black font-bold border-l border-black">فی (ریال)</TableHead>
                                        <TableHead className="text-center w-[120px] text-black font-bold">قیمت کل (ریال)</TableHead>
                                        <TableHead className="w-[40px] print:hidden font-bold"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {itemFields.map((field, index) => {
                                        const rowTotal = (items[index]?.quantity || 0) * (items[index]?.unitPrice || 0);
                                        return (
                                            <TableRow key={field.id} className="odd:bg-white even:bg-gray-100 print:even:bg-gray-100">
                                                <TableCell className="text-center font-medium border-l whitespace-pre-wrap">
                                                    {index + 1}
                                                </TableCell>

                                                <TableCell className="border-l whitespace-pre-wrap">
                                                    <Input
                                                        {...register(`items.${index}.description`)}
                                                        placeholder="نام محصول"
                                                        className="border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 h-auto"
                                                    />
                                                </TableCell>

                                                <TableCell className="border-l whitespace-pre-wrap">
                                                    <Input
                                                        {...register(`items.${index}.model`)}
                                                        placeholder="-"
                                                        className="border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 h-auto"
                                                    />
                                                </TableCell>

                                                <TableCell className="border-l whitespace-pre-wrap">
                                                    {/* 💡 تغییر: type="number" به type="text" تبدیل شد */}
                                                    <Input
                                                        type="text"
                                                        // حذف register مستقیم
                                                        // 🚨 تغییرات اینجا اعمال می‌شود
                                                        value={toPersianDigits(String(items[index]?.quantity || 1))}
                                                        onChange={(e) => {
                                                            const rawValue = e.target.value.replace(/,/g, '');
                                                            const latinValue = toLatinDigits(rawValue);
                                                            const numericValue = parseInt(latinValue.replace(/[^0-9]/g, '') || '1', 10);
                                                            
                                                            // ذخیره مقدار عددی (لاتین) برای محاسبات در React Hook Form
                                                            setValue(`items.${index}.quantity`, numericValue, { shouldValidate: true });
                                                        }}
                                                        placeholder="۱"
                                                        className="text-center border-0 bg-transparent shadow-none focus-visible:ring-0 h-auto"
                                                        style={{ direction: 'rtl' }}
                                                    />
                                                </TableCell>

                                                <TableCell className="border-l whitespace-pre-wrap">
                                                    {/* 💡 تغییر: type="number" به type="text" تبدیل شد */}
                                                    <Input
                                                        type="text"
                                                        // حذف register مستقیم
                                                        // 🚨 تغییرات اینجا اعمال می‌شود
                                                        value={formatPersianNumber(items[index]?.unitPrice || 0)}
                                                        onChange={(e) => {
                                                            const rawValue = e.target.value.replace(/,/g, ''); // حذف جداکننده‌ها
                                                            const latinValue = toLatinDigits(rawValue);      // تبدیل ارقام فارسی به لاتین
                                                            const numericValue = parseInt(latinValue.replace(/[^0-9]/g, '') || '0', 10);
                                                            
                                                            // ذخیره مقدار عددی (لاتین) برای محاسبات در React Hook Form
                                                            setValue(`items.${index}.unitPrice`, numericValue, { shouldValidate: true });
                                                        }}
                                                        placeholder="۰"
                                                        // 👈 تغییر: حذف کلاس ltr برای نمایش RTL
                                                        className="text-center border-0 bg-transparent shadow-none focus-visible:ring-0 h-auto" 
                                                        style={{ direction: 'rtl' }}
                                                    />
                                                </TableCell>

                                                <TableCell className="text-center font-bold ltr pl-4 whitespace-pre-wrap">
                                                    {formatCurrency(rowTotal)}
                                                </TableCell>

                                                <TableCell className="print:hidden p-1 whitespace-pre-wrap">
                                                    {itemFields.length > 1 && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                            onClick={() => removeItem(index)}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>

                            <Button
                                variant="outline"
                                size="sm"
                                className="mt-2 border-dashed border-1 border-gray-400 w-full hover:bg-gray-100 print:hidden text-black"
                                onClick={() => appendItem({ description: "", model: "", unitPrice: 0, quantity: 1 })}
                            >
                                <Plus className="w-4 h-4 ml-2" /> افزودن ردیف کالا
                            </Button>

                            <div className="space-y-3 mt-3">
                                <div className={`flex justify-between text-sm ${!showSubTotalRow ? "print:hidden" : ""}`}>
                                    <span className="text-gray-600">جمع کل اقلام:</span>
                                    <span className="font-medium">{formatCurrency(subTotal)} ریال</span>
                                </div>

                                {/* تخفیف: تغییر به درصد با چک‌باکس */}
                                <div className={`flex justify-between items-center text-sm ${!showDiscountRow ? "print:hidden" : ""}`}>
                                        <div className="flex items-center gap-2">
                                            <Checkbox
                                                id="discountCheck"
                                                className="print:hidden"
                                                checked={discountEnabled}
                                                onCheckedChange={(c) => setValue("discountEnabled", !!c)}
                                            />
                                            <Label htmlFor="discountCheck" className="text-gray-600 cursor-pointer">
                                                تخفیف
                                                {/* نمایش input درصد فقط در حالت ویرایش */}
                                                <span className={`mr-1 text-xs ${!discountEnabled ? "hidden" : "inline"} print:hidden`}>
                                                    (
                                                    <input
                                                        type="number"
                                                        className="w-8 border-b bg-transparent text-center focus:outline-none"
                                                        {...register("discountRate", { valueAsNumber: true })}
                                                    />
                                                    %)
                                                </span>:
                                            </Label>
                                        </div>
                                        {/* نمایش مبلغ تخفیف */}
                                        <span className={`text-red-600 ${!discountEnabled ? "hidden" : "block"}`}>
                                            {formatCurrency(discountAmount)} -
                                        </span>
                                    </div>

                                {/* مالیات: تغییر به درصد دستی با چک‌باکس */}
                                <div className={`flex justify-between items-center text-sm ${!showTaxRow ? "print:hidden" : ""}`}>
                                        <div className="flex items-center gap-2">
                                            <Checkbox
                                                id="taxCheck"
                                                className="print:hidden"
                                                checked={taxEnabled}
                                                onCheckedChange={(c) => setValue("taxEnabled", !!c)}
                                            />
                                            <Label htmlFor="taxCheck" className="text-gray-600 cursor-pointer">
                                                مالیات
                                                {/* نمایش input درصد فقط در حالت ویرایش */}
                                                <span className={`mr-1 text-xs ${!taxEnabled ? "hidden" : "inline"} print:hidden`}>
                                                    (
                                                    <input
                                                        type="number"
                                                        className="w-8 bg-transparent text-center focus:outline-none"
                                                        {...register("taxRate", { valueAsNumber: true })}
                                                    />
                                                    %)
                                                </span>:
                                            </Label>
                                        </div>
                                        {/* نمایش مبلغ مالیات */}
                                        <span className={`font-medium ${!taxEnabled ? "hidden" : "block"}`}>
                                            {formatCurrency(taxAmount)} +
                                        </span>
                                    </div>

                                <div className="my-4 border-t print:border-none"></div>

                                <div className="flex flex-col gap-1 p-2 border border-1 border-gray-200 bg-gray-100 rounded-[10px] ">
                                    <div className="flex justify-between items-center">
                                        <span className="flex items-center gap-2 text-[15px] font-bold text-black">مبلغ قابل پرداخت:
                                            <div className="text-sm font-semibold text-gray-500 print:border-none print:p-0 print:bg-transparent">
                                                <span className="font-bold"> </span>
                                                {numberToPersianWords(totalAmount)}
                                            </div>
                                        </span>

                                        <span className="text-lg font-bold px-2 py-1 print:bg-transparent print:p-0">
                                            {formatCurrency(totalAmount)} <span className="text-xs font-normal">ریال</span>
                                        </span>

                                    </div>

                                </div>
                            </div>

                        </div>

                        {/* بخش پایینی: توضیحات و اطلاعات بانکی */}
                        <div className="flex flex-col md:flex-row break-inside-avoid pt-3 border-t border-gray-200 mt-4">

                            {/* سمت راست: توضیحات */}
                            <div className="w-full">
                                <h3 className="font-bold text-[14px] mb-2 inline-block">توضیحات و شرایط فروش:</h3>

                                <div className="space-y-1 text-sm">
                                    {termFields.map((field, index) => (
                                        <div key={field.id} className={`flex items-start gap-2 ${!terms[index]?.enabled ? 'print:hidden opacity-50' : ''}`}>
                                            <Checkbox
                                                className="mt-1 print:hidden"
                                                checked={terms[index]?.enabled}
                                                onCheckedChange={(checked) => setValue(`terms.${index}.enabled`, !!checked)}
                                            />
                                            <div className="flex-1">
                                                <Input
                                                    {...register(`terms.${index}.text`)}
                                                    className={`border-0 h-auto p-0 text-sm w-full bg-transparent focus-visible:ring-0 ${terms[index]?.enabled ? 'text-slate-700' : 'text-slate-400'}`}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <Textarea
                                    {...register("customNotes")}
                                    placeholder=""
                                    className="mt-4 resize-none border-gray-200 text-sm text-slate-700 min-h-[30px] print:border-none print:shadow-none print:p-0 print:mt-2"
                                />

                                <div className="mt-5 pt-4 print:-mt-4">
                                    <div className="print:hidden mb-2">
                                        <RadioGroup
                                            defaultValue="none"
                                            onValueChange={(val: "none" | "mellat" | "saman" | "mellat2" | "melli") => setValue("selectedBank", val)}
                                            className="flex gap-4 -mt-6 mb-3 items-end justify-end"
                                        >
                                            <div className="flex items-center space-x-2 space-x-reverse">
                                                <RadioGroupItem value="none" id="r1" />
                                                <Label htmlFor="r1">هیچکدام</Label>
                                            </div>
                                            <div className="flex items-center space-x-2 space-x-reverse">
                                                <RadioGroupItem value="mellat" id="r2" />
                                                <Label htmlFor="r2">بانک ملت</Label>
                                            </div>
                                            <div className="flex items-center space-x-2 space-x-reverse">
                                                <RadioGroupItem value="saman" id="r3" />
                                                <Label htmlFor="r3">بانک سامان</Label>
                                            </div>
                                            <div className="flex items-center space-x-2 space-x-reverse">
                                                <RadioGroupItem value="mellat2" id="r4" />
                                                <Label htmlFor="r3">بانک ملت</Label>
                                            </div>
                                            <div className="flex items-center space-x-2 space-x-reverse">
                                                <RadioGroupItem value="melli" id="r5" />
                                                <Label htmlFor="r3">بانک ملی</Label>
                                            </div>                                                                                                                                  
                                        </RadioGroup>
                                    </div>

                                    {selectedBank === 'mellat' && (
                                        <div className="bg-gray-100 p-4 rounded-[15px] border border-gray-200 text-sm text-slate-700 print:bg-transparent print:border-none print:p-0">
                                            <p className="font-bold">شماره حساب: شرکت البرز برج - بانک ملت</p>
                                            <div className="flex gap-4 mt-1 flex-wrap">
                                                <span>کارت: <span className="font-mono font-bold tracking-wider">6104338800950608</span></span>
                                                <span>شبا: <span className="font-mono">IR 1301-2000-0000-0091-9764-7629</span></span>
                                            </div>
                                        </div>
                                    )}

                                    {selectedBank === 'saman' && (
                                        <div className="bg-gray-100 p-4 rounded-[15px] border border-gray-200 text-sm text-slate-700 print:bg-transparent print:border-none print:p-0">
                                            <p className="font-bold">شماره حساب: بنیامین سجادی - بانک سامان </p>
                                            <div className="flex gap-4 mt-1 flex-wrap">
                                                <span>کارت: <span className="font-mono font-bold tracking-wider">6219861923784549</span></span>
                                                <span>شبا: <span className="font-mono">IR 6805-6061-1828-0053-6219-3601</span></span>
                                            </div>
                                        </div>
                                    )}


                                    {selectedBank === 'mellat2' && (
                                        <div className="bg-gray-100 p-4 rounded-[15px] border border-gray-200 text-sm text-slate-700 print:bg-transparent print:border-none print:p-0">
                                            <p className="font-bold">شماره حساب: بنیامین سجادی - بانک ملت </p>
                                            <div className="flex gap-4 mt-1 flex-wrap">
                                                <span>کارت: <span className="font-mono font-bold tracking-wider">6104338919472361</span></span>
                                                <span>شبا: <span className="font-mono">IR 3701-2002-0000-0095-4711-7606</span></span>
                                            </div>
                                        </div>
                                    )}


                                    {selectedBank === 'melli' && (
                                        <div className="bg-gray-100 p-4 rounded-[15px] border border-gray-200 text-sm text-slate-700 print:bg-transparent print:border-none print:p-0">
                                            <p className="font-bold">شماره حساب: بنیامین سجادی - بانک ملی </p>
                                            <div className="flex gap-4 mt-1 flex-wrap">
                                                <span>کارت: <span className="font-mono font-bold tracking-wider">6362141814534831</span></span>
                                                <span>شبا: <span className="font-mono">IR 8206-2000-0000-1021-4803-9000</span></span>
                                            </div>
                                        </div>
                                    )}                             

                                    {(selectedBank !== 'none') && (
                                        <p className="mt-3 text-xs text-gray-600 border-t pt-1 border-dashed border-gray-400">
                                            خواهشمند است پس از واریز، فیش واریزی خود را به شماره <span className="font-mono text-base">۰۹۱۲۲۴۰۱۰۱۶</span> ارسال نمایید.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                    </CardContent>

                    {/* Footer ثابت */}
                    <div className="print-footer scale-[85%]">
                    <img src="/footer.svg" className="mx-auto" />
                    </div>

                </Card>
            </div>


            <style jsx global>{`
              @media print {
                
              .move-left-print {
                margin-left: -100px !important;
              }

              @page {
                  margin-top: 0.7cm;
                  margin-bottom: 0.5cm;
                  margin-left: 0.5cm;
                  margin-right: 0.5cm;
                }

                html, body {
                  direction: rtl !important;
                  unicode-bidi: bidi-override !important;
                  text-align: right !important;
                  background: white !important;
                }

                .print-body {
                    margin-top: 88px;
                    margin-bottom: 80px;
                }

                .print-header {
                    position: fixed;
                    top: -60px;
                    right: 0;
                    left: 0;
                    height: 90px;
                    text-align: center;
                    background: white;
                    padding: 8px 0;
                    z-index: 9999;
                }

                .print-footer {
                    position: fixed;
                    bottom: -20px;
                    right: 0;
                    left: 0;
                    height: 100px;
                    text-align: center;
                    background: white;
                    padding: 5px 0;
                    z-index: 9999;
                }




                .print\\:hidden {
                  display: none !important;
                }

                input[type="number"]::-webkit-inner-spin-button,
                input[type="number"]::-webkit-outer-spin-button {
                  -webkit-appearance: none;
                  margin: 0;
                }
              }
            `}
            </style>


        </div>
    );
}