// src/AdminDashboard.jsx
import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { AuthContext } from './AuthProvider';
import { supabase } from './supabaseClient';
import Navbar from './Navbar';
import Footer from './Footer';
import {
  UsersIcon,
  ClipboardDocumentListIcon,
  StarIcon,
  FolderIcon,
  CalendarDaysIcon,
} from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
);

export default function AdminDashboard() {
  const { user } = useContext(AuthContext);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState(null);
  const [signupSeries, setSignupSeries] = useState({ labels: [], data: [] });

  // only you (bill@solar-states.com) should see these links
  useEffect(() => {
    if (user?.email === 'bill@solar-states.com') {
      setAuthorized(true);
      loadMetrics();
    }
  }, [user]);

  async function loadMetrics() {
    setLoading(true);
    const today = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(today.getDate() - 6);

    const [u, g, e, c, r, signups] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('groups').select('*', { count: 'exact', head: true }),
      supabase.from('events').select('*', { count: 'exact', head: true }),
      supabase
        .from('group_claim_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Pending'),
      supabase.from('reviews').select('*', { count: 'exact', head: true }),
      supabase
        .from('users')
        .select('id, created_at')
        .gte('created_at', weekAgo.toISOString()),
    ]);

    setMetrics({
      users: u.count || 0,
      groups: g.count || 0,
      events: e.count || 0,
      claims: c.count || 0,
      reviews: r.count || 0,
    });

    const counts = Array(7).fill(0);
    signups.data?.forEach((uRec) => {
      const d = new Date(uRec.created_at);
      d.setHours(0, 0, 0, 0);
      const idx = Math.floor((d - weekAgo) / (1000 * 60 * 60 * 24));
      if (idx >= 0 && idx < 7) counts[idx] += 1;
    });
    const labels = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(weekAgo);
      d.setDate(weekAgo.getDate() + i);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    setSignupSeries({ labels, data: counts });
    setLoading(false);
  }

  if (!authorized) {
    return <div className="text-center py-20 text-gray-500">Access denied.</div>;
  }

  if (loading || !metrics) {
    return <div className="text-center py-20">Loading dashboard…</div>;
  }

  const chartData = {
    labels: signupSeries.labels,
    datasets: [
      {
        label: 'Signups',
        data: signupSeries.data,
        fill: true,
        backgroundColor: 'rgba(99,102,241,0.2)',
        borderColor: 'rgba(99,102,241,1)',
        tension: 0.3,
      },
    ],
  };

  const chartOptions = {
    plugins: { legend: { display: false } },
    responsive: true,
    maintainAspectRatio: false,
  };

  return (
    <div className="min-h-screen bg-neutral-50 pt-20 flex flex-col">
      <Navbar />
      <main className="flex-grow max-w-screen-xl mx-auto p-6 space-y-8">
        <h1 className="text-4xl font-[Barrio] text-center mb-4">Admin Cockpit</h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <MetricCard
            icon={<UsersIcon className="w-6 h-6" />}
            label="Users"
            value={metrics.users}
            link="/admin/users"
          />
          <MetricCard
            icon={<FolderIcon className="w-6 h-6" />}
            label="Groups"
            value={metrics.groups}
            link="/admin/updates"
          />
          <MetricCard
            icon={<CalendarDaysIcon className="w-6 h-6" />}
            label="Events"
            value={metrics.events}
            link="/events"
          />
          <MetricCard
            icon={<ClipboardDocumentListIcon className="w-6 h-6" />}
            label="Pending Claims"
            value={metrics.claims}
            link="/admin/claims"
          />
          <MetricCard
            icon={<StarIcon className="w-6 h-6" />}
            label="Reviews"
            value={metrics.reviews}
            link="/admin/reviews"
          />
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Signups Last 7 Days</h2>
          <div className="h-64">
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>

        <div className="text-center">
          <Link to="/admin/activity" className="text-indigo-600 hover:underline">
            View Recent Activity
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function MetricCard({ icon, label, value, link }) {
  return (
    <Link
      to={link}
      className="bg-white rounded-lg shadow p-4 flex items-center space-x-4 hover:shadow-md transition"
    >
      {icon}
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
    </Link>
  );
}
