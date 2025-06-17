// src/NewsletterSection.jsx
import React from 'react';
import { Helmet } from 'react-helmet';

export default function NewsletterSection() {
  // you can override these via VITE_CONVERTKIT_FORM_ID in .env
  const formId  = import.meta.env.VITE_CONVERTKIT_FORM_ID || '8016734';
  const formUid = '5da012403c'; 

  // our inline form markup (no <script> tag here, we've loaded it via Helmet)
  const embed = `
<form action="https://app.convertkit.com/forms/${formId}/subscriptions"
      class="seva-form formkit-form"
      method="post"
      data-sv-form="${formId}"
      data-uid="${formUid}"
      data-format="inline"
      data-version="5"
      style="min-width:100%;max-width:600px;margin:0 auto;"
>
  <div data-style="clean">
    <ul class="formkit-alert formkit-alert-error" data-element="errors"></ul>
    <div data-element="fields" class="formkit-fields">
      <div class="formkit-field">
        <input class="formkit-input"
               name="email_address"
               placeholder="you@example.com"
               required
               type="email" />
      </div>
      <button data-element="submit" class="formkit-submit">
        <span>Subscribe</span>
      </button>
    </div>
  </div>
</form>`;

  return (
    <section className="max-w-screen-md mx-auto my-12 p-8 bg-white rounded-lg shadow-lg">
      <Helmet>
        {/* load Barrio font + ConvertKit library */}
        <link
          href="https://fonts.googleapis.com/css2?family=Barrio&display=swap"
          rel="stylesheet"
        />
        <script src="https://f.convertkit.com/ckjs/ck.5.js" async />
      </Helmet>

      <h2 className="font-[Barrio] text-4xl text-center mb-6 text-[#BF3D35]">
        Join Our Newsletter
      </h2>

      {/* inject the form */}
      <div dangerouslySetInnerHTML={{ __html: embed }} />

      {/* some light overrides */}
      <style>{`
        /* full width */
        .formkit-form[data-uid="${formUid}"] {
          width: 100% !important;
        }
        /* input border */
        .formkit-input {
          border-color: #28313E !important;
        }
        /* button style */
        .formkit-submit {
          background-color: #BF3D35 !important;
          color: #ffffff !important;
          font-family: 'Barrio', cursive !important;
        }
        /* hide the “Built with Kit” badge */
        .formkit-powered-by-convertkit-container {
          display: none !important;
        }
      `}</style>
    </section>
  );
}
