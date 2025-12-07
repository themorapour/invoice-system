// src/app/api/invoices/route.ts

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase'; // اتصال Supabase را وارد می کنیم

export async function POST(request: Request) {
  try {
    const dataToSend = await request.json();

    // 1. داده های کلیدی را برای درج آماده می کنیم
    const { 
        invoiceNumber, 
        buyerName, 
        ...invoiceData 
    } = dataToSend;

    // 2. درج داده در جدول invoices
    const { data, error } = await supabase
      .from('invoices')
      .insert([
        { 
          invoice_number: invoiceNumber, // ستون int4
          buyer_name: buyerName,         // ستون text
          invoice_data: invoiceData      // ستون jsonb (تمام بقیه داده ها اینجا ذخیره می شوند)
        }
      ])
      .select('id') // فقط آیدی جدید را برمی گردانیم
      .single();

    if (error) {
        console.error("Supabase Insert Error:", error);
        return NextResponse.json({ error: "Failed to save invoice to database.", details: error.message }, { status: 500 });
    }

    // 3. در صورت موفقیت، فاکتور ذخیره شده را تایید می کنیم
    return NextResponse.json({ 
      message: "Invoice successfully saved.", 
      id: invoiceNumber, // شماره فاکتور را برای نمایش به کاربر برمی گردانیم
      db_id: data.id 
    }, { status: 201 });

  } catch (error) {
    console.error("API Processing Error:", error);
    return NextResponse.json({ error: "An unexpected error occurred during API processing." }, { status: 500 });
  }
}