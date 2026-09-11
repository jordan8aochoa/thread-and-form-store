// Review this replaceable policy copy and product size guide before accepting orders.
export const policies: Record<
  string,
  { title: string; eyebrow: string; intro: string; sections: { title: string; text: string }[] }
> = {
  about: {
    title: 'Made for the in-between.',
    eyebrow: 'A little about us',
    intro:
      'The morning coffee. The long way home. The extra layer you bring just in case. Thread & Form begins with these ordinary moments.',
    sections: [
      {
        title: 'A quieter wardrobe',
        text: 'Our idea is simple: thoughtful shapes, inviting texture, and pieces you look forward to wearing again. We believe getting dressed can feel easy, personal, and a little more considered.',
      },
      {
        title: 'The everyday collection',
        text: 'From a familiar crewneck to a relaxed cardigan, our collection makes room for your own way of wearing things. Explore the details, find your fit, and make it yours.',
      },
      {
        title: 'A brand in the making',
        text: 'This is our placeholder brand story. Replace it with your founder story, sourcing details, materials, and verified production information before launch.',
      },
    ],
  },
  shipping: {
    title: 'From our door to yours.',
    eyebrow: 'Shipping policy',
    intro:
      'We currently ship within the United States. Available services and live shipping costs are shown after your address has been verified at checkout.',
    sections: [
      {
        title: 'Preparing your order',
        text: 'Our draft processing window is 2–3 business days after payment confirmation, excluding holidays. This is separate from carrier transit time. The store owner must confirm this window before launch. You’ll receive an email when your order is on its way.',
      },
      {
        title: 'Shipping services & estimates',
        text: 'Choose from the carrier services available for your address at checkout. Transit estimates are supplied by the carrier and are not guaranteed. Complimentary shipping, when available, is shown before payment. Taxes are calculated during secure payment.',
      },
      {
        title: 'Your address',
        text: 'Please carefully review your verified address, including apartment or unit details. Contact us promptly if you notice an error. Address changes may not be possible after a label has been purchased or a parcel dispatched.',
      },
      {
        title: 'Tracking & delivery',
        text: 'Your shipping email includes a tracking link. Carrier scans can take time to appear. If your parcel is delayed, lost, or marked delivered but cannot be found, contact us with your order number so we can help investigate.',
      },
    ],
  },
  returns: {
    title: 'Let’s find the right fit.',
    eyebrow: 'Returns & refunds',
    intro:
      'We want you to feel good in your sweater. This is draft policy wording for the store owner to review before launch.',
    sections: [
      {
        title: 'Requesting a return',
        text: 'Our proposed return window is 30 days after delivery. Contact us with your order number and the item you’d like to return before sending anything back. We’ll provide instructions and the correct return address.',
      },
      {
        title: 'Return condition',
        text: 'Items should be unworn, unwashed, and returned with their original tags. Please tell us promptly about a faulty, damaged, or incorrect item. Applicable consumer rights remain unaffected.',
      },
      {
        title: 'Return shipping',
        text: 'Unless your item is faulty or we sent the wrong item, return shipping costs are the customer’s responsibility under this draft policy. Original delivery charges are generally nonrefundable except where applicable rights require otherwise.',
      },
      {
        title: 'Refunds & exchanges',
        text: 'After we receive and inspect your return, we’ll confirm the outcome by email. Approved refunds go to the original payment method; your bank’s processing time may vary. For a different size or color, contact us about available stock before placing a replacement order.',
      },
    ],
  },
  privacy: {
    title: 'Your information, considered.',
    eyebrow: 'Privacy policy',
    intro:
      'This draft explains the information used to operate this store. The store owner must complete and review it for the business and jurisdictions served.',
    sections: [
      {
        title: 'Information you provide',
        text: 'We collect the name, email, shipping address, optional phone number, and order details needed to fulfill your purchase. We also keep messages you send through our contact form and newsletter preferences you choose to provide.',
      },
      {
        title: 'Payments & service providers',
        text: 'Card details are entered directly on Stripe’s hosted checkout. We do not collect or store card numbers. Supabase supports our database, authentication, and images; Stripe processes payments; EasyPost and carriers handle shipping; Resend delivers transactional emails; our hosting provider serves the website.',
      },
      {
        title: 'How information is used',
        text: 'We use your information to process and fulfill orders, provide support, send service updates, prevent abuse, and maintain business records. Newsletter signup is optional and separate from purchasing. We do not sell customer information.',
      },
      {
        title: 'Storage & retention',
        text: 'Your shopping bag is stored locally in your browser. Store administrators use secure authentication cookies. Order and transaction records are retained as needed for fulfillment, support, accounting, and applicable obligations. The business must set its retention schedule before launch.',
      },
      {
        title: 'Your choices',
        text: 'Contact the support email in the footer to ask about access, correction, or deletion of your personal information. Some transaction records may need to be retained. Newsletter emails must include an unsubscribe method. This site does not add advertising trackers by default.',
      },
    ],
  },
  terms: {
    title: 'The details that matter.',
    eyebrow: 'Terms of service',
    intro:
      'These draft terms describe shopping with this store. The owner must replace the placeholder business details and review the terms before launch.',
    sections: [
      {
        title: 'Products & availability',
        text: 'Prices are listed in US dollars. Product photographs are illustrative and screen colors can vary. Check the product description, selected size, and color before ordering. Stock and pricing are verified again when checkout begins.',
      },
      {
        title: 'Orders & payment',
        text: 'Checkout uses Stripe to process payment securely. An order is confirmed after successful payment is verified, and an order confirmation is sent by email. If an order cannot be fulfilled, we will contact you and arrange an appropriate resolution or refund.',
      },
      {
        title: 'Shipping & returns',
        text: 'Our shipping and returns policies describe delivery options, estimates, and the return process. They form part of these terms. Mandatory consumer protections remain unaffected.',
      },
      {
        title: 'Use of the store',
        text: 'Use the website lawfully and provide accurate information. Do not attempt to access private customer or administrative data, interfere with the service, or misuse payment or discount features.',
      },
      {
        title: 'Contact & business details',
        text: 'Questions about your order or these terms can be sent to the support email in the footer. The owner must add the legal business name, mailing address, applicable governing terms, and effective date before opening the store.',
      },
    ],
  },
};
export const faq = [
  {
    question: 'How do I choose my size?',
    answer:
      'Use the size guide on each product page and check the product description for fit notes. If you’re between sizes or need a hand, get in touch before ordering.',
  },
  {
    question: 'Do I need an account?',
    answer:
      'No. Guest checkout is the default. Your confirmation email includes a private order link, and you can request another through Find your order.',
  },
  {
    question: 'Where do you ship?',
    answer:
      'We currently support US domestic addresses. Enter your address at checkout to see the carrier services available for your location.',
  },
  {
    question: 'How much does shipping cost?',
    answer:
      'Shipping is calculated live using your verified address and the weight of your selected items. You choose a service and review its price before payment.',
  },
  {
    question: 'Can I change or cancel an order?',
    answer:
      'Contact us as soon as possible with your order number. We’ll check its fulfillment status. Once a parcel has shipped, we may need to arrange a return instead.',
  },
  {
    question: 'How do I track my order?',
    answer:
      'We’ll email you when your parcel ships. You can also use Find your order to receive a secure link with tracking and fulfillment updates.',
  },
  {
    question: 'How should I care for my sweater?',
    answer:
      'Follow the care label on your garment. Folding rather than hanging helps knits keep their shape. See each product description for any specific care instructions.',
  },
];
