// next.config.js
// --- بخش تنظیم PWA ---
const withPWA = require('next-pwa')({
  dest: 'public',
  // در محیط production (Vercel) این خط باید حذف شود یا false باشد
  disable: process.env.NODE_ENV === 'development', 
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // اگر نیاز به تنظیمات خاص دیگری دارید، اینجا اضافه کنید
  reactStrictMode: true,
};

// --- Export کردن نهایی ---
// Next.js انتظار دارد که از module.exports استفاده کنید.
module.exports = withPWA(nextConfig);