export default function PrivacyPolicyPage() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-2xl">
      <h1 className="text-3xl font-bold text-[#e16b22] mb-4">Privacy Policy</h1>
      <p className="mb-4 text-gray-600">We respect your privacy. This page describes how Felbastore collects, uses, and protects your information.</p>
      <div className="bg-orange-50 rounded p-4 mb-4 text-[#e16b22]">Your privacy is important to us.</div>
      <ul className="list-disc text-gray-700 mb-4 pl-6">
        <li>We do <strong>not</strong> sell your data.</li>
        <li>We use secure payment and data encryption.</li>
        <li>We only collect data needed to process your orders and improve our service.</li>
      </ul>
      <p className="text-gray-600 mb-4">You may request to view or delete your data at any time. For more, contact support@felbastore.co.ke.</p>
      <div className="text-sm text-gray-400">This is a placeholder. We can provide a full legal policy or GDPR/CCPA compliance content on request.</div>
    </div>
  );
}
