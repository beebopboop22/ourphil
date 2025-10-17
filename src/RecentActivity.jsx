import React, { useEffect, useState, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from './supabaseClient';
import { AuthContext } from './AuthProvider';
import { Link } from 'react-router-dom';
import { getDetailPathForItem } from './utils/eventDetailPaths.js';

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
          user_id,
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
  const detailPath = getDetailPathForItem({
    ...(r.events || {}),
    slug,
  });
  // Only show "You" if there is a logged-in user AND they match the review's user_id
  const who = user && r.user_id === user.id ? 'You' : 'A total stranger';

  return (
    <section className="relative w-full mx-auto p-4 bg-gray-100 rounded-lg shadow overflow-hidden">
      

<div className="relative z-10 h-12 flex items-center justify-center overflow-hidden space-x-2">
  <img
    src={MASCOT_URL}
    alt="Mascot"
    className="w-8 h-8 flex-shrink-0"
  />
  <AnimatePresence mode="wait">
    <motion.div
      key={r.id}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.6 }}
      className="text-lg"
    >
      {who} just reviewed{' '}
      {detailPath ? (
        <Link to={detailPath} className="font-semibold text-indigo-600 hover:underline">
          {name}
        </Link>
      ) : (
        <span className="font-semibold text-gray-900">{name}</span>
      )}
    </motion.div>
  </AnimatePresence>
</div>

    </section>
  );
}
