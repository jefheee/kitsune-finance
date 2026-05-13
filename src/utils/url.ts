export const getURL = () => {
  let url =
    process?.env?.NEXT_PUBLIC_SITE_URL ??
    process?.env?.NEXT_PUBLIC_VERCEL_URL ??
    'http://localhost:3000/';
  
  // Inclui 'https://' caso falte (útil no Vercel)
  url = url.startsWith('http') ? url : `https://${url}`;
  
  // Remove slash final
  url = url.charAt(url.length - 1) === '/' ? url.slice(0, -1) : url;
  
  return url;
};
