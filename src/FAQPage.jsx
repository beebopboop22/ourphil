// src/FAQPage.jsx
import React from 'react';
import Navbar from './Navbar';
import Footer from './Footer';

export default function FAQPage() {
  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Navbar />
      <main className="flex-grow max-w-3xl mx-auto px-4 py-20">
        <h1 className="text-4xl font-[Barrio] mb-8 text-center">FAQ</h1>

        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-2">Why should I create an account?</h2>
          <p className="text-gray-700">
            An account lets you save events to your Plans, follow hosts, leave reviews, and build a weekly digest of what&rsquo;s coming up in Philly.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-2">How do I list my event?</h2>
          <p className="text-gray-700">
            Hosts can post events for free. Sign up, click <span className="font-semibold">Post Event</span> in the navbar, and fill out the details. Your listing appears on the Big Board and can be saved by visitors.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-2">Can I manage my event page?</h2>
          <p className="text-gray-700">
            Yes. After posting, you can edit the details or update images. We&rsquo;re working on a claim system so established hosts can take control of existing pages.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-2">What is the Plans card?</h2>
          <p className="text-gray-700">
            It&rsquo;s a shareable card that shows the events you&rsquo;ve saved. It&rsquo;s perfect for planning weekends with friends or promoting upcoming activities.
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
