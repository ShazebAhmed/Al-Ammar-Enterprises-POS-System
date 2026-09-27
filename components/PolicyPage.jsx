import Link from "next/link";

export default function PolicyPage({ eyebrow, title, intro, sections, other }) {
  return (
    <main className="page-wrap policy-page">
      <div className="page-heading">
        <span className="eyebrow">{eyebrow}</span>
        <h1>
          {title}
          <span className="gold-dot">.</span>
        </h1>
        <p>{intro}</p>
      </div>
      <div className="policy-sections">
        {sections.map((section, i) => (
          <section className="policy-section" key={section.title}>
            <span className="policy-number">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <h2>{section.title}</h2>
              <ul>
                {section.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </div>
          </section>
        ))}
      </div>
      <p className="policy-other">
        See also: <Link href={other.href}>{other.label}</Link>
      </p>
    </main>
  );
}
