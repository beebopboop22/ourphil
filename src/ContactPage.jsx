import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import Navbar from './Navbar';
import Footer from './Footer';

export default function ContactPage() {
  const [form, setForm] = useState({ firstName: '', email: '', message: '' });
  const [status, setStatus] = useState(null); // null | 'loading' | 'success' | 'error'

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('loading');

    try {
      const response = await fetch('https://formspree.io/f/meokknnz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          'First Name': form.firstName,
          email: form.email,
          message: form.message,
        }),
      });

      if (!response.ok) throw new Error('Network response was not ok');

      setStatus('success');
      setForm({ firstName: '', email: '', message: '' });
    } catch (error) {
      console.error('Form submission error:', error);
      setStatus('error');
    }
  };

  return (
    <>
      <Helmet>
        <title>Contact Us | Our Philly - Dig Into Philly</title>
        <meta name="description" content="Get in touch with the Our Philly team. We'd love to hear your feedback, questions, or ideas." />
      </Helmet>
      <div className="flex flex-col min-h-screen overflow-x-visible">
        <Navbar />

        <main className="container mx-auto px-4 py-12 flex-grow mt-12">
          <section className="max-w-lg mx-auto bg-white shadow-md rounded-lg p-8">
            <h1 className="text-3xl font-[Barrio] text-center mb-6 text-[#28313e]">Contact Us</h1>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">First Name</label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  value={form.firstName}
                  onChange={handleChange}
                  required
                  autoComplete="given-name"
                  className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email Address</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  autoComplete="email"
                  className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-700">Message</label>
                <textarea
                  id="message"
                  name="message"
                  rows="5"
                  value={form.message}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full py-3 bg-indigo-600 text-white font-medium rounded-md hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {status === 'loading' ? 'Sending…' : 'Send Message'}
              </button>

              {status === 'success' && (
                <p className="text-green-600 text-sm mt-2">Thank you! Your message has been sent.</p>
              )}

              {status === 'error' && (
                <p className="text-red-600 text-sm mt-2">Sorry, something went wrong. Please try again.</p>
              )}
            </form>
          </section>
        </main>

        <Footer />
      </div>
    </>
  );
}
