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
    <div className="min-h-screen bg-neutral-50 pt-32">
      <Helmet>
        <title>Big Board | Our Philly</title>
      </Helmet>
      <Navbar />
      <div className="max-w-3xl mx-auto px-4">
        <h1 className="text-4xl font-[Barrio] text-center mb-8">Big Board</h1>
        <div className="space-y-6">
          {notices.map(n => (
            <div key={n.id} className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">{new Date(n.created_at).toLocaleString()}</div>
              <Link to={`/groups/${n.group_slug}`} className="font-semibold text-indigo-600">
                {n.group_name}
              </Link>
              <p className="mt-2">{n.content}</p>
              <a
                href={n.proof_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 text-sm mt-2 inline-block"
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

