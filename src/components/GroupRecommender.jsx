import React, { useState } from 'react';

const GroupRecommender = () => {
  const [input, setInput] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchRecommendations = async () => {
    if (!input.trim()) return;

    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/recommend-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_input: input }),
      });

      const data = await res.json();

      const output =
        data?.output ||
        data?.messages?.[0]?.output ||
        data?.messages?.[0]?.groups ||
        [];

      setResults(output);
    } catch (err) {
      console.error('Failed to fetch recommendations:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-2">Find Local Groups You'll Love</h2>
      <p className="text-sm text-gray-600 mb-4">
        Tell us what you're into, and we’ll recommend 3 Philly-based groups.
      </p>

      <div className="flex gap-2 mb-6">
        <input
          type="text"
          placeholder="e.g. volunteering, biking, food justice"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 px-4 py-2 border rounded"
        />
        <button
          onClick={fetchRecommendations}
          className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
        >
          {loading ? 'Finding...' : 'Recommend'}
        </button>
      </div>

      {results.length > 0 && (
        <div className="space-y-4">
          {results.map((group, idx) => (
            <div
              key={idx}
              className="border p-4 rounded shadow-sm bg-white transition hover:shadow-md"
            >
              <h3 className="text-lg font-semibold">{group.Name}</h3>
              <p className="text-gray-700 mb-2">{group.Description}</p>
              {group.WhyItMatches && (
                <p className="text-sm italic text-green-600">
                  ✅ {group.WhyItMatches}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GroupRecommender;
