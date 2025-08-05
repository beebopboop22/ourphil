// src/GroupsPage.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from './supabaseClient';
import { Link } from 'react-router-dom';
import Navbar from './Navbar';
import GroupsHeroSearch from './GroupsHeroSearch';
import GroupProgressBar from './GroupProgressBar';
import SubmitGroupModal from './SubmitGroupModal';
import Footer from './Footer';
import GroupMatchWizard from './GroupMatchWizard';
import GroupMatchPromo from './GroupMatchPromo';

export default function GroupsPage() {
  // Pill styles for group types
  const pillStyles = [
    'bg-green-100 text-indigo-800',
    'bg-teal-100 text-teal-800',
    'bg-pink-100 text-pink-800',
    'bg-blue-100 text-blue-800',
    'bg-orange-100 text-orange-800',
    'bg-yellow-100 text-yellow-800',
    'bg-purple-100 text-purple-800',
    'bg-red-100 text-red-800',
  ];

  // Fetched groups
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search term
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination state
  const [page, setPage] = useState(1);
  const itemsPerPage = 25;

  // Modal state for adding groups
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  // Modal state for match wizard
  const [showMatchModal, setShowMatchModal] = useState(false);

  const openAddGroup = () => {
    setShowMatchModal(false);
    setShowSubmitModal(true);
  };

  // Fetch groups on mount
  useEffect(() => {
    async function fetchGroups() {
      const { data, error } = await supabase.from('groups').select('*');
      if (error) console.error('Error fetching groups:', error);
      else setGroups(data);
      setLoading(false);
    }
    fetchGroups();
  }, []);

  // Filter by search term
  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return groups.filter(g =>
      (g.Name || '').toLowerCase().includes(term)
    );
  }, [groups, searchTerm]);

  // Determine groups to display
  const displayedGroups = filtered.slice(0, page * itemsPerPage);

  // Handler for See More
  const handleSeeMore = () => setPage(prev => prev + 1);

  return (
    <>
      <Helmet>
        <title>
          Philly Groups – Search & Discover Local Crews | Our Philly
        </title>
        <meta
          name="description"
          content="Search and discover Philadelphia’s local groups—from sports leagues and fitness crews to hobby clubs. Join your neighborhood communities today."
        />
        <link rel="canonical" href="https://www.ourphilly.org/groups" />
      </Helmet>

      <div className="min-h-screen bg-neutral-50">
        <Navbar />
        <div className="pt-20">
          {/* Match Wizard Promo Section */}
          <div className="max-w-screen-xl mx-auto px-4 mb-6">
            <GroupMatchPromo
              groups={groups}
              onStart={() => setShowMatchModal(true)}
              onAddGroup={openAddGroup}
            />
          </div>

          <GroupProgressBar />

          {/* Search */}
          <div className="max-w-screen-xl mx-auto px-4 mb-6">
            <GroupsHeroSearch
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
            />
          </div>

          <div className="max-w-screen-xl mx-auto px-4 mb-20">
          {loading ? (
            <div className="text-center py-20 text-gray-500">
              Loading Groups...
            </div>
          ) : (
            <>
              {/* Add Your Group row */}
              <button
                onClick={() => setShowSubmitModal(true)}
                className="w-full flex items-center bg-white rounded-lg overflow-hidden shadow hover:shadow-lg transition mb-6"
              >
                <div className="w-32 h-32 flex-shrink-0 flex items-center justify-center bg-gray-100">
                  <span className="text-5xl text-green-600">➕</span>
                </div>
                <div className="p-4">
                  <h2 className="text-2xl font-semibold text-gray-900">
                    Add Your Group
                  </h2>
                  <p className="mt-1 text-gray-600">
                    Submit a new community group
                  </p>
                </div>
              </button>

              {/* Full-width rows */}
              <div className="space-y-4">
                {displayedGroups.map(group => (
                  <Link
                    key={group.id}
                    to={`/groups/${group.slug}`}
                    className="w-full flex bg-white rounded-lg overflow-hidden shadow hover:shadow-lg transition"
                  >
                    {/* Left: Image */}
                    <div className="w-32 h-32 flex-shrink-0 bg-gray-100">
                      {group.imag ? (
                        <img
                          src={group.imag}
                          alt={group.Name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          No Image
                        </div>
                      )}
                    </div>

                    {/* Right: Details */}
                    <div className="p-4 flex-1">
                      <h2 className="text-2xl font-semibold text-gray-900">
                        {group.Name}
                      </h2>
                      <p className="mt-2 text-gray-700">
                        {group.Description || 'No description available.'}
                      </p>

                      {/* Group Type Pills */}
                      {group.Type && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {group.Type.split(',').map((type, i) => {
                            const t = type.trim();
                            const slug = t.toLowerCase().replace(/\s+/g, '-');
                            const style = pillStyles[i % pillStyles.length];
                            return (
                              <Link
                                key={i}
                                to={`/groups/type/${slug}`}
                                className={`${style} px-2 py-1 rounded-full text-xs font-semibold`}
                              >
                                {t}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>

              {/* See More */}
              {displayedGroups.length < filtered.length && (
                <div className="flex justify-center mt-8">
                  <button
                    onClick={handleSeeMore}
                    className="bg-indigo-600 text-white px-6 py-2 rounded-full hover:bg-indigo-700 transition"
                  >
                    See More
                  </button>
                </div>
              )}
            </>
          )}
          </div>

          {/* Match Wizard Modal */}
          {showMatchModal && (
            <GroupMatchWizard
              onClose={() => setShowMatchModal(false)}
              onAddGroup={openAddGroup}
            />
          )}

          {/* Submit Group Modal */}
          {showSubmitModal && (
            <SubmitGroupModal onClose={() => setShowSubmitModal(false)} />
          )}

          <Footer />
        </div>
      </div>
    </>
  );
}
