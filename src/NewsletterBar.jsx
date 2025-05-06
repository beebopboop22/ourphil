// src/NewsletterBar.jsx
import React from 'react'
import { Helmet } from 'react-helmet'

export default function NewsletterBar() {
  const embed = `
<script src="https://f.convertkit.com/ckjs/ck.5.js"></script>
<form action="https://app.kit.com/forms/8017113/subscriptions"
      class="seva-form formkit-form"
      method="post"
      data-sv-form="8017113"
      data-uid="0f25986beb"
      data-format="inline"
      data-version="5"
      style="min-width:100%;max-width:800px;margin:0 auto;"
>
  <div data-style="clean">
    <ul class="formkit-alert formkit-alert-error" data-element="errors" data-group="alert"></ul>
    <div data-element="fields" data-stacked="false" class="seva-fields formkit-fields">
      <div class="formkit-field">
        <input class="formkit-input"
               name="email_address"
               aria-label="Email Address"
               placeholder="you@example.com"
               required
               type="email" />
      </div>
      <button data-element="submit" class="formkit-submit formkit-submit">
        <div class="formkit-spinner"><div></div><div></div><div></div></div>
        <span>Subscribe</span>
      </button>
    </div>
  </div>
</form>
  `

  return (
    <>
      <Helmet>
        {/* load Barrio */}
        <link
          href="https://fonts.googleapis.com/css2?family=Barrio&display=swap"
          rel="stylesheet"
        />
      </Helmet>

      <section className="max-w-screen-md mx-auto my-12 p-8 bg-white rounded-lg shadow-lg">
        <h2 className="font-[Barrio] text-4xl text-center mb-6 text-[#BF3D35]">
          Join Our Newsletter
        </h2>

        {/* embed the ConvertKit form */}
        <div className="w-full" dangerouslySetInnerHTML={{ __html: embed }} />

        {/* override some CK styles */}
        <style>{`
          /* make the form itself take full width */
          .formkit-form[data-uid="0f25986beb"] {
            width: 100% !important;
          }
          /* input border in primary blue */
          .formkit-input {
            border-color: #28313E !important;
          }
          /* subscribe button in primary red, Barrio font */
          .formkit-submit {
            background-color: #BF3D35 !important;
            font-family: 'Barrio', cursive, Arial, sans-serif !important;
          }
        `}</style>
      </section>
    </>
  )
}
