"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { LucideIcon } from "lucide-react";
import { PillButton } from "@/components/ui/PillButton";
import { Badge } from "@/components/ui/Badge";

interface FeatureCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  accentColor: string;
  ctaLabel: string;
  href: string;
  tag?: "new" | "soon";
  previewImages?: string[];
}

export function FeatureCard({
  title,
  description,
  icon: Icon,
  accentColor,
  ctaLabel,
  href,
  tag,
  previewImages = [],
}: FeatureCardProps) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="relative overflow-hidden rounded-[26px] bg-card p-6 md:p-8 flex flex-col"
    >
      <div className="flex items-center gap-2 mb-6">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ backgroundColor: accentColor }}
        >
          <Icon className="h-6 w-6 text-white" strokeWidth={2} />
        </div>
        {tag && <Badge>{tag}</Badge>}
      </div>

      <h3 className="text-2xl md:text-3xl font-bold lowercase text-[#f5f5f5] mb-3">
        {title}
      </h3>
      <p className="text-[#a3a3a3] text-[15px] leading-relaxed mb-6 max-w-xs">
        {description}
      </p>

      <Link href={href}>
        <PillButton variant="primary">{ctaLabel}</PillButton>
      </Link>

      {previewImages.length > 0 && (
        <div className="relative mt-8 flex-1 min-h-[180px]">
          {previewImages.map((src, i) => (
            <motion.div
              key={i}
              className="absolute bottom-0 right-0 w-3/4 rounded-2xl overflow-hidden shadow-2xl"
              style={{
                zIndex: i,
                transform: `rotate(${(i - previewImages.length / 2) * 6}deg) translateX(${i * 12}px)`,
              }}
              whileHover={{
                transform: `rotate(${(i - previewImages.length / 2) * 10}deg) translateX(${i * 24}px)`,
              }}
            >
              <img src={src} alt="" className="w-full h-full object-cover" />
            </motion.div>
          ))}
          <motion.button
            whileHover={{ scale: 1.1 }}
            className="absolute bottom-2 right-2 z-50 flex h-9 w-9 items-center justify-center rounded-full bg-white text-black"
          >
            →
          </motion.button>
        </div>
      )}
    </motion.div>
  );
}
