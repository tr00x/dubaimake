import React from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { LogoIcon } from './ui/Icons';
import { EASE } from './motion/Reveal';

interface PreloaderProps {
  isLoading: boolean;
}

export default function Preloader({ isLoading }: PreloaderProps) {
  const reduced = !!useReducedMotion();

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          className="fixed inset-0 z-[9999] flex h-[100dvh] w-screen touch-none items-center justify-center overscroll-none bg-ink"
          initial={{ y: "0%" }}
          animate={{ y: "0%" }}
          exit={reduced ? { opacity: 0 } : { y: "-100%" }}
          transition={{ duration: reduced ? 0.3 : 0.8, ease: EASE }}
        >
          <div className="flex flex-col items-center gap-5">
            <motion.div
              className="w-40"
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE }}
            >
              <LogoIcon className="block h-auto w-full brightness-0 invert" />
            </motion.div>

            <motion.div
              className="h-px w-40 origin-left bg-white"
              initial={reduced ? { opacity: 0 } : { scaleX: 0 }}
              animate={reduced ? { opacity: 1 } : { scaleX: 1 }}
              transition={{ duration: 1.1, ease: EASE, delay: 0.15 }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
