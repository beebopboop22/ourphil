import React, { useState, useContext } from 'react';
import { supabase } from './supabaseClient';
import { AuthContext } from './AuthProvider';

/**
 * ClaimGroupButton
 * ----------------
 * Allows a user to submit a claim request for a group, collecting their email directly.
 * Inserts group_id, user_id, user_email, message, and status into group_claim_requests.
 */
export default function ClaimGroupButton({ groupId }) {
  const { user } = useContext(AuthContext);
  const [showForm, setShowForm] = useState(false);

  // Local form state
  const [email, setEmail] = useState(user?.email || '');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  /**
   * handleSubmit
   * -------------
   * Collects email and message from the form and inserts into Supabase.
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      alert('Please enter your email address.');
      return;
    }

    setSubmitting(true);

    const payload = {
      group_id: groupId,
      user_id: user?.id || null,
      user_email: email,
      message,
      status: 'Pending',
    };
    console.log('🌱 Claim payload →', payload);

    const { data: inserted, error } = await supabase
      .from('group_claim_requests')
      .insert([payload])
      .select();

    setSubmitting(false);
    console.log('🪴 Insert response →', { inserted, error });

    if (error) {
      console.error('Error submitting claim:', error);
      alert('There was an error submitting your request. Please try again.');
    } else {
      setSubmitted(true);
    }
  };

  // If not logged in show form anyway to collect email
  return (
    <div className="mt-6">
      {!showForm ? (
        <>
          <button
            onClick={() => setShowForm(true)}
            className="bg-indigo-100 text-indigo-800 font-bold py-2 px-4 rounded-full hover:bg-indigo-200 transition"
          >
            Claim This Group
          </button>
          <p className="mt-2 text-xs text-gray-500 max-w-sm">
            We’ll verify your claim by contacting you at the email provided.
          </p>
        </>
      ) : submitted ? (
        <div className="text-green-600 mt-4">
          ✅ Claim request submitted! We’ll review and be in touch soon.
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="bg-white p-4 border rounded-lg shadow-md mt-4 max-w-md space-y-4"
        >
          <div>
            <label className="block text-sm font-bold mb-1">Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">Why you can claim this group</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="I help organize events for this group..."
              required
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-green-600 text-white font-bold py-2 px-4 rounded hover:bg-green-700 transition"
          >
            {submitting ? 'Submitting...' : 'Submit Claim Request'}
          </button>
        </form>
      )}
    </div>
  );
}
