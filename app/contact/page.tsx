import { ContactForm } from '@/components/contact-form';
import { getSettings } from '@/lib/catalog';
export const metadata = {
  title: 'Get in touch',
  description: 'A question about fit, your order, or something else? We’re here to help.',
};
export default async function ContactPage() {
  const settings = await getSettings();
  return (
    <div className="container">
      <article className="policy">
        <p className="eyebrow">A real conversation</p>
        <h1>We’re all ears.</h1>
        <p>
          A question about your order, a hand with sizing, or just a hello. Drop us a note below, or
          email{' '}
          <a className="underline" href={`mailto:${settings.support_email}`}>
            {settings.support_email}
          </a>
          .
        </p>
        <div className="mt-8">
          <ContactForm />
        </div>
      </article>
    </div>
  );
}
