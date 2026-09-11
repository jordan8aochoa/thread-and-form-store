import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { policies, faq } from '@/lib/content';
import { getSettings } from '@/lib/catalog';
export async function generateMetadata({
  params,
}: {
  params: Promise<{ page: string }>;
}): Promise<Metadata> {
  const key = (await params).page;
  const content = policies[key];
  return {
    title: key === 'faq' ? 'Common questions' : content?.eyebrow || 'Page not found',
    description: content?.intro,
  };
}
export default async function ContentPage({ params }: { params: Promise<{ page: string }> }) {
  const key = (await params).page;
  const settings = await getSettings();
  if (key === 'faq')
    return (
      <div className="container">
        <article className="policy">
          <p className="eyebrow">A little clarity</p>
          <h1>Good questions.</h1>
          <p>
            Some helpful answers, all in one place. Need something else?{' '}
            <Link href="/contact" className="underline">
              We’re here.
            </Link>
          </p>
          {faq.map((item) => (
            <details key={item.question}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </article>
      </div>
    );
  const content = policies[key];
  if (!content) notFound();
  return (
    <div className="container">
      <article className="policy">
        <p className="eyebrow">{content.eyebrow}</p>
        <h1>{content.title}</h1>
        <p>{content.intro}</p>
        {content.sections.map((section) => (
          <section key={section.title}>
            <h2>{section.title}</h2>
            <p>{section.text.replaceAll('Thread & Form', settings.brand_name)}</p>
          </section>
        ))}
        <p className="mt-10">
          A question or a thought?{' '}
          <a className="underline" href={`mailto:${settings.support_email}`}>
            {settings.support_email}
          </a>
        </p>
        <Link className="text-link mt-5" href={key === 'about' ? '/shop' : '/contact'}>
          {key === 'about' ? 'Explore the collection' : 'Get in touch'}
        </Link>
      </article>
    </div>
  );
}
