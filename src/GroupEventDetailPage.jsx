// src/GroupEventDetailPage.jsx
import React, { useEffect, useState, useContext } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { supabase } from './supabaseClient';
import Navbar from './Navbar';
import Footer from './Footer';
import GroupProgressBar from './GroupProgressBar';
import { AuthContext } from './AuthProvider';

export default function GroupEventDetailPage() {
  const { slug, eventId } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [group, setGroup] = useState(null);
  const [evt, setEvt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    title: '', description: '', start_date: '', start_time: ''
  });
  const [saving, setSaving] = useState(false);

  const [moreEvents, setMoreEvents] = useState([]);
  const [loadingMore, setLoadingMore] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const { data: grp } = await supabase
        .from('groups')
        .select('id, Name, slug, imag')
        .eq('slug', slug)
        .single();
      const { data: ev } = await supabase
        .from('group_events')
        .select('*')
        .eq('id', eventId)
        .single();
      setGroup(grp);
      setEvt(ev);
      setLoading(false);
    }
    fetchData();
  }, [slug, eventId]);

  useEffect(() => {
    if (!evt) return;
    (async () => {
      setLoadingMore(true);
      const todayStr = new Date().toISOString().slice(0,10);
      const { data: list } = await supabase
        .from('big_board_events')
        .select('id, post_id, title, start_date, end_date, slug')
        .gte('start_date', todayStr)
        .neq('id', evt.id)
        .order('start_date', { ascending: true })
        .limit(24);
      const enriched = await Promise.all(
        (list||[]).map(async e => {
          const { data: p } = await supabase
            .from('big_board_posts')
            .select('image_url')
            .eq('id', e.post_id)
            .single();
          let img = '';
          if (p?.image_url) {
            const { data: { publicUrl } } = supabase
              .storage.from('big-board')
              .getPublicUrl(p.image_url);
            img = publicUrl;
          }
          return { ...e, imageUrl: img };
        })
      );
      setMoreEvents(enriched);
      setLoadingMore(false);
    })();
  }, [evt]);

  if (loading || !group || !evt) {
    return <div className="py-20 text-center text-gray-500">Loading…</div>;
  }

  function parseYMD(s) {
    let [m,d,y] = s.split('/');
    if (d && y) return new Date(+y, +m-1, +d);
    [y,m,d] = s.split('-');
    return new Date(+y, +m-1, +d);
  }
  const startDate = parseYMD(evt.start_date);
  const today = new Date(); today.setHours(0,0,0,0);
  const diffDays = Math.round((startDate - today)/(1000*60*60*24));
  let prefix;
  if (diffDays === 0) prefix = 'Today';
  else if (diffDays === 1) prefix = 'Tomorrow';
  else if (diffDays < 7) {
    const wd = startDate.toLocaleDateString('en-US',{ weekday:'long' });
    prefix = `This ${wd}`;
  } else if (diffDays < 14) {
    const wd = startDate.toLocaleDateString('en-US',{ weekday:'long' });
    prefix = `Next ${wd}`;
  } else {
    prefix = startDate.toLocaleDateString('en-US',{ weekday:'long' });
  }
  const monthDay = startDate.toLocaleDateString('en-US',{ month:'long', day:'numeric' });
  const dateDisplay = `${prefix}, ${monthDay}`;

  const startEditing = () => {
    setFormData({
      title: evt.title || '',
      description: evt.description || '',
      start_date: evt.start_date || '',
      start_time: evt.start_time || ''
    });
    setIsEditing(true);
  };
  const handleChange = e => {
    const { name, value } = e.target;
    setFormData(fd => ({ ...fd, [name]: value }));
  };
  const handleSave = async e => {
    e.preventDefault();
    setSaving(true);
    const { data, error } = await supabase
      .from('group_events')
      .update(formData)
      .eq('id', evt.id)
      .select()
      .single();
    setSaving(false);
    if (error) alert(error.message);
    else {
      setEvt(data);
      setIsEditing(false);
    }
  };
  const handleDelete = async () => {
    if (!confirm('Delete this event?')) return;
    const { error } = await supabase
      .from('group_events')
      .delete()
      .eq('id', evt.id);
    if (error) alert(error.message);
    else navigate(`/groups/${group.slug}`);
  };

  return (
    <div className="min-h-screen bg-neutral-50 pt-20">
      <Helmet>
        <title>{`${evt.title} – ${group.Name}`}</title>
      </Helmet>

      <Navbar />
      <GroupProgressBar />

      <main className="flex-grow pt-24 pb-12 px-4">
        <div className="max-w-5xl mx-auto bg-white shadow-xl rounded-2xl overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2">

            {/* Left: group avatar */}
            <div className="p-8 flex items-center justify-center">
              <img
                src={group.imag}
                alt={group.Name}
                className="w-full max-w-sm h-auto object-cover rounded-lg shadow-lg"
              />
            </div>

            {/* Right: details / edit */}
            <div className="p-8 flex flex-col justify-between">
              {evt.user_id === user?.id && !isEditing && (
                <div className="flex justify-end space-x-2 mb-4">
                  <button
                    onClick={startEditing}
                    className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleDelete}
                    className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              )}

              {isEditing ? (
                <form onSubmit={handleSave} className="space-y-4">
                  {/* ... edit form fields (unchanged) ... */}
                </form>
              ) : (
                <>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    {evt.title}
                  </h1>

                  <div className="mt-2 p-4 bg-blue-50 border-l-4 border-blue-600 rounded-md mb-4">
                    <p className="text-blue-700 text-sm">
                      This event was created by the organizers of&nbsp;
                      <Link
                        to={`/groups/${group.slug}`}
                        className="underline font-semibold"
                      >
                        {group.Name}
                      </Link>
                      . Organizers can add or claim their group on Our Philly to create events.
                    </p>
                  </div>

                  <p className="text-lg text-gray-700 mb-6">{dateDisplay}</p>

                  <div className="mb-6">
                    <h2 className="text-xl font-semibold text-gray-800 mb-2">
                      Info
                    </h2>
                    <p className="text-base text-gray-700 leading-relaxed">
                      {evt.description}
                    </p>
                  </div>

                  <div className="flex justify-center mb-8">
                    <Link
                      to={`/groups/${group.slug}`}
                      className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300"
                    >
                      ← Back to {group.Name}
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Upcoming community submissions */}
        <div className="border-t border-gray-200 mt-12 pt-8 px-4 pb-12">
          <h2 className="text-2xl text-center font-semibold text-gray-800 mb-6">
            More upcoming community submissions
          </h2>

          {loadingMore ? (
            <p className="text-center text-gray-500">Loading…</p>
          ) : moreEvents.length === 0 ? (
            <p className="text-center text-gray-600">No upcoming submissions.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {moreEvents.map(e => (
                <Link
                  key={e.id}
                  to={`/big-board/${e.slug}`}
                  className="bg-white rounded-xl shadow-md hover:shadow-lg transition-transform hover:scale-[1.02] overflow-hidden flex flex-col"
                >
                  <div className="relative h-40 bg-gray-100">
                    <div className="absolute inset-x-0 bottom-0 h-6 bg-indigo-600 flex items-center justify-center z-10">
                      <span className="text-xs font-bold text-white uppercase">
                        COMMUNITY SUBMISSION
                      </span>
                    </div>
                    {e.imageUrl ? (
                      <img
                        src={e.imageUrl}
                        alt={e.title}
                        className="w-full h-full object-cover object-center"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        No Image
                      </div>
                    )}
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2 line-clamp-2">
                      {e.title}
                    </h3>
                    <p className="text-center text-sm text-gray-600">
                      {(() => {
                        const sd = parseYMD(e.start_date);
                        const dd = Math.round((sd - today)/(1000*60*60*24));
                        let pfx = '';
                        if (dd===0) pfx='Today';
                        else if (dd===1) pfx='Tomorrow';
                        else pfx=sd.toLocaleDateString('en-US',{ weekday:'long' });
                        const md = sd.toLocaleDateString('en-US',{ month:'short', day:'numeric' });
                        return `${pfx}, ${md}`;
                      })()}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

// helper to parse various date formats
function parseYMD(s) {
  let [m,d,y] = s.split('/');
  if (d && y) return new Date(+y, +m-1, +d);
  [y,m,d] = s.split('-');
  return new Date(+y, +m-1, +d);
}
