import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import Navbar from './Navbar';
import Footer from './Footer';
import { supabase } from './supabaseClient';

export default function BigBoard() {
  const [notices, setNotices] = useState([]);

  useEffect(() => {
    supabase
      .from('community_bulletin_latest')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => setNotices(data || []));
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      <Helmet>
        <title>Big Board | Our Philly</title>
      </Helmet>
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 pt-32 pb-16">
        <h1 className="text-5xl font-[Barrio] text-center text-indigo-900">Big Board</h1>
        <p className="text-center text-lg text-indigo-700 mt-2 mb-10">
          A friendly neighborhood bulletin.{' '}
          <Link to="/groups" className="underline font-semibold">
            Visit a group page
          </Link>{' '}
          to leave your own notice.
        </p>
        <div className="space-y-4">
          {notices.map(n => (
            <div key={n.id} className="bg-white rounded-xl shadow p-5 border-l-4 border-indigo-500">
              <div className="text-xs text-gray-500">{new Date(n.created_at).toLocaleDateString()}</div>
              <Link
                to={`/groups/${n.group_slug}`}
                className="block text-lg font-semibold text-indigo-700"
              >
                {n.group_name}
              </Link>
              <p className="mt-1 text-gray-700">{n.content}</p>
              <a
                href={n.proof_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 text-sm underline mt-2 inline-block"
              >
                Proof
              </a>
            </div>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
}

