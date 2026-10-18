import { useEffect, useRef } from "react";
import { archivalFilms, classicFilms, destinations, films, openFilms } from "../data/catalog";
import { approvedLiveChannels } from "../data/liveTVAdapter";
import { safeHttpsUrl, sources } from "../media/providers";
import Icon from "../ui/Icon";
import { useStartupReady } from "../ui/StartupContext";
import TitleDetails from "./TitleDetails";
import "./InfoDialog.css";

function creditSections() {
  return [
    {
      label: "Current collection",
      text: `${films.length} film selections, ${approvedLiveChannels.length} TV channels and ${destinations.length} Globe cameras in the public collection. Includes ${classicFilms.length} Chaplin entries, ${openFilms.length} Blender open films and ${archivalFilms.length} additional classic film editions. Retired and experimental streams are excluded from this public lineup.`,
    },
    {
      label: "Original editions",
      text: "The exact transfer, restoration and soundtrack rights of the original Chaplin editions have not been independently cleared. An uploader’s public-domain declaration does not establish the rights to every edition. Embedded availability and current programming are controlled by the source publisher.",
    },
    {
      label: "Classic library",
      text: "Additional classic editions come from the Library of Congress, Wikimedia Commons and Internet Archive. Their stored public-domain reviews are specific to the United States and the edition shown. Each title retains its source, artwork credit and edition notes in its information panel.",
      links: [
        { label: "Library of Congress", href: "https://www.loc.gov/film-and-videos/" },
        { label: "Wikimedia Commons", href: "https://commons.wikimedia.org/" },
        { label: "Internet Archive", href: "https://archive.org/" },
      ],
    },
    ...openFilms.map((film) => ({
      label: film.title,
      text:
        film.attribution +
        "\nLicense: " +
        film.license +
        ". The full original film and its end credits are retained.",
      links: [
        { label: `${film.title} source`, href: sources[film.sourceId]?.providerUrl || film.providerUrl },
        { label: `${film.title} license`, href: sources[film.sourceId]?.permissionUrl },
      ],
    })),
    {
      label: "Live TV",
      text: "TV from the Danish Parliament — Folketinget (Danish Parliament), under its recorded reuse license. The complete, unchanged license and broadcaster credit remain alongside its viewing experience.\n\nUN Web TV — United Nations, Department of Global Communications, through its official Kaltura player. Provider controls, notices and branding are retained. Use remains subject to the broadcaster’s conditions and does not imply endorsement.",
      links: [
        { label: "Danish Parliament license", href: "https://www.ft.dk/aktuelt/tv-fra-folketinget/deling-og-rettigheder" },
        { label: "UN Web TV official source", href: "https://webtv.un.org/en" },
      ],
    },
    {
      label: "Globe",
      text: "Alveus Sanctuary supplies the Central Texas sanctuary cameras. Lights Over Lapland AB supplies the Abisko National Park camera in Sweden. Both use the official Twitch player, with its branding, controls and advertisements preserved. Camera availability and programming are controlled by the broadcasters. Functional embedding does not grant separate promotional-use permission.",
      links: [
        { label: "Alveus Sanctuary", href: "https://www.alveussanctuary.org/" },
        { label: "Lights Over Lapland", href: "https://lightsoverlapland.com/aurora-webcam/" },
        { label: "Twitch embed documentation", href: "https://dev.twitch.tv/docs/embed/" },
        { label: "Twitch developer terms", href: "https://legal.twitch.com/legal/developer-agreement" },
      ],
    },
    {
      label: "Artwork",
      text: `The ${classicFilms.length} Chaplin entries use authentic period posters, advertisements, archival stills and frames from the actual historical films. Each title retains its artwork credit. Reviewed images retain their source-specific U.S. public-domain statements; worldwide clearance is not asserted. Missing artwork uses a distinct Krispy title card, identified as a fallback. Poster and film-edition rights remain separate.`,
      links: [
        { label: "Library of Congress poster record", href: "https://www.loc.gov/item/92510098/" },
        { label: "Wikimedia Commons artwork sources", href: "https://commons.wikimedia.org/" },
      ],
    },
    {
      label: "Blender artwork",
      text: "Film posters: Blender Foundation / Blender Institute. Sintel concept artwork: David Revoy, CC BY 3.0. Elephants Dream poster: Bassam Kurdali and Andy Goralczyk, CC BY 4.0. Cosmos Laundromat poster: Andy Goralczyk, CC BY 4.0. Big Buck Bunny and Tears of Steel posters: CC BY 3.0.\n\nBig Buck Bunny’s featured image: © 2008 Blender Foundation / www.bigbuckbunny.org, CC BY 3.0. The original 1920 × 1080 image is retained unchanged; its display is cropped to fit the banner. Other local artwork copies may be resized for display.",
      links: [
        { label: "Big Buck Bunny artwork gallery", href: "https://peach.blender.org/media-gallery/" },
        { label: "Big Buck Bunny artwork license", href: "https://peach.blender.org/about/" },
      ],
    },
    {
      label: "TV and Globe artwork",
      text: "TV covers are Krispy original illustrations of Christiansborg Palace in Copenhagen and United Nations headquarters in New York. Globe cards use Krispy location illustrations for Alveus Sanctuary and Abisko. These illustrations identify the destinations; they are not institutional logos, broadcaster promotional artwork or live camera stills.",
    },
    {
      label: "Your data",
      text: "Email and password accounts are managed by Firebase Authentication. Favorites require login. Each account has its own saved titles, recently opened items and compatible playback progress stored in this browser; these lists do not sync to another device. Logout hides the account's list without changing it. Guest playback history stays separate. Clearing browser storage removes local lists and the saved login, but does not delete your Firebase account. Earlier browser-only profile records are preserved separately and are not used to sign in.",
    },
  ];
}

