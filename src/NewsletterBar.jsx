import React, { useState, useEffect } from 'react'
import { Helmet } from 'react-helmet'

export default function NewsletterBar() {
  const [spots, setSpots] = useState<number|null>(null)
  const FORM_ID = import.meta.env.VITE_CONVERTKIT_FORM_ID
  const API_KEY = import.meta.env.VITE_CONVERTKIT_API_KEY
  const PLAN_LIMIT = Number(import.meta.env.VITE_FREE_PLAN_LIMIT || 10000)

  useEffect(() => {
    async function fetchCount() {
      const res = await fetch(
        `https://api.convertkit.com/v3/forms/${FORM_ID}/subscriptions?api_key=${API_KEY}&limit=1`
      )
      const json = await res.json()
      const total = json.total_subscribers ?? 0
      setSpots(PLAN_LIMIT - total)
    }
    fetchCount()
  }, [])

  const embed = `
<script src="https://f.convertkit.com/ckjs/ck.5.js"></script>
<form action="https://app.convertkit.com/forms/${FORM_ID}/subscriptions"
      class="seva-form formkit-form"
      method="post"
      data-sv-form="${FORM_ID}"
      data-uid="0f25986beb"
      data-format="inline"
      data-version="5"
      style="min-width:100%;max-width:800px;margin:0 auto;"
>
  <!-- your fields… -->
</form>
  `

  return (
    <>
      <Helmet>
        <link
          href="https://fonts.googleapis.com/css2?family=Barrio&display=swap"
          rel="stylesheet"
        />
      </Helmet>
      <section className="max-w-screen-md mx-auto my-12 p-8 bg-white rounded-lg shadow-lg">
        <h2 className="font-[Barrio] text-4xl text-center mb-4 text-[#BF3D35]">
          Join Our Newsletter
        </h2>
        {spots != null && (
          <div className="text-center mb-4">
            <span>{spots.toLocaleString()} spots remaining</span>
            <span
              className="ml-2 text-gray-500 cursor-help"
              title="We clear out inactive subscribers every 60 days."
            >
              ❓
            </span>
          </div>
        )}
        <div dangerouslySetInnerHTML={{ __html: embed }} />
        <style>{`
          .formkit-form[data-uid="0f25986beb"] { width:100% !important; }
          .formkit-input { border-color:#28313E!important; }
          .formkit-submit {
            background-color:#BF3D35!important;
            font-family:'Barrio',cursive,Arial,sans-serif!important;
          }
        `}</style>
      </section>
    </>
  )
}
