// src/GroupCard.jsx
import React, { useState, useEffect, useContext } from 'react';
import { supabase } from './supabaseClient';
import { AuthContext } from './AuthProvider';
import { getMyFavorites, addFavorite, removeFavorite } from './utils/favorites';

const GroupCard = ({ group, isAdmin, featuredGroupId }) => {
  const { user } = useContext(AuthContext);

  // ── Favorites state ─────────────────────
  const [favMap, setFavMap] = useState({});
  const [favLoading, setFavLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    getMyFavorites().then(rows => {
      const map = {};
      rows.forEach(r => { map[r.group_id] = r.id });
      setFavMap(map);
    });
  }, [user]);

  const toggleFav = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;
    setFavLoading(true);
    if (favMap[group.id]) {
      await removeFavorite(favMap[group.id]);
      setFavMap(m => { const c = { ...m }; delete c[group.id]; return c; });
    } else {
      const { data } = await addFavorite(group.id);
      setFavMap(m => ({ ...m, [group.id]: data[0].id }));
    }
    setFavLoading(false);
  };

  const isFav = Boolean(favMap[group.id]);

  // ── Your existing states & logic ────────
  const [isHovered, setIsHovered] = useState(false);
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
    const fetchOptions = async () => {
      const { data } = await supabase.from('groups').select('Type, Vibes');
      if (data) {
        const typesSet = new Set();
        const vibesSet = new Set();
        data.forEach(g => {
          g.Type?.split(',').forEach(t => typesSet.add(t.trim()));
          g.Vibes?.split(',').forEach(v => vibesSet.add(v.trim()));
        });
        setAllTypes(Array.from(typesSet));
        setAllVibes(Array.from(vibesSet));
      }
    };
    fetchOptions();
  }, []);

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this group?')) {
      await supabase.from('groups').delete().eq('id', group.id);
      window.location.reload();
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsUploading(true);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const path = `${group.id}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('group-images')
      .upload(path, file, { upsert: true });
    if (!uploadError) {
      const { data } = supabase.storage.from('group-images').getPublicUrl(path);
      await supabase
        .from('groups')
        .update({ imag: data.publicUrl })
        .eq('id', group.id);
      window.location.reload();
    } else {
      console.error('Upload error:', uploadError);
    }
    setIsUploading(false);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  };

  const handleMultiChange = (field, value) => {
    setEditForm(prev => {
      const current = new Set(prev[field]);
      current.has(value) ? current.delete(value) : current.add(value);
      return { ...prev, [field]: Array.from(current) };
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    await supabase.from('groups').update({
      ...editForm,
      Type: editForm.Type.join(', '),
      Vibes: editForm.Vibes.join(', '),
    }).eq('id', group.id);
    setIsEditing(false);
    window.location.reload();
  };

  // ── Mascot special case ─────────────────
  if (group.Name === '__MASCOT_INSERT__') {
    return (
      <div className="col-span-1 sm:col-span-2 lg:col-span-1 xl:col-span-1">
        <img
          src="https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/sign/group-images/Ksqk1fh.jpeg?token=…"
          alt="Mascot Gritty"
          className="rounded-2xl w-full h-full object-cover shadow-xl"
        />
      </div>
    );
  }

  const imageUrl = group.imag?.includes('http') ? group.imag : '';
  const vibes = group.Vibes?.split(',').map(v => v.trim()) || [];
  const types = group.Type?.split(',').map(t => t.trim()) || [];

  return (
    <div
      className={`relative bg-white rounded-2xl overflow-hidden transition-transform duration-500 transform hover:scale-105
        ${isHovered ? 'ring-4 ring-indigo-300' : ''}
        ${isFeatured
          ? 'border-4 border-yellow-400 shadow-[0_0_30px_rgba(255,223,0,0.75)]'
          : 'shadow-xl'
        }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* ❤️ Favorite button */}
      <button
        onClick={toggleFav}
        disabled={favLoading}
        className="absolute top-2 right-2 z-20 text-xl"
        aria-label={isFav ? 'Remove favorite' : 'Add favorite'}
      >
        {isFav ? '❤️' : '🤍'}
      </button>

      {/* 🌟 Featured badge */}
      {isFeatured && (
        <div className="absolute top-2 left-2 bg-yellow-400 text-white text-xs font-semibold px-3 py-1 rounded-full shadow-md z-10">
          🌟 Featured Group
        </div>
      )}

      {/* Image (clickable) */}
      {imageUrl && (
        <a href={`/groups/${group.slug}`} className="block">
          <img
            src={imageUrl}
            alt={group.Name}
            className="w-full h-48 object-cover"
          />
        </a>
      )}

      {/* Card body */}
      <div className="p-4">
        <h2 className={`text-xl font-bold mb-1 ${isFeatured ? 'text-yellow-700' : 'text-indigo-700'}`}>
          {group.Name}
        </h2>
        <p className="text-sm text-gray-600 mb-3">{group.Description}</p>

        <div className="flex flex-wrap gap-2 mb-3">
          {types.map((type, idx) => (
            <span
              key={idx}
              className="bg-indigo-100 text-indigo-700 px-2 py-1 text-xs rounded-full"
            >
              {type}
            </span>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-gray-500">
          {vibes.map((vibe, idx) => (
            <span
              key={idx}
              className="bg-gray-100 px-2 py-1 rounded-full"
            >
              {vibe}
            </span>
          ))}
        </div>

        {isAdmin && (
          <div className="mt-4 space-y-2">
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-indigo-400 rounded-lg p-3 text-center text-sm text-indigo-600 cursor-pointer hover:bg-indigo-50"
            >
              {isUploading ? 'Uploading...' : 'Drag image here to update'}
            </div>
            <button
              onClick={() => setIsEditing(true)}
              className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded text-xs hover:bg-yellow-200"
            >
              Edit
            </button>
            <button
              onClick={handleDelete}
              className="bg-red-100 text-red-600 px-3 py-1 rounded text-xs hover:bg-red-200"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Edit modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-xl p-6 relative max-h-full overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Edit Group</h2>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <input
                type="text"
                name="Name"
                placeholder="Group Name"
                value={editForm.Name}
                onChange={handleEditChange}
                required
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
              <input
                type="url"
                name="Link"
                placeholder="Group Link (URL)"
                value={editForm.Link}
                onChange={handleEditChange}
                required
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
              <textarea
                name="Description"
                placeholder="Short description of the group"
                value={editForm.Description}
                onChange={handleEditChange}
                required
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {allTypes.map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleMultiChange('Type', type)}
                      className={`text-xs px-2 py-1 rounded-full border whitespace-nowrap ${
                        editForm.Type.includes(type)
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white text-gray-700 border-gray-300'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vibes</label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {allVibes.map(vibe => (
                    <button
                      key={vibe}
                      type="button"
                      onClick={() => handleMultiChange('Vibes', vibe)}
                      className={`text-xs px-2 py-1 rounded-full border whitespace-nowrap ${
                        editForm.Vibes.includes(vibe)
                          ? 'bg-pink-600 text-white'
                          : 'bg-white text-gray-700 border-gray-300'
                      }`}
                    >
                      {vibe}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupCard;


