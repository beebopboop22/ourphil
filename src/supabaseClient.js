import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qdartpzrxmftmaftfdbd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkYXJ0cHpyeG1mdG1hZnRmZGJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMxMDc3OTgsImV4cCI6MjA1ODY4Mzc5OH0.maFYGLz62w4n-BVERIvbxhIewzjPkkqJgXAn61FmIA8';

let storage;
let persistSession = false;
try {
  if (typeof globalThis.localStorage !== 'undefined') {
    storage = globalThis.localStorage;
    persistSession = true;
  }
} catch {
  // In some mobile browsers (e.g., Safari private mode) localStorage
  // is unavailable or throws. Fall back to in-memory storage so Supabase
  // still works and events load.
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage,
    persistSession,
  },
});
