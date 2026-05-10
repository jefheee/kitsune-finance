import Image from "next/image";

export default function Home() {
  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col bg-[#fcfaf8] group/design-root overflow-x-hidden">
      <div className="flex gap-2 border-t border-[#f4ede6] bg-[#fcfaf8] px-4 pb-3 pt-2">
        <a className="just flex flex-1 flex-col items-center justify-end gap-1 rounded-full text-[#1d140c]" href="#">
          <div className="text-[#1d140c] flex h-8 items-center justify-center" data-icon="House" data-size="24px" data-weight="fill">
            <svg fill="currentColor" height="24px" viewBox="0 0 256 256" width="24px" xmlns="http://www.w3.org/2000/svg">
              <path d="M224,115.55V208a16,16,0,0,1-16,16H168a16,16,0,0,1-16-16V168a8,8,0,0,0-8-8H112a8,8,0,0,0-8,8v40a16,16,0,0,1-16,16H48a16,16,0,0,1-16-16V115.55a16,16,0,0,1,5.17-11.78l80-75.48.11-.11a16,16,0,0,1,21.53,0,1.14,1.14,0,0,0,.11.11l80,75.48A16,16,0,0,1,224,115.55Z"></path>
            </svg>
          </div>
          <p className="text-[#1d140c] text-xs font-medium leading-normal tracking-[0.015em]">Home</p>
        </a>
        <a className="just flex flex-1 flex-col items-center justify-end gap-1 text-[#a17145]" href="#">
          <div className="text-[#a17145] flex h-8 items-center justify-center" data-icon="Briefcase" data-size="24px" data-weight="regular">
            <svg fill="currentColor" height="24px" viewBox="0 0 256 256" width="24px" xmlns="http://www.w3.org/2000/svg">
              <path d="M216,56H176V48a24,24,0,0,0-24-24H104A24,24,0,0,0,80,48v8H40A16,16,0,0,0,24,72V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V72A16,16,0,0,0,216,56ZM96,48a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96ZM216,72v41.61A184,184,0,0,1,128,136a184.07,184.07,0,0,1-88-22.38V72Zm0,128H40V131.64A200.19,200.19,0,0,0,128,152a200.25,200.25,0,0,0,88-20.37V200ZM104,112a8,8,0,0,1,8-8h32a8,8,0,0,1,0,16H112A8,8,0,0,1,104,112Z"></path>
            </svg>
          </div>
          <p className="text-[#a17145] text-xs font-medium leading-normal tracking-[0.015em]">Portfolio</p>
        </a>
        <a className="just flex flex-1 flex-col items-center justify-end gap-1 text-[#a17145]" href="#">
          <div className="text-[#a17145] flex h-8 items-center justify-center" data-icon="ArrowsLeftRight" data-size="24px" data-weight="regular">
            <svg fill="currentColor" height="24px" viewBox="0 0 256 256" width="24px" xmlns="http://www.w3.org/2000/svg">
              <path d="M213.66,181.66l-32,32a8,8,0,0,1-11.32-11.32L188.69,184H48a8,8,0,0,1,0-16H188.69l-18.35-18.34a8,8,0,0,1,11.32-11.32l32,32A8,8,0,0,1,213.66,181.66Zm-139.32-64a8,8,0,0,0,11.32-11.32L67.31,88H208a8,8,0,0,0,0-16H67.31L85.66,53.66A8,8,0,0,0,74.34,42.34l-32,32a8,8,0,0,0,0,11.32Z"></path>
            </svg>
          </div>
          <p className="text-[#a17145] text-xs font-medium leading-normal tracking-[0.015em]">Transfers</p>
        </a>
        <a className="just flex flex-1 flex-col items-center justify-end gap-1 text-[#a17145]" href="#">
          <div className="text-[#a17145] flex h-8 items-center justify-center" data-icon="User" data-size="24px" data-weight="regular">
            <svg fill="currentColor" height="24px" viewBox="0 0 256 256" width="24px" xmlns="http://www.w3.org/2000/svg">
              <path d="M230.92,212c-15.23-26.33-38.7-45.21-66.09-54.16a72,72,0,1,0-73.66,0C63.78,166.78,40.31,185.66,25.08,212a8,8,0,1,0,13.85,8c18.84-32.56,52.14-52,89.07-52s70.23,19.44,89.07,52a8,8,0,1,0,13.85-8ZM72,96a56,56,0,1,1,56,56A56.06,56.06,0,0,1,72,96Z"></path>
            </svg>
          </div>
          <p className="text-[#a17145] text-xs font-medium leading-normal tracking-[0.015em]">Profile</p>
        </a>
      </div>
      <div className="flex items-center bg-[#fcfaf8] p-4 pb-2 justify-between">
        <div className="flex size-12 shrink-0 items-center justify-center">
          <img src="/assets/logo/logo.png" alt="Kitsune Finance Logo" className="w-8 h-8 object-contain" />
        </div>
        <h2 className="text-[#1d140c] text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">Dashboard</h2>
        <div className="flex w-12 items-center justify-end">
          <button className="flex max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 bg-transparent text-[#1d140c] gap-2 text-base font-bold leading-normal tracking-[0.015em] min-w-0 p-0">
            <div className="text-[#1d140c]" data-icon="Bell" data-size="24px" data-weight="regular">
              <svg fill="currentColor" height="24px" viewBox="0 0 256 256" width="24px" xmlns="http://www.w3.org/2000/svg">
                <path d="M221.8,175.94C216.25,166.38,208,139.33,208,104a80,80,0,1,0-160,0c0,35.34-8.26,62.38-13.81,71.94A16,16,0,0,0,48,200H88.81a40,40,0,0,0,78.38,0H208a16,16,0,0,0,13.8-24.06ZM128,216a24,24,0,0,1-22.62-16h45.24A24,24,0,0,1,128,216ZM48,184c7.7-13.24,16-43.92,16-80a64,64,0,1,1,128,0c0,36.05,8.28,66.73,16,80Z"></path>
              </svg>
            </div>
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-3 px-4 py-3">
        <div className="flex min-w-[111px] flex-1 basis-[fit-content] flex-col gap-2 rounded-lg border border-[#eadbcd] p-3 items-center text-center">
          <p className="text-[#1d140c] tracking-light text-2xl font-bold leading-tight">$24,500.00</p>
          <div className="flex items-center gap-2">
            <p className="text-[#a17145] text-sm font-normal leading-normal">Total Balance</p>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-4 px-4 py-6">
        <div className="flex min-w-72 flex-1 flex-col gap-2">
          <p className="text-[#1d140c] text-base font-medium leading-normal">Portfolio Performance</p>
          <p className="text-[#1d140c] tracking-light text-[32px] font-bold leading-tight truncate">+ $1,250.00</p>
          <div className="flex gap-1">
            <p className="text-[#a17145] text-base font-normal leading-normal">1M</p>
            <p className="text-[#07880e] text-base font-medium leading-normal">+5.3%</p>
          </div>
          <div className="flex min-h-[180px] flex-1 flex-col gap-8 py-4">
            <svg fill="none" height="148" preserveAspectRatio="none" viewBox="-3 0 478 150" width="100%" xmlns="http://www.w3.org/2000/svg">
              <path d="M0 109C18.1538 109 18.1538 21 36.3077 21C54.4615 21 54.4615 41 72.6154 41C90.7692 41 90.7692 93 108.923 93C127.077 93 127.077 33 145.231 33C163.385 33 163.385 101 181.538 101C199.692 101 199.692 61 217.846 61C236 61 236 45 254.154 45C272.308 45 272.308 121 290.462 121C308.615 121 308.615 149 326.769 149C344.923 149 344.923 1 363.077 1C381.231 1 381.231 81 399.385 81C417.538 81 417.538 129 435.692 129C453.846 129 453.846 25 472 25V149H326.769H0V109Z" fill="url(#paint0_linear_1131_5935)"></path>
              <path d="M0 109C18.1538 109 18.1538 21 36.3077 21C54.4615 21 54.4615 41 72.6154 41C90.7692 41 90.7692 93 108.923 93C127.077 93 127.077 33 145.231 33C163.385 33 163.385 101 181.538 101C199.692 101 199.692 61 217.846 61C236 61 236 45 254.154 45C272.308 45 272.308 121 290.462 121C308.615 121 308.615 149 326.769 149C344.923 149 344.923 1 363.077 1C381.231 1 381.231 81 399.385 81C417.538 81 417.538 129 435.692 129C453.846 129 453.846 25 472 25" stroke="#a17145" strokeLinecap="round" strokeWidth="3"></path>
              <defs>
                <linearGradient gradientUnits="userSpaceOnUse" id="paint0_linear_1131_5935" x1="236" x2="236" y1="1" y2="149">
                  <stop stopColor="#f4ede6"></stop>
                  <stop offset="1" stopColor="#f4ede6" stopOpacity="0"></stop>
                </linearGradient>
              </defs>
            </svg>
            <div className="flex justify-around">
              <p className="text-[#a17145] text-[13px] font-bold leading-normal tracking-[0.015em]">Mon</p>
              <p className="text-[#a17145] text-[13px] font-bold leading-normal tracking-[0.015em]">Tue</p>
              <p className="text-[#a17145] text-[13px] font-bold leading-normal tracking-[0.015em]">Wed</p>
              <p className="text-[#a17145] text-[13px] font-bold leading-normal tracking-[0.015em]">Thu</p>
              <p className="text-[#a17145] text-[13px] font-bold leading-normal tracking-[0.015em]">Fri</p>
              <p className="text-[#a17145] text-[13px] font-bold leading-normal tracking-[0.015em]">Sat</p>
              <p className="text-[#a17145] text-[13px] font-bold leading-normal tracking-[0.015em]">Sun</p>
            </div>
          </div>
        </div>
      </div>
      <div className="flex justify-stretch">
        <div className="flex flex-1 gap-3 flex-wrap px-4 py-3 justify-between">
          <button className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-5 bg-[#ff7b00] text-[#1d140c] text-base font-bold leading-normal tracking-[0.015em]">
            <span className="truncate">Deposit</span>
          </button>
          <button className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-5 bg-[#ff7b00] text-[#1d140c] text-base font-bold leading-normal tracking-[0.015em]">
            <span className="truncate">Transfer</span>
          </button>
        </div>
      </div>
      <div className="h-5 bg-[#fcfaf8]"></div>
      <div className="px-margin-mobile py-lg bg-background w-full">
        <h3 className="font-headline-md text-on-surface mb-md">Active Positions</h3>
        <div className="flex flex-col gap-sm">
          <div className="bg-surface rounded-xl p-md border border-outline-variant/30 flex justify-between items-center shadow-[0px_4px_20px_rgba(17,24,39,0.05)] transition-transform hover:-translate-y-[2px]">
            <div className="flex items-center gap-md">
              <div className="w-12 h-12 rounded-full bg-primary-container/10 text-primary flex items-center justify-center">
                <span className="material-symbols-outlined">monitoring</span>
              </div>
              <div>
                <div className="font-label-md font-bold text-on-surface">AAPL</div>
                <div className="font-label-sm text-on-surface-variant font-normal">Apple Inc.</div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-label-md font-bold text-on-surface">$185.92</div>
              <div className="font-label-sm text-primary font-medium flex items-center justify-end gap-xs">
                <span className="material-symbols-outlined text-[14px]">arrow_upward</span>
                1.2%
              </div>
            </div>
          </div>
          <div className="bg-surface rounded-xl p-md border border-outline-variant/30 flex justify-between items-center shadow-[0px_4px_20px_rgba(17,24,39,0.05)] transition-transform hover:-translate-y-[2px]">
            <div className="flex items-center gap-md">
              <div className="w-12 h-12 rounded-full bg-primary-container/10 text-primary flex items-center justify-center">
                <span className="material-symbols-outlined">electric_car</span>
              </div>
              <div>
                <div className="font-label-md font-bold text-on-surface">TSLA</div>
                <div className="font-label-sm text-on-surface-variant font-normal">Tesla, Inc.</div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-label-md font-bold text-on-surface">$242.50</div>
              <div className="font-label-sm text-tertiary font-medium flex items-center justify-end gap-xs">
                <span className="material-symbols-outlined text-[14px]">arrow_downward</span>
                0.5%
              </div>
            </div>
          </div>
          <div className="bg-surface rounded-xl p-md border border-outline-variant/30 flex justify-between items-center shadow-[0px_4px_20px_rgba(17,24,39,0.05)] transition-transform hover:-translate-y-[2px]">
            <div className="flex items-center gap-md">
              <div className="w-12 h-12 rounded-full bg-primary-container/10 text-primary flex items-center justify-center">
                <span className="material-symbols-outlined">cloud</span>
              </div>
              <div>
                <div className="font-label-md font-bold text-on-surface">MSFT</div>
                <div className="font-label-sm text-on-surface-variant font-normal">Microsoft Corp.</div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-label-md font-bold text-on-surface">$378.85</div>
              <div className="font-label-sm text-primary font-medium flex items-center justify-end gap-xs">
                <span className="material-symbols-outlined text-[14px]">arrow_upward</span>
                2.1%
              </div>
            </div>
          </div>
        </div>
        <button className="w-full mt-lg py-3 rounded-full border-2 border-outline text-on-surface font-label-md font-bold flex justify-center items-center gap-2 hover:bg-surface-variant transition-colors">
          View All Assets
          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
        </button>
      </div>
    </div>
  );
}
