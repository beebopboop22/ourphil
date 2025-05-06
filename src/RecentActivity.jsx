// src/RecentActivity.jsx
import React, { useEffect, useState, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from './supabaseClient';
import { AuthContext } from './AuthProvider';
import { Link } from 'react-router-dom';

const MASCOT_URL =
  'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images/Our-Philly-Concierge_Illustration-1.png';

export default function RecentActivity() {
  const { user } = useContext(AuthContext);
  const [items, setItems] = useState([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 1. Fetch latest 10 reviews + event slug & name
  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from('reviews')
        .select(`
          id,
          created_at,
          events (
            slug,
            name:"E Name"
          )
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error(error);
        setError(error);
      } else {
        setItems(data);
      }
      setLoading(false);
    }
    load();
  }, []);

  // 2. Rotate index every 10s
  useEffect(() => {
    if (items.length > 1) {
      const iv = setInterval(() => {
        setIdx((i) => (i + 1) % items.length);
      }, 10000);
      return () => clearInterval(iv);
    }
  }, [items]);

  if (loading) return <p className="text-center py-4">Loading recent reviews…</p>;
  if (error || items.length === 0)
    return <p className="text-center py-4 text-red-600">No recent activity.</p>;

  const r = items[idx];
  const name = r.events?.name || 'an event';
  const slug = r.events?.slug || '';
  const who = r.user_id === user?.id ? 'You' : 'A total stranger';

  return (
    <section className="relative w-full mx-auto my-12 p-4 bg-white rounded-lg shadow overflow-hidden">
      {/* Mascots */}
      <img
        src={MASCOT_URL}
        alt="Mascot"
        className="absolute left-0 bottom-0 w-24 opacity-80 pointer-events-none z-0"
      />
      <img
        src={MASCOT_URL}
        alt="Mascot"
        className="absolute right-0 top-0 w-20 opacity-60 pointer-events-none transform rotate-180 z-0"
      />

      {/* Text + animation must be above mascots */}
      <div className="relative z-10 h-12 flex items-center justify-center overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.6 }}
            className="text-lg text-center"
          >
            {who} just reviewed{' '}
            <Link
              to={`/events/${slug}`}
              className="font-semibold text-indigo-600 hover:underline"
            >
              {name}
            </Link>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
