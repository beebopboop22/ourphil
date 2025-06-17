import React, { useEffect, useState, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from './supabaseClient';
import { Link } from 'react-router-dom';
import Navbar from './Navbar';
import GroupsHeroSearch from './GroupsHeroSearch';
import GroupProgressBar from './GroupProgressBar';
import SubmitGroupModal from './SubmitGroupModal';
import Footer from './Footer';

/**
 * GroupsPage
 * ----------
 * Displays a paginated 5×5 grid of group cards with search.
 * Includes an "Add Your Group" tile that opens the SubmitGroupModal.
 */
export default function GroupsPage() {
  // Fetched groups
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search term
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination state
  const [page, setPage] = useState(1);

  // Modal state for adding groups
  const [showSubmitModal, setShowSubmitModal] = useState(false);

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
    return groups.filter(g => (g.Name || '').toLowerCase().includes(term));
  }, [groups, searchTerm]);

  // Determine groups to display
  const itemsPerPage = 25;
  const displayedGroups = filtered.slice(0, page * itemsPerPage);

  // Handler for See More
  const handleSeeMore = () => setPage(prev => prev + 1);

  return (
    <>
      <Helmet>
        <title>Philly Groups – Search & Discover Local Crews | Our Philly</title>
        <meta
          name="description"
          content="Search and discover Philadelphia’s local groups—from sports leagues and fitness crews to hobby clubs. Join your neighborhood communities today."
        />
        <link rel="canonical" href="https://www.ourphilly.org/groups" />
      </Helmet>

      <div className="min-h-screen bg-neutral-50 pt-20">
        <Navbar />
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
            <div className="text-center py-20 text-gray-500">Loading Groups...</div>
          ) : (
            <>
              {/* Grid 5×5 with Add Group tile */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {/* Add Your Group tile */}
                <button
                  onClick={() => setShowSubmitModal(true)}
                  className="flex flex-col items-center bg-white rounded-lg overflow-hidden shadow hover:shadow-lg transition"
                >
                  <div className="h-32 bg-white-100 flex items-center justify-center">
                    <span className="text-4xl text-green-600">➕</span>
                  </div>
                  <div className="py-2 text-center text-sm font-medium text-gray-900">
                    Add Your Group
                  </div>
                </button>

                {/* Existing group cards */}
                {displayedGroups.map(group => (
                  <Link
                    key={group.id}
                    to={`/groups/${group.slug}`}
                    className="block bg-white rounded-lg overflow-hidden shadow hover:shadow-lg transition"
                  >
                    <div className="h-32 bg-gray-100">
                      <img
                        src={group.imag}
                        alt={group.Name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="py-2 text-center text-sm font-medium text-gray-900">
                      {group.Name}
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

        {/* Submit Group Modal */}
        {showSubmitModal && (
          <SubmitGroupModal onClose={() => setShowSubmitModal(false)} />
        )}

        <Footer />
      </div>
    </>
  );
}
