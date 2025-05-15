// src/AdminDashboard.jsx
import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from './AuthProvider';
import Navbar from './Navbar';
import Footer from './Footer';

export default function AdminDashboard() {
  const { user } = useContext(AuthContext);
  const [authorized, setAuthorized] = useState(false);

  // only you (bill@solar-states.com) should see these links
  useEffect(() => {
    if (user?.email === 'bill@solar-states.com') setAuthorized(true);
  }, [user]);

  if (!authorized) {
    return <div className="text-center py-20 text-gray-500">Access denied.</div>;
  }

  return (
    <div className="min-h-screen bg-neutral-50 pt-20 flex flex-col">
      <Navbar />
      <main className="flex-grow max-w-screen-xl mx-auto p-6">
        <h1 className="text-4xl font-[Barrio] mb-8 text-center">Admin Dashboard</h1>
        <ul className="space-y-4 text-lg">
          <li><Link to="/admin/users" className="text-indigo-600 hover:underline">Manage Users</Link></li>
          <li><Link to="/admin/claims" className="text-indigo-600 hover:underline">Group Claim Requests</Link></li>
          <li><Link to="/admin/reviews" className="text-indigo-600 hover:underline">Manage Reviews</Link></li>
          <li><Link to="/admin/updates" className="text-indigo-600 hover:underline">Manage Group Updates</Link></li>
          <li><Link to="/admin/activity" className="text-indigo-600 hover:underline">Activity Feed</Link></li>
        </ul>
      </main>
      <Footer />
    </div>
  );
}
