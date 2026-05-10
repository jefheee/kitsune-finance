'use client';

import BottomNav from '@/components/BottomNav';

export default function Home() {
  return (
    <main className="relative flex min-h-screen w-full max-w-md mx-auto flex-col bg-[#fcfaf8] group/design-root overflow-x-hidden font-sans pb-24">
      
      <div className="flex items-center bg-[#fcfaf8] p-4 pb-2 justify-between">
        <div className="text-[#1d140c] flex size-12 shrink-0 items-center">
          <svg fill="currentColor" height="24px" viewBox="0 0 256 256" width="24px" xmlns="http://www.w3.org/2000/svg">
            <path d="M224,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128ZM40,72H216a8,8,0,0,0,0-16H40a8,8,0,0,0,0,16ZM216,184H40a8,8,0,0,0,0,16H216a8,8,0,0,0,0-16Z"></path>
          </svg>
        </div>
        <h2 className="text-[#1d140c] text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">Dashboard</h2>
        <div className="flex w-12 items-center justify-end">
          <button className="flex max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 bg-transparent text-[#1d140c] gap-2 text-base font-bold leading-normal tracking-[0.015em] min-w-0 p-0">
            <div className="text-[#1d140c]">
              <svg fill="currentColor" height="24px" viewBox="0 0 256 256" width="24px" xmlns="http://www.w3.org/2000/svg">
                <path d="M221.8,175.94C216.25,166.38,208,139.33,208,104a80,80,0,1,0-160,0c0,35.34-8.26,62.38-13.81,71.94A16,16,0,0,0,48,200H88.81a40,40,0,0,0,78.38,0H208a16,16,0,0,0,13.8-24.06ZM128,216a24,24,0,0,1-22.62-16h45.24A24,24,0,0,1,128,216ZM48,184c7.7-13.24,16-43.92,16-80a64,64,0,1,1,128,0c0,36.05,8.28,66.73,16,80Z"></path>
              </svg>
            </div>
          </button>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-3 px-4 py-3">
        <div className="flex min-w-[111px] flex-1 basis-[fit-content] flex-col gap-2 rounded-lg border border-[#eadbcd] p-3 items-center text-center">
          <p className="text-[#1d140c] tracking-light text-2xl font-bold leading-tight font-value">$24,500.00</p>
          <div className="flex items-center gap-2"><p className="text-[#a17145] text-sm font-normal leading-normal">Total Balance</p></div>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-4 px-4 py-6">
        <div className="flex min-w-72 flex-1 flex-col gap-2">
          <p className="text-[#1d140c] text-base font-medium leading-normal">Portfolio Performance</p>
          <p className="text-[#1d140c] tracking-light text-[32px] font-bold leading-tight truncate font-value">+ $1,250.00</p>
          <div className="flex gap-1">
            <p className="text-[#a17145] text-base font-normal leading-normal">1M</p>
            <p className="text-[#07880e] text-base font-medium leading-normal font-value">+5.3%</p>
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

      <div className="px-4 py-6 bg-white w-full rounded-t-3xl">
        <h3 className="text-xl text-[#1d140c] font-bold mb-4">Active Positions</h3>
        <div className="flex flex-col gap-2">
          
          <div className="bg-white rounded-xl p-4 border border-[#eadbcd] flex justify-between items-center transition-transform hover:-translate-y-[2px]">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[#ffdbc8] text-[#994700] flex items-center justify-center">
                M
              </div>
              <div>
                <div className="text-sm font-bold text-[#1d140c]">AAPL</div>
                <div className="text-xs text-[#584235] font-normal">Apple Inc.</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-[#1d140c] font-value">$185.92</div>
              <div className="text-xs text-[#994700] font-medium flex items-center justify-end gap-1 font-value">
                1.2%
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-4 border border-[#eadbcd] flex justify-between items-center transition-transform hover:-translate-y-[2px]">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[#ffdbc8] text-[#994700] flex items-center justify-center">
                E
              </div>
              <div>
                <div className="text-sm font-bold text-[#1d140c]">TSLA</div>
                <div className="text-xs text-[#584235] font-normal">Tesla, Inc.</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-[#1d140c] font-value">$242.50</div>
              <div className="text-xs text-[#585f6c] font-medium flex items-center justify-end gap-1 font-value">
                0.5%
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-4 border border-[#eadbcd] flex justify-between items-center transition-transform hover:-translate-y-[2px]">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[#ffdbc8] text-[#994700] flex items-center justify-center">
                C
              </div>
              <div>
                <div className="text-sm font-bold text-[#1d140c]">MSFT</div>
                <div className="text-xs text-[#584235] font-normal">Microsoft Corp.</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-[#1d140c] font-value">$378.85</div>
              <div className="text-xs text-[#994700] font-medium flex items-center justify-end gap-1 font-value">
                2.1%
              </div>
            </div>
          </div>
          
        </div>
        <button className="w-full mt-6 py-3 rounded-full border-2 border-[#8c7263] text-[#1d140c] text-sm font-bold flex justify-center items-center gap-2 hover:bg-[#e1e3e4] transition-colors">
          View All Assets
        </button>
      </div>

      <BottomNav />
    </main>
  );
}
