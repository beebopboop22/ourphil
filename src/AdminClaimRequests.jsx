// /src/AdminClaimRequests.jsx

import React, { useEffect, useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import Navbar from './Navbar';
import Footer from './Footer';
import { AuthContext } from './AuthProvider';

const AdminClaimRequests = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [requests, setRequests] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  console.log('👤 AUTH CONTEXT USER:', user);


  useEffect(() => {
  if (user === undefined) return; // wait until user is loaded

  if (user === null) {
    setLoadingAuth(false); // will trigger unauthorized message below
    return;
  }

  if (user.email !== 'bill@solar-states.com') {
    setLoadingAuth(false); // same
    return;
  }

  // ✅ correct user
  setLoadingAuth(false);
}, [user]);



  const fetchRequests = async () => {
    setLoadingData(true);
    const { data, error } = await supabase
      .from('group_claim_requests')
      .select('id, group_id, user_id, message, status, created_at')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading requests:', error);
    } else {
      setRequests(data);
    }
    setLoadingData(false);
  };

  useEffect(() => {
    if (!loadingAuth) {
      fetchRequests();
    }
  }, [loadingAuth]);

  const updateStatus = async (id, newStatus) => {
    const { error } = await supabase
      .from('group_claim_requests')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status.');
    } else {
      fetchRequests(); // refresh after update
    }
  };

  if (loadingAuth) {
    return <div className="text-center py-20 text-gray-500">Checking authorization...</div>;
  }

  return (
    <div className="min-h-screen bg-neutral-50 pt-20 flex flex-col">
      <Navbar />

      <div className="flex-grow max-w-screen-xl mx-auto px-4 py-10">
        <h1 className="text-4xl font-[Barrio] text-gray-800 mb-8 text-center">
          Group Claim Requests
        </h1>

        {loadingData ? (
          <div className="text-center py-20">Loading requests...</div>
        ) : (
          <div className="grid gap-6">
            {requests.length === 0 ? (
              <div className="text-center text-gray-500">No claim requests found.</div>
            ) : (
              requests.map(req => (
                <div key={req.id} className="bg-white border p-6 rounded-lg shadow-sm">
                  <div className="flex flex-col md:flex-row md:justify-between">
                    <div>
                      <p className="text-sm text-gray-500 mb-2">
                        <strong>Submitted:</strong> {new Date(req.created_at).toLocaleString()}
                      </p>
                      <p className="text-lg font-semibold break-words">Group ID: {req.group_id}</p>
                      <p className="text-lg font-semibold break-words">User ID: {req.user_id}</p>
                      <p className="text-gray-600 mt-2">{req.message}</p>
                      <p className="mt-2 text-sm text-gray-500">
                        Status: <strong>{req.status}</strong>
                      </p>
                    </div>

                    {req.status === 'Pending' && (
                      <div className="flex gap-2 mt-4 md:mt-0 md:flex-col">
                        <button
                          onClick={() => updateStatus(req.id, 'Approved')}
                          className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => updateStatus(req.id, 'Rejected')}
                          className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default AdminClaimRequests;
