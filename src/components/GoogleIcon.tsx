import React from 'react';

export default function GoogleIcon({ className = "w-5 h-5 shrink-0" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" suppressHydrationWarning>
      <path
        d="M22.56 12.25C22.56 11.47 22.49 10.72 22.36 10H12V14.26H17.92C17.67 15.63 16.86 16.8 15.65 17.61V20.34H19.22C21.31 18.42 22.56 15.6 22.56 12.25Z"
        fill="#4285F4"
        suppressHydrationWarning
      />
      <path
        d="M12 23C14.97 23 17.46 22.02 19.22 20.34L15.65 17.61C14.7 18.25 13.44 18.63 12 18.63C9.23 18.63 6.88 16.76 6.04 14.25H2.36V17.1C4.14 20.63 7.78 23 12 23Z"
        fill="#34A853"
        suppressHydrationWarning
      />
      <path
        d="M6.04 14.25C5.83 13.62 5.71 12.82 5.71 12C5.71 11.18 5.83 10.38 6.04 9.75V6.9H2.36C1.62 8.38 1.2 10.14 1.2 12C1.2 13.86 1.62 15.62 2.36 17.1L6.04 14.25Z"
        fill="#FBBC05"
        suppressHydrationWarning
      />
      <path
        d="M12 5.38C13.62 5.38 15.06 5.94 16.2 7.03L19.3 3.93C17.45 2.21 14.97 1.2 12 1.2C7.78 1.2 4.14 3.57 2.36 6.9L6.04 9.75C6.88 7.24 9.23 5.38 12 5.38Z"
        fill="#EA4335"
        suppressHydrationWarning
      />
    </svg>
  );
}
