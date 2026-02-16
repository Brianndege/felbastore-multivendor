export default function TermsPage() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-2xl">
      <h1 className="text-3xl font-bold text-[#e16b22] mb-4">Terms of Service</h1>
      <p className="mb-4 text-gray-600">Welcome to Felbastore. These terms govern your use of our services and website.</p>
      <ul className="list-decimal pl-6 text-gray-700 mb-4">
        <li>By using Felbastore, you agree to these terms.</li>
        <li>Do not use our service to conduct illegal activity.</li>
        <li>We may modify these terms at any time, with notice.</li>
        <li>For B2B/vendorship, additional agreements may apply.</li>
      </ul>
      <p className="text-gray-500 mb-2">Questions? Contact us anytime at support@felbastore.co.ke.</p>
      <div className="text-sm text-gray-400">This is a placeholder. You may provide your own full terms, or request an editable, legally reviewed policy.</div>
    </div>
  );
}
