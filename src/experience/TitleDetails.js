import { getItemSections } from "./itemDetailsModel";
import { safeHttpsUrl } from "../media/providers";
import "./TitleDetails.css";

const noteLabels = new Set(["Cast", "Filming locations"]);
const creditLabels = new Set(["Artwork", "Attribution", "License"]);

function Facts({ sections, className }) {
  if (!sections.length) return null;
  return (
    <dl className={className}>
      {sections.map(({ label, text }) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{text}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function TitleDetails({ item, titleAction = null }) {
  const permission = item?.type === "channel" ? item.metadata?.playback?.permission : null;
  const fullLicense = typeof permission?.fullLicenseText === "string" && permission.fullLicenseText.trim()
    ? permission.fullLicenseText : null;
  const officialLicense = safeHttpsUrl(permission?.fullLicenseUrl || item?.licenseUrl);
  const supplied = getItemSections(item).filter(
    ({ label }) => label !== "Title",
  );
  const sections = supplied.length ? supplied : getItemSections(null);
  const story = sections.find(({ label }) => label === "Story");
  const notes = sections.filter(({ label }) => noteLabels.has(label));
  const trivia = sections.filter(({ label }) =>
    /^Trivia(?: \d+)?$/.test(label),
  );
  const credits = sections.filter(({ label }) =>
    creditLabels.has(label) && !(fullLicense && label === "License"),
  );
  const facts = sections.filter(
    ({ label }) =>
      label !== "Story" &&
      !noteLabels.has(label) &&
      !creditLabels.has(label) &&
      !/^Trivia(?: \d+)?$/.test(label),
  );

  return (
    <section className="title-details" aria-label="Title details" tabIndex={0}>
      <div className="title-details-heading">
        <h1 className="title-details-title">
          {item?.title || item?.original?.name || "Information"}
        </h1>
        {titleAction}
      </div>
      {story && (
        <section className="title-description" aria-label="Description">
          <p>{story.text}</p>
        </section>
      )}
      <Facts sections={facts} className="title-details-facts" />
      {(notes.length > 0 || trivia.length > 0) && (
        <div className="title-details-notes">
          {notes.map(({ label, text }) => (
            <section key={label} aria-label={label}>
              <h2>{label}</h2>
              <p>{text}</p>
            </section>
          ))}
          {trivia.length > 0 && (
            <section className="title-details-trivia" aria-label="Trivia">
              <h2>Trivia</h2>
              <ol>
                {trivia.map(({ label, text }) => (
                  <li key={label}>{text}</li>
                ))}
              </ol>
            </section>
          )}
        </div>
      )}
      <Facts sections={credits} className="title-details-credits" />
      {fullLicense ? (
        <section className="title-license-rights" aria-label="License & Rights">
          <div className="title-license-header">
            <h2>License &amp; Rights</h2>
            {officialLicense && (
              <a href={officialLicense} target="_blank" rel="noopener noreferrer">
                Official license<span className="sr-only"> (opens in a new tab)</span>
              </a>
            )}
          </div>
          <details key={item.id || item.title}>
            <summary>Read the complete license</summary>
            <div className="title-license-text" role="region" aria-label="Complete license text" tabIndex={0}>
              {fullLicense}
            </div>
          </details>
        </section>
      ) : safeHttpsUrl(item?.licenseUrl) && (
        <a
          className="title-license-link"
          href={safeHttpsUrl(item.licenseUrl)}
          target="_blank"
          rel="noopener noreferrer"
        >
          Source and licence
        </a>
      )}
    </section>
  );
}
