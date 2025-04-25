import React from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from './supabaseClient';
import Navbar from './Navbar';
import GroupsHeroSearch from './GroupsHeroSearch';
import GroupsList from './GroupsList';
import FilteredGroupSection from './FilteredGroupSection';
import GroupProgressBar from './GroupProgressBar';
import Footer from './Footer';

const GroupsPage = () => {
  const [groups, setGroups] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedType, setSelectedType] = React.useState([]);

  React.useEffect(() => {
    const fetchGroups = async () => {
      const { data, error } = await supabase.from('groups').select('*');
      if (error) {
        console.error('Error fetching groups:', error);
      } else {
        setGroups(data);
      }
      setLoading(false);
    };
    fetchGroups();
  }, []);

  const filteredGroups = groups.filter((group) => {
    const name = group.Name?.toLowerCase() || '';
    const types = group.Type?.split(',').map((t) => t.trim()) || [];
    return (
      name.includes(searchTerm.toLowerCase()) &&
      (selectedType.length === 0 || selectedType.some((t) => types.includes(t)))
    );
  });

  // build JSON-LD for SEO
  const listSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: groups.map((group, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      url: `https://ourphilly.com/groups/${group.slug}`,
      name: group.Name
    }))
  };

  return (
    <>
      <Helmet>
        <title>Philly Groups – Neighborhood Crews & Clubs | Our Philly</title>
        <link rel="icon" href="/favicon.ico" />
        <meta name="description" content="From sports leagues to social crews, explore Philly's most active local groups and communities." />
        <meta name="keywords" content="Philadelphia groups, Philly clubs, Philly social groups, Philly community, Philly rec sports" />
        <link rel="canonical" href="https://ourphilly.com/groups" />
        <meta property="og:title" content="Philly Groups – Our Philly" />
        <meta property="og:description" content="Discover Philly's coolest local groups, sports leagues, and social crews." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://ourphilly.com/groups" />
        <meta property="og:image" content="https://your-image-url.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Philly Groups – Our Philly" />
        <meta name="twitter:description" content="Explore Philly's most active groups and crews." />
        <meta name="twitter:image" content="https://your-image-url.png" />

        {/* JSON-LD structured data for list of groups */}
        <script type="application/ld+json">
          {JSON.stringify(listSchema, null, 2)}
        </script>
      </Helmet>

      <div className="min-h-screen bg-white-50 pt-20">
        <Navbar />
        <div className="w-full">
          <GroupProgressBar />
        </div>

        <div className="max-w-screen-xl mx-auto px-4">
          {loading ? (
            <div className="text-center py-20 text-gray-500">Loading Groups...</div>
          ) : (
            <>
              <GroupsHeroSearch
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                selectedType={selectedType}
                setSelectedType={setSelectedType}
                allGroups={groups}
              />

              <GroupsList groups={filteredGroups} isAdmin={false} />

              <FilteredGroupSection
                tag="Arts"
                title="Creative & Arts Groups"
                seeMoreLink="/groups/type/arts"
              />

              <FilteredGroupSection
                tag="Sports Fans"
                title="Groups for Philly Sports Fans"
                seeMoreLink="/groups/type/sports-fans"
              />
              <Footer />
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default GroupsPage;
