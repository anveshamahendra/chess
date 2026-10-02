"use client";

import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { isSoundEnabled, setSoundEnabled, playSound } from "@/lib/sounds";

export function SoundToggle() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    setEnabled(isSoundEnabled());
  }, []);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    setSoundEnabled(next);
    if (next) playSound("notify");
  }

  return (
    <button onClick={toggle} className="p-2 text-gray-600 hover:text-black" aria-label="Toggle sound">
      {enabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
    </button>
  );
}
