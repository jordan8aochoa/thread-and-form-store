import Link from 'next/link';
export function Footer({
  brand,
  support,
  social,
}: {
  brand: string;
  support: string;
  social: Record<string, string>;
}) {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <Link className="wordmark" href="/">
              {brand}
            </Link>
            <p>
              Thoughtfully simple knits.
              <br />
              For all the days in between.
            </p>
          </div>
          <div className="footer-col">
            <h3>Explore</h3>
            <Link href="/shop">The collection</Link>
            <Link href="/shop?sort=newest">New arrivals</Link>
            <Link href="/about">Our story</Link>
          </div>
          <div className="footer-col">
            <h3>Here to help</h3>
            <Link href="/contact">Contact us</Link>
            <Link href="/faq">Common questions</Link>
            <Link href="/orders">Find your order</Link>
            <Link href="/shipping">Shipping</Link>
            <Link href="/returns">Returns & exchanges</Link>
          </div>
          <div className="footer-col">
            <h3>Stay in touch</h3>
            <a href={`mailto:${support}`}>{support}</a>
            {Object.entries(social)
              .filter(([, url]) => /^https:\/\//.test(url))
              .map(([name, url]) => (
                <a href={url} key={name} rel="noopener noreferrer" target="_blank">
                  {name}
                </a>
              ))}
            <Link href="/admin">Store admin</Link>
          </div>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} {brand}. Good things, made to stay.
          </span>
          <div className="flex gap-5">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <span>USD · United States</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
