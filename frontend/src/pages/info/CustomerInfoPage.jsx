import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Mail, MessageCircleQuestion } from 'lucide-react'
import Navbar from '../../components/layout/Navbar.jsx'
import Footer from '../../components/layout/Footer.jsx'

const policyPages = {
  shipping: {
    title: 'Shipping policy',
    eyebrow: 'DELIVERY',
    intro: 'We currently offer free shipping across India.',
    sections: [
      ['Where we deliver', 'Free shipping is available across India. If a delivery address cannot be served, we will contact you before the order is fulfilled.'],
      ['Delivery estimates', 'Delivery estimates depend on the seller, destination, and carrier. Any estimate shown during checkout or in an order update is informational and may change.'],
      ['Tracking and delays', 'Order progress is available from Your orders. Carrier delays, weather, and other events outside the seller’s control can affect delivery. Contact customer care if an order appears stuck.'],
      ['Marketplace orders', 'An order may contain products from different sellers. Items may ship separately and arrive at different times.'],
    ],
  },
  returns: {
    title: 'Returns and refunds',
    eyebrow: 'AFTER YOUR ORDER',
    intro: 'You may submit a return request within 30 days after delivery for an eligible paid order.',
    sections: [
      ['Requesting a return', 'Open Your orders, choose the delivered order, and submit the return reason and any helpful details. Our team reviews each request individually. Submitting a request does not guarantee approval.'],
      ['Refunds', 'If a return is approved, the refund is handled through the original payment route where available. Cash-on-delivery refunds are reviewed and handled manually. Processing time depends on the payment provider and operational review; no fixed refund timeline is promised.'],
      ['Order-level requests', 'Returns currently apply to the whole order rather than individual seller items. For a marketplace order, contact customer care if only part of the order has an issue.'],
      ['Need help?', 'Contact help@goodthings.shop and include your order number and a description of the issue.'],
    ],
  },
  privacy: {
    title: 'Privacy notice',
    eyebrow: 'YOUR INFORMATION',
    intro: 'This page is a draft overview for Goodthings customers and must be reviewed against the business’s actual practices before launch.',
    sections: [
      ['Information used', 'The service uses account and contact details, delivery addresses, order and payment status, reviews, and a session-scoped visitor identifier and visit events to operate the marketplace, understand site visits, and provide customer support. Payment card details are handled by the payment provider and are not intended to be stored by this storefront.'],
      ['Why it is used', 'Information is used to provide accounts, process and deliver orders, prevent misuse, respond to support requests, and meet applicable record-keeping obligations.'],
      ['Marketplace and service providers', 'Order details needed for fulfillment may be shared with the relevant seller, delivery provider, or payment provider. The actual vendors, processing locations, retention periods, and safeguards must be confirmed by the store operator.'],
      ['Your choices', 'You can review your profile and contact customer care about account or privacy questions. Applicable rights and request procedures depend on the laws that apply to the operator and customer.'],
      ['Operator review required', 'Before publication, replace this draft with the operator’s legal name, privacy contact, data-retention schedule, provider list, complaint process, and legally reviewed privacy disclosures.'],
    ],
  },
  terms: {
    title: 'Terms of service',
    eyebrow: 'SHOPPING TERMS',
    intro: 'This page is a draft summary, not a substitute for terms prepared for the marketplace operator and reviewed by qualified counsel.',
    sections: [
      ['Marketplace role', 'Goodthings provides a storefront for products sold by the platform or approved independent sellers. Product listings identify sellers where seller information is available.'],
      ['Orders and payment', 'An order is subject to product availability, seller confirmation, and successful payment where applicable. Prices, discounts, and order totals are confirmed by the server at checkout.'],
      ['Delivery and returns', 'Delivery, returns, and refunds are subject to the Shipping policy and Returns and refunds policy, and applicable law.'],
      ['Prices and taxes', 'Applicable GST is included in listed prices. No separate tax amount is added at checkout.'],
      ['Accounts', 'Keep account credentials secure and provide accurate contact and delivery details. The store may restrict access when required to protect customers, sellers, or the service.'],
      ['Operator review required', 'Before publication, add the operator’s legal identity, governing law, dispute-resolution process, seller obligations, liability terms, and legally required consumer disclosures.'],
    ],
  },
}

const faqs = [
  ['How can I track an order?', 'Sign in and open Your orders to see payment status, fulfillment progress, and available return actions.'],
  ['How do I request a return?', 'For an eligible paid order marked delivered, submit a request from Your orders within 30 days of delivery. The team reviews each request.'],
  ['When will I receive my refund?', 'Refund timing varies by payment route and review. The team does not promise a fixed processing timeline.'],
  ['Do you charge for shipping?', 'Shipping is currently free across India. Delivery estimates can vary by seller and destination.'],
  ['Are taxes added at checkout?', 'Applicable GST is included in listed prices; no additional tax line is added at checkout.'],
  ['Can I contact a seller directly?', 'For help with an order, contact customer care at help@goodthings.shop and include the order number.'],
]

export default function CustomerInfoPage() {
  const { policy } = useParams()
  const page = Object.hasOwn(policyPages, policy) ? policyPages[policy] : null

  return <div className="min-h-screen bg-[#f5f6f8] text-slate-800">
    <Navbar />
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-[#2874f0]"><ArrowLeft size={16} /> Back to shop</Link>
      {page ? <article className="mt-7 rounded-2xl border border-slate-200 bg-white p-6 sm:p-10">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-[#2874f0]">{page.eyebrow}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#172337]">{page.title}</h1>
        <p className="mt-4 text-sm leading-6 text-slate-600">{page.intro}</p>
        <div className="mt-8 space-y-7">{page.sections.map(([title, text]) => <section key={title}><h2 className="font-semibold text-[#172337]">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></section>)}</div>
      </article> : policy ? <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-8 text-center"><h1 className="text-2xl font-bold text-[#172337]">Policy page not found</h1><Link className="mt-4 inline-block text-sm font-semibold text-[#2874f0]" to="/help">Visit help and FAQs</Link></section> : <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-6 sm:p-10">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-[#2874f0]">WE’RE HERE TO HELP</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#172337]">Help and frequently asked questions</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Find quick answers below, or contact our customer care team for help with an order.</p>
        <a href="mailto:help@goodthings.shop" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#172337] px-4 py-3 text-sm font-semibold text-white hover:bg-[#2874f0]"><Mail size={16} /> Email customer care</a>
        <div className="mt-9 divide-y divide-slate-100">{faqs.map(([question, answer]) => <section className="py-5 first:pt-0 last:pb-0" key={question}><h2 className="flex items-center gap-2 text-sm font-semibold text-[#172337]"><MessageCircleQuestion size={16} className="text-[#2874f0]" />{question}</h2><p className="mt-2 pl-6 text-sm leading-6 text-slate-600">{answer}</p></section>)}</div>
        <div className="mt-8 flex flex-wrap gap-4 border-t border-slate-100 pt-5 text-sm font-medium text-[#2874f0]"><Link to="/policies/shipping">Shipping policy</Link><Link to="/policies/returns">Returns and refunds</Link><Link to="/policies/privacy">Privacy notice</Link><Link to="/policies/terms">Terms of service</Link></div>
      </section>}
    </main>
    <Footer />
  </div>
}
