import fs from 'fs';
import path from 'path';
import webpush from 'web-push';

// 1. Permanent VAPID Keys for Class XII Birthday Tracker
const DEFAULT_PUBLIC_KEY = 'BOikmHgA-OpCLC2tdLLJvaT93m2OMtqieOeOYlbExtjPocenhXbNpanbVUpwtqr42kWKIxHwRB8gobiI8VqxtGA';
const DEFAULT_PRIVATE_KEY = '2Nmu6tgEE2kK9lfx3hSErgtH0vzFdzq27XUN9V0tdFA';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || DEFAULT_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || DEFAULT_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:class12birthdays@gmail.com';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// 2. Load all 232 students from data files
function loadStudents() {
  let all = [];
  for (const file of ['s0.js', 's1.js', 's2.js', 's3.js']) {
    const fp = path.resolve(process.cwd(), file);
    if (fs.existsSync(fp)) {
      const code = fs.readFileSync(fp, 'utf-8');
      const match = code.match(/concat\((\[[\s\S]*?\])\);/);
      if (match) {
        try {
          all = all.concat(JSON.parse(match[1]));
        } catch (e) {
          console.warn(`Failed to parse ${file}:`, e.message);
        }
      }
    }
  }
  return all.map(s => ({
    name: s.n,
    month: s.m,
    day: s.d,
    gender: s.g === 1 ? 'GIRLS' : 'BOYS',
    section: s.s || 'A',
    roll: s.r,
    dob: s.dob || ''
  }));
}

// 3. Load active Push Subscriptions
async function loadSubscriptions() {
  const subscriptions = [];

  // Source A: Environment variable PUSH_SUBSCRIPTIONS (e.g. GitHub Secret)
  if (process.env.PUSH_SUBSCRIPTIONS) {
    try {
      const parsed = JSON.parse(process.env.PUSH_SUBSCRIPTIONS);
      if (Array.isArray(parsed)) {
        subscriptions.push(...parsed);
      } else if (parsed.endpoint) {
        subscriptions.push(parsed);
      }
    } catch (e) {
      console.warn('Failed to parse PUSH_SUBSCRIPTIONS env variable:', e.message);
    }
  }

  // Source B: Local JSON file data/subscriptions.json
  const dataFile = path.resolve(process.cwd(), 'data', 'subscriptions.json');
  if (fs.existsSync(dataFile)) {
    try {
      const fileData = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
      if (Array.isArray(fileData)) {
        subscriptions.push(...fileData);
      }
    } catch (e) {
      console.warn('Failed to read data/subscriptions.json:', e.message);
    }
  }

  // Source C: Remote API / Cloudflare KV / Supabase if configured
  if (process.env.SUBSCRIPTIONS_API_URL) {
    try {
      const res = await fetch(process.env.SUBSCRIPTIONS_API_URL, {
        headers: process.env.SUBSCRIPTIONS_API_KEY ? { 'Authorization': `Bearer ${process.env.SUBSCRIPTIONS_API_KEY}` } : {}
      });
      if (res.ok) {
        const remoteSubs = await res.json();
        if (Array.isArray(remoteSubs)) {
          subscriptions.push(...remoteSubs);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch remote subscriptions:', e.message);
    }
  }

  // Deduplicate by endpoint
  const map = new Map();
  for (const s of subscriptions) {
    if (s && s.endpoint) {
      map.set(s.endpoint, s);
    }
  }
  return Array.from(map.values());
}

async function run() {
  const isDryRun = process.argv.includes('--dry-run') || process.argv.includes('--test');

  // Compute Indian Standard Time (IST)
  const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const month = nowIST.getMonth() + 1;
  const day = nowIST.getDate();

  console.log(`[Midnight Cron] Triggered for date (IST): Day ${day}, Month ${month} (${nowIST.toLocaleDateString('bn-BD', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })})`);

  const students = loadStudents();
  const birthdaysToday = students.filter(s => s.month === month && s.day === day);

  console.log(`[Midnight Cron] Found ${birthdaysToday.length} birthday(s) today.`);

  let payload = null;
  if (birthdaysToday.length === 1) {
    const s = birthdaysToday[0];
    payload = {
      title: `🎉 আজ ${s.name}-এর জন্মদিন! 🎂`,
      body: `Class XII (সেকশন ${s.section} · রোল ${s.roll}) · বন্ধুদের জন্মদিনের শুভেচ্ছা জানাতে এখনই ট্যাপ করুন!`,
      icon: 'favicon.svg',
      url: 'https://jmaity434.github.io/class-xii-birthday-tracker/'
    };
  } else if (birthdaysToday.length > 1) {
    const names = birthdaysToday.map(s => s.name).join(', ');
    payload = {
      title: `🎉 আজ ${birthdaysToday.length} জন বন্ধুর জন্মদিন! 🎂`,
      body: `${names} · বন্ধুদের জন্মদিনের শুভেচ্ছা জানাতে এখনই ট্যাপ করুন!`,
      icon: 'favicon.svg',
      url: 'https://jmaity434.github.io/class-xii-birthday-tracker/'
    };
  } else {
    console.log('[Midnight Cron] No birthdays today. Web Push skipped.');
    if (!isDryRun) {
      return;
    }
    // For testing dry-run:
    payload = {
      title: '🎉 Class XII Birthday Tracker 🎂',
      body: 'আজ ক্লাসে কারো জন্মদিন নেই, পরবর্তী জন্মদিন দেখতে ট্র্যাকার খুলুন!',
      icon: 'favicon.svg',
      url: 'https://jmaity434.github.io/class-xii-birthday-tracker/'
    };
  }

  console.log('[Midnight Cron] Push Payload:', JSON.stringify(payload, null, 2));

  const subscriptions = await loadSubscriptions();
  console.log(`[Midnight Cron] Total registered subscriptions to notify: ${subscriptions.length}`);

  if (isDryRun) {
    console.log('[Midnight Cron] Dry-run complete. Exiting without network push.');
    return;
  }

  if (subscriptions.length === 0) {
    console.log('[Midnight Cron] No push subscriptions found in storage/secrets. Web push ready for when users subscribe.');
    return;
  }

  let successCount = 0;
  let failureCount = 0;

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(sub, JSON.stringify(payload));
      successCount++;
    } catch (err) {
      failureCount++;
      console.warn(`[Midnight Cron] Failed to send to endpoint ${sub.endpoint.slice(0, 45)}... -> ${err.statusCode || err.message}`);
    }
  }

  console.log(`[Midnight Cron] Notifications finished! Delivered: ${successCount}, Failed/Expired: ${failureCount}`);
}

run().catch(err => {
  console.error('[Midnight Cron Error]', err);
  process.exit(1);
});
