import React from 'react';
import Navbar from './Navbar.jsx';
import Footer from './Footer.jsx';
import GhostNewsletterEmbed from './GhostNewsletterEmbed.jsx';

const MailingListPage = () => (
  <>
    <Navbar />
    <main className="min-h-screen bg-white px-4 pb-24 pt-32 sm:pt-40 lg:pt-48">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-10 text-center">
        <h1 className="text-4xl font-bold uppercase tracking-wide text-gray-900 sm:text-5xl">
          Newsletter
        </h1>
        <GhostNewsletterEmbed />
      </div>
    </main>
    <Footer />
  </>
);

export default MailingListPage;
