import React, { useEffect } from 'react';
import Navbar from './Navbar.jsx';
import Footer from './Footer.jsx';

const NewsletterPage = () => {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const initializeForm = () => {
      if (typeof window.sender === 'function') {
        try {
          window.sender('forms.load');
        } catch (error) {
          // eslint-disable-next-line no-console
          console.warn('Sender form initialization error', error);
        }
      }
    };

    initializeForm();
    const timeout = window.setTimeout(initializeForm, 500);

    return () => {
      window.clearTimeout(timeout);
    };
  }, []);

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-white px-4 pb-24 pt-32 sm:pt-40 lg:pt-48">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-10 text-center">
          <h1 className="text-4xl font-[Barrio] lowercase text-gray-900 sm:text-5xl">
            weekend newsletter
          </h1>
          <div
            style={{ textAlign: 'left' }}
            className="sender-form-field w-full"
            data-sender-form-id="dPN914"
          />
        </div>
      </main>
      <Footer />
    </>
  );
};

export default NewsletterPage;
