import React, { useState } from 'react';
import { supabase } from './supabaseClient';

const GroupUpdateForm = ({ groupId, userId, onPostSuccess }) => {
  const [content, setContent] = useState('');
  const [posting, setPosting] = useState(false);

  const submitUpdate = async (e) => {
    e.preventDefault();
    setPosting(true);

    const { error } = await supabase.from('group_updates').insert([
      { group_id: groupId, user_id: userId, content }
    ]);

    setPosting(false);

    if (error) {
      console.error('Error posting update:', error);
      alert('Failed to post update.');
    } else {
      setContent('');
      onPostSuccess(); // refresh updates after posting
    }
  };

  return (
    <form onSubmit={submitUpdate} className="bg-white p-4 rounded-lg shadow-md mb-8">
      <textarea
        className="w-full border rounded p-2 mb-4"
        placeholder="Share an update with your group..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        required
      />
      <button
        type="submit"
        className="bg-indigo-600 text-white font-bold px-6 py-2 rounded hover:bg-indigo-700 transition"
        disabled={posting}
      >
        {posting ? 'Posting...' : 'Post Update'}
      </button>
    </form>
  );
};

export default GroupUpdateForm;
