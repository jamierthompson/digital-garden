/**
 * The site's logo mark — a line-drawn tulip. A single-color SVG painting `currentColor`, so the
 * `Logo` link's ink states color it; sized by the module's `--logo-size` token, so it carries no
 * width or height attributes.
 */
export default function TulipMark(): React.ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <g transform="translate(0.6 1.3) scale(0.95)">
        <path d="M16.2 6c0 3.25-1.88 5.9-4.2 5.9S7.8 9.25 7.8 6c0-2.5 2.2-4.6 3.4-5.5.47-.36 1.13-.36 1.6 0 1.2.9 3.4 3 3.4 5.5Z" />
        <path d="M12 11.9c2.53 0 4.6-3.05 4.6-6.8 0-1.02-.16-2.03-.47-3a.42.42 0 0 0-.58-.27C13.53 2.4 12 5.2 12 8.6Z" />
        <path d="M12 11.9c-2.53 0-4.6-3.05-4.6-6.8 0-1.02.16-2.03.47-3a.42.42 0 0 1 .58-.27C10.47 2.4 12 5.2 12 8.6Z" />
        <path d="M12 11.9V21.5" />
        <path d="M12 21.5c.3-2.5.8-5.2 2.1-6.9 1.8-2.3 4.7-3.6 7.2-4.2-.9 1.8-2.3 3.6-3.8 4.5-3.5 2-5.2 3.1-5.5 6.6Z" />
        <path d="M12 21.5c-.3-2.5-.8-5.2-2.1-6.9-1.8-2.3-4.7-3.6-7.2-4.2.9 1.8 2.3 3.6 3.8 4.5 3.5 2 5.2 3.1 5.5 6.6Z" />
      </g>
    </svg>
  );
}
