export default function AccessibilityPage() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-lg">
      <h1 className="text-3xl font-bold text-[#e16b22] mb-4">Accessibility</h1>
      <p className="mb-6 text-gray-600">Felbastore is committed to providing an accessible and usable shopping experience for everyone.</p>
      <div className="bg-orange-50 text-[#e16b22] rounded p-4 mb-4">If you encounter any accessibility difficulties using our website, please contact us at <a className="underline" href="mailto:support@felbastore.co.ke">support@felbastore.co.ke</a> and we will help promptly.</div>
      <ul className="list-disc text-gray-700 pl-6 mb-4">
        <li>We strive for WCAG AA compliance for our visual design</li>
        <li>Keyboard navigation and alt text on all images</li>
        <li>Continuous accessibility improvements based on feedback</li>
      </ul>
      <div className="text-sm text-gray-400">This is a placeholder. We can expand on your accessibility features or add a formal policy on request.</div>
    </div>
  );
}
