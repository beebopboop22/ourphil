import React, { useEffect, useState, useContext } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { supabase } from './supabaseClient';
import Navbar from './Navbar';
import Footer from './Footer';
import GroupProgressBar from './GroupProgressBar';
import { AuthContext } from './AuthProvider';

/**
 * GroupEventDetailPage
 * --------------------
 * Detailed view of a single group event with edit/delete for owners.
 */
export default function GroupEventDetailPage() {
  const { slug, eventId } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [group, setGroup] = useState(null);
  const [evt, setEvt] = useState(null);
  const [loading, setLoading] = useState(true);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start_date: '',
    start_time: ''
  });
  const [saving, setSaving] = useState(false);

  const coverUrl = 'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images//pine-street-51011_1280.jpg';

  // Fetch group and event
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

  if (loading || !group || !evt) {
    return <div className="text-center py-20 text-gray-500">Loading Event…</div>;
  }

  // Initialize form when entering edit mode
  const startEditing = () => {
    setFormData({
      title: evt.title || '',
      description: evt.description || '',
      start_date: evt.start_date || '',
      start_time: evt.start_time || ''
    });
    setIsEditing(true);
  };

  // Handle form input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(fd => ({ ...fd, [name]: value }));
  };

  // Save edits
  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const { data, error } = await supabase
      .from('group_events')
      .update(formData)
      .eq('id', evt.id)
      .select()
      .single();
    setSaving(false);
    if (error) {
      alert('Error saving event: ' + error.message);
    } else {
      setEvt(data);
      setIsEditing(false);
    }
  };

  // Delete event
  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this event?')) return;
    const { error } = await supabase
      .from('group_events')
      .delete()
      .eq('id', evt.id);
    if (error) {
      alert('Error deleting event: ' + error.message);
    } else {
      navigate(`/groups/${group.slug}`);
    }
  };

  // Format date/time display
  const fmtDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const fmtTime = (t) => t
    ? new Date(`1970-01-01T${t}`)
        .toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true, timeZone: 'America/New_York', timeZoneName: 'short' })
    : '';

  return (
    <div className="min-h-screen bg-neutral-50 pt-20">
      <Helmet>
        <title>{`${evt.title} – ${group.Name} – Find Groups & Events in Philly`}</title>
      </Helmet>

      <Navbar />
      <GroupProgressBar />

      {/* Banner & Avatar */}
      <div className="relative">
        <div className="h-64 bg-cover bg-center" style={{ backgroundImage: `url("${coverUrl}")` }} />
        <div className="absolute left-4 bottom-0 transform translate-y-1/2">
          <img src={group.imag} alt={group.Name} className="w-32 h-32 rounded-full border-4 border-white object-cover" />
        </div>
      </div>

      <div className="max-w-screen-md mx-auto px-4 mt-16">
        {/* Owner controls */}
        {evt.user_id === user?.id && !isEditing && (
          <div className="flex justify-end space-x-2 mb-4">
            <button onClick={startEditing} className="bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700">
              Edit
            </button>
            <button onClick={handleDelete} className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700">
              Delete
            </button>
          </div>
        )}

        {/* Edit Form */}
        {isEditing ? (
          <form onSubmit={handleSave} className="space-y-4 bg-white p-6 rounded shadow">
            <div>
              <label className="block text-sm font-bold mb-1">Title</label>
              <input name="title" value={formData.title} onChange={handleChange} required className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Description</label>
              <textarea name="description" value={formData.description} onChange={handleChange} rows={4} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Start Date</label>
              <input type="date" name="start_date" value={formData.start_date} onChange={handleChange} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">Start Time</label>
              <input type="time" name="start_time" value={formData.start_time} onChange={handleChange} className="w-full border rounded px-3 py-2" />
            </div>
            <div className="flex justify-end space-x-2">
              <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 rounded border">Cancel</button>
              <button type="submit" disabled={saving} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        ) : (
          /* Display Mode */
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-4">{evt.title}</h1>
            <p className="text-gray-600 mb-6">{evt.description}</p>
            <div className="space-y-2 mb-8">
              <p><strong>Date:</strong> {fmtDate(evt.start_date)}</p>
              {evt.start_time && <p><strong>Time:</strong> {fmtTime(evt.start_time)}</p>}
            </div>
            <div className="flex justify-center flex-wrap gap-4 mb-12">
              <Link to={`/groups/${group.slug}`} className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300">← Back to {group.Name}</Link>
              <Link to={`/groups/${group.slug}/events`} className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">See all events</Link>
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}

// Utility formatting
function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}
function fmtTime(t) {
  return t
    ? new Date(`1970-01-01T${t}`)
        .toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true, timeZone: 'America/New_York', timeZoneName: 'short' })
    : '';
}
