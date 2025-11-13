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
      <main className="mt-[var(--navbar-height)] bg-white px-4 pb-24">
        <div
          className="mx-auto flex w-full max-w-5xl flex-col items-center justify-center gap-12 text-center md:flex-row md:text-left"
          style={{ minHeight: 'calc(100vh - var(--navbar-height, 96px))' }}
        >
          <div className="flex w-full flex-1 items-center justify-center md:justify-end">
            <h1 className="text-center text-4xl font-[Barrio] lowercase text-gray-900 sm:text-5xl md:text-left">
              weekend newsletter
            </h1>
          </div>
          <div className="flex w-full flex-1 items-center justify-center md:justify-start">
            <div
              style={{ textAlign: 'left' }}
              className="sender-form-field w-full max-w-2xl text-center"
              data-sender-form-id="dPN914"
            />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
};

export default NewsletterPage;
