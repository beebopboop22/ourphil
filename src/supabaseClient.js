import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qdartpzrxmftmaftfdbd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkYXJ0cHpyeG1mdG1hZnRmZGJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMxMDc3OTgsImV4cCI6MjA1ODY4Mzc5OH0.maFYGLz62w4n-BVERIvbxhIewzjPkkqJgXAn61FmIA8';

export const supabase = createClient(supabaseUrl, supabaseKey);
