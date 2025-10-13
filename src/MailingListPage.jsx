import React from 'react';
import GhostNewsletterEmbed from './GhostNewsletterEmbed.jsx';

const MailingListPage = () => (
  <main className="min-h-screen bg-white pt-28 pb-16 px-4">
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-8 text-center">
      <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl">Newsletter</h1>
      <GhostNewsletterEmbed />
    </div>
  </main>
);

export default MailingListPage;
