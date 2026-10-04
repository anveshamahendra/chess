"use client";

import { NavBar } from "@/components/nav/NavBar";
import { FeatureCard } from "@/components/cards/FeatureCard";
import { Swords, Puzzle, Bot, LineChart, Trophy } from "lucide-react";

const features = [
  {
    title: "play",
    description: "Start a game, share the link, play live.",
    icon: Swords,
    accentColor: "var(--accent-play)",
    ctaLabel: "play chess",
    href: "/play/new",
  },
  {
    title: "vs bot",
    description: "Practice against the computer, any difficulty.",
    icon: Bot,
    accentColor: "var(--accent-bot)",
    ctaLabel: "play a bot",
    href: "/play/bot",
  },
  {
    title: "dashboard",
    description: "Your rating, your stats, your games.",
    icon: LineChart,
    accentColor: "var(--accent-dashboard)",
    ctaLabel: "view dashboard",
    href: "/dashboard",
  },
  {
    title: "puzzles",
    description: "Sharpen your tactics, one puzzle at a time.",
    icon: Puzzle,
    accentColor: "var(--accent-puzzles)",
    ctaLabel: "play puzzles",
    href: "/puzzles",
    tag: "new" as const,
  },
  {
    title: "leaderboard",
    description: "See who's on top.",
    icon: Trophy,
    accentColor: "var(--accent-leaderboard)",
    ctaLabel: "view leaderboard",
    href: "/leaderboard",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-page">
      <NavBar />
      <div className="px-4 md:px-8 py-10">
        <p className="text-gray-500 dark:text-gray-400 mb-8">Simple, clean chess. Play with a friend in seconds.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {features.map((f) => (
            <FeatureCard key={f.title} {...f} />
          ))}
        </div>
      </div>
    </div>
  );
}
