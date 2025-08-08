import React from 'react';
import { Helmet } from 'react-helmet';
import Navbar from './Navbar';
import Footer from './Footer';
import UpcomingTraditionsScroller from './UpcomingTraditionsScroller';

export default function TraditionsFAQ() {
  const heartUrl = 'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images/OurPhilly-CityHeart-1.png';
  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      <Helmet>
        <title>Traditions Hosts FAQ | Our Philly</title>
        <meta name="description" content="Quick FAQ for organizers of Philly’s annual traditions—photo reviews, Add to Plans, site placement, and support." />
      </Helmet>
      <Navbar />
      <main className="flex-grow">
        <section className="pt-24 pb-16 px-4 max-w-3xl mx-auto text-center">
          <img src={heartUrl} alt="Our Philly heart logo" width="120" height="120" className="mx-auto mb-6" />
          <h1 className="text-4xl sm:text-5xl font-[Barrio] text-indigo-900 mb-4">Traditions Hosts FAQ</h1>
          <p className="text-lg text-gray-700 mb-12">For organizers of Philly’s annual traditions (e.g., Broad Street Run, Danny Rumph Classic).</p>
          <div className="space-y-4 text-left">
            <details className="bg-white rounded-lg shadow p-4">
              <summary className="cursor-pointer">
                <h2 className="inline text-xl font-semibold text-gray-800">What is a “Tradition” page?</h2>
              </summary>
              <p className="mt-2 text-gray-700 leading-relaxed">A special page for any event that happens every year in Philadelphia. It has a custom layout, a photo-review gallery, and <strong>Description</strong> + <strong>What to Expect</strong> sections written by Our Philly.</p>
            </details>
            <details className="bg-white rounded-lg shadow p-4">
              <summary className="cursor-pointer">
                <h2 className="inline text-xl font-semibold text-gray-800">How do photo reviews work?</h2>
              </summary>
              <p className="mt-2 text-gray-700 leading-relaxed">Attendees post photos after your event; approved images appear in a scrolling gallery near the top.</p>
            </details>
            <details className="bg-white rounded-lg shadow p-4">
              <summary className="cursor-pointer">
                <h2 className="inline text-xl font-semibold text-gray-800">My page looks empty—how do I improve it?</h2>
              </summary>
              <p className="mt-2 text-gray-700 leading-relaxed">Ask past attendees to add photo reviews from prior years to seed the gallery.</p>
            </details>
            <details className="bg-white rounded-lg shadow p-4">
              <summary className="cursor-pointer">
                <h2 className="inline text-xl font-semibold text-gray-800">What happens when someone taps “Add to Plans”?</h2>
              </summary>
              <p className="mt-2 text-gray-700 leading-relaxed">Your event auto-reappears in that user’s Plans next year when the tradition returns.</p>
            </details>
            <details className="bg-white rounded-lg shadow p-4">
              <summary className="cursor-pointer">
                <h2 className="inline text-xl font-semibold text-gray-800">Where do Traditions appear on the site?</h2>
              </summary>
              <p className="mt-2 text-gray-700 leading-relaxed">They’re prioritized: at the top of the homepage, in homepage search results, and again toward the bottom—plus other featured spots.</p>
            </details>
            <details className="bg-white rounded-lg shadow p-4">
              <summary className="cursor-pointer">
                <h2 className="inline text-xl font-semibold text-gray-800">Is there any cost?</h2>
              </summary>
              <p className="mt-2 text-gray-700 leading-relaxed">No.</p>
            </details>
            <details className="bg-white rounded-lg shadow p-4">
              <summary className="cursor-pointer">
                <h2 className="inline text-xl font-semibold text-gray-800">I’m unhappy with my page or need edits/support—how do I reach you?</h2>
              </summary>
              <p className="mt-2 text-gray-700 leading-relaxed">Email <a href="mailto:bill@ourphilly.org" className="text-indigo-700 underline">bill@ourphilly.org</a> or DM us on Instagram <a href="https://www.instagram.com/ourphillydotorg/" className="text-indigo-700 underline" target="_blank" rel="noopener noreferrer">@ourphillydotorg</a>.</p>
            </details>
          </div>
        </section>
        <section className="bg-neutral-100 py-16 px-4">
          <h2 className="text-3xl font-[Barrio] text-indigo-900 text-center mb-8">Sample Upcoming Traditions</h2>
          <div className="max-w-screen-xl mx-auto">
            <UpcomingTraditionsScroller />
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