export default function InfoDialog({ item = null, onClose, modal = true }) {
  const startupReady = useStartupReady();
  const dialogRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    if (modal && typeof dialog.showModal === "function") dialog.showModal();
    else if (!modal && typeof dialog.show === "function") dialog.show();
    else dialog.setAttribute("open", "");
    document.body.style.overflow = "hidden";
    return () => {
      if (dialog.open && typeof dialog.close === "function") dialog.close();
      document.body.style.overflow = previousOverflow;
      window.requestAnimationFrame(() => {
        const active = document.activeElement;
        if (
          previousFocus?.isConnected &&
          !document.querySelector("dialog[open]") &&
          (!active ||
            active === document.body ||
            !active.isConnected ||
            dialog.contains(active))
        )
          previousFocus.focus?.();
      });
    };
  }, [modal]);

  useEffect(() => {
    if (startupReady) closeRef.current?.focus();
  }, [modal, startupReady]);

  const close = (event) => {
    event?.preventDefault();
    event?.stopPropagation();
    onClose?.();
  };
  const handleKey = (event) => {
    if (event.key === "Escape") {
      close(event);
      return;
    }
    if (event.key !== "Tab" || !modal) return;
    const controls = [
      ...dialogRef.current.querySelectorAll(
        "button:not(:disabled), a[href], [tabindex='0']",
      ),
    ];
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (
      event.shiftKey &&
      (document.activeElement === first ||
        !dialogRef.current.contains(document.activeElement))
    ) {
      event.preventDefault();
      last?.focus();
    } else if (
      !event.shiftKey &&
      (document.activeElement === last ||
        !dialogRef.current.contains(document.activeElement))
    ) {
      event.preventDefault();
      first?.focus();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="experience-info"
      aria-label={
        item
          ? "About " + (item.title || item.original?.name || "this title")
          : "Credits"
      }
      aria-modal={modal ? true : undefined}
      onCancel={close}
      onKeyDown={handleKey}
    >
      <div className="experience-info-sheet">
        <header className="experience-info-header">
          {item ? (
            <span className="experience-info-label">Information</span>
          ) : (
            <h1>Credits</h1>
          )}
          <button
            ref={closeRef}
            type="button"
            aria-label="Close information"
            onClick={close}
          >
            <Icon name="close" size={24} />
          </button>
        </header>
        <div
          className="experience-info-content"
          role="region"
          aria-label={item ? "Information content" : "Credits content"}
          tabIndex={0}
        >
          {item ? (
            <TitleDetails item={item} />
          ) : (
            <div className="experience-credit-sections">
              {creditSections().map(({ label, text, links }, index) => (
                <section key={label + index}>
                  <h2>{label}</h2>
                  <p>{text}</p>
                  {links && <ul className="experience-credit-links">
                    {links.map(({ label: linkLabel, href }) => {
                      const url = safeHttpsUrl(href);
                      return url ? <li key={linkLabel}>
                        <a href={url} target="_blank" rel="noopener noreferrer">
                          {linkLabel}<span className="sr-only"> (opens in a new tab)</span>
                        </a>
                      </li> : null;
                    })}
                  </ul>}
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}
