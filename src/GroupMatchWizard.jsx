import React, { useState, useEffect, useContext } from 'react';
import { supabase } from './supabaseClient';
import { AuthContext } from './AuthProvider';
import { useNavigate } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';

export default function GroupMatchWizard() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [allTags, setAllTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [areas, setAreas] = useState([]);
  const [selectedArea, setSelectedArea] = useState('');
  const [about, setAbout] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from('culture_tags')
      .select('id,name')
      .then(({ data }) => setAllTags(data || []));
  }, []);

  useEffect(() => {
    supabase
      .from('groups')
      .select('Area')
      .not('Area', 'is', null)
      .then(({ data }) => {
        const uniques = Array.from(new Set((data || []).map(g => g.Area).filter(Boolean))).sort();
        setAreas(uniques);
      });
  }, []);

  const toggleTag = id => {
    setSelectedTags(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const fetchMatches = async (tags, area) => {
    if (!tags.length) return [];
    const { data: taggings } = await supabase
      .from('taggings')
      .select('taggable_id, tag_id')
      .eq('taggable_type', 'groups')
      .in('tag_id', tags);
    const counts = {};
    (taggings || []).forEach(t => {
      counts[t.taggable_id] = (counts[t.taggable_id] || 0) + 1;
    });
    const groupIds = Object.keys(counts);
    if (!groupIds.length) return [];
    const { data: groupsData } = await supabase
      .from('groups')
      .select('id, Name, slug, imag, Area')
      .in('id', groupIds);
    const scored = (groupsData || []).map(g => {
      const overlap = counts[g.id] || 0;
      const areaMatch = g.Area === area ? 1 : 0;
      const score = overlap * 10 + areaMatch;
      return { ...g, score };
    });
    return scored.sort((a, b) => b.score - a.score);
  };

  const handleFinish = async () => {
    if (!user) return;
    setSaving(true);
    await supabase
      .from('profile_tags')
      .delete()
      .eq('profile_id', user.id)
      .eq('tag_type', 'interest');
    if (selectedTags.length) {
      const rows = selectedTags.map(tag_id => ({
        profile_id: user.id,
        tag_id,
        tag_type: 'interest',
      }));
      await supabase.from('profile_tags').insert(rows);
    }
    await supabase
      .from('user_preferences')
      .upsert({ user_id: user.id, region: selectedArea, about });

    const matches = await fetchMatches(selectedTags, selectedArea);
    const matchIds = matches.map(g => g.id);
    await supabase
      .from('profiles')
      .update({ cached_group_matches: matchIds })
      .eq('id', user.id);
    setSaving(false);
    navigate('/groups');
  };

  return (
    <div className="min-h-screen bg-neutral-50 pt-20">
      <Navbar />
      <div className="max-w-lg mx-auto p-4">
        {step === 1 && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Select interests</h2>
            <div className="flex flex-wrap gap-2">
              {allTags.map(t => (
                <button
                  key={t.id}
                  onClick={() => toggleTag(t.id)}
                  className={`${selectedTags.includes(t.id) ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'} px-3 py-1 rounded-full`}
                >
                  #{t.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Which region are you in?</h2>
            <select
              className="w-full border p-2 rounded"
              value={selectedArea}
              onChange={e => setSelectedArea(e.target.value)}
            >
              <option value="">Select area</option>
              {areas.map(a => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="text-2xl font-bold mb-4">About you</h2>
            <textarea
              className="w-full border p-2 rounded"
              rows={4}
              value={about}
              onChange={e => setAbout(e.target.value)}
              placeholder="Tell us a little about yourself"
            />
          </div>
        )}

        <div className="mt-6 flex justify-between">
          {step > 1 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="px-4 py-2 bg-gray-200 rounded"
            >
              Back
            </button>
          )}
          {step < 3 && (
            <button
              onClick={() => setStep(s => s + 1)}
              className="ml-auto px-4 py-2 bg-indigo-600 text-white rounded"
            >
              Next
            </button>
          )}
          {step === 3 && (
            <button
              onClick={handleFinish}
              disabled={saving}
              className="ml-auto px-4 py-2 bg-green-600 text-white rounded"
            >
              {saving ? 'Saving...' : 'Finish'}
            </button>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}

