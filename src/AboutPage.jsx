import React from 'react'
import { Helmet } from 'react-helmet'
import { Link } from 'react-router-dom'
import Navbar from './Navbar'
import Footer from './Footer'

function DigIntoPhillySection() {
  const items = [
    {
      title: 'Add events to your Plans',
      body: "They'll appear in the Plans section of your calendar.",
    },
    {
      title: 'Share your events card with friends',
      body: 'Select View Upcoming Plans Card and share by text, Instagram, whatever.',
    },
    {
      title: 'Subscribe to tags',
      body:
        "You'll receive a daily e-mail digest of upcoming events for any tag you subscribe to. Visit Settings in your account to change your digest.",
    },
    {
      title: 'Edit your profile',
      body:
        'Besides a username and photo, add your ethnicities and social accounts. Both your ethnicities (as flag emojis) and links to social accounts will appear beside any comment you leave on an event page.',
    },
    {
      title: 'Follow event creators',
      body: "Their created events will appear in your profile's Following section.",
    },
    {
      title: 'Find Groups',
      body: (
        <span>
          Use <Link to="/groups" className="underline">Quick Match on the groups page</Link>, or search around.
        </span>
      ),
    },
    {
      title: 'Claim Groups',
      body: (
        <span>
          If you manage a group, you can claim it. See our{' '}
          <Link to="/groups-faq" className="underline">Groups FAQ page</Link> for more information.
        </span>
      ),
    },
  ]

  return (
    <section className="w-full py-12">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-center px-4">
        <img
          src="https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images/Cards%20Design.png"
          alt="Upcoming plans cards"
          className="w-full rounded-lg shadow"
        />
        <div>
          <h2 className="font-[Barrio] text-4xl text-indigo-900 mb-4">Dig Into Philly</h2>
          <p className="mb-4 text-gray-700">
            A reminder of what you can do on Our Philly, besides adding events:
          </p>
          <div className="space-y-2">
            {items.map(({ title, body }, idx) => (
              <details key={idx} className="border rounded-md p-3">
                <summary className="cursor-pointer font-semibold">{title}</summary>
                <div className="mt-2 text-gray-700">{body}</div>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default function AboutPage() {
  return (
    <>
      <Helmet>
        <title>About | Our Philly</title>
        <meta name="description" content="Learn more about Our Philly and how to get involved." />
      </Helmet>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="container mx-auto px-4 py-12 flex-grow mt-32">
          <h1 className="text-3xl font-[Barrio] text-center text-[#28313e] mb-8">About Our Philly</h1>
          <DigIntoPhillySection />
        </main>
        <Footer />
      </div>
    </>
  )
}

