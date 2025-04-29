import React, { useState } from 'react';
import { supabase } from './supabaseClient';

const ClaimGroupButton = ({ groupId, userId }) => {
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    const { error } = await supabase.from('group_claim_requests').insert([
      {
        group_id: groupId,
        user_id: userId,
        message,
        status: 'Pending',
      }
    ]);

    setSubmitting(false);

    if (error) {
      console.error('Error submitting claim:', error);
      alert('There was an error. Please try again.');
    } else {
      setSubmitted(true);
    }
  };

  if (submitted) {
    return <div className="text-green-600 mt-4">✅ Claim request submitted! We’ll be in touch soon.</div>;
  }

  return (
    <div className="mt-6">
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="bg-indigo-600 text-white font-bold py-2 px-4 rounded hover:bg-indigo-700 transition"
        >
          Claim This Group
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white p-4 border rounded-lg shadow-md mt-4">
          <label className="block text-sm font-bold mb-2">Tell us about your connection to this group:</label>
          <textarea
            className="w-full border rounded p-2 mb-4"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="I help organize events for this group..."
            required
          />
          <button
            type="submit"
            className="bg-green-600 text-white font-bold py-2 px-4 rounded hover:bg-green-700 transition"
            disabled={submitting}
          >
            {submitting ? 'Submitting...' : 'Submit Claim Request'}
          </button>
        </form>
      )}
    </div>
  );
};

export default ClaimGroupButton;
