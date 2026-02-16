export default function CookiesPage() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-lg">
      <h1 className="text-3xl font-bold text-[#e16b22] mb-4">Cookie Settings</h1>
      <p className="mb-4">Felbastore uses cookies to improve your browsing, remember preferences, and enhance security.</p>
      <div className="bg-orange-50 rounded p-4 mb-4 text-[#e16b22]">You can adjust your browser settings to manage cookies, or accept the use of cookies to continue.</div>
      <ul className="list-disc pl-6 text-gray-700 mb-4">
        <li>No ad tracking cookies are set by default</li>
        <li>Analytics cookies help us improve site experience, anonymized</li>
        <li>Session cookies keep your cart and login secure</li>
      </ul>
      <div className="text-sm text-gray-400">This is a placeholder. A live cookie consent tool can be added.</div>
    </div>
  );
}
