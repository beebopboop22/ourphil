import React from 'react';
import { Helmet } from 'react-helmet-async';
import Navbar from './Navbar';
import Footer from './Footer';
import PopularGroups from './PopularGroups.jsx';

export default function GroupsFAQ() {
  const heartUrl = 'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images/OurPhilly-CityHeart-1.png';
  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      <Helmet>
        <title>Groups FAQ | Our Philly</title>
        <meta name="description" content="Brief FAQ for Philly group owners—how to submit, claim pages, post events, and increase visibility on Our Philly." />
      </Helmet>
      <Navbar />
      <main className="flex-grow">
        <section className="pt-32 pb-16 px-4 max-w-3xl mx-auto text-center">
          <img src={heartUrl} alt="Our Philly heart logo" width="120" height="120" className="mx-auto mb-6" />
          <h1 className="text-4xl sm:text-5xl font-[Barrio] text-indigo-900 mb-4">Groups FAQ</h1>
          <p className="text-lg text-gray-700 mb-12">For clubs, associations, neighborhood networks—any group in Philadelphia.</p>
          <div className="space-y-4 text-left">
            <details className="bg-white rounded-lg shadow p-4">
              <summary className="cursor-pointer">
                <h2 className="inline text-xl font-semibold text-gray-800">What is a “Group” on Our Philly?</h2>
              </summary>
              <p className="mt-2 text-gray-700 leading-relaxed">Any club, association, or neighborhood network in Philadelphia. Submit your group and we’ll list it.</p>
            </details>
            <details className="bg-white rounded-lg shadow p-4">
              <summary className="cursor-pointer">
                <h2 className="inline text-xl font-semibold text-gray-800">How do I add my group?</h2>
              </summary>
              <p className="mt-2 text-gray-700 leading-relaxed">Use the <a href="/groups" className="text-indigo-700 underline">Add Your Group</a> button on the Groups page. We’ll publish your page after a quick review.</p>
            </details>
            <details className="bg-white rounded-lg shadow p-4">
              <summary className="cursor-pointer">
                <h2 className="inline text-xl font-semibold text-gray-800">How do I claim my group page?</h2>
              </summary>
              <p className="mt-2 text-gray-700 leading-relaxed">On your group page, click <strong>Claim Group</strong>. We’ll verify ownership and make you the page owner.</p>
            </details>
            <details className="bg-white rounded-lg shadow p-4">
              <summary className="cursor-pointer">
                <h2 className="inline text-xl font-semibold text-gray-800">What can page owners do?</h2>
              </summary>
              <p className="mt-2 text-gray-700 leading-relaxed">Create events on behalf of the group. Your group's events will appear in the homepage search results (group events appear first), on relevant tag pages (e.g., #family), and on your group page.</p>
            </details>
            <details className="bg-white rounded-lg shadow p-4">
              <summary className="cursor-pointer">
                <h2 className="inline text-xl font-semibold text-gray-800">How do people find my group?</h2>
              </summary>
              <p className="mt-2 text-gray-700 leading-relaxed">Visitors browse the Groups page search or use Quick Match to pick tags/areas and get a tailored list.</p>
            </details>
            <details className="bg-white rounded-lg shadow p-4">
              <summary className="cursor-pointer">
                <h2 className="inline text-xl font-semibold text-gray-800">Does it cost anything?</h2>
              </summary>
              <p className="mt-2 text-gray-700 leading-relaxed">No.</p>
            </details>
            <details className="bg-white rounded-lg shadow p-4">
              <summary className="cursor-pointer">
                <h2 className="inline text-xl font-semibold text-gray-800">Need help or edits?</h2>
              </summary>
              <p className="mt-2 text-gray-700 leading-relaxed">Email <a href="mailto:bill@ourphilly.org" className="text-indigo-700 underline">bill@ourphilly.org</a> or DM <a href="https://www.instagram.com/ourphillydotorg/" className="text-indigo-700 underline" target="_blank" rel="noopener noreferrer">@ourphillydotorg</a> on Instagram.</p>
            </details>
          </div>
          <p className="mt-12 text-gray-700">
            Need more support? Email <a href="mailto:bill@ourphilly.org" className="text-indigo-700 underline">bill@ourphilly.org</a> or DM us on Instagram <a href="https://www.instagram.com/ourphillydotorg/" className="text-indigo-700 underline" target="_blank" rel="noopener noreferrer">@ourphillydotorg</a>.
          </p>
        </section>
        <PopularGroups />
      </main>
      <Footer />
    </div>
  );
}

