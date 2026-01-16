'use client';

import { useEffect, useState } from 'react';

export function DesktopGuard({ children }: { children: React.ReactNode }) {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            // Simple check: if width < 1024px (standard tailwind lg breakpoint, or we can use md 768px)
            // The user wants "Linear Calendar" which requires width.
            // Let's set a safe limit, e.g., 1000px.
            setIsMobile(window.innerWidth < 1024);
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    if (isMobile) {
        return (
            <div className="flex h-screen w-full items-center justify-center p-8 text-center bg-neutral-950 text-neutral-400">
                <div>
                    <h2 className="text-xl font-bold mb-2 text-white">Desktop Only</h2>
                    <p>The Linear Calendar is designed for larger screens. Please open this page on your desktop.</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
