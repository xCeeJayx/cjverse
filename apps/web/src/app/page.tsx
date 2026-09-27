import React from 'react';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <h1 className="text-5xl font-extrabold tracking-tight bg-gradient-to-r from-amber-400 via-rose-500 to-indigo-500 bg-clip-text text-transparent mb-4">
        CJVerse Arena
      </h1>
      <p className="text-lg text-slate-400 max-w-md">
        Enter real-time skirmishes and collect mythical cards across races, elements, and evolutionary tiers.
      </p>
    </main>
  );
}
