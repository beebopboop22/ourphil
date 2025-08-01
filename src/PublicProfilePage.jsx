import React, { useEffect, useState, useContext } from 'react';
import { useParams } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import SavedEventCard from './SavedEventCard.jsx';
import { supabase } from './supabaseClient';
import { AuthContext } from './AuthProvider';
import useFollow from './utils/useFollow';

export default function PublicProfilePage() {
  const { slug } = useParams();
  const { user } = useContext(AuthContext);
  const [profile, setProfile] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    supabase
      .from('profiles')
      .select('id,username,image_url,slug')
      .eq('slug', slug)
      .single()
      .then(({ data }) => {
        setProfile(data || null);
      });
  }, [slug]);

  const { isFollowing, toggleFollow, loading: followLoading } = useFollow(profile?.id);

  useEffect(() => {
    if (!profile) return;
    const load = async () => {
      setLoading(true);
      const today = new Date().toISOString().slice(0, 10);
      const all = [];

      // big board events via posts
        const { data: bbPosts, error: bbErr } = await supabase
          .from('big_board_posts')
          .select(
            'image_url,big_board_events!big_board_posts_event_id_fkey(id,slug,title,start_date,start_time)'
          )
          .eq('user_id', profile.id)
          .gte('big_board_events.start_date', today)
          .order('big_board_events.start_date', { ascending: true });
        if (bbErr) console.error(bbErr);
        bbPosts?.forEach(post => {
        const ev = post.big_board_events?.[0];
        if (!ev) return;
        let img = '';
        if (post.image_url) {
          const {
            data: { publicUrl },
          } = supabase.storage.from('big-board').getPublicUrl(post.image_url);
          img = publicUrl;
        }
        all.push({
          id: ev.id,
          slug: ev.slug,
          title: ev.title,
          start_date: ev.start_date,
          start_time: ev.start_time,
          image: img,
          source_table: 'big_board_events',
        });
      });

      // group events
        const { data: ge, error: geErr } = await supabase
          .from('group_events')
          .select('id,slug,title,start_date,start_time,groups(slug,imag)')
          .eq('user_id', profile.id)
          .gte('start_date', today)
          .order('start_date', { ascending: true });
        if (geErr) console.error(geErr);
        ge?.forEach(ev => {
        all.push({
          id: ev.id,
          slug: ev.slug,
          title: ev.title,
          start_date: ev.start_date,
          start_time: ev.start_time,
          image: ev.groups?.imag || ev.groups?.[0]?.imag || '',
          group: ev.groups ? { slug: ev.groups.slug } : ev.groups?.[0] ? { slug: ev.groups[0].slug } : null,
          source_table: 'group_events',
        });
      });

      const parseISO = str => {
        const [y,m,d] = str.split('-').map(Number);
        return new Date(y, m-1, d);
      };
      const todayObj = new Date();
      todayObj.setHours(0,0,0,0);
      const upcoming = all
        .map(ev => ({ ...ev, _d: parseISO(ev.start_date) }))
        .filter(ev => ev._d && ev._d >= todayObj)
        .sort((a,b) => a._d - b._d)
        .map(({ _d, ...rest }) => rest);
      setEvents(upcoming);
      setLoading(false);
    };
    load();
  }, [profile]);

  if (profile === null) {
    return (
      <div className="min-h-screen bg-neutral-50 pb-12 pt-20">
        <Navbar />
        <div className="py-20 text-center">Profile not found.</div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 pb-12 pt-20">
      <Navbar />
      <header className="bg-gradient-to-r from-indigo-700 to-purple-600 text-white">
        <div className="max-w-screen-md mx-auto px-4 py-10 flex flex-col items-center gap-4">
          {profile.image_url ? (
            <img src={profile.image_url} alt="avatar" className="w-32 h-32 rounded-full object-cover" />
          ) : (
            <div className="w-32 h-32 rounded-full bg-gray-300" />
          )}
          <h1 className="text-3xl font-bold">{profile.username || profile.slug}</h1>
          {user && user.id !== profile.id && (
            <button
              onClick={toggleFollow}
              disabled={followLoading}
              className="border border-white rounded px-4 py-1 hover:bg-white hover:text-indigo-700 transition"
            >
              {isFollowing ? 'Unfollow' : 'Follow'}
            </button>
          )}
        </div>
      </header>
      <div className="max-w-screen-md mx-auto px-4 py-12">
        <h2 className="text-2xl font-semibold mb-4">Upcoming Events</h2>
        {loading ? (
          <div className="py-20 text-center text-gray-500">Loading…</div>
        ) : events.length === 0 ? (
          <div className="py-20 text-center text-gray-500">No upcoming events.</div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {events.map(ev => (
              <SavedEventCard key={`${ev.source_table}-${ev.id}`} event={ev} />
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
