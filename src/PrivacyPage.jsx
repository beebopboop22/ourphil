// src/PrivacyPolicyPage.jsx
import React from 'react';
import { Helmet } from 'react-helmet';
import Navbar from './Navbar';
import Footer from './Footer';

export default function PrivacyPolicyPage() {
  return (
    <>
      <Helmet>
        <title>Our Philly – Privacy Policy</title>
        <meta name="description" content="Our Philly Privacy Policy – how we collect, use, and protect your data." />
      </Helmet>

      <Navbar />

      <main className="bg-white">
        <div className="max-w-3xl mx-auto px-4 py-16">
          {/* Logo */}
          <div className="text-center mb-8 mt-12">
            <img
              src="https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images//logoo.png"
              alt="Our Philly Logo"
              className="mx-auto h-24"
            />
          </div>

          {/* Title & Date */}
          <h1 className="text-4xl font-bold text-center mb-2">Privacy Policy</h1>
          <p className="text-center text-sm text-gray-600 mb-12">Last updated: May 6, 2025</p>

          {/* Policy Content */}
          <div className="prose prose-lg mx-auto text-gray-800">
            <p>
              At <strong>Our Philly</strong> (“we”, “us”, or “our”), your privacy is paramount. This
              Privacy Policy explains how we collect, use, and safeguard your information when you
              visit our website or sign up for an account.
            </p>

            <h2>Information We Collect</h2>
            <p>
              <strong>Account Data:</strong> When you register, we collect your name, email
              address, and any other information you choose to provide.  
              <strong>Usage Data:</strong> We automatically gather certain technical information,
              including IP address, browser type, and pages you visit.
            </p>

            <h2>How We Use Your Information</h2>
            <ul>
              <li>To provide, maintain, and improve our services.</li>
              <li>To communicate updates, newsletters, and support messages.</li>
              <li>To personalize your experience and suggest relevant content.</li>
            </ul>

            <h2>Security</h2>
            <p>
              We implement reasonable administrative, technical, and physical safeguards to
              protect your data. However, no method of transmission over the internet is
              100% secure.
            </p>

            <h2>Your Choices</h2>
            <p>
              You can update your account information or delete your account at any time via
              your profile settings. You may also opt out of marketing emails by clicking the
              “unsubscribe” link in any newsletter.
            </p>

            <h2>Children’s Privacy</h2>
            <p>
              Our site is not intended for children under 13. We do not knowingly collect
              personal data from anyone under 13.
            </p>

            <h2>Contact Us</h2>
            <p>
              If you have questions or concerns about this Privacy Policy, please contact us at{' '}
              <a href="mailto:bill@ourphilly.org" className="text-indigo-600 hover:underline">
                bill@ourphilly.org
              </a>.
            </p>

            <p className="mt-8 text-sm text-gray-500">
              By creating an account or using our site, you acknowledge that you have read and
              agree to this Privacy Policy.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
