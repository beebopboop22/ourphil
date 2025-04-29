// src/TestGroupUpdates.jsx
import React, { useEffect } from 'react';
import { supabase } from './supabaseClient';

const TestGroupUpdates = () => {
  useEffect(() => {
    const test = async () => {
      const { data, error } = await supabase
        .from('group_updates')
        .select('*');

      console.log('✅ DATA:', data);
      console.log('❌ ERROR:', error);
    };
    test();
  }, []);

  return <div className="p-6 text-center">Check your console for group_updates test results.</div>;
};

export default TestGroupUpdates;
