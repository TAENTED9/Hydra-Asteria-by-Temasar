'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NavBar: React.FunctionComponent = () => {
  const pathname = usePathname() || '';
  const isActive = (route: string): string => pathname.includes(route) ? 'text-[#FFF75D]' : 'text-[#F1E9D9]';

  return (
    <div className="w-full h-[64px]">
      <div className="fixed w-full h-[64px] px-10 flex flex-row items-center bg-[#171717] z-[9000]">
        <div className="flex flex-row items-end flex-auto basis-1/4">
          <div className="flex-none">
            <Link href="/">
              <img
                className="h-8 sm:h-10 md:h-12 w-auto mx-0 absolute top-2 left-4"
                src="/hydra.svg"
                alt="Hydra Logo"
                style={{ maxWidth: "10%", height: "auto" }}
              />
            </Link>
          </div>
          {pathname !== '/' && (
            <span className="font-inter-regular text-md text-[#606060] ml-[-16px] pointer-events-none">
              By Mesh
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default NavBar;