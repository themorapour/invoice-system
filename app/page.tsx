"use client";

import React, { useEffect } from "react";
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

// --- Zod Schema ---
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
  // تنظیمات جدید تخفیف و مالیات
  discountEnabled: z.boolean().default(false),
  discountRate: z.number().min(0).max(100).default(0),
  taxEnabled: z.boolean().default(false),
  taxRate: z.number().min(0).max(100).default(9), // پیش فرض ۹ یا ۱۰ درصد
  
  terms: z.array(
    z.object({
      text: z.string(),
      enabled: z.boolean(),
    })
  ),
  selectedBank: z.enum(["none", "mellat", "refah"]).default("none"),
  customNotes: z.string().optional(),
});

type InvoiceFormValues = z.infer<typeof invoiceSchema>;

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("fa-IR").format(amount);
};

export default function InvoicePage() {
  const componentRef = React.useRef(null);
  
  const defaultDate = new Date().toLocaleDateString("fa-IR");

  const defaultTerms = [
    { text: "نحوه پرداخت: نقدی", enabled: true },
    { text: "زمان تحویل: فوری", enabled: true },
    { text: "گارانتی: ۵ سال ضمانت کمپرسور، ۱۸ ماه کلیه قطعات و ۱۰ سال خدمات پس از فروش", enabled: true },
    { text: "قیمت‌های فوق با احتساب مالیات بر ارزش افزوده می‌باشند", enabled: true },
    { text: "محل تحویل: انبار مرکزی شرکت (هزینه حمل تا پروژه به عهده خریدار محترم می‌باشد)", enabled: true },
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

  // Watch values
  const items = useWatch({ control, name: "items" });
  const selectedBank = useWatch({ control, name: "selectedBank" });
  const terms = useWatch({ control, name: "terms" });
  
  // Watch tax & discount
  const discountEnabled = useWatch({ control, name: "discountEnabled" });
  const discountRate = useWatch({ control, name: "discountRate" }) || 0;
  const taxEnabled = useWatch({ control, name: "taxEnabled" });
  const taxRate = useWatch({ control, name: "taxRate" }) || 0;

  // --- محاسبات جدید ---
  const subTotal = items.reduce((acc, item) => acc + (item.unitPrice || 0) * (item.quantity || 0), 0);
  
  // محاسبه مبلغ تخفیف بر اساس درصد
  const discountAmount = discountEnabled ? Math.round(subTotal * (discountRate / 100)) : 0;
  
  const totalAfterDiscount = subTotal - discountAmount;
  
  // محاسبه مبلغ مالیات بر اساس درصد
  const taxAmount = taxEnabled ? Math.round(totalAfterDiscount * (taxRate / 100)) : 0;
  
  const totalAmount = totalAfterDiscount + taxAmount;

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

  return (
    <div className="min-h-screen bg-white p-8 flex flex-col items-center font-sans" dir="rtl">
      
      {/* هدر کنترل پنل */}
      <div className="w-full max-w-5xl flex justify-between items-center mb-6 print:hidden">
        <h1 className="text-2xl font-bold text-gray-800">سامانه صدور پیش‌فاکتور</h1>
        <div className="flex gap-2">
           <Button onClick={handleSubmit(onSubmit)} className="bg-green-600 hover:bg-green-700">
            <Save className="w-4 h-4 ml-2" />
            ذخیره و ثبت شماره
          </Button>
          <Button onClick={handlePrint} variant="outline">
            <Printer className="w-4 h-4 ml-2" />
            چاپ / PDF
          </Button>
        </div>
      </div>

      {/* ناحیه کاغذ A4 */}
      <Card className="w-full max-w-5xl shadow-2xl print:shadow-none print:border-none print:w-full print:max-w-none" ref={componentRef}>
        <CardHeader className="pb-4 bg-white">
          <div className="flex flex-col justify-center items-center pt-2">
              <CardTitle className="text-2xl font-black text-slate-900 mb-2 ">پیش فاکتور فروش</CardTitle>
              <p className="text-sm text-gray-500 font-bold">شرکت البرز برج</p>
          </div>
          
          <div className="flex w-full -mt-2 p-4 justify-between print:bg-transparent print:border-none print:p-0">              
            
            <div className="flex items-center gap-2">
              <label className="text-sm font-bold text-gray-700 whitespace-nowrap">خریدار محترم:</label>
              <Input
                {...register("buyerName")}
                className="h-8 bg-gray-50 border-gray-200 print:border-none print:bg-transparent print:px-0 print:font-bold print:h-auto"
                placeholder="نام شخص / شرکت..."
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center">
                  <span className="text-sm font-bold w-16 text-right">شماره:</span>
                  <Input 
                    {...register("invoiceNumber", { valueAsNumber: true })}
                    className="h-8 w-32 text-center bg-gray-50 border-gray-200 print:border-none print:bg-transparent print:p-0 print:text-right print:w-auto"
                  />
              </div>
              <div className="flex items-center">
                  <span className="text-sm font-bold w-16 text-right">تاریخ:</span>
                  <Input 
                    {...register("invoiceDate")}
                    placeholder="1402/01/01"
                    className="h-8 w-32 text-center bg-gray-50 border-gray-200 print:border-none print:bg-transparent print:p-0 print:text-right print:w-auto"
                  />
              </div>
              <div className="flex items-center">
                  <span className="text-sm font-bold w-16 text-right text-gray-500">اعتبار تا:</span>
                  <Input 
                    {...register("validUntil")}
                    placeholder="اختیاری..."
                    className="h-8 w-32 text-center bg-gray-50 border-gray-200 print:border-none print:bg-transparent print:p-0 print:text-right print:w-auto"
                  />
              </div>
            </div>

          </div>
        </CardHeader>

        <CardContent className="p-4 -mt-16">
          <div className="p-6 min-h-[300px]">
            <Table className="border overflow-hidden">
              <TableHeader className="bg-white">
                <TableRow className="bg-white">
                  <TableHead className="w-[50px] text-center text-black font-bold border-l border-black">ردیف</TableHead>
                  <TableHead className="text-right w-[35%] text-black font-bold border-l border-black">شرح کالا</TableHead>
                  <TableHead className="text-right text-black border-l border-black">مدل</TableHead>
                  <TableHead className="text-center w-[80px] text-black font-bold border-l border-black">تعداد</TableHead>
                  <TableHead className="text-left w-[140px] text-black font-bold border-l border-black">فی (ریال)</TableHead>
                  <TableHead className="text-left w-[160px] text-black font-bold">قیمت کل (ریال)</TableHead>
                  <TableHead className="w-[40px] print:hidden font-bold"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itemFields.map((field, index) => {
                  const rowTotal = (items[index]?.quantity || 0) * (items[index]?.unitPrice || 0);
                  return (
                    <TableRow key={field.id} className="odd:bg-white even:bg-gray-100 print:even:bg-gray-100">
                      <TableCell className="text-center font-medium border-l">
                        {index + 1}
                      </TableCell>
                      
                      <TableCell className="border-l">
                        <Input
                          {...register(`items.${index}.description`)}
                          placeholder="نام محصول"
                          className="border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 h-auto"
                        />
                      </TableCell>
                      
                      <TableCell className="border-l">
                        <Input
                          {...register(`items.${index}.model`)}
                          placeholder="-"
                          className="border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 text-sm text-gray-600 h-auto"
                        />
                      </TableCell>

                      <TableCell className="border-l">
                        <Input
                          type="number"
                          {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                          className="text-center border-0 bg-transparent shadow-none focus-visible:ring-0 h-auto"
                        />
                      </TableCell>

                      <TableCell className="border-l">
                         <Input
                          type="number"
                          {...register(`items.${index}.unitPrice`, { valueAsNumber: true })}
                          className="text-left border-0 bg-transparent shadow-none focus-visible:ring-0 ltr h-auto"
                        />
                      </TableCell>

                      <TableCell className="text-left font-bold text-slate-700 ltr pl-4">
                        {formatCurrency(rowTotal)}
                      </TableCell>

                      <TableCell className="print:hidden p-1">
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

            <div className="space-y-3 mt-8">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">جمع کل اقلام:</span>
                <span className="font-medium">{formatCurrency(subTotal)} ریال</span>
              </div>
              
              {/* تخفیف: تغییر به درصد با چک‌باکس */}
              <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                      <Checkbox 
                          id="discountCheck" 
                          className="print:hidden"
                          checked={discountEnabled}
                          onCheckedChange={(c) => setValue("discountEnabled", !!c)}
                      />
                      <Label htmlFor="discountCheck" className="text-gray-600 cursor-pointer">
                          تخفیف 
                          {discountEnabled && (
                              <span className="mr-1 text-xs">
                                    (
                                    <input 
                                      type="number"
                                      className="w-8 border-b bg-transparent text-center focus:outline-none"
                                      {...register("discountRate", { valueAsNumber: true })}
                                    />
                                    ٪)
                              </span>
                          )}:
                      </Label>
                  </div>
                  {discountEnabled && (
                        <span className="font-medium text-red-600">
                            {formatCurrency(discountAmount)} -
                        </span>
                  )}
              </div>

              {/* مالیات: تغییر به درصد دستی با چک‌باکس */}
              <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                      <Checkbox 
                          id="taxCheck" 
                          className="print:hidden"
                          checked={taxEnabled}
                          onCheckedChange={(c) => setValue("taxEnabled", !!c)}
                      />
                      <Label htmlFor="taxCheck" className="text-gray-600 cursor-pointer">
                          مالیات
                          {taxEnabled && (
                              <span className="mr-1 text-xs">
                                    (
                                    <input 
                                      type="number"
                                      className="w-8 bg-transparent text-center focus:outline-none"
                                      {...register("taxRate", { valueAsNumber: true })}
                                    />
                                    ٪)
                              </span>
                          )}:
                      </Label>
                  </div>
                  {taxEnabled && (
                      <span className="font-medium">{formatCurrency(taxAmount)} +</span>
                  )}
              </div>
              
              <div className="my-4"></div>
              
              <div className="flex flex-col gap-1 p-4 border border-1 border-gray-200 bg-gray-100 rounded-[10px] ">
                  <div className="flex justify-between items-center">
                      <span className="flex items-center gap-2 text-lg font-bold text-black">مبلغ قابل پرداخت:

                        <div className="text-sm font-semibold text-gray-500 print:border-none print:p-0 print:bg-transparent">
                              <span className="font-bold"> </span>
                              {numberToPersianWords(totalAmount)}
                        </div> 
                      </span>

                      <span className="text-lg font-black text-black px-2 py-1 print:bg-transparent print:p-0">
                          {formatCurrency(totalAmount)} <span className="text-xs font-normal">ریال</span>
                      </span>

                  </div>

              </div>
            </div>

          </div>

          {/* بخش پایینی: محاسبات و توضیحات */}
          <div className="flex flex-col md:flex-row border-t border-gray-300 break-inside-avoid mx-6 pt-3">
            
            {/* سمت راست: توضیحات */}
            <div className="w-full">
              <h3 className="font-bold text-slate-800 mb-4 inline-block">توضیحات و شرایط فروش:</h3>
              
              <div className="space-y-2 text-sm">
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
                placeholder="توضیحات تکمیلی خاص این فاکتور..."
                className="mt-4 resize-none border-gray-200 text-sm min-h-[60px] print:border-none print:p-0"
              />

              <div className="mt-6 pt-4">
                 <div className="print:hidden mb-2">
                    <RadioGroup 
                        defaultValue="none" 
                        onValueChange={(val: "none" | "mellat" | "refah") => setValue("selectedBank", val)}
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
                            <RadioGroupItem value="refah" id="r3" />
                            <Label htmlFor="r3">بانک رفاه</Label>
                        </div>
                    </RadioGroup>
                 </div>

                 {selectedBank === 'mellat' && (
                    <div className="bg-gray-100 p-4 rounded-[15px] border border-gray-200 text-sm text-slate-700 print:bg-transparent print:border-none print:p-0">
                        <p className="font-bold">شماره حساب: شرکت البرز برج - بانک ملت</p>
                        <div className="flex gap-4 mt-1 flex-wrap">
                            <span>کارت: <span className="font-mono font-bold tracking-wider">6104338800950608</span></span>
                            <span>شبا: <span className="font-mono">IR 130120000000009197647629</span></span>
                        </div>
                    </div>
                 )}

                 {selectedBank === 'refah' && (
                    <div className="bg-gray-100 p-4 rounded-[15px] border border-gray-200 text-sm text-slate-700 print:bg-transparent print:border-none print:p-0">
                        <p className="font-bold">شماره حساب: بنیامین سجادی - بانک رفاه</p>
                        <div className="flex gap-4 mt-1 flex-wrap">
                            <span>کارت: <span className="font-mono font-bold tracking-wider">5894631161108360</span></span>
                            <span>شبا: <span className="font-mono">IR 420130100000000321344765</span></span>
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
            {/* سمت چپ: محاسبات مالی (تغییر یافته) */}
          </div>

            <div className="w-full p-6 print:bg-transparent">
              
              {/* محل امضا */}
              <div className="hidden print:block mt-16 pt-8">
                  <div className="grid grid-cols-2 gap-4 text-center">
                      <div>
                          <p className="text-xs font-bold mb-8 text-gray-600">مهر و امضای فروشنده</p>
                          <div className="border-b border-gray-400 w-2/3 mx-auto"></div>
                      </div>
                      <div>
                          <p className="text-xs font-bold mb-8 text-gray-600">مهر و امضای خریدار</p>
                          <div className="border-b border-gray-400 w-2/3 mx-auto"></div>
                      </div>
                  </div>
              </div>

            </div>
          
        </CardContent>
      </Card>


      <style jsx global>{`
          @media print {
              @page {
                  /* تنظیم حاشیه‌ها برای حالت چاپ */
                  margin-top: 2cm;    /* فضای خالی بالا برای سربرگ */
                  margin-bottom: 2.5cm; /* فضای خالی پایین برای فوتر یا امضاها */
                  margin-left: 1cm;
                  margin-right: 1cm;
              }
              body {
                  background: white;
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
      `}</style>

    </div>
  );
}