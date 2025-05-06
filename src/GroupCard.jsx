// src/GroupCard.jsx
import React, { useState, useEffect, useContext } from 'react';
import { supabase } from './supabaseClient';
import { AuthContext } from './AuthProvider';
import { getMyFavorites, addFavorite, removeFavorite } from './utils/favorites';
import { Link } from 'react-router-dom';

export default function GroupCard({ group, isAdmin, featuredGroupId }) {
  const { user } = useContext(AuthContext);

  // Favorites state
  const [favMap, setFavMap] = useState({});
  const [favLoading, setFavLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    getMyFavorites().then(rows => {
      const map = {};
      rows.forEach(r => { map[r.group_id] = r.id; });
      setFavMap(map);
    });
  }, [user]);

  const isFav = Boolean(favMap[group.id]);
  const toggleFav = async e => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;
    setFavLoading(true);
    if (isFav) {
      await removeFavorite(favMap[group.id]);
      setFavMap(prev => { const c = { ...prev }; delete c[group.id]; return c; });
    } else {
      const { data } = await addFavorite(group.id);
      setFavMap(prev => ({ ...prev, [group.id]: data[0].id }));
    }
    setFavLoading(false);
  };

  // Admin/Edit/Upload state (unchanged)
  const [isUploading, setIsUploading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    Name: group.Name || '',
    Link: group.Link || '',
    Description: group.Description || '',
    Type: group.Type?.split(',').map(t => t.trim()) || [],
    Vibes: group.Vibes?.split(',').map(v => v.trim()) || [],
  });
  const [allTypes, setAllTypes] = useState([]);
  const [allVibes, setAllVibes] = useState([]);
  const isFeatured = group.id === featuredGroupId;

  useEffect(() => {
    const loadOpts = async () => {
      const { data } = await supabase.from('groups').select('Type, Vibes');
      if (data) {
        const types = new Set();
        const vibes = new Set();
        data.forEach(g => {
          g.Type?.split(',').forEach(t => types.add(t.trim()));
          g.Vibes?.split(',').forEach(v => vibes.add(v.trim()));
        });
        setAllTypes([...types]);
        setAllVibes([...vibes]);
      }
    };
    loadOpts();
  }, []);

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this group?')) {
      await supabase.from('groups').delete().eq('id', group.id);
      window.location.reload();
    }
  };

  const handleDrop = async e => {
    e.preventDefault();
    setIsUploading(true);
    const file = e.dataTransfer.files[0];
    if (file) {
      const path = `${group.id}-${file.name}`;
      const { error } = await supabase.storage.from('group-images').upload(path, file, { upsert: true });
      if (!error) {
        const { data: urlData } = supabase.storage.from('group-images').getPublicUrl(path);
        await supabase.from('groups').update({ imag: urlData.publicUrl }).eq('id', group.id);
        window.location.reload();
      }
    }
    setIsUploading(false);
  };

  const handleEditChange = e => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  };
  const handleMultiChange = (field, val) => {
    setEditForm(prev => {
      const s = new Set(prev[field]);
      s.has(val) ? s.delete(val) : s.add(val);
      return { ...prev, [field]: Array.from(s) };
    });
  };
  const handleEditSubmit = async e => {
    e.preventDefault();
    await supabase.from('groups').update({
      ...editForm,
      Type: editForm.Type.join(', '),
      Vibes: editForm.Vibes.join(', '),
    }).eq('id', group.id);
    setIsEditing(false);
    window.location.reload();
  };

  // Mascot
  if (group.Name === '__MASCOT_INSERT__') {
    return (
      <div className="flex-none w-56 h-96 mx-2 rounded-2xl overflow-hidden shadow-lg">
        <img
          src="https://qdartpzrxmftmaftfdbd.supabase.co/.../Ksqk1fh.jpeg?token=…"
          alt="Mascot Gritty"
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  const imageUrl = group.imag?.startsWith('http') ? group.imag : null;
  const types = group.Type?.split(',').map(t => t.trim()) || [];
  const primaryType = types[0];

  return (
    <div
      className={`flex-none w-56 h-96 mx-2 relative overflow-hidden rounded-2xl shadow-lg ${isFeatured ? 'ring-4 ring-yellow-400' : ''}`}
      onDrop={isAdmin ? handleDrop : undefined}
      onDragOver={isAdmin ? e => e.preventDefault() : undefined}
    >
      {/* Full-bleed image area */}
      <div className="relative w-full h-full bg-gray-200">
        <img
          src={imageUrl || 'https://via.placeholder.com/224x384'}
          alt={group.Name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/40" />

        {/* Click overlay */}
        <Link to={`/groups/${group.slug}`} className="absolute inset-0 z-10" />

        {/* Type tag */}
        {primaryType && (
          <span className="absolute top-2 left-2 bg-indigo-100 text-indigo-700 text-xs font-semibold px-2 py-1 rounded-full z-20">
            {primaryType}
          </span>
        )}

        {/* Favorite heart */}
        <button
          onClick={toggleFav}
          disabled={favLoading}
          className="absolute top-2 right-2 text-2xl z-20 pointer-events-auto"
          aria-label={isFav ? 'Remove favorite' : 'Add favorite'}
        >
          {isFav ? '❤️' : '🤍'}
        </button>

        {/* Group name larger */}
        <h3 className="absolute text-center bottom-10 right-4 text-4xl font-bold text-white z-20 leading-tight">
          {group.Name}
        </h3>
      </div>

      {/* Admin Controls (unchanged) */}
      {isAdmin && (
        <div className="absolute bottom-2 left-2 right-2 flex justify-between space-x-2">
          <button
            onClick={() => setIsEditing(true)}
            className="flex-1 bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full text-xs hover:bg-yellow-200 transition"
          >
            Edit
          </button>
          <button
            onClick={handleDelete}
            className="flex-1 bg-red-100 text-red-600 px-2 py-1 rounded-full text-xs hover:bg-red-200 transition"
          >
            Delete
          </button>
        </div>
      )}

      {/* Edit Modal (unchanged) */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-xl p-6 overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Edit Group</h2>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              {/* form fields omitted for brevity */}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
